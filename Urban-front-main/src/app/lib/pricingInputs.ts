const PROVISIONAL_PRICING_SOURCES = new Set([
  'snapshot_self_cron',
  'self_cron',
  'price_snapshot',
  'preco_base_snapshot',
  'preco_base_snapshot_backfill',
  'comp_extraction',
  'direct_comp_avg',
  'market_average',
  'market_estimate',
  'knn_estimate',
  'event_intelligence_estimate',
  'derived_from_existing_analise_preco',
  'price_absorption_curve_pending_nico_engine',
  'requires_manual_price',
]);

const TRUSTED_EXACT_PRICING_SOURCES = new Set([
  'manual',
  'manual_backfill',
  'portfolio_bulk_action',
  'stays_sync',
  'stays_auto',
  'admin_manual',
  'airbnb19',
]);

export type BasePriceReadinessReason =
  | 'manual'
  | 'trusted-source'
  | 'missing-price'
  | 'provisional-source'
  | 'unknown-source';

export type BasePriceReadiness = {
  ready: boolean;
  dailyPrice: number | null;
  source: string;
  sourceLabel: string;
  reason: BasePriceReadinessReason;
  message: string;
};

function normalizeSource(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function parseMoneyLike(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
  }

  if (typeof value !== 'string') return null;

  const sanitized = value.trim().replace(/[^\d,.-]/g, '');
  if (!sanitized) return null;

  const normalized = sanitized
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

export function isProvisionalBasePriceSource(value: unknown): boolean {
  return PROVISIONAL_PRICING_SOURCES.has(normalizeSource(value));
}

export function isTrustedBasePriceSource(value: unknown): boolean {
  const source = normalizeSource(value);
  if (!source || PROVISIONAL_PRICING_SOURCES.has(source)) return false;
  if (TRUSTED_EXACT_PRICING_SOURCES.has(source)) return true;

  return source.startsWith('airbnb_');
}

export function formatPricingSourceLabel(value: unknown): string {
  const source = normalizeSource(value);
  if (!source) return 'fonte não informada';
  if (source === 'manual' || source === 'manual_backfill' || source === 'admin_manual') return 'diária manual';
  if (source.startsWith('airbnb_')) return 'Airbnb checkout';
  if (source === 'portfolio_bulk_action') return 'ação em lote';
  if (source === 'stays_sync' || source === 'stays_auto') return 'Stays';

  return source.replace(/_/g, ' ');
}

export function describeBasePriceReadiness(list: any): BasePriceReadiness {
  const manualDailyPrice = parseMoneyLike(list?.manualDailyPrice);
  if (manualDailyPrice) {
    return {
      ready: true,
      dailyPrice: manualDailyPrice,
      source: normalizeSource(list?.pricingInputSource) || 'manual',
      sourceLabel: 'diária manual',
      reason: 'manual',
      message: 'Diária base informada manualmente.',
    };
  }

  const dailyPrice = parseMoneyLike(list?.dailyPrice);
  const source = normalizeSource(list?.pricingInputSource);
  const sourceLabel = formatPricingSourceLabel(source);

  if (!dailyPrice) {
    return {
      ready: false,
      dailyPrice: null,
      source,
      sourceLabel,
      reason: 'missing-price',
      message: 'Ainda não encontramos uma diária base para este imóvel.',
    };
  }

  if (isProvisionalBasePriceSource(source)) {
    return {
      ready: false,
      dailyPrice,
      source,
      sourceLabel,
      reason: 'provisional-source',
      message: 'Existe um valor temporário, mas ele ainda não é uma diária confirmada do Airbnb.',
    };
  }

  if (isTrustedBasePriceSource(source)) {
    return {
      ready: true,
      dailyPrice,
      source,
      sourceLabel,
      reason: 'trusted-source',
      message: 'Diária base encontrada em uma fonte confiável.',
    };
  }

  return {
    ready: false,
    dailyPrice,
    source,
    sourceLabel,
    reason: 'unknown-source',
    message: 'Encontramos um valor, mas a origem não confirma que ele pode iniciar a análise.',
  };
}

export function hasUsableBasePrice(list: any): boolean {
  return describeBasePriceReadiness(list).ready;
}
