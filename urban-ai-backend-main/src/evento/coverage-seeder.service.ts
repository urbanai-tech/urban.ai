import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoverageRegion } from '../entities/coverage-region.entity';

/**
 * Seed do mapa de cobertura inicial.
 *
 * No boot do servidor, garante que existe pelo menos a região "Grande São Paulo"
 * com status `active` (raio 80km do marco zero da Sé). Sem isso, o motor
 * acabava de subir com cobertura zero (todos eventos viravam outOfScope).
 *
 * Idempotente: só cria se a tabela `coverage_regions` está vazia.
 */
@Injectable()
export class CoverageSeederService {
  private readonly logger = new Logger(CoverageSeederService.name);

  // Marco zero de SP — Praça da Sé
  private readonly SE_LAT = -23.5505;
  private readonly SE_LNG = -46.6333;

  constructor(
    @InjectRepository(CoverageRegion)
    private readonly regionRepo: Repository<CoverageRegion>,
  ) {}

  async seedDefaultIfEmpty(): Promise<void> {
    try {
      const count = await this.regionRepo.count();
      if (count > 0) {
        this.logger.debug(`coverage_regions já tem ${count} entradas — seed não roda.`);
        return;
      }

      const greaterSp = this.regionRepo.create({
        name: 'Grande São Paulo',
        status: 'active',
        centerLat: this.SE_LAT,
        centerLng: this.SE_LNG,
        radiusKm: 80,
        notes:
          'Cobertura default no go-live. Raio 80km do marco zero (Praça da Sé) — ' +
          'cobre SP capital + ABC + Guarulhos + Osasco + Cotia. ' +
          'Pode ser ajustada/substituída pelo admin a qualquer momento.',
      });

      await this.regionRepo.save(greaterSp);
      this.logger.log(
        '✅ coverage_regions seedada com "Grande São Paulo" (raio 80km da Sé).',
      );
    } catch (err) {
      // Falha de seed não derruba o boot — pode ser DB ainda subindo
      this.logger.warn(
        `Não conseguiu rodar seed de coverage_regions agora (segue sem bloquear boot): ${err}`,
      );
    }
  }
}
