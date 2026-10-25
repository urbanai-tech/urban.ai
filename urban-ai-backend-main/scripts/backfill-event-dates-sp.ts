#!/usr/bin/env ts-node
/**
 * Backfill de datas de eventos para a política de fuso America/Sao_Paulo (D3).
 *
 * DRY-RUN POR PADRÃO: sem `--apply` nada é escrito. Veja
 * docs/runbooks/datas-e-fuso-horario.md.
 *
 * Para cada evento, recalcula início/fim a partir do payload ORIGINAL em
 * `event_sources.rawPayload` (a fonte do evento, ou a primeira vista) e compara
 * com o gravado em `events`. Atualiza `dataInicio`/`dataFim` e, quando o DIA de
 * São Paulo muda, recalcula o `dedupHash` com a mesma fórmula do ingest. Se o
 * hash novo já pertence a outro evento (colisão), o hash NÃO é sobrescrito: as
 * datas são corrigidas e um `EventDedupCandidate` é registrado para revisão do
 * admin (no dry-run só é contado).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../src/data-source';
import { Event } from '../src/entities/events.entity';
import { EventSource } from '../src/entities/event-source.entity';
import { EventDedupCandidate } from '../src/entities/event-dedup-candidate.entity';
import {
  classifyEventDateBackfill,
  DateBackfillClass,
  HashRecomputeAction,
  HashRecomputeDecision,
  planDedupHashRecompute,
  recordBackfillHashCollision,
} from '../src/evento/event-date-backfill';
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

interface PlannedChange {
  event: Event;
  classification: DateBackfillClass;
  expectedStart: Date;
  expectedEnd: Date;
  storedDay: string;
  expectedDay: string;
  apply: boolean;
  hash?: HashRecomputeDecision;
}

function toHashEvent(event: Event) {
  return {
    id: event.id,
    nome: event.nome ?? '',
    enderecoCompleto: event.enderecoCompleto ?? null,
    latitude: event.latitude as unknown as number | string | null,
    longitude: event.longitude as unknown as number | string | null,
    dedupHash: event.dedupHash ?? null,
    storedStart: event.dataInicio,
  };
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
    const candidateRepo = AppDataSource.getRepository(EventDedupCandidate);

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
    const changes: PlannedChange[] = [];

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

      if (decision.classification !== 'day_shift' && decision.classification !== 'instant_shift') continue;
      changes.push({
        event,
        classification: decision.classification,
        expectedStart: decision.expectedStart!,
        expectedEnd: decision.expectedEnd!,
        storedDay: decision.storedDayKey!,
        expectedDay: decision.expectedDayKey!,
        apply: decision.classification === 'day_shift' || options.scope === 'instant',
      });
    }

    // dedupHash: planejado por evento a corrigir (só muda quando o dia de SP muda).
    const plannedHashes = new Map<string, string>();
    const hashCounts: Record<HashRecomputeAction, number> = {
      no_hash: 0,
      day_unchanged: 0,
      already_current: 0,
      update: 0,
      collision: 0,
    };
    for (const change of changes) {
      if (!change.apply) continue;
      const hashEvent = toHashEvent(change.event);
      const probe = planDedupHashRecompute({ event: hashEvent, expectedStart: change.expectedStart });
      let holderEventId: string | null = null;
      if (probe.action === 'update') {
        const holder = await eventRepo.findOne({ where: { dedupHash: probe.newHash }, select: ['id'] });
        holderEventId = holder?.id ?? null;
      }
      change.hash = planDedupHashRecompute({
        event: hashEvent,
        expectedStart: change.expectedStart,
        holderEventId,
        plannedHashes,
      });
      hashCounts[change.hash.action]++;
      if (change.hash.action === 'update') plannedHashes.set(change.hash.newHash!, change.event.id);
    }

    const rows: string[] = [
      'id,source,nome,classification,storedStart,expectedStart,storedDay,expectedDay,hashAction,oldHash,newHash,collidesWithEventId',
    ];
    const sample: string[] = [];
    for (const change of changes) {
      const h = change.hash;
      const line = [
        change.event.id,
        change.event.source ?? '',
        JSON.stringify(change.event.nome ?? ''),
        change.classification,
        change.event.dataInicio.toISOString(),
        change.expectedStart.toISOString(),
        change.storedDay,
        change.expectedDay,
        h?.action ?? (change.apply ? '' : 'fora_do_escopo'),
        h?.oldHash ?? '',
        h?.newHash ?? '',
        h?.holderEventId ?? '',
      ].join(',');
      rows.push(line);
      if (sample.length < 25) sample.push(line);
    }
    const toApply = changes.filter((c) => c.apply);

    process.stdout.write(`Eventos examinados: ${events.length}\n`);
    for (const [name, n] of Object.entries(counts)) process.stdout.write(`  ${name.padEnd(15)} ${n}\n`);
    process.stdout.write(`Candidatos à correção (scope=${options.scope}): ${toApply.length}\n`);
    process.stdout.write('dedupHash dos candidatos:\n');
    process.stdout.write(`  ${'a recalcular'.padEnd(15)} ${hashCounts.update}\n`);
    process.stdout.write(`  ${'colisões'.padEnd(15)} ${hashCounts.collision}  (hash NÃO sobrescrito; vira EventDedupCandidate p/ revisão)\n`);
    process.stdout.write(`  ${'já correto'.padEnd(15)} ${hashCounts.already_current}\n`);
    process.stdout.write(`  ${'dia não muda'.padEnd(15)} ${hashCounts.day_unchanged}\n`);
    process.stdout.write(`  ${'sem hash'.padEnd(15)} ${hashCounts.no_hash}\n`);
    if (sample.length) {
      process.stdout.write(`\nAmostra (${sample.length}):\n${rows[0]}\n${sample.join('\n')}\n`);
    }
    if (options.csv) {
      fs.writeFileSync(options.csv, `${rows.join('\n')}\n`, 'utf8');
      process.stdout.write(`\nCSV: ${path.resolve(options.csv)}\n`);
    }

    if (!options.apply) {
      process.stdout.write(
        `\nDRY-RUN: nada foi gravado. Com --apply: ${toApply.length} eventos corrigidos, ${hashCounts.update} dedupHash recalculados, ` +
          `${hashCounts.collision} candidatos de dedup registrados para revisão. Faça backup antes.\n`,
      );
      return;
    }

    let updated = 0;
    let hashesUpdated = 0;
    for (let i = 0; i < toApply.length; i += options.batchSize) {
      const batch = toApply.slice(i, i + options.batchSize);
      await AppDataSource.transaction(async (manager) => {
        for (const item of batch) {
          const patch: Partial<Event> = { dataInicio: item.expectedStart, dataFim: item.expectedEnd };
          if (item.hash?.action === 'update') patch.dedupHash = item.hash.newHash!;
          await manager.update(Event, { id: item.event.id }, patch);
          if (item.hash?.action === 'update') hashesUpdated++;
        }
      });
      updated += batch.length;
      process.stdout.write(`  aplicados ${updated}/${toApply.length}\n`);
    }
    let candidatesCreated = 0;
    let candidatesExisting = 0;
    for (const item of toApply) {
      if (item.hash?.action !== 'collision' || !item.hash.holderEventId) continue;
      const result = await recordBackfillHashCollision(candidateRepo, item.hash.holderEventId, item.event.id);
      if (result === 'created') candidatesCreated++;
      else candidatesExisting++;
    }
    process.stdout.write(
      `\nAPLICADO: ${updated} eventos com dataInicio/dataFim atualizados; ${hashesUpdated} dedupHash recalculados; ` +
        `${hashCounts.collision} colisões de hash (hash preservado): ${candidatesCreated} candidatos criados, ${candidatesExisting} já existiam.\n`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
