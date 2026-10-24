#!/usr/bin/env ts-node
/**
 * Backfill de datas de eventos para a política de fuso America/Sao_Paulo (D3).
 *
 * DRY-RUN POR PADRÃO: sem `--apply` nada é escrito. Veja
 * docs/runbooks/datas-e-fuso-horario.md.
 *
 * Para cada evento, recalcula início/fim a partir do payload ORIGINAL em
 * `event_sources.rawPayload` (a fonte do evento, ou a primeira vista) e compara
 * com o gravado em `events`. Só atualiza `dataInicio`/`dataFim`; NÃO recalcula
 * `dedupHash` (hash antigo continua único; o casamento fuzzy por identidade
 * cobre reingestões).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../src/data-source';
import { Event } from '../src/entities/events.entity';
import { EventSource } from '../src/entities/event-source.entity';
import { classifyEventDateBackfill, DateBackfillClass } from '../src/evento/event-date-backfill';
import { saoPauloDayBounds, todaySaoPauloDateKey, addDaysToDateKey } from '../src/common/sp-date';

type Scope = 'day' | 'instant';

interface CliOptions {
  help: boolean;
  apply: boolean;
  scope: Scope;
  limit: number;
  includePast: boolean;
  source?: string;
  csv?: string;
  utcNaiveSources: string[];
  batchSize: number;
}

function usage(): string {
  return `Uso: npm run backfill:event-dates -- [opções]   (dry-run por padrão)

  --apply                    grava as correções (sem isso, só lista)
  --scope=day|instant        day (padrão): só eventos cujo DIA de São Paulo muda;
                             instant: também os que só mudam de horário
  --source=<nome>            restringe a uma fonte (events.source)
  --include-past             inclui eventos já ocorridos (padrão: de ontem em diante)
  --limit=<n>                máximo de eventos examinados (padrão 50000)
  --utc-naive-sources=a,b    fontes cujo texto sem offset era UTC no legado (padrão: api-football)
  --csv=<arquivo>            grava o relatório linha a linha
  --help`;
}

function parseArgs(argv: string[]): CliOptions {
  const o: CliOptions = {
    help: false,
    apply: false,
    scope: 'day',
    limit: 50_000,
    includePast: false,
    utcNaiveSources: ['api-football'],
    batchSize: 200,
  };
  for (const arg of argv) {
    const [key, value] = arg.split('=');
    if (key === '--help' || key === '-h') o.help = true;
    else if (key === '--apply') o.apply = true;
    else if (key === '--include-past') o.includePast = true;
    else if (key === '--scope') {
      if (value !== 'day' && value !== 'instant') throw new Error('--scope deve ser day ou instant');
      o.scope = value;
    } else if (key === '--source') o.source = value;
    else if (key === '--csv') o.csv = value;
    else if (key === '--limit') o.limit = Math.max(1, Number(value) || o.limit);
    else if (key === '--utc-naive-sources') o.utcNaiveSources = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else throw new Error(`argumento desconhecido: ${arg}`);
  }
  return o;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  await AppDataSource.initialize();
  try {
    const eventRepo = AppDataSource.getRepository(Event);
    const sourceRepo = AppDataSource.getRepository(EventSource);

    const qb = eventRepo.createQueryBuilder('e').orderBy('e.dataInicio', 'ASC').take(options.limit);
    if (!options.includePast) {
      qb.where('e.dataInicio >= :from', { from: saoPauloDayBounds(addDaysToDateKey(todaySaoPauloDateKey(), -1)).start });
    }
    if (options.source) qb.andWhere('e.source = :source', { source: options.source });
    const events = await qb.getMany();

    const counts: Record<DateBackfillClass, number> = {
      unchanged: 0,
      instant_shift: 0,
      day_shift: 0,
      no_raw_payload: 0,
      unparseable: 0,
    };
    const rows: string[] = ['id,source,nome,classification,storedStart,expectedStart,storedDay,expectedDay'];
    const toApply: Array<{ id: string; start: Date; end: Date }> = [];
    const sample: string[] = [];

    for (const event of events) {
      const sources = await sourceRepo.find({ where: { eventId: event.id }, order: { firstSeenAt: 'ASC' } });
      const primary = sources.find((s) => s.source === event.source) ?? sources[0];
      const raw = (primary?.rawPayload ?? {}) as { dataInicio?: unknown; dataFim?: unknown };

      const decision = classifyEventDateBackfill({
        storedStart: event.dataInicio,
        storedEnd: event.dataFim ?? null,
        source: event.source ?? primary?.source ?? null,
        rawStart: raw.dataInicio,
        rawEnd: raw.dataFim,
        utcNaiveSources: options.utcNaiveSources,
      });
      counts[decision.classification]++;

      const changes = decision.classification === 'day_shift' || decision.classification === 'instant_shift';
      if (!changes) continue;

      const line = [
        event.id,
        event.source ?? '',
        JSON.stringify(event.nome ?? ''),
        decision.classification,
        event.dataInicio.toISOString(),
        decision.expectedStart!.toISOString(),
        decision.storedDayKey,
        decision.expectedDayKey,
      ].join(',');
      rows.push(line);
      if (sample.length < 25) sample.push(line);

      if (decision.classification === 'day_shift' || options.scope === 'instant') {
        toApply.push({ id: event.id, start: decision.expectedStart!, end: decision.expectedEnd! });
      }
    }

    process.stdout.write(`Eventos examinados: ${events.length}\n`);
    for (const [name, n] of Object.entries(counts)) process.stdout.write(`  ${name.padEnd(15)} ${n}\n`);
    process.stdout.write(`Candidatos à correção (scope=${options.scope}): ${toApply.length}\n`);
    if (sample.length) {
      process.stdout.write(`\nAmostra (${sample.length}):\n${rows[0]}\n${sample.join('\n')}\n`);
    }
    if (options.csv) {
      fs.writeFileSync(options.csv, `${rows.join('\n')}\n`, 'utf8');
      process.stdout.write(`\nCSV: ${path.resolve(options.csv)}\n`);
    }

    if (!options.apply) {
      process.stdout.write('\nDRY-RUN: nada foi gravado. Use --apply para aplicar (faça backup antes).\n');
      return;
    }

    let updated = 0;
    for (let i = 0; i < toApply.length; i += options.batchSize) {
      const batch = toApply.slice(i, i + options.batchSize);
      await AppDataSource.transaction(async (manager) => {
        for (const item of batch) {
          await manager.update(Event, { id: item.id }, { dataInicio: item.start, dataFim: item.end });
        }
      });
      updated += batch.length;
      process.stdout.write(`  aplicados ${updated}/${toApply.length}\n`);
    }
    process.stdout.write(`\nAPLICADO: ${updated} eventos atualizados (dataInicio/dataFim). dedupHash não foi alterado.\n`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
