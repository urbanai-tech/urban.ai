import type { PricingRuleConfigItem, PricingRuleType } from '../entities/pricing-rule-config.entity';

/**
 * Regras de preço por imóvel (`PricingRuleConfig`) — defaults e avaliação diária.
 *
 * Até 2026-10-24 estas regras só existiam no PREVIEW do painel do anfitrião
 * (`host-panels.service.ts#buildPricingPreview`); o motor de sugestão as
 * ignorava. O motor v2 (`pricing-engine-v2.ts`) passa a aplicá-las.
 *
 * Os defaults moraram em `host-panels.service.ts`; agora são exportados daqui
 * para que painel e motor usem exatamente os mesmos valores.
 */
export const DEFAULT_PRICING_RULES: PricingRuleConfigItem[] = [
  {
    type: 'weekend_uplift',
    enabled: true,
    params: { percent: 15 },
    label: 'Uplift de fim de semana',
    description: 'Aumenta o preço base em sexta e sábado, quando a demanda costuma ser maior.',
  },
  {
    type: 'weekday_discount',
    enabled: true,
    params: { percent: -8 },
    label: 'Desconto em dias úteis lentos',
    description: 'Aplica desconto suave em segunda, terça e quarta para puxar reservas.',
  },
  {
    type: 'gap_night_filler',
    enabled: true,
    params: { percent: -20, maxNights: 2 },
    label: 'Preenchimento de lacunas',
    description: 'Reduz o preço quando há lacunas curtas entre noites reservadas.',
  },
  {
    type: 'last_minute',
    enabled: true,
    params: { percent: -12, daysBefore: 3 },
    label: 'Última hora',
    description: 'Baixa o preço quando a data está muito próxima e ainda sem reserva registrada.',
  },
  {
    type: 'length_of_stay',
    enabled: false,
    params: { percent: -10, minNights: 7 },
    label: 'Desconto para estadia longa',
    description: 'Regra por reserva; não altera o preview diário isolado.',
  },
  {
    type: 'min_stay_dynamic',
    enabled: false,
    params: { baseMinNights: 2, highMinNights: 3, occupancyThreshold: 70 },
    label: 'Estadia mínima dinâmica',
    description: 'Regra operacional de mínimo de noites; não altera preço no preview.',
  },
  {
    type: 'occupancy_floor',
    enabled: true,
    params: { minPrice: 180 },
    label: 'Piso de preço',
    description: 'Impede que regras combinadas baixem o preço abaixo do piso definido.',
  },
  {
    type: 'event_uplift',
    enabled: true,
    params: { percent: 25, radiusKm: 3 },
    label: 'Uplift por evento de alto impacto',
    description: 'Aumenta o preço quando há evento relevante perto do imóvel.',
  },
];

export function cloneDefaultPricingRules(): PricingRuleConfigItem[] {
  return DEFAULT_PRICING_RULES.map((rule) => ({ ...rule, params: { ...rule.params } }));
}

/**
 * Faixa aceita para o `percent` de cada regra no motor. O painel aceita
 * qualquer número; o motor NÃO confia nisso: regra de desconto nunca vira
 * aumento (e vice-versa) e nenhuma regra isolada passa de 50%.
 * Os guardrails do imóvel limitam o efeito combinado depois.
 */
export const RULE_PERCENT_BOUNDS: Partial<Record<PricingRuleType, [number, number]>> = {
  weekend_uplift: [0, 50],
  weekday_discount: [-50, 0],
  gap_night_filler: [-50, 0],
  last_minute: [-50, 0],
  event_uplift: [0, 50],
};

/** Regras que não alteram a diária de uma noite isolada (são por reserva/operacionais). */
export const NON_DAILY_RULES: PricingRuleType[] = ['length_of_stay', 'min_stay_dynamic'];

export function boundedRulePercent(rule: PricingRuleConfigItem, fallback = 0): number {
  const raw = Number(rule?.params?.percent);
  const value = Number.isFinite(raw) ? raw : fallback;
  const bounds = RULE_PERCENT_BOUNDS[rule.type];
  if (!bounds) return value;
  return Math.min(Math.max(value, bounds[0]), bounds[1]);
}

/** Dia da semana (0=domingo) de uma chave YYYY-MM-DD, sem depender do fuso do servidor. */
export function weekdayOfDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Diferença em dias entre duas chaves YYYY-MM-DD (b - a). */
export function daysBetweenDateKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
