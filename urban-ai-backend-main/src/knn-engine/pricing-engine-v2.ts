import type { MarketSignalV2 } from '../market-data/market-signal';
import type { PricingRuleConfigItem } from '../entities/pricing-rule-config.entity';
import { addDaysToDateKey, toDayKey, todaySaoPauloDateKey } from '../common/sp-date';
import {
  geminiRelevanceContribution,
  GeminiContributionConfig,
  resolveGeminiConfig,
} from './gemini-relevance';
import {
  boundedRulePercent,
  cloneDefaultPricingRules,
  daysBetweenDateKeys,
  weekdayOfDateKey,
} from './pricing-rules';

/**
 * Motor de pricing v2 — função pura, determinística e explicável.
 *
 * Diferenças para o v1 (`UrbanAIPricingEngine.suggestPriceV1`):
 *  - Multiplicadores COMBINADOS MULTIPLICATIVAMENTE e com sinal: o v2 pode
 *    recomendar preço ABAIXO da base (dias úteis lentos, sem evento, última
 *    hora sem reserva, noite-lacuna), limitado pelo guardrail do imóvel
 *    (`maxDecreasePercent`, default 20%) e pelo piso (`occupancy_floor`).
 *  - Sem "+10% por ser Standard": a categoria KNN é informativa (o preço base
 *    do anfitrião já embute o padrão do imóvel; somar prêmio de categoria
 *    sobre o próprio preço contava o mesmo atributo duas vezes).
 *  - Proximidade do evento entra UMA vez (v1 somava +50% de "atratividade" e
 *    +30% de "isócrona < 15 min", que são o mesmo sinal: score>80 ⇔ <=15 min).
 *  - Contribuição do LLM limitada (default +20%) e condicionada a confiança
 *    (ver `gemini-relevance.ts`).
 *  - Regras por imóvel (`PricingRuleConfig`) passam a ser aplicadas.
 *  - Toda decisão carrega `drivers` (o que aplicou, quanto e por quê).
 *
 * Os percentuais default abaixo são HIPÓTESES de partida, não parâmetros
 * calibrados com dado real. Ver `docs/runbooks/motor-de-preco.md`.
 */

export const PRICING_ENGINE_V2_VERSION = 'pricing-engine-v2.0';
const DEMAND_SIGNAL_MIN_PERCENT = 3;
const DEFAULT_IMPACT_RADIUS_KM = 3;
const MAX_IMPACT_RADIUS_KM = 10;

export type PricingDriverSource =
  | 'classification'
  | 'event'
  | 'gemini'
  | 'rule'
  | 'baseline'
  | 'market'
  | 'guardrail';

/**
 * Compatível com `EventIntelligenceDriver` ({ key, label, weight, explanation })
 * usado em `PricingDecisionSnapshot.drivers`; os campos extras são aditivos.
 * `weight` = efeito no multiplicador em fração com sinal (-0.08 = -8%).
 */
export interface PricingDriver {
  key: string;
  label: string;
  weight: number;
  explanation: string;
  deltaPercent: number;
  applied: boolean;
  source: PricingDriverSource;
}

export interface PricingGuardrailV2 {
  maxDecreasePercent?: number | null;
  maxIncreasePercent?: number | null;
}

export interface PricingOccupancyContext {
  targetNightBooked?: boolean | null;
  prevNightBooked?: boolean | null;
  nextNightBooked?: boolean | null;
}

export interface PricingContextV2 {
  /** Noite precificada. Default: dia (SP) de `event.dataInicio`. */
  targetDate?: string | Date | null;
  /** "Hoje" para a regra de última hora. Default: hoje em SP. */
  today?: string | Date | null;
  /** Regras do imóvel; `null/undefined` → defaults do painel. */
  rules?: PricingRuleConfigItem[] | null;
  occupancy?: PricingOccupancyContext | null;
  guardrail?: PricingGuardrailV2 | null;
  /** Distância imóvel→evento em km (para `event_uplift.radiusKm`). */
  distanceKm?: number | null;
  /**
   * Insumo de mercado por bairro (ADR 0028), só agregados. EM SOMBRA: vira um driver informativo
   * (peso 0) e vai em `details.shadowV2.market`; não altera o preço do v1 nem o do v2.
   */
  market?: MarketSignalV2 | null;
}

export interface AttractivityLike {
  score: number;
  travelTime: number;
  attractivityLevel?: string;
}

export interface PricingV2Config {
  noEventAdjustmentPercent: number;
  highAttractivityUpliftPercent: number;
  mediumAttractivityUpliftPercent: number;
  defaultMaxDecreasePercent: number;
  defaultMaxIncreasePercent: number;
  gemini: GeminiContributionConfig;
}

function envNumber(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function resolvePricingV2Config(env: NodeJS.ProcessEnv = process.env): PricingV2Config {
  return {
    noEventAdjustmentPercent: envNumber(env, 'PRICING_V2_NO_EVENT_ADJUSTMENT_PERCENT', -5, -20, 0),
    highAttractivityUpliftPercent: envNumber(env, 'PRICING_V2_HIGH_ATTRACTIVITY_UPLIFT_PERCENT', 12, 0, 50),
    mediumAttractivityUpliftPercent: envNumber(env, 'PRICING_V2_MEDIUM_ATTRACTIVITY_UPLIFT_PERCENT', 5, 0, 30),
    defaultMaxDecreasePercent: envNumber(env, 'PRICING_V2_MAX_DECREASE_PERCENT', 20, 0, 50),
    defaultMaxIncreasePercent: envNumber(env, 'PRICING_V2_MAX_INCREASE_PERCENT', 50, 0, 100),
    gemini: resolveGeminiConfig(env),
  };
}

export interface PricingV2Input {
  basePrice: number;
  classification?: { categoryId: number; categoryName: string } | null;
  /** null quando não há evento (dia "normal"). */
  event?: Record<string, any> | null;
  attractivity?: AttractivityLike | null;
  context?: PricingContextV2 | null;
}

export interface PricingV2Result {
  engineVersion: typeof PRICING_ENGINE_V2_VERSION;
  basePrice: number;
  suggestedPrice: number;
  multiplier: number;
  uncappedMultiplier: number;
  targetDate: string | null;
  demandSignal: boolean;
  drivers: PricingDriver[];
  guardrail: {
    minMultiplier: number;
    maxMultiplier: number;
    maxDecreasePercent: number;
    maxIncreasePercent: number;
    floorPrice: number | null;
    capped: 'floor' | 'ceiling' | 'occupancy_floor' | null;
  };
  reasoning: string;
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function pct(fraction: number): string {
  const v = round(fraction * 100, 1);
  return `${v >= 0 ? '+' : ''}${v}%`;
}

function driver(
  key: string,
  label: string,
  deltaPercent: number,
  source: PricingDriverSource,
  explanation: string,
  applied = deltaPercent !== 0,
): PricingDriver {
  const d = round(deltaPercent, 2);
  return {
    key,
    label,
    weight: round(d / 100, 4),
    deltaPercent: d,
    applied,
    source,
    explanation,
  };
}

function findRule(rules: PricingRuleConfigItem[], type: PricingRuleConfigItem['type']) {
  return rules.find((r) => r?.type === type && r.enabled);
}

function strictNumber(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

export function computePriceV2(
  input: PricingV2Input,
  config: PricingV2Config = resolvePricingV2Config(),
): PricingV2Result {
  const basePrice = Number(input.basePrice);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    throw new Error('computePriceV2: basePrice inválido');
  }
  const ctx = input.context ?? {};
  const event = input.event ?? null;
  const rules = Array.isArray(ctx.rules) ? ctx.rules : cloneDefaultPricingRules();
  const rulesSource = Array.isArray(ctx.rules) ? 'configuração do imóvel' : 'regras padrão';
  const drivers: PricingDriver[] = [];

  // --- Classificação (informativa) -------------------------------------
  if (input.classification) {
    drivers.push(
      driver(
        'knn_category',
        `Perfil KNN: ${input.classification.categoryName}`,
        0,
        'classification',
        'Informativo: o preço base do anfitrião já reflete o padrão do imóvel; o v2 não soma prêmio de categoria.',
        false,
      ),
    );
  }

  // --- Mercado do bairro (informativo, sem efeito no preço) ---------------
  if (ctx.market) {
    const m = ctx.market;
    const origem = m.sources.map((src) => src.source).join(', ') || 'sem fonte';
    drivers.push(
      driver(
        'market_position',
        `Mercado: percentil ${m.percentile} do bairro`,
        0,
        'market',
        `Informativo (sombra): diária mediana do bairro R$${m.medianAdr} em ${m.sampleSize} anúncios a ${m.radiusKm} km (${origem}). Não altera o preço.`,
        false,
      ),
    );
  }

  // --- Sinais de demanda do evento --------------------------------------
  const eventDeltas: number[] = [];
  if (event && input.attractivity) {
    const score = Number(input.attractivity.score);
    const upliftRule = findRule(rules, 'event_uplift');
    const radiusKm = strictNumber(upliftRule?.params?.radiusKm) ?? 3;
    const distanceKm = strictNumber(ctx.distanceKm);
    // Fator de proximidade (0..1): o efeito de um evento decai com a distância.
    // Com distância conhecida: exp(-d / raio), raio = `raioImpactoKm` do evento
    // limitado a [1, 10] km (o LLM costuma exagerar o raio: o prompt sugere 50 km
    // para mega eventos) e default 3 km. Sem distância: faixas do score de
    // atratividade (>=80 → 1; >=50 → 0,5; senão 0).
    const impactRadiusKm = Math.min(
      Math.max(strictNumber(event.raioImpactoKm) ?? DEFAULT_IMPACT_RADIUS_KM, 1),
      MAX_IMPACT_RADIUS_KM,
    );
    const proximityFactor =
      distanceKm !== null && distanceKm >= 0
        ? round(Math.exp(-distanceKm / impactRadiusKm), 4)
        : score >= 80 ? 1 : score >= 50 ? 0.5 : 0;
    const audience = Math.max(
      strictNumber(event.expectedAttendance) ?? 0,
      strictNumber(event.venueCapacity) ?? 0,
    );
    const gemini = geminiRelevanceContribution(event, config.gemini);
    // Magnitude do evento (0..1): público observável (escala log, 1k→0, 50k→1) ou,
    // na falta, a relevância do LLM aceita; sem nenhum dos dois, 0,5 ("desconhecido").
    // Evita que um evento pequeno a 25 min dê o mesmo uplift de um estádio lotado.
    const audienceMagnitude =
      audience >= 1000 ? Math.min(1, Math.max(0, Math.log(audience / 1000) / Math.log(50))) : null;
    const llmMagnitude = gemini.applied && gemini.relevancia !== null ? gemini.relevancia / 100 : null;
    const magnitude = audienceMagnitude ?? llmMagnitude ?? 0.5;
    const baseAttrPct =
      distanceKm !== null && distanceKm >= 0 ? config.highAttractivityUpliftPercent * proximityFactor
      : score >= 80 ? config.highAttractivityUpliftPercent
      : score >= 50 ? config.mediumAttractivityUpliftPercent
      : 0;
    const attrPct = round(baseAttrPct * magnitude, 2);
    // O score do LLM também só vale perto do evento.
    gemini.upliftFraction = round(gemini.upliftFraction * proximityFactor, 4);
    if (gemini.applied && proximityFactor < 1) {
      gemini.reason += ` × proximidade ${proximityFactor}.`;
      if (gemini.upliftFraction < 0.0005) {
        gemini.applied = false;
        gemini.upliftFraction = 0;
        gemini.reason += ' Zerado: imóvel longe do evento.';
      }
    }
    const highImpact = audience >= 10_000 || (gemini.applied && (gemini.relevancia ?? 0) >= 70);
    const ruleApplies =
      !!upliftRule && distanceKm !== null && distanceKm <= radiusKm && highImpact;
    const rulePct = upliftRule ? boundedRulePercent(upliftRule, 25) : 0;

    const geminiPct = gemini.applied ? gemini.upliftFraction * 100 : 0;
    const organicMultiplier = (1 + attrPct / 100) * (1 + geminiPct / 100);
    if (ruleApplies && 1 + rulePct / 100 >= organicMultiplier) {
      // A regra do anfitrião já É o uplift de "evento grande perto": ela substitui
      // proximidade E relevância IA (os três medem o mesmo fenômeno; somar contaria 2-3×).
      drivers.push(
        driver(
          'rule_event_uplift',
          upliftRule!.label || 'Uplift por evento de alto impacto',
          rulePct,
          'rule',
          `Evento de alto impacto a ${round(distanceKm!, 1)} km (raio ${radiusKm} km, ${rulesSource}). Substitui proximidade e relevância IA (mesmo sinal, não soma).`,
        ),
      );
      eventDeltas.push(rulePct);
      drivers.push(
        driver('gemini_relevance', 'Relevância do evento (IA)', 0, 'gemini', `${gemini.reason} Absorvido pela regra de evento.`, false),
      );
    } else {
      drivers.push(
        driver(
          'event_proximity',
          `Proximidade do evento (${input.attractivity.attractivityLevel ?? `score ${score}`})`,
          attrPct,
          'event',
          `Acesso ao evento em ${input.attractivity.travelTime} min (score ${score}/100` +
            (distanceKm !== null ? `, ${round(distanceKm, 1)} km, fator de proximidade ${proximityFactor} com raio ${impactRadiusKm} km` : '') +
            `) × magnitude ${round(magnitude, 2)}` +
            ` (${audienceMagnitude !== null ? 'público observável' : llmMagnitude !== null ? 'relevância IA' : 'porte desconhecido'}). Proximidade conta uma única vez.`,
        ),
      );
      if (attrPct > 0) eventDeltas.push(attrPct);
      drivers.push(
        driver('gemini_relevance', 'Relevância do evento (IA)', geminiPct, 'gemini', gemini.reason, gemini.applied),
      );
      if (gemini.applied) eventDeltas.push(geminiPct);
    }
  }
  // Sinal de demanda = uplift de evento combinado >= 3% (ruído abaixo disso não
  // deve cancelar os descontos de dia útil/última hora/lacuna).
  const demandSignal = eventDeltas.reduce((s, d) => s + d, 0) >= DEMAND_SIGNAL_MIN_PERCENT;

  // --- Calendário --------------------------------------------------------
  const targetDate = toDayKey(ctx.targetDate ?? event?.dataInicio ?? null);
  const today = toDayKey(ctx.today ?? null) ?? todaySaoPauloDateKey();
  const weekday = targetDate ? weekdayOfDateKey(targetDate) : null;
  const isWeekend = weekday === 5 || weekday === 6;
  const isSlowWeekday = weekday !== null && weekday >= 1 && weekday <= 3;
  const ruleDeltas: number[] = [];

  const weekendRule = findRule(rules, 'weekend_uplift');
  if (weekendRule && isWeekend) {
    const p = boundedRulePercent(weekendRule, 15);
    drivers.push(driver('rule_weekend_uplift', weekendRule.label || 'Fim de semana', p, 'rule', `Sexta/sábado (${rulesSource}).`));
    ruleDeltas.push(p);
  }

  // Regras de redução só valem em noite SEM sinal de demanda: não faz sentido
  // dar desconto de dia útil na noite de um show lotado ao lado.
  if (!demandSignal) {
    if (!event) {
      if (!isWeekend && config.noEventAdjustmentPercent !== 0) {
        drivers.push(
          driver(
            'baseline_no_event',
            'Sem evento nem sinal de demanda',
            config.noEventAdjustmentPercent,
            'baseline',
            'Noite sem evento mapeado: ajuste-base configurável (PRICING_V2_NO_EVENT_ADJUSTMENT_PERCENT). Hipótese a calibrar com dado real.',
          ),
        );
        ruleDeltas.push(config.noEventAdjustmentPercent);
      }
    }

    const weekdayRule = findRule(rules, 'weekday_discount');
    if (weekdayRule && isSlowWeekday) {
      const p = boundedRulePercent(weekdayRule, -8);
      drivers.push(driver('rule_weekday_discount', weekdayRule.label || 'Dia útil lento', p, 'rule', `Segunda a quarta sem sinal de demanda (${rulesSource}).`));
      ruleDeltas.push(p);
    }

    const lastMinuteRule = findRule(rules, 'last_minute');
    const booked = ctx.occupancy?.targetNightBooked === true;
    if (lastMinuteRule && targetDate && !booked) {
      const daysBefore = strictNumber(lastMinuteRule.params?.daysBefore) ?? 3;
      const lead = daysBetweenDateKeys(today, targetDate);
      if (lead >= 0 && lead <= daysBefore) {
        const p = boundedRulePercent(lastMinuteRule, -12);
        drivers.push(driver('rule_last_minute', lastMinuteRule.label || 'Última hora', p, 'rule', `Faltam ${lead} dia(s) (limite ${daysBefore}) e a noite não consta como reservada (${rulesSource}).`));
        ruleDeltas.push(p);
      }
    }

    const gapRule = findRule(rules, 'gap_night_filler');
    const occ = ctx.occupancy;
    if (gapRule && occ?.prevNightBooked === true && occ?.nextNightBooked === true && !booked) {
      const p = boundedRulePercent(gapRule, -20);
      drivers.push(driver('rule_gap_night_filler', gapRule.label || 'Noite-lacuna', p, 'rule', `Noite livre entre duas reservadas (${targetDate ? `${addDaysToDateKey(targetDate, -1)} e ${addDaysToDateKey(targetDate, 1)}` : 'datas vizinhas'}; ${rulesSource}).`));
      ruleDeltas.push(p);
    }
  }

  // --- Combinação --------------------------------------------------------
  const allDeltas = [...eventDeltas, ...ruleDeltas];
  const uncappedMultiplier = round(allDeltas.reduce((m, d) => m * (1 + d / 100), 1));

  // --- Guardrails --------------------------------------------------------
  const maxDecreasePercent = Math.min(
    Math.max(strictNumber(ctx.guardrail?.maxDecreasePercent) ?? config.defaultMaxDecreasePercent, 0),
    50,
  );
  const maxIncreasePercent = Math.min(
    Math.max(strictNumber(ctx.guardrail?.maxIncreasePercent) ?? config.defaultMaxIncreasePercent, 0),
    100,
  );
  const minMultiplier = round(1 - maxDecreasePercent / 100);
  const maxMultiplier = round(1 + maxIncreasePercent / 100);
  const multiplier = Math.min(Math.max(uncappedMultiplier, minMultiplier), maxMultiplier);
  let capped: PricingV2Result['guardrail']['capped'] = null;
  if (multiplier !== uncappedMultiplier) {
    capped = uncappedMultiplier < minMultiplier ? 'floor' : 'ceiling';
    drivers.push(
      driver(
        capped === 'floor' ? 'guardrail_max_decrease' : 'guardrail_max_increase',
        capped === 'floor' ? `Limite de redução (-${maxDecreasePercent}%)` : `Limite de aumento (+${maxIncreasePercent}%)`,
        (multiplier / uncappedMultiplier - 1) * 100,
        'guardrail',
        `Multiplicador ${uncappedMultiplier.toFixed(3)} limitado a ${multiplier.toFixed(3)} pelo guardrail do imóvel.`,
      ),
    );
  }

  let suggestedPrice = basePrice * multiplier;
  const floorRule = findRule(rules, 'occupancy_floor');
  const floorRaw = strictNumber(floorRule?.params?.minPrice);
  const floorPrice = floorRule && floorRaw !== null && floorRaw > 0 ? floorRaw : null;
  // O piso só impede QUEDA abaixo dele; nunca empurra o preço acima da base.
  if (floorPrice !== null && suggestedPrice < basePrice && suggestedPrice < floorPrice) {
    const floored = Math.min(floorPrice, basePrice);
    drivers.push(
      driver(
        'rule_occupancy_floor',
        floorRule!.label || 'Piso de preço',
        (floored / suggestedPrice - 1) * 100,
        'rule',
        `Redução interrompida no piso de R$${floored.toFixed(2)} (piso configurado R$${floorPrice.toFixed(2)}; nunca acima da base).`,
      ),
    );
    suggestedPrice = floored;
    capped = 'occupancy_floor';
  }

  suggestedPrice = Number(suggestedPrice.toFixed(2));
  const finalMultiplier = round(suggestedPrice / basePrice);
  const applied = drivers.filter((d) => d.applied);
  const reasoning =
    `Motor v2: ${pct(finalMultiplier - 1)} sobre a base R$${basePrice.toFixed(2)}` +
    (targetDate ? ` para ${targetDate}` : '') +
    '. ' +
    (applied.length
      ? applied.map((d) => `${d.label} ${pct(d.weight)}`).join('; ')
      : 'Nenhum ajuste aplicado') +
    '.';

  return {
    engineVersion: PRICING_ENGINE_V2_VERSION,
    basePrice,
    suggestedPrice,
    multiplier: finalMultiplier,
    uncappedMultiplier,
    targetDate,
    demandSignal,
    drivers,
    guardrail: {
      minMultiplier,
      maxMultiplier,
      maxDecreasePercent,
      maxIncreasePercent,
      floorPrice,
      capped,
    },
    reasoning,
  };
}

/** Converte drivers para o formato de `PricingDecisionSnapshot.drivers`. */
export function toSnapshotDrivers(drivers: PricingDriver[]) {
  return drivers.map((d) => ({
    key: d.key,
    label: d.label,
    weight: d.weight,
    explanation: `${d.explanation} Efeito: ${pct(d.weight)}${d.applied ? '' : ' (não aplicado)'}.`,
  }));
}

export type PricingEngineMode = 'v1' | 'v2' | 'shadow';

/**
 * `PRICING_ENGINE_V2`:
 *  - `true|on|1|v2` → v2 responde.
 *  - `shadow` (DEFAULT) → v1 responde (números inalterados); v2 é calculado e
 *    anexado em `details.shadowV2` para comparação.
 *  - `false|off|0|v1` → só v1.
 */
export function resolvePricingEngineMode(raw = process.env.PRICING_ENGINE_V2): PricingEngineMode {
  const v = String(raw ?? '').trim().toLowerCase();
  if (['true', 'on', '1', 'v2', 'yes'].includes(v)) return 'v2';
  if (['false', 'off', '0', 'v1', 'no'].includes(v)) return 'v1';
  return 'shadow';
}
