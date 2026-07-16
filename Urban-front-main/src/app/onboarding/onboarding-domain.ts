import type { AppLoadingStep } from '../componentes/ui';

export const TOTAL_STEPS = 5;

export const quotaErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as any)?.response?.data;
  if (data?.code === 'LISTINGS_QUOTA_EXCEEDED') {
  return data.message || 'Você atingiu o limite de imóveis do seu plano. Escolha um plano maior para adicionar mais imóveis.';
  }
  return fallback;
};

// ═══════════════════════════════════════
//  TIPOS
// ═══════════════════════════════════════
export interface Property {
  id: number;
  titulo: string;
  id_do_anuncio: string;
  ativo: boolean;
  pictureUrl: string;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  guests?: number;
  rating?: number;
  isNewListing?: boolean;
  reviewCount?: number;
  propertyType?: string;
  neighborhood?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  fullAddress?: string;
  amenitiesCount?: number;
  amenities?: string[];
}

export interface RegisteredProperty {
  id: string;
  titulo: string;
  id_do_anuncio: string;
  pictureUrl: string;
  ativo: boolean;
  user?: { id: string };
}

export interface SelectedPropertiesState {
  [key: string]: boolean;
}

export type PendingPricingProperty = {
  addressId: string;
  listId: string;
  propertyName: string;
  pictureUrl?: string | null;
  airbnbId?: string | null;
  sourceLabel?: string;
  fallbackMessage?: string;
  provisionalDailyPrice?: number | null;
};

export type PricingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'autonomous';
export type OperationMode = 'notifications' | 'automatic';

// Sprint 4 redesign: removido `color` ciclico (green/blue/orange/purple)
// e icones emoji (🛡️⚖️🚀🤖). Identificador agora e `iconKey` para
// renderizar com SVG inline (StrategyIcon). Selecao destacada via accent var(--app-accent).
export type StrategyIconKey = 'shield' | 'scale' | 'rocket' | 'sparkles';

export const PRICING_PRESETS: Record<PricingStrategy, { inicial: number; final: number | null; label: string; desc: string; iconKey: StrategyIconKey }> = {
  conservative: {
  inicial: -5, final: 10,
  label: 'Mais cautelosa', desc: 'Busca manter o imóvel competitivo sem mexer demais nos preços. Boa para começar com tranquilidade.',
  iconKey: 'shield',
  },
  balanced: {
  inicial: -10, final: 20,
  label: 'Equilibrada', desc: 'Tenta equilibrar ocupação e diária média. Recomendado para a maioria dos anfitriões.',
  iconKey: 'scale',
  },
  aggressive: {
  inicial: -15, final: 35,
  label: 'Mais ousada', desc: 'Permite variações maiores em datas de alta procura. Indicada para quem já acompanha preços de perto.',
  iconKey: 'rocket',
  },
  autonomous: {
  inicial: -5, final: null,
  label: 'Automático com IA', desc: 'Modo beta. A IA ajusta com mais liberdade, mantendo limite para evitar quedas bruscas.',
  iconKey: 'sparkles',
  },
};

// ═══════════════════════════════════════
//  COMPONENTE PRINCIPAL

export type OnboardingLoadStage =
  | 'idle'
  | 'checking-existing'
  | 'resolving-link'
  | 'finding-host'
  | 'fetching-listing'
  | 'fetching-profile'
  | 'filtering-listings'
  | 'registering'
  | 'creating-addresses'
  | 'pricing'
  | 'checking-airbnb-availability'
  | 'finding-available-dates'
  | 'calculating-daily-rate'
  | 'manual-price-required'
  | 'saving-prices'
  | 'starting-analysis';

const onboardingStageOrder: OnboardingLoadStage[] = [
  'checking-existing',
  'resolving-link',
  'finding-host',
  'fetching-listing',
  'fetching-profile',
  'filtering-listings',
  'registering',
  'creating-addresses',
  'pricing',
  'checking-airbnb-availability',
  'finding-available-dates',
  'calculating-daily-rate',
  'manual-price-required',
  'saving-prices',
  'starting-analysis',
];

export function getOnboardingLoadingStatus(stage: OnboardingLoadStage, foundCount: number): {
  eyebrow: string;
  title: string;
  body: string;
  tone: "accent" | "warn" | "neutral" | "error";
  steps: AppLoadingStep[];
} {
  const currentIndex = onboardingStageOrder.indexOf(stage);
  const status = (step: OnboardingLoadStage) => {
  const index = onboardingStageOrder.indexOf(step);
  if (stage === 'idle' || index < 0) return 'pending' as const;
  if (index < currentIndex) return 'complete' as const;
  if (index === currentIndex) return 'active' as const;
  return 'pending' as const;
}

  if ([
  'registering',
  'creating-addresses',
  'pricing',
  'checking-airbnb-availability',
  'finding-available-dates',
  'calculating-daily-rate',
  'manual-price-required',
  'saving-prices',
  'starting-analysis',
  ].includes(stage)) {
  const needsManualPrice = stage === 'manual-price-required';

  return {
    eyebrow: needsManualPrice ? 'Fallback manual' : 'Configurando imóveis',
    title: needsManualPrice
      ? 'Precisamos da diária base para continuar'
      : 'Estamos preparando a diária base e as recomendações',
    body: needsManualPrice
      ? 'O Airbnb não retornou uma diária confirmada, ou a origem encontrada era provisória. Informe o valor atual para iniciar a análise.'
      : 'Buscamos disponibilidade no Airbnb, tentamos encontrar datas futuras e calculamos a diária antes de iniciar a análise.',
    tone: needsManualPrice ? 'warn' : 'accent',
    steps: [
      { id: 'registering', label: 'Salvar imóveis', status: status('registering') },
      { id: 'creating-addresses', label: 'Validar dados', status: status('creating-addresses') },
      { id: 'pricing', label: 'Preparar cotação', status: status('pricing') },
      { id: 'availability', label: 'Ver disponibilidade', status: status('checking-airbnb-availability') },
      { id: 'dates', label: 'Encontrar datas', status: status('finding-available-dates') },
      { id: 'daily', label: 'Calcular diária', status: status('calculating-daily-rate') },
      { id: 'manual', label: 'Fallback manual', status: status('manual-price-required') },
      { id: 'saving-prices', label: 'Salvar diária', status: status('saving-prices') },
      { id: 'starting-analysis', label: 'Iniciar análise', status: status('starting-analysis') },
    ],
  };
  }

  return {
  eyebrow: 'Buscando no Airbnb',
  title: foundCount > 0 ? `Encontramos ${foundCount} imóveis até agora` : 'Estamos buscando informações do Airbnb',
  body: 'Abrimos o link, identificamos o anfitrião e validamos os anúncios públicos antes de mostrar a lista.',
  tone: 'accent',
  steps: [
    { id: 'checking-existing', label: 'Checar conta', status: status('checking-existing') },
    { id: 'resolving-link', label: 'Abrir link', status: status('resolving-link') },
    { id: 'finding-host', label: 'Identificar host', status: status('finding-host') },
    { id: 'fetching-profile', label: 'Buscar imóveis', status: status('fetching-profile') },
    { id: 'filtering-listings', label: 'Validar lista', status: status('filtering-listings') },
  ],
}
}


export function extractAirbnbPropertyId(link: string): string | null {
  if (!link || !link.includes('airbnb')) return null;
  const patterns = [
    /\/rooms\/(\d+)/,
    /airbnb\.com\.?\w*\/rooms\/(\d+)/i,
    /airbnb\.com\.?\w*\/p\/(\d+)/i
  ];
  for (const regex of patterns) {
    const match = link.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

export function extractAirbnbUserId(link: string): string | null {
  if (!link || !link.includes('airbnb')) return null;
  const regex = /\/users\/(?:show|profile)\/(\d+)/;
  const match = link.match(regex);
  return match && match[1] ? match[1] : null;
}

export function extractAirbnbListingId(url: string): string | null {
  try {
    const regex = /editor\/(\d+)\/details/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function parseMoneyInput(value: string): number | null {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

