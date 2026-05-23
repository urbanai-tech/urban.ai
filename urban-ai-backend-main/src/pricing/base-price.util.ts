const PROVISIONAL_PRICING_SOURCES = new Set([
  'snapshot_self_cron',
  'self_cron',
  'price_snapshot',
  'preco_base_snapshot',
  'preco_base_snapshot_backfill',
  'comp_extraction',
  'requires_manual_price',
]);

const TRUSTED_EXACT_PRICING_SOURCES = new Set([
  'manual',
  'manual_backfill',
  'portfolio_bulk_action',
  'stays_sync',
  'stays_auto',
  'admin_manual',
]);

function normalizeSource(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isTrustedBasePriceSource(value: unknown): boolean {
  const source = normalizeSource(value);
  if (!source || PROVISIONAL_PRICING_SOURCES.has(source)) return false;
  if (TRUSTED_EXACT_PRICING_SOURCES.has(source)) return true;
  return source.startsWith('airbnb_');
}

export function hasUsableBasePrice(list: any): boolean {
  const manualDailyPrice = Number(list?.manualDailyPrice);
  if (Number.isFinite(manualDailyPrice) && manualDailyPrice > 0) return true;

  const dailyPrice = Number(list?.dailyPrice);
  if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) return false;

  return isTrustedBasePriceSource(list?.pricingInputSource);
}

export function resolveUsableBaseDailyPrice(list: any): number | null {
  const manualDailyPrice = Number(list?.manualDailyPrice);
  if (Number.isFinite(manualDailyPrice) && manualDailyPrice > 0) {
    return Number(manualDailyPrice.toFixed(2));
  }

  if (!isTrustedBasePriceSource(list?.pricingInputSource)) return null;

  for (const value of [list?.dailyPrice, list?.raw, list?.priceText]) {
    const parsed = parsePriceLike(value);
    if (parsed !== null) return parsed;
  }

  return null;
}

function parsePriceLike(value: unknown): number | null {
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
