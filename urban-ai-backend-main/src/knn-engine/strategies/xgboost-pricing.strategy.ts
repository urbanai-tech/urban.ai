import { Injectable, Logger } from '@nestjs/common';
import {
  PricingInput,
  PricingStrategy,
  PriceSuggestion,
} from '../pricing-strategy.interface';

/**
 * Skeleton da estratégia XGBoost (ADR 0008, F6.1 Tier 1+).
 *
 * Hoje:
 *  - `isReady()` retorna `false` — o modelo não foi carregado.
 *  - `suggestPrice()` joga um `Error` claro caso seja chamada por engano;
 *    isso protege o caller que sempre deve checar `isReady()` antes.
 *
 * Quando dataset estiver disponível (ver `docs/runbooks/dataset-acquisition.md`)
 * a implementação real fará uma de duas coisas:
 *
 *  A) Carregar artefato `.json` do XGBoost via npm `@dqbd/xgboost` ou WASM
 *     equivalente, mantendo inferência local no Node.
 *
 *  B) Quando o esforço de manter ML em Node começar a doer (provavelmente
 *     no Tier 2), extrair `pricing-engine` para um microserviço Python
 *     (FastAPI + xgboost + scikit) e este Strategy vira um HTTP client.
 *     Decisão será documentada num ADR novo (revisão do 0002 + 0008).
 *
 * Esta classe é o ponto de extensão. Quem implementar não precisa mexer
 * em `propriedade.service` ou `cron.service` — só plugar a estratégia.
 */
@Injectable()
export class XGBoostPricingStrategy implements PricingStrategy {
  public readonly name = 'xgboost';
  private readonly logger = new Logger(XGBoostPricingStrategy.name);
  private modelLoaded = false;

  isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Stub. Implementar quando o pipeline de treino entregar o artefato.
   * Convenção sugerida: artefato em `models/pricing-xgboost-v{N}.json`,
   * carregado por checksum + versão semântica.
   */
  async loadModel(_artifactPath: string): Promise<void> {
    this.logger.warn(
      `XGBoostPricingStrategy.loadModel é stub — sem artefato em ${_artifactPath}.`,
    );
    // Quando implementado:
    // const booster = await xgboost.loadModel(_artifactPath);
    // this.booster = booster;
    // this.modelLoaded = true;
    return;
  }

  async suggestPrice(_input: PricingInput): Promise<PriceSuggestion> {
    if (!this.isReady()) {
      throw new Error(
        'XGBoostPricingStrategy ainda não está pronta. Verifique isReady() antes de chamar.',
      );
    }
    // Implementação real virá quando o modelo estiver treinado.
    // Inferência típica:
    //   const features = featureVectorFromInput(_input);
    //   const prediction = this.booster.predict(features);
    //   return shapeAsPriceSuggestion(prediction, _input);
    throw new Error('XGBoost inference não implementado nesta fase.');
  }
}
