import { Injectable, Logger } from '@nestjs/common';
import { TravelTimeEngine } from './isochrone';
import { PropertyClassifier } from './knn-classifier';
import { DisplacementCostMatrix } from './cost-matrix';
import {
    computePriceV2,
    PricingContextV2,
    PricingDriver,
    PricingEngineMode,
    PricingV2Result,
    resolvePricingEngineMode,
} from './pricing-engine-v2';

export const PRICING_ENGINE_V1_VERSION = 'pricing-engine-v1';

export interface SuggestPriceOptions extends PricingContextV2 {
    /** Força o modo (testes/backtest); default = `PRICING_ENGINE_V2`. */
    mode?: PricingEngineMode;
    /** Classificador alternativo (ex.: treinado só com os comps da análise). */
    classifier?: PropertyClassifier;
    /**
     * Evento enriquecido só para o v2 (ex.: com relevancia/venueCapacity). Permite
     * dar ao v2 mais sinais sem alterar o que o v1 recebe (v1 soma relevancia sem teto).
     * Precisa ter as mesmas coordenadas do evento principal.
     */
    eventV2?: any;
}

@Injectable()
export class UrbanAIPricingEngine {
    private readonly logger = new Logger(UrbanAIPricingEngine.name);

    constructor(
        private readonly travelEngine: TravelTimeEngine,
        private readonly classifier: PropertyClassifier,
        private readonly costMatrix: DisplacementCostMatrix,
    ) {}

    /**
     * Inicializa o motor com dados históricos/atuais de imóveis.
     */
    initialize(properties: any[]) {
        this.classifier.train(properties);
    }

    /**
     * Sugere preço para um imóvel numa noite (com ou sem evento).
     *
     * Modo (`PRICING_ENGINE_V2`, ver `pricing-engine-v2.ts`):
     *  - `shadow` (default): resposta = v1 (inalterada), v2 anexado em `details.shadowV2`.
     *  - `true`: resposta = v2 (pode reduzir preço; com drivers e guardrails).
     *  - `false`: só v1.
     *
     * O formato de retorno é o mesmo do v1; campos novos são só aditivos
     * (`details.drivers`, `details.engineVersion`, `details.multiplier`,
     * `details.guardrail`, `details.shadowV2`).
     */
    async suggestPrice(property: any, event: any, basePrice: number, options: SuggestPriceOptions = {}) {
        const mode = options.mode ?? resolvePricingEngineMode();
        const classifier = options.classifier ?? this.classifier;
        const v2Event = options.eventV2 ?? event;
        // v2 só usa evento com coordenadas válidas (senão trata como noite sem evento).
        // v1 mantém o comportamento antigo: qualquer evento vai para a matriz de custo.
        const attractivity =
            mode === 'v1' ? (event ? await this.costMatrix.calculateAttractivityScore(property, event) : null)
            : this.isUsableEvent(v2Event) ? await this.costMatrix.calculateAttractivityScore(property, v2Event)
            : null;

        if (mode === 'v2') {
            return this.shapeV2(property, v2Event, basePrice, this.runV2(property, v2Event, basePrice, attractivity, classifier, options), classifier);
        }

        if (!event) {
            throw new Error('Motor v1 exige um evento; use PRICING_ENGINE_V2=true para noites sem evento.');
        }
        const v1 = this.suggestPriceV1(
            property,
            event,
            basePrice,
            attractivity ?? (await this.costMatrix.calculateAttractivityScore(property, event)),
            classifier,
        );
        if (mode === 'shadow') {
            try {
                const v2 = this.runV2(property, v2Event, basePrice, attractivity, classifier, options);
                (v1.details as any).shadowV2 = {
                    engineVersion: v2.engineVersion,
                    suggestedPrice: v2.suggestedPrice,
                    multiplier: v2.multiplier,
                    drivers: v2.drivers,
                    guardrail: v2.guardrail,
                    // Insumo de mercado (ADR 0028), só quando MARKET_ENGINE_SIGNAL_ENABLED=true.
                    ...(options.market ? { market: options.market } : {}),
                };
                this.logger.debug(
                    `[shadow-v2] property=${property?.id} v1=${v1.suggestedPrice} v2=${v2.suggestedPrice} ` +
                        `diff=${(((v2.suggestedPrice - v1.suggestedPrice) / v1.suggestedPrice) * 100).toFixed(1)}%`,
                );
            } catch (err) {
                this.logger.warn(`[shadow-v2] falhou para property=${property?.id}: ${(err as Error).message}`);
            }
        }
        return v1;
    }

    private isUsableEvent(event: any): boolean {
        return !!event && Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng));
    }

    private runV2(
        property: any,
        event: any,
        basePrice: number,
        attractivity: any,
        classifier: PropertyClassifier,
        options: SuggestPriceOptions,
    ): PricingV2Result {
        const classification = classifier.classify(property);
        return computePriceV2({
            basePrice,
            classification,
            event: this.isUsableEvent(event) ? event : null,
            attractivity,
            context: options,
        });
    }

    private shapeV2(property: any, event: any, basePrice: number, v2: PricingV2Result, classifier: PropertyClassifier) {
        const classification = v2.drivers.find((d) => d.key === 'knn_category');
        const proximity = v2.drivers.find((d) => d.key === 'event_proximity' || d.key === 'rule_event_uplift');
        return {
            propertyId: property?.id,
            eventName: event?.name ?? event?.nome ?? null,
            basePrice,
            suggestedPrice: v2.suggestedPrice,
            increasePercentage: Math.round((v2.multiplier - 1) * 100),
            details: {
                classification: classification
                    ? classification.label.replace('Perfil KNN: ', '')
                    : classifier.getCategoryName(1),
                attractivity: proximity?.label,
                travelTimeMinutes: undefined as number | undefined,
                eventAIRelevance: event?.relevancia ?? null,
                reasoning: v2.reasoning,
                engineVersion: v2.engineVersion,
                multiplier: v2.multiplier,
                drivers: v2.drivers,
                guardrail: v2.guardrail,
                targetDate: v2.targetDate,
            },
        };
    }

    /**
     * Motor v1 (legado) — preservado byte-a-byte nos números para que ligar ou
     * desligar `PRICING_ENGINE_V2` seja reversível. Só ganhou `drivers`.
     * Problemas conhecidos (por isso existe o v2): só soma; +10% fixo para
     * Standard; proximidade contada duas vezes; LLM até +50% sem teto.
     */
    private suggestPriceV1(property: any, event: any, basePrice: number, attractivity: any, classifier: PropertyClassifier) {
        // 1. Classificação KNN (Perfil do Imóvel) — modelo legado
        const classification = classifier.classifyLegacy(property);

        // 3. Cálculo do Multiplicador de Preço
        let multiplier = 1.0;
        const drivers: PricingDriver[] = [];
        const add = (key: string, label: string, delta: number, source: PricingDriver['source'], explanation: string) => {
            multiplier += delta;
            drivers.push({ key, label, weight: delta, deltaPercent: delta * 100, applied: delta !== 0, source, explanation });
        };

        // Boost por categoria (KNN)
        if (classification.categoryId === 2) add('knn_category', 'Perfil KNN: Premium', 0.2, 'classification', 'v1: +20% fixo para Premium.');
        if (classification.categoryId === 1) add('knn_category', 'Perfil KNN: Standard', 0.1, 'classification', 'v1: +10% fixo para Standard.');

        // Boost por Atratividade ao Evento
        if (attractivity.score > 80) {
            add('event_attractivity', 'Atratividade alta', 0.5, 'event', `v1: score ${attractivity.score} > 80.`);
        } else if (attractivity.score > 50) {
            add('event_attractivity', 'Atratividade média', 0.2, 'event', `v1: score ${attractivity.score} > 50.`);
        }

        // Boost adicional se o tempo de viagem for muito curto (Isócrona < 15min)
        if (attractivity.travelTime <= 15) {
            add('event_travel_time', 'Isócrona <= 15 min', 0.3, 'event', `v1: ${attractivity.travelTime} min até o evento.`);
        }

        // Boost autônomo baseado na IA (event.relevancia de 1 a 100)
        // Uma relevância 100 (Mega evento) trará um boost elástico de +0.50 (50%).
        if (event.relevancia) {
            add('gemini_relevance', 'Relevância do evento (IA)', event.relevancia / 200, 'gemini', `v1: relevância ${event.relevancia}/200, sem teto.`);
        }

        const suggestedPrice = basePrice * multiplier;

        return {
            propertyId: property.id,
            eventName: event.name,
            basePrice: basePrice,
            suggestedPrice: parseFloat(suggestedPrice.toFixed(2)),
            increasePercentage: Math.round((multiplier - 1) * 100),
            details: {
                classification: classification.categoryName,
                attractivity: attractivity.attractivityLevel,
                travelTimeMinutes: attractivity.travelTime,
                eventAIRelevance: event.relevancia || null,
                reasoning: `Imóvel classificado como '${classification.categoryName}'. ` +
                           `Acesso ao evento '${event.name || event.nome}' em ${attractivity.travelTime} min (${attractivity.attractivityLevel}). ` +
                           (event.relevancia ? `Boost de Relevância IA: ${event.relevancia}/100.` : ''),
                engineVersion: PRICING_ENGINE_V1_VERSION,
                multiplier: Number(multiplier.toFixed(4)),
                drivers,
            },
        };
    }
}
