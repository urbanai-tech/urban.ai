import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CollectorAlertKind, CollectorAlertState } from '../entities/collector-alert-state.entity';

/**
 * Estado dos alertas de fonte de eventos, persistido em `collector_alert_state` para sobreviver a
 * reinício/deploy (antes o realerta do zero-yield vivia só em memória e o alerta reenviava a cada
 * deploy). Se a tabela não existir ainda (migration pendente) ou o banco falhar, cai para memória:
 * o alerta nunca deixa de sair por causa do estado.
 */
@Injectable()
export class CollectorAlertStateService {
  private readonly logger = new Logger(CollectorAlertStateService.name);
  private readonly memory = new Map<string, { firstExpectedAt: Date | null; lastAlertAt: Date | null }>();

  constructor(@InjectRepository(CollectorAlertState) private readonly repo: Repository<CollectorAlertState>) {}

  private key(source: string, kind: CollectorAlertKind) {
    return `${kind}:${source}`;
  }

  private fail(action: string, error: any) {
    this.logger.warn(`Estado de alertas (${action}) indisponível, usando memória: ${error?.message}`);
  }

  /** source -> último alerta (ms epoch) do tipo `kind`. */
  async lastAlerts(kind: CollectorAlertKind): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    try {
      const rows = await this.repo.find({ where: { kind } });
      for (const r of rows) if (r.lastAlertAt) out.set(r.source, new Date(r.lastAlertAt).getTime());
    } catch (error) {
      this.fail('ler', error);
    }
    for (const [k, v] of this.memory) {
      if (k.startsWith(`${kind}:`) && v.lastAlertAt) {
        const source = k.slice(kind.length + 1);
        out.set(source, Math.max(out.get(source) ?? 0, v.lastAlertAt.getTime()));
      }
    }
    return out;
  }

  async markAlerted(kind: CollectorAlertKind, sources: string[], at: Date): Promise<void> {
    if (sources.length === 0) return;
    for (const source of sources) {
      const current = this.memory.get(this.key(source, kind));
      this.memory.set(this.key(source, kind), { firstExpectedAt: current?.firstExpectedAt ?? null, lastAlertAt: at });
    }
    try {
      await this.repo.upsert(
        sources.map((source) => ({ source, kind, lastAlertAt: at, updatedAt: at })),
        ['source', 'kind'],
      );
    } catch (error) {
      this.fail('gravar', error);
    }
  }

  /** Rearma o alerta (a fonte voltou a enviar / deixou de ser esperada). */
  async clear(kind: CollectorAlertKind, sources: string[]): Promise<void> {
    if (sources.length === 0) return;
    for (const source of sources) this.memory.delete(this.key(source, kind));
    try {
      await this.repo.delete({ kind, source: In(sources) });
    } catch (error) {
      this.fail('limpar', error);
    }
  }

  /** Leitura sem efeito colateral: só fontes com `firstExpectedAt` já gravado pelo cron. */
  async readExpected(sources: string[]): Promise<Map<string, Date>> {
    const out = new Map<string, Date>();
    try {
      const rows = await this.repo.find({ where: { kind: 'expected' } });
      for (const r of rows) if (r.firstExpectedAt && sources.includes(r.source)) out.set(r.source, new Date(r.firstExpectedAt));
    } catch (error) {
      this.fail('ler esperadas', error);
    }
    for (const [k, v] of this.memory) {
      if (k.startsWith('expected:') && v.firstExpectedAt) {
        const source = k.slice('expected:'.length);
        if (sources.includes(source) && !out.has(source)) out.set(source, v.firstExpectedAt);
      }
    }
    return out;
  }

  /**
   * Garante `firstExpectedAt` para cada fonte esperada (cria se faltar) e devolve o mapa. Fontes que
   * deixaram de ser esperadas (`stillExpected` não contém) são removidas: se a chave voltar, a
   * espera recomeça do zero.
   */
  async syncExpected(stillExpected: string[], now: Date): Promise<Map<string, Date>> {
    const result = new Map<string, Date>();
    let known = new Map<string, Date>();
    try {
      const rows = await this.repo.find({ where: { kind: 'expected' } });
      for (const r of rows) if (r.firstExpectedAt) known.set(r.source, new Date(r.firstExpectedAt));
    } catch (error) {
      this.fail('ler esperadas', error);
      known = new Map();
    }
    for (const [k, v] of this.memory) {
      if (k.startsWith('expected:') && v.firstExpectedAt) {
        const source = k.slice('expected:'.length);
        if (!known.has(source)) known.set(source, v.firstExpectedAt);
      }
    }

    const expectedSet = new Set(stillExpected);
    const toCreate: string[] = [];
    for (const source of stillExpected) {
      const existing = known.get(source);
      if (existing) {
        result.set(source, existing);
      } else {
        result.set(source, now);
        toCreate.push(source);
        this.memory.set(this.key(source, 'expected'), { firstExpectedAt: now, lastAlertAt: null });
      }
    }
    const stale = [...known.keys()].filter((s) => !expectedSet.has(s));

    try {
      if (toCreate.length > 0) {
        await this.repo.upsert(
          toCreate.map((source) => ({ source, kind: 'expected' as const, firstExpectedAt: now, updatedAt: now })),
          ['source', 'kind'],
        );
      }
    } catch (error) {
      this.fail('gravar esperadas', error);
    }
    await this.clear('expected', stale);
    return result;
  }
}
