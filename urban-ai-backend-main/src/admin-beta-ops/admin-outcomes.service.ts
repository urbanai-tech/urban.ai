import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AnalisePreco } from '../entities/AnalisePreco';
import { buildOutcomesComparison, DEFAULT_MIN_SAMPLE, OutcomesComparison } from './outcomes-comparison';

const MAX_ROWS = 1000;

export type OutcomesComparisonResult = OutcomesComparison & {
  generatedAt: string;
  /** Recomendações aplicadas ainda sem resultado: o quanto falta coletar. */
  appliedWithoutOutcome: number;
  appliedTotal: number;
  /** Linhas devolvidas foram cortadas em `limit`. */
  truncated: boolean;
};

/**
 * Painel admin v1 x v2: lê só `analise_preco` (preço v1 em `precoSugerido`, v2 em sombra em
 * `shadowV2Preco`, `precoAplicado` e os campos de resultado que o anfitrião registra).
 */
@Injectable()
export class AdminOutcomesService {
  constructor(@InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>) {}

  async comparison(options: { limit?: number } = {}, now = new Date()): Promise<OutcomesComparisonResult> {
    const limit = Math.min(Math.max(Math.floor(Number(options.limit) || MAX_ROWS), 1), MAX_ROWS);
    const rows = await this.analiseRepo.find({
      where: { precoAplicado: Not(IsNull()), resultadoRegistradoEm: Not(IsNull()) },
      relations: ['endereco', 'endereco.list', 'evento', 'usuarioProprietario'],
      order: { resultadoRegistradoEm: 'DESC' },
      take: limit + 1,
    });
    const [appliedTotal, appliedWithoutOutcome] = await Promise.all([
      this.analiseRepo.count({ where: { precoAplicado: Not(IsNull()) } }),
      this.analiseRepo.count({ where: { precoAplicado: Not(IsNull()), resultadoRegistradoEm: IsNull() } }),
    ]);

    const truncated = rows.length > limit;
    const minSample = this.resolveMinSample();
    const comparison = buildOutcomesComparison(rows.slice(0, limit), minSample);
    return {
      ...comparison,
      generatedAt: now.toISOString(),
      appliedTotal,
      appliedWithoutOutcome,
      truncated,
    };
  }

  private resolveMinSample(): number {
    const parsed = Number(process.env.OUTCOMES_COMPARISON_MIN_SAMPLE);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_MIN_SAMPLE;
  }
}
