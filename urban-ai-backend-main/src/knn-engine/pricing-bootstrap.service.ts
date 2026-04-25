import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { UrbanAIPricingEngine } from './pricing-engine';

/**
 * F6.1 Tier 1 — Bootstrap do motor de pricing.
 *
 * Hoje o `UrbanAIPricingEngine` tem um método `initialize(properties)` que
 * treina o `PropertyClassifier` com dados de imóveis, mas **nunca era chamado
 * em produção** — todo imóvel caía no fallback Standard. Este service:
 *
 *  1. **No boot** (OnModuleInit): coleta TODOS os imóveis cadastrados e treina
 *     o classificador com features básicas (lat, lng, metroDistance, amenitiesCount).
 *     Aceitamos features faltantes (default 0.5/1) — o KNN é tolerante.
 *
 *  2. **Cron semanal** (`0 4 * * 0` — domingo 04:00 BRT): re-treina depois que
 *     o pipeline de scraping terminou de atualizar a tabela `event` na semana.
 *
 * Idempotente — pode ser chamado N vezes sem efeito colateral além do retreino.
 *
 * Próximos passos (F6.1 Tier 1 completo):
 *  - Resolver lat/lng automaticamente para imóveis sem coordenada
 *  - Calcular metroDistance via cost-matrix
 *  - Estimar amenitiesCount via Gemini sobre o título do anúncio
 *
 * Ver `docs/runbooks/feature-engineering.md` para o pipeline completo.
 */
@Injectable()
export class PricingBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PricingBootstrapService.name);

  constructor(
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    private readonly engine: UrbanAIPricingEngine,
  ) {}

  async onModuleInit() {
    // Default: ativar bootstrap em prod e staging; pular em dev/test para
    // não bloquear o start em ambientes locais sem DB populado.
    if (process.env.PRICING_BOOTSTRAP_ON_BOOT === 'false') {
      this.logger.log('PricingBootstrap pulado (PRICING_BOOTSTRAP_ON_BOOT=false)');
      return;
    }

    try {
      await this.train();
    } catch (err) {
      // Não derruba o backend se o bootstrap falhar — caímos no fallback Standard.
      this.logger.warn(
        `PricingBootstrap.onModuleInit falhou (segue com fallback): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Cron domingo 04:00 BRT — re-treina depois do scraping da semana.
   * Mantida fora do `onModuleInit` para que o restart não force retreino
   * desnecessário a cada deploy.
   */
  @Cron('0 4 * * 0', { name: 'pricing-retrain', timeZone: 'America/Sao_Paulo' })
  async handleWeeklyRetrain() {
    this.logger.log('Iniciando retreino semanal do PricingEngine...');
    try {
      await this.train();
    } catch (err) {
      this.logger.error(
        `Retreino semanal falhou: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Coleta imóveis com lat/lng resolvidos e treina o classificador.
   *
   * Filtros:
   *  - Address.list NOT NULL (precisa estar associado a uma listing)
   *  - Address.latitude e longitude presentes (pulamos os ainda não geocodificados;
   *    o pipeline de feature engineering resolve em paralelo)
   */
  async train(): Promise<{ count: number }> {
    const rows = await this.addressRepo.find({ relations: ['list'] });
    const properties = rows
      .filter((a: any) => a.latitude != null && a.longitude != null)
      .map((a: any) => ({
        id: a.id,
        lat: Number(a.latitude),
        lng: Number(a.longitude),
        // Features ausentes recebem default seguro (KNN tolera).
        // Quando a F6.1 Tier 1 fechar, esses campos virão preenchidos
        // pelo pipeline de feature engineering.
        metroDistance: Number((a as any).metroDistance ?? 0.5),
        amenitiesCount: Number((a as any).amenitiesCount ?? 1),
        category: Number((a as any).category ?? 1),
      }));

    if (properties.length === 0) {
      this.logger.warn(
        'Nenhum imóvel com coordenadas para treinar — engine fica no fallback Standard.',
      );
      return { count: 0 };
    }

    this.engine.initialize(properties);
    this.logger.log(`PricingEngine treinado com ${properties.length} imóveis.`);
    return { count: properties.length };
  }
}
