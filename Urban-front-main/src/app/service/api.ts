import axios from "axios";
import { Connect, CreateAddressDto } from "../types/connect";
import { List, Address } from "../types/connect"; // Crie esse tipo DTO correspondente à entidade List
import { Subscription } from "../componentes/Subscription";

// Base URL configurada via variável de ambiente
const url = process.env.NEXT_PUBLIC_API_URL;
console.log("API Base URL:", url);

// Cria instância do axios com baseURL
export const api = axios.create({
  baseURL: url,
  withCredentials: true,
  // baseURL: 'https://urban-back-719774307855.us-central1.run.app',
});

// Interceptor para incluir o token de autorização em todas as requisições
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Interceptor global de resposta — sprint design premium 2026-05-17.
 *
 * - 401 (não autenticado): limpa token, redireciona pra login `/`.
 *   Exceção: rotas publicas (/lancamento, /landing, /precos, /sobre, /contato,
 *   /termos, /privacidade, /create, /forbidden, /post-login, /request-reset-password,
 *   /reset-password/*, /confirm-email/*) NÃO redirecionam — login não eh
 *   necessario nelas e o componente que disparou o 401 lida com o erro.
 * - 403 (sem permissão): redireciona pra `/forbidden` page premium.
 * - Outros erros: passa adiante.
 *
 * O endpoint `/auth/me` é exceção — 401 nele é esperado (componente decide).
 */
const PUBLIC_PATH_REGEX =
  /^\/(lancamento|landing|precos|sobre|contato|termos|privacidade|create|forbidden|post-login|request-reset-password|reset-password|confirm-email|waitlist|robots|sitemap)/;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return PUBLIC_PATH_REGEX.test(pathname);
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const status = error?.response?.status;
    const requestUrl: string = error?.config?.url ?? "";
    const pathname = window.location.pathname || "";

    // 401: invalida sessao + redireciona pra login.
    // Exceções: /auth/me (componente decide), ou se ja estamos em rota publica.
    if (status === 401) {
      const isAuthMeProbe = requestUrl.endsWith("/auth/me");
      if (!isAuthMeProbe && !isPublicPath(pathname)) {
        try {
          localStorage.removeItem("accessToken");
        } catch {
          /* ignore storage errors */
        }
        const redirect = encodeURIComponent(pathname + window.location.search);
        window.location.href = `/?next=${redirect}`;
      }
    }

    // 403: usuario logado mas sem permissao — manda pra pagina 403 amigavel.
    if (status === 403) {
      const isAuthProbe =
        requestUrl.endsWith("/auth/me") || requestUrl.endsWith("/auth/logout");
      const alreadyOnForbidden = pathname.startsWith("/forbidden");
      if (!isAuthProbe && !alreadyOnForbidden && !isPublicPath(pathname)) {
        window.location.href = `/forbidden?from=${encodeURIComponent(pathname)}`;
      }
    }

    return Promise.reject(error);
  },
);

/* ============================
 *    EMAIL / AUTENTICAÇÃO
 * ============================ */

/* ============================
 *      CONNECT / PROPS
 * ============================ */

export async function getUserManagedListings(
  userId: string,
): Promise<Connect[]> {
  try {
    const { data } = await api.get<Connect[]>(
      `/connect/user-managed-listings/${userId}`,
    );
    return data;
  } catch (error) {
    console.error("Erro ao buscar listings do usuário:", error);
    throw error;
  }
}

/** Busca listagens do usuário com CEP validado pela BrasilAPI */
export type PropertyDropdown = {
  id: string;
  propertyName: string;
  userId: string;
  analisado	: string;
  image_url: string;
  latitude: number;
  longitude: number;
  id_do_anuncio?: string;
  manualDailyPrice?: number | null;
  averageMonthlyRevenue?: number | null;
  dailyPrice?: number | null;
  pricingInputSource?: string | null;
  nome: string;
};

export type PricingInputHistory = {
  id: string;
  previousManualDailyPrice: number | null;
  newManualDailyPrice: number | null;
  previousAverageMonthlyRevenue: number | null;
  newAverageMonthlyRevenue: number | null;
  source: string;
  changedByUserId: string | null;
  createdAt: string;
};

export async function getPropriedadesDropdownList(): Promise<PropertyDropdown[]> {
  try {
    const { data } = await api.get<any[]>("/propriedades/dropdown/list");
    return data;
  } catch (error) {
    console.error("Erro ao buscar propriedades dropdown list:", error);
    throw error;
  }
}

export async function updatePropertyPricingInputs(
  addressId: string,
  payload: { manualDailyPrice?: number | null; averageMonthlyRevenue?: number | null },
): Promise<PropertyDropdown> {
  const { data } = await api.patch(`/propriedades/${addressId}/pricing-inputs`, payload);
  return data;
}

export async function getPropertyPricingInputHistory(
  addressId: string,
  limit = 10,
): Promise<PricingInputHistory[]> {
  const { data } = await api.get<PricingInputHistory[]>(
    `/propriedades/${addressId}/pricing-inputs/history`,
    { params: { limit } },
  );
  return data;
}

export async function registerProperties(properties: List[]): Promise<List[]> {
  try {
    const { data } = await api.post<List[]>("/connect/register", properties);
    return data;
  } catch (error) {
    console.error("Erro ao registrar propriedades:", error);
    throw error;
  }
}

export type BillingCycle = 'monthly' | 'quarterly' | 'semestral' | 'annual';

export async function createCheckoutSession(
  planId: string,
  billingCycle: BillingCycle = 'monthly',
  quantity: number = 1,
): Promise<{ sessionId: string }> {
  try {
    const { data } = await api.post<{ sessionId: string }>("/payments/create-checkout-session", {
      plan: planId,
      billingCycle,
      quantity,
    });
    return data;
  } catch (error) {
    console.error("Erro ao criar sessão de checkout:", error);
    throw error;
  }
}

export async function fetchSubscription(): Promise<Subscription> {
  try {
    const { data } = await api.get<Subscription>("/payments/getSubscription");
    return data;
  } catch (error) {
    console.error("Erro ao buscar subscription:", error);
    throw error;
  }
}

export async function cancelSubscription(): Promise<void> {
  try {
    await api.delete("/payments/cancelSubscription");
  } catch (error) {
    console.error("Erro ao cancelar subscription:", error);
    throw error;
  }
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
  try {
    const { data } = await api.post<{ url: string }>("/payments/billing-portal-session");
    return data;
  } catch (error) {
    console.error("Erro ao criar sessao do portal de billing:", error);
    throw error;
  }
}

export const getEventos = async (
  page = 1,
  limit = 10,
  propriedadeId: string
) => {
  try {
    const response = await api.get('/event', {
      params: { page, limit, propriedadeId },
    });

    return response.data;
  } catch (error) {
    console.error('Erro na requisição de eventos:', error);
    return [];
  }
};

export const getUserProperties = async (page = 1, limit = 10) => {
  const response = await api.get(`/propriedades/user/`, {
    params: { page, limit },
  });
  return response.data;
};

export const getPropertyById = async (propertyId: string) => {
  const response = await api.get(`/propriedades/${propertyId}`, {
    headers: { accept: 'application/json' },
  });
  return response.data;
};

export async function getAddressByCep(cep: string): Promise<{
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  service: string;
}> {
  try {
    const cleanCep = cep.replace(/\D/g, "");
    const { data } = await api.get(`/connect/cep/${cleanCep}`);
    return data;
  } catch (error) {
    console.error("Erro ao consultar CEP:", error);
    throw error;
  }
}

/** Cria múltiplos endereços (endpoint correto conforme guia) */
export async function createMultipleAddresses(
  addresses: CreateAddressDto[],
): Promise<Address[]> {
  try {
    const { data } = await api.post<Address[]>(
      "/connect/addresses",
      addresses
    );
    return data;
  } catch (error) {
    console.error("Erro ao criar endereços:", error);
    throw error;
  }
}

interface ProcessResponse {
  status: string;
}

export async function registerProcess(list:any[]
) {

  const body = {
    listIds: list
  }
  try {
    const { data } = await api.post<ProcessResponse>(
      "/processos",
      body
    );
    return data;
  } catch (error) {
    console.error("Erro ao registrar processo:", error);
    throw error;
  }
}

export const getAllEventos = async (page = 1, limit = 10) => {
  try {
    const response = await api.get('/event/all', {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar todos os eventos:', error);
    throw error;
  }
};

export const forgotPassword = async (email: string) => {
  try {
    const response = await api.post('/email/forgot-password', {
      email: email,
    });

    return {
      data: response.data,   // { enviado: true }
      status: response.status, // ex: 200
    };
  } catch (error) {
    console.error('Erro ao solicitar recuperação de senha:', error);
    throw error;
  }
};

export const enviarCodigo = async (email: string) => {
  try {
    const response = await api.post('/email/enviar-codigo', {
      email: email,
    });

    return {
      data: response.data,   // { enviado: true }
      status: response.status, // ex: 200
    };
  } catch (error) {
    console.error('Erro ao enviar código por e-mail:', error);
    throw error;
  }
};

export const confirmarEmail = async (email: string, codigo: string) => {
  try {
    const response = await api.post('/email/confirmar-email', {
      email,
      codigo,
    });

    return {
      data: response.data,   // resposta do backend
      status: response.status, // ex: 200
    };
  } catch (error) {
    console.error('Erro ao confirmar e-mail:', error);
    throw error;
  }
};

export const verificarUsuarioState = async (email: string) => {
  try {
    const response = await api.post('/email/verificar-usuario-state', {
      email: email,
    });

    return {
      data: response.data,   // { ativo: false }
      status: response.status, // ex: 200
    };
  } catch (error) {
    console.error('Erro ao verificar estado do usuário:', error);
    throw error;
  }
};
export const getProfile = async () => {
  try {
    const response = await api.get("/auth/profile");

    return {
      data: response.data,   // { onboardingCompleted: true, loginCount: 2, ... }
      status: response.status, // ex: 200
    };
  } catch (error) {
    console.error("Erro ao obter perfil:", error);
    throw error;
  }
};



interface User {
  id: string;
  username: string;
  email: string;
  password: string | null;
  createdAt: string;
  distanceKm: number;
  ativo: boolean;
}

interface UpdatePasswordResponse {
  enviado: boolean;
  user: User;
}

export const updatePassword = async (
  token: string,
  pass: string
): Promise<UpdatePasswordResponse> => {
  try {
    const response = await api.post<UpdatePasswordResponse>('/email/update-password', {
      token,
      pass,
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar a senha:', error);
    throw error;
  }
};



/* ============================
 *        PROFILE / PERFIL
 * ============================ */

export type UpdateProfilePayload = {
  username?: string;
  email?: string;
  phone?: string;
  company?: string;
  distanceKm?: number;
  airbnbHostId?: string;
  pricingStrategy?: string;
  operationMode?: string;
  percentualInicial?: number | null;
  percentualFinal?: number | null;
};

// Resposta normalizada para sempre expor { profile: { phone, company } }
export type ProfileResponse = {
  id: string;
  username: string;
  email: string;
  distanceKm?: number;
  pricingStrategy?: string;
  operationMode?: string;
  percentualInicial?: number | null;
  percentualFinal?: number | null;
  createdAt?: string;
  profile: {
    phone: string | null;
    company: string | null;
  };
};

/** GET /auth/profile/:id (normaliza para conter .profile.phone/company) */
export async function getProfileById(): Promise<ProfileResponse> {
  try {
    const { data } = await api.get<any>(`/auth/profile/`);
    return {
      ...data,
      profile: {
        phone: data?.profile?.phone ?? data?.phone ?? null,
        company: data?.profile?.company ?? data?.company ?? null,
      },
    };
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    throw error;
  }
}

/** PUT /auth/profile/:id (aceita username, email, phone, company, distanceKm) */
export async function updateProfileById(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<ProfileResponse> {
  try {
    const { data } = await api.put<any>('/auth/profile', payload);
    return {
      ...data,
      profile: {
        phone: data?.profile?.phone ?? data?.phone ?? null,
        company: data?.profile?.company ?? data?.company ?? null,
      },
    };
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    throw error;
  }
}

export const getNotificacoesPorUsuario = async (
  page = 1,
  limit = 10
) => {
  try {
    const { data } = await api.get(`/notifications/user/`, {
      params: { page, limit },
    });

    return data;
  } catch (error) {
    console.error('Erro ao buscar notificações por usuário:', error);
    throw error;
  }
};
export const marcarNotificacaoComoAberta = async (notificationId: string) => {
  try {
    const { data } = await api.patch(`/notifications/${notificationId}/opened`);
    return data;
  } catch (error) {
    console.error(`Erro ao marcar notificação ${notificationId} como aberta:`, error);
    throw error;
  }
};
export const getUnreadNotificationsCount = async (): Promise<{ unread: number }> => {
  try {
    const { data } = await api.get('/notifications/user/unread-count');
    return data; // { unread: number }
  } catch (error) {
    console.error('Erro ao buscar contagem de notificações não lidas:', error);
    throw error;
  }
};
export const resolveAirbnbUrl = async (
  url: string
): Promise<{ finalUrl: string }> => {
  try {
    const { data } = await api.get('/connect/resolve', {
      params: { url },
    });
    return data; // { finalUrl: string }
  } catch (error) {
    console.error('Erro ao resolver URL do Airbnb:', error);
    throw error;
  }
};

export const getPropertyData = async (propertyId: string | undefined): Promise<{
  quantidadePropriedadesAtivas: number;
  lucroProjetadoGeradoPeloUrban: number;
  receitaProjetada: {
    receitaProjetada: number;
    diferencaPercentual: number;
  };
  quantidadeEventos: number;
}> => {
  try {
    const { data } = await api.get(`/dados`, {
      params: { propertyId },
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados da propriedade:', error);
    throw error;
  }
};

export const getEventosPorPropriedade = async (
  propriedadeId: string,
  dataInicial: string,
  page = 1,
  limit = 4000
) => {
  try {
    const { data } = await api.get('/propriedades/eventos-analisados-com-price', {
      params: { propriedadeId, page, limit, dataInicial},
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar eventos por propriedade:', error);
    throw error;
  }
};


export const getEventosAcompanhando = async (
  propriedadeId: string | undefined,
  page = 1,
  limit = 10
) => {
  try {
    const { data } = await api.get('/propriedades/eventos-acompanhando', {
      params: { propriedadeId, page, limit },
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar eventos por propriedade:', error);
    throw error;
  }
};


export const getPagamentosDoUsuario = async () => {
  try {
    const { data } = await api.get('/payments/me'); // rota do controller
    return data;
  } catch (error) {
    console.error('Erro ao buscar pagamentos do usuário:', error);
    throw error;
  }
};

export const alterarAceitoSugestao = async (id: string, aceito: boolean) => {
  try {
    const { data } = await api.patch(`/sugestoes-preco/${id}/aceito`, {
      aceito,
    });
    return data;
  } catch (error) {
    console.error(`Erro ao alterar o status de aceito da sugestão ${id}:`, error);
    throw error;
  }
};

export const registrarPrecoAplicadoSugestao = async (
  id: string,
  precoAplicado: number,
  origem:
    | 'manual_dashboard'
    | 'manual_off_platform'
    | 'stays_auto'
    | 'stays_user_accepted' = 'manual_dashboard',
  feedback?: {
    reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
    receitaReal?: number | null;
    noitesReservadas?: number | null;
    feedbackObservacao?: string | null;
  },
) => {
  try {
    const { data } = await api.patch(`/sugestoes-preco/${id}/aplicado`, {
      precoAplicado,
      origem,
      ...feedback,
    });
    return data;
  } catch (error) {
    console.error(`Erro ao registrar o preco aplicado da sugestao ${id}:`, error);
    throw error;
  }
};

export const registrarResultadoSugestao = async (
  id: string,
  feedback: {
    precoAplicado?: number | null;
    reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
    receitaReal?: number | null;
    noitesReservadas?: number | null;
    feedbackObservacao?: string | null;
  },
) => {
  try {
    const { data } = await api.patch(`/sugestoes-preco/${id}/resultado`, feedback);
    return data;
  } catch (error) {
    console.error(`Erro ao registrar resultado da sugestao ${id}:`, error);
    throw error;
  }
};




export const getEventosForMaps = async (
  propriedadeId: string,
  page = 1,
  limit = 4000,
  raio = 10,
  dataInicial:string,
  dataFinal:string
) => {
  try {
    const { data } = await api.get('/propriedades/eventos-analisados-com-price-para-maps', {
      params: { propriedadeId, page, limit, raio, dataFinal, dataInicial },
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar eventos por propriedade:', error);
    throw error;
  }
};


export type GetHostInfoResponse = {
  hostId: string;
  hostName: string;
};

export const getHostId = async (propertyId: string) => {
  try {
    const { data } = await api.get<{ result: GetHostInfoResponse }>(`/propriedades/hostId`, {
      params: { propertyId },
    });

    return data; // Retorna o hostId encontrado
  } catch (error) {
    console.error("Erro ao buscar hostId:", error);
    throw error; // Propaga o erro para ser tratado em outro lugar
  }
};

export type PropertyQuickInfo = {
  propertyId: string;
  title: string;
  pictureUrl: string;
  hostId: string | null;
  hostName: string | null;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  guests: number;
  rating: number;
  isNewListing: boolean;
  reviewCount: number;
  propertyType: string;
  neighborhood: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
  latitude: number | null;
  longitude: number | null;
  amenitiesCount: number;
  amenities: string[];
};

/** Busca info rápida de um imóvel individual (título, imagem, hostId) */
export const getPropertyQuickInfo = async (propertyId: string): Promise<PropertyQuickInfo> => {
  try {
    const { data } = await api.get<PropertyQuickInfo>(`/propriedades/quick-info`, {
      params: { propertyId },
    });
    return data;
  } catch (error) {
    console.error("Erro ao buscar info rápida do imóvel:", error);
    throw error;
  }
};

// ============================
//  USERS / ADDRESSES (CHECK)
// ============================

export type HasAddressResult = {
  hasAddress: boolean;
  count: number;
};

/** GET /users/me/has-address?onlyActive=true|false
 *  Retorna { hasAddress: boolean, count: number } */
export async function getHasAddress(
  onlyActive: boolean = true
): Promise<HasAddressResult> {
  const { data } = await api.get<HasAddressResult>('/users/me/has-address', {
    params: { onlyActive },
  });
  return data;
}

/** Açucar: retorna apenas o boolean */
export async function hasAnyAddress(
  onlyActive: boolean = true
): Promise<boolean> {
  const res = await getHasAddress(onlyActive);
  return res.hasAddress;
}

export const requestDeleteAddress = async (addressId: string) => {
  try {
    const { data } = await api.delete(`/propriedades/address/${addressId}`);
    return data;
  } catch (error) {
    console.error('Erro ao deletar endereço:', error);
    throw error;
  }
};


export interface PercentualPayload {
  percentualInicial: number;
  percentualFinal: number | null;
}

/**
 * Cria ou atualiza os percentuais do usuário.
 * @param payload Objeto com percentualInicial e percentualFinal
 * @returns Dados retornados pela API
 */
export const requestCreateOrUpdatePercentual = async (
  payload: PercentualPayload
) => {
  try {
    const { data } = await api.post('/propriedades/createOrUpdatePercentual', payload);
    return data;
  } catch (error) {
    console.error('Erro ao criar ou atualizar percentuais:', error);
    throw error;
  }
};

/**
 * Consulta de Planos Dinâmicos.
 *
 * Os campos `price` / `priceAnnual` são legados (toggle binário).
 * Os campos `priceMonthly|Quarterly|Semestral|AnnualNew` são da matriz F6.5
 * (cobrança por imóvel × 4 ciclos com desconto progressivo).
 */
export interface Plan {
  id: string;
  name: string;
  title: string;
  // Legados
  price: string;
  priceAnnual?: string;
  originalPrice?: string;
  originalPriceAnnual?: string;
  stripePriceId?: string;
  stripePriceIdAnnual?: string;
  // F6.5
  priceMonthly?: string;
  priceQuarterly?: string;
  priceSemestral?: string;
  priceAnnualNew?: string;
  originalPriceMonthly?: string;
  originalPriceQuarterly?: string;
  originalPriceSemestral?: string;
  originalPriceAnnualNew?: string;
  discountQuarterlyPercent?: number;
  discountSemestralPercent?: number;
  discountAnnualPercent?: number;
  // Display
  period: string;
  propertyLimit?: number | null;
  features: string[];
  isCustomPrice?: boolean;
  highlightBadge?: string;
  discountBadge?: string;
  isActive: boolean;
}

export const getPlans = async (): Promise<Plan[]> => {
  try {
    const { data } = await api.get<Plan[]>('/plans');
    return data;
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    throw error;
  }
};

/**
 * F6.5 — quota de imóveis contratados vs. ativos. O Paywall usa para decidir
 * se o anfitrião pode adicionar mais um imóvel ou precisa fazer upsell.
 */
export interface ListingsQuota {
  contratados: number;
  ativos: number;
  podeAdicionar: boolean;
}

export const fetchListingsQuota = async (): Promise<ListingsQuota> => {
  const { data } = await api.get<ListingsQuota>('/payments/listings-quota');
  return data;
};

// ================== ROI do anfitriao ==================

export type RoiConfidence = 'high' | 'medium' | 'low';

export interface RoiSummary {
  windowDays: number;
  generatedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  subscription: {
    monthlyCostCents: number;
    activePayments: number;
  };
  money: {
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    potentialLostCents: number;
    netValueCents: number;
    roiPercent: number | null;
    roiMultiple: number | null;
  };
  activity: {
    recommendations: number;
    accepted: number;
    applied: number;
    booked: number;
    rejected: number;
    impactedNights: number;
    acceptanceRatePercent: number;
    applicationRatePercent: number;
  };
  dataQuality: {
    confidence: RoiConfidence;
    label: string;
    explanation: string;
  };
  perProperty: Array<{
    propertyId: string | null;
    propertyName: string;
    recommendations: number;
    accepted: number;
    applied: number;
    booked: number;
    impactedNights: number;
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    potentialLostCents: number;
  }>;
  recentWins: Array<{
    id: string;
    propertyName: string;
    currentPriceCents: number;
    appliedPriceCents: number;
    deltaCents: number;
    nights: number;
    incrementalCents: number;
    status: string;
    createdAt: string;
  }>;
}

export interface AdminRoiOverview {
  windowDays: number;
  generatedAt: string;
  totals: {
    users: number;
    usersWithPositiveRoi: number;
    activePayments: number;
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    subscriptionCostCents: number;
    netValueCents: number;
    roiPercent: number | null;
    roiMultiple: number | null;
    potentialLostCents: number;
    impactedNights: number;
  };
  leaderboard: Array<RoiSummary & { activeListings: number }>;
}

export const fetchMyRoi = (params?: { windowDays?: number; propertyId?: string }) =>
  api
    .get<RoiSummary>('/roi/me', {
      params: {
        windowDays: params?.windowDays ?? 30,
        propertyId: params?.propertyId || undefined,
      },
    })
    .then((r) => r.data);

export const fetchAdminRoi = (params?: { windowDays?: number; limit?: number }) =>
  api
    .get<AdminRoiOverview>('/admin/roi', {
      params: {
        windowDays: params?.windowDays ?? 30,
        limit: params?.limit ?? 25,
      },
    })
    .then((r) => r.data);

// ================== Admin (F6.3 painel) ==================

export interface AdminOverview {
  users: { total: number; active: number; admins: number };
  product: {
    propertiesRegistered: number;
    eventsTotal: number;
    eventsLast7d: number;
    analysesTotal: number;
    analysesAccepted: number;
    acceptanceRatePercent: number;
  };
  revenue: { activeSubscriptions: number };
  ai: {
    currentTier: string;
    currentStrategy: string;
    reason: string;
    dataset: {
      totalSnapshots: number;
      distinctListings: number;
      distinctDays: number;
      trainingReady: number;
    };
  };
}

export interface AdminPricingStatus {
  activeStrategy: string;
  tier: string;
  reason: string;
  datasetSize: {
    total: number;
    distinctListings: number;
    distinctDays: number;
    trainingReady: number;
  };
  strategyEnvDefault: string;
  bootstrapOnBoot: boolean;
}

export interface AdminDatasetMetrics {
  byOrigin: Array<{ origin: string; count: number }>;
  daysCovered: number;
  topListings: Array<{ listingId: string; snapshots: number }>;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'host' | 'admin' | 'support' | string;
  ativo: boolean;
  createdAt: string;
  phone?: string;
  company?: string;
  pricingStrategy?: string;
  operationMode?: string;
  airbnbHostId?: string;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data } = await api.get<AdminOverview>('/admin/overview');
  return data;
}

export async function fetchAdminPricingStatus(): Promise<AdminPricingStatus> {
  const { data } = await api.get<AdminPricingStatus>('/admin/pricing/status');
  return data;
}

export async function fetchAdminDatasetMetrics(): Promise<AdminDatasetMetrics> {
  const { data } = await api.get<AdminDatasetMetrics>('/admin/dataset/metrics');
  return data;
}

export interface AdminAlphaRecommendation {
  id: string;
  createdAt: string;
  property: {
    listId: string | null;
    addressId: string | null;
    title: string | null;
    manualDailyPrice: number | null;
    averageMonthlyRevenue: number | null;
  };
  event: {
    id: string | null;
    name: string | null;
    city: string | null;
    state: string | null;
    startsAt: string | null;
    source: string | null;
    relevance: number | null;
    expectedAttendance: number | null;
  };
  pricing: {
    current: number;
    suggested: number;
    lift: number | null;
    liftPercent: number;
    recommendation: string | null;
    reason: string | null;
    distanceKm: number;
  };
  lifecycle: {
    accepted: boolean;
    status: string;
    appliedPrice: number | null;
    appliedAt: string | null;
    applicationOrigin: string | null;
  };
  outcome: {
    reservationStatus: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
    realRevenue: number | null;
    bookedNights: number | null;
    capturedAt: string | null;
    note: string | null;
  };
  qualityFlags: string[];
}

export interface AdminAlphaDashboard {
  generatedAt: string;
  user: { id: string; email: string; username: string; ativo: boolean; role: string };
  properties: {
    total: number;
    activeAddresses: number;
    completed: number;
    withManualPrice: number;
    withAverageMonthlyRevenue: number;
    totalAverageMonthlyRevenue: number;
  };
  recommendations: {
    total: number;
    accepted: number;
    applied: number;
    feedbackCaptured: number;
    booked: number;
    realRevenue: number;
    potentialDailyLift: number;
    distinctProperties: number;
    distinctEvents: number;
  };
  events: {
    total: number;
    upcoming: number;
    createdLast24h: number;
    qualityFlags: Record<string, number>;
  };
  recentRecommendations: AdminAlphaRecommendation[];
}

export interface AdminAlphaRecommendationsExport {
  generatedAt: string;
  user: { id: string; email: string; username: string };
  total: number;
  rows: AdminAlphaRecommendation[];
}

export async function fetchAdminAlphaDashboard(email = 'gustavo8gouveia@hotmail.com') {
  const { data } = await api.get<AdminAlphaDashboard>('/admin/alpha/dashboard', { params: { email } });
  return data;
}

export async function fetchAdminAlphaRecommendations(email = 'gustavo8gouveia@hotmail.com', limit = 250) {
  const { data } = await api.get<AdminAlphaRecommendationsExport>('/admin/alpha/recommendations', {
    params: { email, limit },
  });
  return data;
}

export async function runAdminAlphaReprocess(email = 'gustavo8gouveia@hotmail.com') {
  const { data } = await api.post<AdminJobRunResponse>('/admin/alpha/reprocess', null, {
    params: { email },
  });
  return data;
}

export interface AdminDatasetDiagnostics {
  generatedAt: string;
  health: 'red' | 'amber' | 'green';
  readiness: 'empty' | 'collecting' | 'training_ready' | 'ground_truth_ready';
  blockers: Array<{
    code: string;
    severity: 'red' | 'amber' | 'green';
    message: string;
    nextAction: string;
  }>;
  tables: {
    priceSnapshots: AdminDatasetMetrics & {
      total: number;
      distinctListings: number;
      distinctDays: number;
      trainingReady: number;
      latestSnapshotDate: string | null;
    };
    occupancyHistory: {
      total: number;
      trainingReady: number;
      latestDate: string | null;
    };
    eventProximityFeatures: {
      total: number;
      latestSnapshotDate: string | null;
    };
  };
  externalDependencies: Record<string, { configured: boolean; status: string; message: string }>;
  lastOwnedListingsSnapshot: unknown | null;
}

export interface AdminJobRunResponse<T = unknown> {
  id: string;
  name: string;
  status: 'running' | 'success' | 'error';
  triggeredByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  result: T | null;
  errorMessage: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatasetSnapshotResult {
  captured: number;
  skipped: number;
  duplicates: number;
  totalLists: number;
  skippedMissingPrice: number;
  skippedInvalidPrice: number;
  externalDataAvailable: boolean;
  status: string;
  warnings: string[];
}

export type DatasetSnapshotRunResponse = AdminJobRunResponse<DatasetSnapshotResult>;

export interface EventProximitySnapshotResult {
  captured: number;
  skipped: number;
  duplicates: number;
  totalAddresses: number;
  totalEvents: number;
  status: string;
  warnings: string[];
}

export type EventProximitySnapshotRunResponse =
  AdminJobRunResponse<EventProximitySnapshotResult>;

export interface GeocoderRunResult {
  attempted: number;
  succeeded: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

export interface ResetStaleEnrichmentResult {
  reset: number;
}

export const fetchAdminDatasetDiagnostics = () =>
  api.get<AdminDatasetDiagnostics>('/admin/dataset/diagnostics').then((r) => r.data);

export const runAdminDatasetSnapshot = () =>
  api.post<DatasetSnapshotRunResponse>('/admin/dataset/snapshot/run').then((r) => r.data);

export const runAdminEventProximitySnapshot = () =>
  api
    .post<EventProximitySnapshotRunResponse>('/admin/dataset/event-proximity/run')
    .then((r) => r.data);

export const fetchAdminJobRuns = (limit = 10) =>
  api.get<AdminJobRunResponse[]>('/admin/jobs/runs', { params: { limit } }).then((r) => r.data);

export const runAdminGeocoderJob = (limit = 50) =>
  api
    .post<AdminJobRunResponse<GeocoderRunResult>>('/admin/jobs/geocoder/run', null, {
      params: { limit },
    })
    .then((r) => r.data);

export const runAdminResetStaleEnrichmentJob = () =>
  api
    .post<AdminJobRunResponse<ResetStaleEnrichmentResult>>(
      '/admin/jobs/reset-stale-enrichment/run',
    )
    .then((r) => r.data);

export async function fetchAdminUsers(page = 1, limit = 20): Promise<AdminUsersResponse> {
  const { data } = await api.get<AdminUsersResponse>('/admin/users', {
    params: { page, limit },
  });
  return data;
}

export async function setAdminUserRole(
  userId: string,
  role: 'host' | 'admin' | 'support',
): Promise<{ id: string; role: string }> {
  const { data } = await api.patch(`/admin/users/${userId}/role`, { role });
  return data;
}

export async function setAdminUserActive(
  userId: string,
  ativo: boolean,
): Promise<{ id: string; ativo: boolean }> {
  const { data } = await api.patch(`/admin/users/${userId}/active`, { ativo });
  return data;
}

export interface AdminAuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown | null;
  after: unknown | null;
  metadata: unknown | null;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  items: AdminAuditLog[];
  total: number;
  page: number;
  limit: number;
}

export const fetchAdminAuditLogs = (params?: {
  page?: number;
  limit?: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}) =>
  api
    .get<AdminAuditLogsResponse>('/admin/audit-logs', { params })
    .then((r) => r.data);

// ================== Stays integration (F6.4) ==================

export interface StaysAccountPublic {
  id: string;
  status: 'pending' | 'active' | 'error' | 'disconnected';
  clientId: string;
  lastSyncAt: string | null;
  consentVersion?: string | null;
  consentAcceptedAt?: string | null;
}

export interface StaysListingPublic {
  id: string;
  staysListingId: string;
  title: string | null;
  shortAddress: string | null;
  basePriceCents: number | null;
  active: boolean;
  operationMode: 'inherit' | 'notifications' | 'auto';
  propriedadeId: string | null;
}

export interface PriceUpdatePublic {
  id: string;
  targetDate: string;
  previousPriceCents: number;
  newPriceCents: number;
  currency: string;
  origin: 'ai_auto' | 'user_accepted' | 'user_manual' | 'rollback';
  status: 'pending' | 'success' | 'rejected' | 'error';
  errorMessage: string | null;
  createdAt: string;
}

export interface StaysPricePreviewIssue {
  code: string;
  message: string;
}

export interface StaysPricePreview {
  listingId: string;
  staysListingId: string;
  title: string | null;
  targetDate: string;
  previousPriceCents: number;
  newPriceCents: number;
  currency: string;
  diffCents: number;
  diffPercent: number | null;
  maxIncreasePercent: number;
  maxDecreasePercent: number;
  withinGuardrails: boolean;
  readyForPush: boolean;
  blockers: StaysPricePreviewIssue[];
  warnings: StaysPricePreviewIssue[];
  existingPriceUpdateId: string | null;
  idempotentReplay: boolean;
}

export async function staysConnect(
  clientId: string,
  accessToken: string,
  consent: { consentAccepted: boolean; consentVersion: string },
): Promise<StaysAccountPublic> {
  const { data } = await api.post<StaysAccountPublic>('/stays/connect', {
    clientId,
    accessToken,
    consentAccepted: consent.consentAccepted,
    consentVersion: consent.consentVersion,
  });
  return data;
}

export async function staysDisconnect(): Promise<void> {
  await api.delete('/stays/connect');
}

export async function staysSyncListings(): Promise<{ count: number; listings: StaysListingPublic[] }> {
  const { data } = await api.post('/stays/listings/sync');
  return data;
}

export async function staysListListings(): Promise<StaysListingPublic[]> {
  const { data } = await api.get<StaysListingPublic[]>('/stays/listings');
  return data;
}

export async function staysPreviewPrice(input: {
  listingId: string;
  targetDate: string;
  newPriceCents: number;
  previousPriceCents?: number | null;
  currency?: string;
  analisePrecoId?: string;
}): Promise<StaysPricePreview> {
  const { data } = await api.post<StaysPricePreview>('/stays/price/preview', input);
  return data;
}

export async function staysPushPrice(input: {
  listingId: string;
  targetDate: string;
  newPriceCents: number;
  previousPriceCents: number;
  currency?: string;
  analisePrecoId?: string;
}): Promise<PriceUpdatePublic> {
  const { data } = await api.post<PriceUpdatePublic>('/stays/price/push', input);
  return data;
}

export async function staysRollback(priceUpdateId: string): Promise<PriceUpdatePublic> {
  const { data } = await api.post<PriceUpdatePublic>(`/stays/price/${priceUpdateId}/rollback`);
  return data;
}

// ================== Admin v2.8 (eventos, Stays, funnel, qualidade, ocupação) ==================

export interface AdminEventsAnalytics {
  summary: {
    total: number;
    ativos: number;
    inScope: number;
    outOfScope: number;
    coveragePercent: number;
    enrichmentPercent: number;
    coordsMissing: number;
    relevanceMissing: number;
  };
  upcoming: { next7d: number; next30d: number; next90d: number; megaUpcoming: number };
  byCategory: Array<{ categoria: string; count: number }>;
  byCity: Array<{ cidade: string; count: number }>;
  byRelevance: Array<{ bucket: string; count: number }>;
  topUpcoming: Array<{
    id: string;
    nome: string;
    cidade: string;
    dataInicio: string;
    relevancia: number | null;
    categoria: string | null;
    capacidadeEstimada: number | null;
    raioImpactoKm: number | null;
    hasCoords: boolean;
  }>;
  lastCrawlAt: string | null;
}

export interface AdminStaysHealth {
  readiness?: {
    apiBaseConfigured: boolean;
    tokenEncryptionConfigured: boolean;
    betaPrivate: boolean;
    missingEnv: string[];
  };
  accountsByStatus: Array<{ status: string; count: number }>;
  listings: { total: number; active: number; forcedAuto: number };
  pushLast30d: Array<{ status: string; count: number }>;
  recent: Array<{
    id: string;
    targetDate: string;
    previousPriceCents: number;
    newPriceCents: number;
    origin: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    userId?: string;
    listingId?: string;
  }>;
}

export interface AdminProductFunnel {
  windowDays: number;
  stages: {
    signups: number;
    onboardedWithAirbnbId: number;
    analysesGenerated: number;
    suggestionsAccepted: number;
    appliedPriceCaptured: number;
    activeSubscriptions: number;
    operationModeAuto: number;
  };
  rates: {
    acceptanceRatePercent: number;
    applicationRatePercent: number;
  };
}

export interface AdminPricingQuality {
  windowDays: number;
  sampleSize: number;
  discarded: number;
  mapePercent: number | null;
  rmse: number | null;
  medianAbsoluteError: number | null;
  qualityGate: { threshold: number; passes: boolean; meetsMinSample: boolean };
}

export interface AdminOccupancyCoverage {
  byStatus: Array<{ status: string; count: number }>;
  byOrigin: Array<{ origin: string; count: number }>;
  distinctListings: number;
}

export interface AdminOccupancyProperty {
  addressId: string;
  listId: string;
  title: string;
  airbnbListingId: string | null;
  userId: string | null;
  userEmail: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  manualDailyPrice: number | null;
  dailyPrice: number | null;
  averageMonthlyRevenue: number | null;
}

export interface ManualOccupancyPayload {
  listId: string;
  date: string;
  status: 'booked' | 'available' | 'blocked' | 'unknown';
  revenueCents?: number | null;
  listedPriceCents?: number | null;
  currency?: string;
}

export interface ManualOccupancyRecord extends ManualOccupancyPayload {
  id: string;
  origin: string;
  trainingReady: boolean;
}

export const fetchAdminEvents = () =>
  api.get<AdminEventsAnalytics>('/admin/events/analytics').then((r) => r.data);
export const fetchAdminStays = () =>
  api.get<AdminStaysHealth>('/admin/stays/health').then((r) => r.data);
export const fetchAdminFunnel = () =>
  api.get<AdminProductFunnel>('/admin/funnel').then((r) => r.data);
export const fetchAdminPricingQuality = () =>
  api.get<AdminPricingQuality>('/admin/pricing/quality').then((r) => r.data);
export const fetchAdminOccupancy = () =>
  api.get<AdminOccupancyCoverage>('/admin/occupancy/coverage').then((r) => r.data);
export const fetchAdminOccupancyProperties = () =>
  api.get<AdminOccupancyProperty[]>('/admin/occupancy/properties').then((r) => r.data);
export const upsertAdminManualOccupancy = (payload: ManualOccupancyPayload) =>
  api.post<ManualOccupancyRecord>('/admin/occupancy/manual', payload).then((r) => r.data);

// ---- Admin v2.9 (finance + plans-config) ----

export interface AdminFinanceOverview {
  currency: string;
  activeListings: number;
  activePayments: number;
  revenue: {
    mrrCents: number;
    byPlan: Array<{ planName: string; count: number; monthlyCents: number }>;
  };
  costs: {
    totalCents: number;
    fixedCents: number;
    percentualCents: number;
    byCategory: Array<{ category: string; cents: number }>;
  };
  margin: { absoluteCents: number; percent: number };
  perListing: {
    revenueCents: number;
    costCents: number;
    marginCents: number;
    marginPercent: number;
  };
}

export interface AdminCost {
  id: string;
  name: string;
  category: string;
  recurrence: string;
  monthlyCostCents: number;
  percentOfRevenue: number | null;
  description: string | null;
  scalesWithListings: boolean;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlanConfig {
  id: string;
  name: string;
  title: string;
  price?: string;
  priceAnnual?: string;
  priceMonthly?: string;
  priceQuarterly?: string;
  priceSemestral?: string;
  priceAnnualNew?: string;
  discountQuarterlyPercent?: number;
  discountSemestralPercent?: number;
  discountAnnualPercent?: number;
  propertyLimit?: number | null;
  features: string[];
  highlightBadge?: string | null;
  discountBadge?: string | null;
  isActive: boolean;
  isCustomPrice?: boolean;
  stripePriceIdMonthly?: string;
  stripePriceIdQuarterly?: string;
  stripePriceIdSemestral?: string;
  stripePriceIdAnnualNew?: string;
}

export const fetchAdminFinanceOverview = () =>
  api.get<AdminFinanceOverview>('/admin/finance/overview').then((r) => r.data);

export const fetchAdminCosts = (includeInactive = false) =>
  api
    .get<AdminCost[]>('/admin/finance/costs', { params: { includeInactive } })
    .then((r) => r.data);

export const createAdminCost = (input: {
  name: string;
  category: string;
  recurrence: string;
  monthlyCostCents: number;
  percentOfRevenue?: number;
  description?: string;
  scalesWithListings?: boolean;
  notes?: string;
}) => api.post<AdminCost>('/admin/finance/costs', input).then((r) => r.data);

export const updateAdminCost = (id: string, input: Partial<AdminCost>) =>
  api.patch<AdminCost>(`/admin/finance/costs/${id}`, input).then((r) => r.data);

export const deleteAdminCost = (id: string) =>
  api.delete(`/admin/finance/costs/${id}`).then((r) => r.data);

/**
 * Popula a tabela `platform_costs` com os custos operacionais default da Urban AI
 * (Railway, Stripe, Gemini, Mailersend etc.). Idempotente: por padrão NÃO
 * sobrescreve custos já cadastrados — passe `overwrite=true` para resetar.
 */
export const seedAdminCosts = (overwrite = false) =>
  api
    .post<{
      created: number;
      updated: number;
      skipped: number;
      items: Array<{ name: string; action: 'created' | 'updated' | 'skipped' }>;
    }>(`/admin/finance/costs/seed?overwrite=${overwrite ? 'true' : 'false'}`)
    .then((r) => r.data);

export const fetchAdminPlansConfig = () =>
  api.get<AdminPlanConfig[]>('/admin/plans-config').then((r) => r.data);

export const updateAdminPlan = (name: string, input: Partial<AdminPlanConfig>) =>
  api.patch<AdminPlanConfig>(`/admin/plans-config/${name}`, input).then((r) => r.data);

// =================== Stripe sync check ===================

export type StripePriceCycleStatus =
  | 'ok'
  | 'missing'
  | 'not-configured'
  | 'not-found'
  | 'cycle-mismatch'
  | 'inactive'
  | 'currency-mismatch'
  | 'check-error';

export interface StripeSyncEntry {
  planName: string;
  cycle: 'monthly' | 'quarterly' | 'semestral' | 'annual';
  priceId: string | null;
  source: 'plan-entity' | 'env-fallback' | 'missing';
  status: StripePriceCycleStatus;
  details?: string;
  stripeAmountCents?: number;
  stripeCurrency?: string;
  stripeInterval?: string;
  stripeIntervalCount?: number;
  stripeActive?: boolean;
}

export interface StripeSyncReport {
  summary: {
    total: number;
    ok: number;
    missing: number;
    notConfigured: number;
    problems: number;
    stripeKeyConfigured: boolean;
  };
  entries: StripeSyncEntry[];
}

/**
 * Valida que os 8 Stripe Price IDs (matriz F6.5: 2 planos × 4 ciclos) existem
 * na conta Stripe e batem com o ciclo esperado. Útil para detectar faltas
 * antes de um cliente tentar checkout.
 */
export const fetchStripeSyncCheck = () =>
  api.get<StripeSyncReport>('/admin/stripe/sync-check').then((r) => r.data);

// =================== Waitlist (F8 pré-lançamento) ===================

export interface PublicConfig {
  launchMode: 'prelaunch' | 'closed_beta' | 'paid_beta' | 'public';
  prelaunchMode: boolean;
  appEnv: string;
  version: string;
}

/**
 * Configuração pública do ambiente. Usada pelo front para decidir gating
 * (PRELAUNCH_MODE) sem precisar de env var de build-time, que fica ossificada.
 * Mudança no Railway reflete em todos os clients no próximo refresh.
 */
export const fetchPublicConfig = () =>
  api.get<PublicConfig>('/public-config').then((r) => r.data);

export interface WaitlistSignupResult {
  position: number;
  referralCode: string;
  aheadOfYou: number;
  totalSignups: number;
}

export interface WaitlistStatus {
  position: number;
  aheadOfYou: number;
  totalSignups: number;
  referralsCount: number;
  status: 'pending' | 'invited' | 'converted' | 'declined';
}

export const signupWaitlist = (input: {
  email: string;
  name?: string;
  phone?: string;
  source?: string;
  referredBy?: string;
}) =>
  api.post<WaitlistSignupResult>('/waitlist', input).then((r) => r.data);

export const fetchWaitlistStatus = (referralCode: string) =>
  api
    .get<WaitlistStatus>('/waitlist/me', { params: { code: referralCode } })
    .then((r) => r.data);

export interface WaitlistInviteValidation {
  valid: boolean;
  reason?: string;
  email?: string;
  name?: string | null;
  position?: number;
}

export const validateWaitlistInvite = (token: string) =>
  api
    .get<WaitlistInviteValidation>('/waitlist/invite', { params: { token } })
    .then((r) => r.data);

export const acceptWaitlistInvite = (input: {
  token: string;
  username?: string;
  password: string;
}) =>
  api
    .post<{ mode: 'registered'; accessToken: string; user: unknown }>(
      '/auth/waitlist/accept',
      input,
    )
    .then((r) => r.data);

// Admin
export interface WaitlistEntry {
  id: string;
  position: number;
  email: string;
  name: string | null;
  phone: string | null;
  source: string;
  referralCode: string;
  referredBy: string | null;
  referralsCount: number;
  status: 'pending' | 'invited' | 'converted' | 'declined';
  invitedAt: string | null;
  convertedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WaitlistListResponse {
  page: number;
  limit: number;
  total: number;
  items: WaitlistEntry[];
}

export interface WaitlistStats {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  topReferrers: Array<{
    email: string;
    referralCode: string;
    referralsCount: number;
    position: number;
  }>;
}

export const fetchAdminWaitlist = (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) => api.get<WaitlistListResponse>('/admin/waitlist', { params }).then((r) => r.data);

export const fetchAdminWaitlistStats = () =>
  api.get<WaitlistStats>('/admin/waitlist/stats').then((r) => r.data);

export const inviteWaitlistEntry = (id: string) =>
  api.post<{ ok: true; inviteUrl: string; emailSent: boolean }>(`/admin/waitlist/${id}/invite`).then((r) => r.data);

export const updateWaitlistNotes = (id: string, notes: string | null) =>
  api.patch<WaitlistEntry>(`/admin/waitlist/${id}/notes`, { notes }).then((r) => r.data);

export const deleteWaitlistEntry = (id: string) =>
  api.delete<{ ok: true }>(`/admin/waitlist/${id}`).then((r) => r.data);

// =================== Contato publico + admin ===================

export type ContactSubmissionStatus = 'new' | 'in_progress' | 'resolved' | 'archived';
export type ContactSubmissionCategory =
  | 'sales'
  | 'support'
  | 'billing'
  | 'privacy_lgpd'
  | 'stays'
  | 'incident'
  | 'partnership';
export type ContactSubmissionSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source: string;
  status: ContactSubmissionStatus;
  category: ContactSubmissionCategory;
  severity: ContactSubmissionSeverity;
  dueAt: string | null;
  resolvedAt: string | null;
  assignedOwner: string | null;
  notes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSubmissionListResponse {
  page: number;
  limit: number;
  total: number;
  byStatus?: Array<{ status: ContactSubmissionStatus; count: number }>;
  byCategory?: Array<{ category: ContactSubmissionCategory; count: number }>;
  bySeverity?: Array<{ severity: ContactSubmissionSeverity; count: number }>;
  items: ContactSubmission[];
}

export const createContactSubmission = (input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  source?: string;
}) => api.post<ContactSubmission>('/contact-submissions', input).then((r) => r.data);

export const fetchAdminContactSubmissions = (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContactSubmissionStatus | 'all';
}) =>
  api
    .get<ContactSubmissionListResponse>('/admin/contact-submissions', { params })
    .then((r) => r.data);

export const updateAdminContactSubmission = (
  id: string,
  input: {
    status?: ContactSubmissionStatus;
    category?: ContactSubmissionCategory;
    severity?: ContactSubmissionSeverity;
    assignedOwner?: string | null;
    notes?: string | null;
  },
) =>
  api
    .patch<ContactSubmission>(`/admin/contact-submissions/${id}`, input)
    .then((r) => r.data);

// =================== Eventos - Camada 3 (curadoria manual) ===================

export interface ManualEventInput {
  nome: string;
  dataInicio: string;
  dataFim?: string;
  enderecoCompleto?: string;
  cidade?: string;
  estado?: string;
  latitude?: number | null;
  longitude?: number | null;
  categoria?: string;
  venueType?: string;
  venueCapacity?: number | null;
  expectedAttendance?: number | null;
  linkSiteOficial?: string;
  imagemUrl?: string;
  descricao?: string;
}

export interface IngestResult {
  status: 'created' | 'updated' | 'skipped';
  reason?: string;
  id?: string;
  dedupHash?: string;
}

export interface IngestBatchResponse {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  bySource: Record<string, { created: number; updated: number; skipped: number }>;
  results: IngestResult[];
}

/**
 * Cria/atualiza 1 evento manualmente. Idempotente via dedupHash.
 * Source forçado a 'admin-manual'.
 */
export const createManualEvent = (input: ManualEventInput) =>
  api
    .post<IngestBatchResponse>('/events/ingest', {
      events: [{ ...input, source: 'admin-manual' }],
    })
    .then((r) => r.data);

/**
 * Importa CSV de eventos. Retorna parsedRows + invalidRows + ingest agregado.
 */
export const importCsvEvents = (file: File, sourceLabel?: string) => {
  const fd = new FormData();
  fd.append('file', file);
  if (sourceLabel) fd.append('sourceLabel', sourceLabel);
  return api
    .post<{
      parsedRows: number;
      invalidRows: Array<{ line: number; reason: string }>;
      ingest: IngestBatchResponse;
    }>('/events/import-csv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export type GeocoderReadinessStatus = 'configured' | 'missing_api_key';

export interface GeocoderRunSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

export interface GeocoderLastRun extends GeocoderRunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'success' | 'partial_failure' | 'failed' | 'error';
  errorMessage?: string;
}

export interface GeocoderStatus {
  pendingGeocode: number;
  readiness?: {
    configured: boolean;
    status: GeocoderReadinessStatus;
    message: string;
    nextAction?: string;
  };
  running?: boolean;
  lastRun?: GeocoderLastRun | null;
}

export const fetchGeocoderStatus = () =>
  api.get<GeocoderStatus>('/events/geocoder/status').then((r) => r.data);

export const runGeocoderNow = (limit = 30) =>
  api
    .post<GeocoderRunSummary>(`/events/geocoder/run?limit=${limit}`)
    .then((r) => r.data);

// =================== Coverage Regions (admin) ===================

export interface CoverageRegion {
  id: string;
  name: string;
  status: 'active' | 'bootstrap' | 'inactive';
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
  minLat: number | null;
  maxLat: number | null;
  minLng: number | null;
  maxLng: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageStats {
  activeRegions: number;
  bootstrapRegions: number;
  addresses: number;
  addressRadiusKm: number;
}

export const fetchCoverageRegions = () =>
  api.get<CoverageRegion[]>('/admin/coverage').then((r) => r.data);

export const fetchCoverageStats = () =>
  api.get<CoverageStats>('/admin/coverage/stats').then((r) => r.data);

export const createCoverageRegion = (input: Partial<CoverageRegion>) =>
  api.post<CoverageRegion>('/admin/coverage', input).then((r) => r.data);

export const updateCoverageRegion = (id: string, input: Partial<CoverageRegion>) =>
  api.patch<CoverageRegion>(`/admin/coverage/${id}`, input).then((r) => r.data);

export const deleteCoverageRegion = (id: string) =>
  api.delete<{ ok: true }>(`/admin/coverage/${id}`).then((r) => r.data);

export const checkCoveragePoint = (latitude: number, longitude: number) =>
  api
    .post<{ latitude: number; longitude: number; inCoverage: boolean }>(
      '/admin/coverage/check',
      { latitude, longitude },
    )
    .then((r) => r.data);

export const resetStaleEnrichment = () =>
  api
    .post<{ reset: number }>('/admin/coverage/reset-stale-enrichment')
    .then((r) => r.data);

// =================== Events listing + collectors health ===================

export interface EventListItem {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
  categoria: string | null;
  relevancia: number | null;
  capacidadeEstimada: number | null;
  raioImpactoKm: number | null;
  venueType: string | null;
  venueCapacity: number | null;
  source: string | null;
  outOfScope: boolean;
  pendingGeocode: boolean;
  ativo: boolean;
  latitude: number | null;
  longitude: number | null;
  enrichmentAttempts: number;
  enrichmentLastError: string | null;
  crawledUrl: string | null;
}

export interface EventsListResponse {
  page: number;
  limit: number;
  total: number;
  scope: 'in' | 'out' | 'all';
  items: EventListItem[];
}

export const fetchAdminEventsList = (params: {
  page?: number;
  limit?: number;
  scope?: 'in' | 'out' | 'all';
  source?: string;
  search?: string;
  upcoming?: boolean;
}) =>
  api
    .get<EventsListResponse>('/admin/events/list', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        scope: params.scope ?? 'in',
        source: params.source,
        search: params.search,
        upcoming: params.upcoming ? 'true' : undefined,
      },
    })
    .then((r) => r.data);

export interface CollectorSourceStats {
  source: string;
  total: number;
  last7d: number;
  last24h: number;
  outOfScope: number;
  outOfScopePercent: number;
  pendingGeocode: number;
  pendingEnrichment: number;
  enriched: number;
  withErrors: number;
  errorRate: number;
  lastSeen: string | null;
}

export interface CollectorsHealthResponse {
  generatedAt: string;
  sources: CollectorSourceStats[];
}

export const fetchCollectorsHealth = () =>
  api.get<CollectorsHealthResponse>('/admin/events/collectors-health').then((r) => r.data);

// =================== Events timeline ===================

export interface EventsTimelineBucket {
  day: string; // YYYY-MM-DD
  inScope: number;
  outOfScope: number;
}

export interface EventsTimelineResponse {
  days: number;
  generatedAt: string;
  totalInScope: number;
  totalOutScope: number;
  avgPerDay: number;
  peakDay: { day: string; total: number };
  buckets: EventsTimelineBucket[];
}

export const fetchEventsTimeline = (days = 30) =>
  api
    .get<EventsTimelineResponse>('/admin/events/timeline', { params: { days } })
    .then((r) => r.data);

// =================== Dashboard summary ===================

export interface DashboardSummary {
  generatedAt: string;
  health: 'green' | 'amber' | 'red';
  alerts: Array<{ severity: 'red' | 'amber' | 'info'; message: string }>;
  events: {
    total: number;
    inScope: number;
    outOfScope: number;
    outOfScopePercent: number;
    pendingGeocode: number;
    pendingEnrichment: number;
    last24h: number;
    last7d: number;
    next7d: number;
    next30d: number;
    megaUpcoming: number;
    distinctSources: number;
  };
  waitlist: {
    total: number;
    pending: number;
    invited: number;
    converted: number;
  };
  coverage: {
    activeRegions: number;
    bootstrapRegions: number;
  };
  pricing: {
    last24h: number;
    last30d: number;
    futureRecommendations: number;
    activeAddresses: number;
    activeWithFuturePricing: number;
    coveragePercent: number;
    appliedPriceCaptured: number;
    invalidLocalityAddresses: number;
  };
  dataset: {
    health: 'green' | 'amber' | 'red';
    readiness: Record<string, boolean>;
    blockers: Array<{ severity: 'red' | 'amber' | 'green'; code: string; message: string; nextAction: string }>;
    priceSnapshots: number;
    occupancyRecords: number;
    eventProximityFeatures: number;
    latestSnapshotDate: string | null;
  };
  billing: {
    activeSubscriptions: number;
    legacyPedingPayments: number;
    stripeSecretConfigured: boolean;
    stripeWebhookConfigured: boolean;
    stripePublishableConfigured?: boolean;
    stripeSecretMode?: 'test' | 'live' | 'unknown' | 'missing';
    stripePublishableMode?: 'test' | 'live' | 'unknown' | 'missing';
    stripeModeMismatch?: boolean;
    byStatus: Array<{ status: string; count: number }>;
  };
  email?: {
    mailerSendApiKeyConfigured: boolean;
    emailSenderConfigured: boolean;
    senderDomain: string;
    senderUsesUrbanDomain: boolean;
    frontUrlConfigured: boolean;
  };
  stays: {
    accounts: number;
    listings: number;
    priceUpdatesLast30d: number;
    apiBaseConfigured: boolean;
    tokenEncryptionConfigured: boolean;
    betaPrivate: boolean;
  };
  support?: {
    open: number;
    overdue: number;
    p0Open: number;
    lgpdOpen: number;
  };
  revenue: {
    activeSubscriptions: number;
  };
  topSources: Array<{ source: string; count: number }>;
  timeline: {
    days: number;
    buckets: Array<{ day: string; inScope: number; outOfScope: number }>;
  };
}

export const fetchDashboardSummary = () =>
  api.get<DashboardSummary>('/admin/dashboard-summary').then((r) => r.data);

// =================== Pace (booked vs expected) ===================

/**
 * Ponto da curva de pace exposto pelo backend (Gap 4 — Dev 1).
 *
 * Contrato esperado quando o endpoint estiver pronto:
 *   GET /properties/:id/pace?targetDateFrom=YYYY-MM-DD&targetDateTo=YYYY-MM-DD
 *   GET /pace/portfolio?targetDateFrom=YYYY-MM-DD&targetDateTo=YYYY-MM-DD
 * Resposta:
 *   { points: [{ date, booked, expected, eventLabel? }, ...] }
 *
 * Enquanto o backend não entrega, geramos mock realista local (controlado por
 * `NEXT_PUBLIC_PACE_MOCK_DATA=true`, default true).
 */
export interface PaceApiPoint {
  date: string;
  booked: number;
  expected: number;
  eventLabel?: string | null;
}

export interface PaceApiResponse {
  points: PaceApiPoint[];
}

const PACE_USE_MOCK =
  (process.env.NEXT_PUBLIC_PACE_MOCK_DATA ?? 'true').toLowerCase() !== 'false';

function isoFromDaysAhead(daysAhead: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/**
 * Mock realista de pace pra próximos 60 dias.
 *
 * Modelo:
 *  - booked sobe conforme proximidade da data (close-in mais cheio): ~75% em 0d,
 *    desce até ~25% em 60d, com microvariação por ruído determinístico.
 *  - expected: baseline ~55-65% com sazonalidade leve.
 *  - 3 eventos espalhados (15d, 32d, 47d).
 */
function generatePaceMock(propertyId?: string, days = 60): PaceApiPoint[] {
  // Seed determinístico baseado em propertyId pra ficar estável entre reloads.
  const seedBase = (propertyId ?? 'portfolio').length;
  const points: PaceApiPoint[] = [];

  const eventDays: Record<number, string> = {
    15: 'Show internacional',
    32: 'Feriado prolongado',
    47: 'Convenção corporativa',
  };

  for (let i = 0; i < days; i++) {
    // booked: curva decrescente (mais cheio perto, mais vazio longe) com ruído
    const proximityFactor = 1 - i / days; // 1 -> 0
    const noise = Math.sin((i + seedBase) * 0.7) * 6;
    let booked = 28 + proximityFactor * 50 + noise;
    // Boost em dias de evento
    if (eventDays[i]) booked += 12;

    // expected: baseline mais plana com leve sazonalidade semanal
    const weekday = (new Date(isoFromDaysAhead(i)).getDay() + 7) % 7;
    const isWeekend = weekday === 5 || weekday === 6;
    const expected = (isWeekend ? 68 : 54) + Math.sin(i * 0.18) * 4;

    points.push({
      date: isoFromDaysAhead(i),
      booked: Math.max(0, Math.min(100, booked)),
      expected: Math.max(0, Math.min(100, expected)),
      eventLabel: eventDays[i] ?? null,
    });
  }
  return points;
}

/**
 * fetchPace — busca pace para um imóvel específico ou para o portfólio.
 *
 * Quando `NEXT_PUBLIC_PACE_MOCK_DATA=true` (default), retorna mock local.
 * Quando false, chama o endpoint real do Dev 1.
 *
 * Range default: hoje até hoje+60 dias.
 */
export async function fetchPace(
  propertyId?: string,
  options?: { days?: number },
): Promise<PaceApiPoint[]> {
  const days = options?.days ?? 60;

  if (PACE_USE_MOCK) {
    // Simula latência ~150ms pra exercitar loading state em dev.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return generatePaceMock(propertyId, days);
  }

  const targetDateFrom = isoFromDaysAhead(0);
  const targetDateTo = isoFromDaysAhead(days);
  const endpoint = propertyId
    ? `/properties/${encodeURIComponent(propertyId)}/pace`
    : '/pace/portfolio';

  try {
    const { data } = await api.get<PaceApiResponse>(endpoint, {
      params: { targetDateFrom, targetDateTo },
    });
    return data?.points ?? [];
  } catch (err) {
    // Backend ainda não entregou — fallback gracioso pro mock.
    console.warn('[fetchPace] endpoint indisponível, usando mock:', err);
    return generatePaceMock(propertyId, days);
  }
}

// =================== Portfolio calendar (Gap 1 — Dev 1 ↔ Dev 2) ===================

/**
 * Contrato B — `/portfolio/calendar` payload (Dev 1 → Dev 2).
 *
 *   GET /portfolio/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   → {
 *       properties: [{
 *         propertyId: string;
 *         name: string;
 *         thumbnail: string | null;
 *         days: [{
 *           date: string;
 *           sugestao: number | null;
 *           atual: number;
 *           evento: { id: string; nome: string; impacto: 'alta' | 'media' } | null;
 *         }];
 *       }]
 *     }
 *
 * Enquanto Dev 1 não entrega (semana 2), usamos mock realista controlado por
 * `NEXT_PUBLIC_PORTFOLIO_MOCK_DATA` (default = mock ativo, set 'false' pra
 * tentar o endpoint real).
 */
export type PortfolioEventImpact = 'alta' | 'media';

export interface PortfolioEvent {
  id: string;
  nome: string;
  impacto: PortfolioEventImpact;
}

export interface PortfolioDay {
  date: string;
  sugestao: number | null;
  atual: number;
  evento: PortfolioEvent | null;
}

export interface PortfolioProperty {
  propertyId: string;
  name: string;
  thumbnail: string | null;
  days: PortfolioDay[];
}

export interface PortfolioCalendarResponse {
  properties: PortfolioProperty[];
}

export interface PortfolioCalendarInput {
  from: string;
  to: string;
  propertyIds?: string[];
  strategy?: string;
}

const PORTFOLIO_USE_MOCK =
  (process.env.NEXT_PUBLIC_PORTFOLIO_MOCK_DATA ?? 'true').toLowerCase() !== 'false';

const PORTFOLIO_MOCK_PROPERTIES: ReadonlyArray<{
  propertyId: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
}> = [
  { propertyId: 'pf-alpha-01', name: 'Studio Faria Lima', thumbnail: null, basePrice: 320 },
  { propertyId: 'pf-alpha-02', name: 'Loft Jardins', thumbnail: null, basePrice: 410 },
  { propertyId: 'pf-alpha-03', name: 'Apto 2qts Vila Madalena', thumbnail: null, basePrice: 285 },
  { propertyId: 'pf-alpha-04', name: 'Cobertura Itaim', thumbnail: null, basePrice: 690 },
  { propertyId: 'pf-alpha-05', name: 'Casa Pinheiros', thumbnail: null, basePrice: 510 },
];

const PORTFOLIO_MOCK_EVENTS: ReadonlyArray<Omit<PortfolioEvent, 'id'> & { offset: number }> = [
  { offset: 6, nome: 'Show internacional Allianz', impacto: 'alta' },
  { offset: 14, nome: 'Feriado prolongado', impacto: 'media' },
  { offset: 22, nome: 'Convenção corporativa Expo', impacto: 'alta' },
  { offset: 34, nome: 'Festival gastronômico', impacto: 'media' },
  { offset: 48, nome: 'Show internacional Morumbi', impacto: 'alta' },
];

function isoDateAt(daysAhead: number, base?: Date): string {
  const d = base ? new Date(base) : new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function generatePortfolioMock(input: PortfolioCalendarInput): PortfolioCalendarResponse {
  const fromIso = input.from;
  const totalDays = Math.min(180, daysBetween(input.from, input.to) + 1);
  const baseDate = new Date(fromIso);

  const filterIds = input.propertyIds && input.propertyIds.length > 0
    ? new Set(input.propertyIds)
    : null;

  const properties: PortfolioProperty[] = PORTFOLIO_MOCK_PROPERTIES
    .filter((p) => (filterIds ? filterIds.has(p.propertyId) : true))
    .map((p, propertyIdx) => {
      const days: PortfolioDay[] = [];
      for (let i = 0; i < totalDays; i++) {
        const date = isoDateAt(i, baseDate);
        const matchedEvent = PORTFOLIO_MOCK_EVENTS.find(
          (ev) => ev.offset === ((i + propertyIdx) % 60),
        );
        const evento: PortfolioEvent | null = matchedEvent
          ? {
              id: `${p.propertyId}-ev-${matchedEvent.offset}`,
              nome: matchedEvent.nome,
              impacto: matchedEvent.impacto,
            }
          : null;

        // sugestao só em ~50% dos dias, com bump quando há evento próximo
        const hasSuggestion = (i + propertyIdx) % 2 === 0 || evento !== null;
        const eventBoost = evento
          ? evento.impacto === 'alta' ? 1.45 : 1.2
          : 1.0;
        const weekday = (new Date(date).getDay() + 7) % 7;
        const weekendBoost = weekday === 5 || weekday === 6 ? 1.12 : 1.0;
        const sugestao = hasSuggestion
          ? Math.round(p.basePrice * eventBoost * weekendBoost)
          : null;

        days.push({
          date,
          sugestao,
          atual: p.basePrice,
          evento,
        });
      }
      return {
        propertyId: p.propertyId,
        name: p.name,
        thumbnail: p.thumbnail,
        days,
      };
    });

  return { properties };
}

/**
 * fetchPortfolioCalendar — multi-imóvel calendar (Gap 1).
 *
 * Quando `NEXT_PUBLIC_PORTFOLIO_MOCK_DATA !== 'false'` (default), retorna mock
 * local. Caso contrário, chama `GET /portfolio/calendar` com fallback gracioso
 * pro mock se o backend ainda não respondeu.
 */
export async function fetchPortfolioCalendar(
  input: PortfolioCalendarInput,
): Promise<PortfolioCalendarResponse> {
  if (PORTFOLIO_USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return generatePortfolioMock(input);
  }

  try {
    const { data } = await api.get<PortfolioCalendarResponse>('/portfolio/calendar', {
      params: {
        from: input.from,
        to: input.to,
        propertyIds: input.propertyIds?.join(',') || undefined,
        strategy: input.strategy && input.strategy !== 'todas' ? input.strategy : undefined,
      },
    });
    return data ?? { properties: [] };
  } catch (err) {
    console.warn('[fetchPortfolioCalendar] endpoint indisponível, usando mock:', err);
    return generatePortfolioMock(input);
  }
}

/**
 * Contrato C — `/portfolio/bulk-action` (Dev 2 → Dev 1).
 *
 *   POST /portfolio/bulk-action
 *   {
 *     propertyIds: string[];
 *     action: 'apply-strategy' | 'set-base-price' | 'accept-suggestions' | string;
 *     payload?: Record<string, unknown>;
 *   }
 *   → { applied: number; failed: { propertyId: string; reason: string }[]; auditLogId: string }
 */
export type PortfolioBulkAction =
  | 'apply-strategy'
  | 'set-base-price'
  | 'accept-suggestions'
  | string;

export interface PortfolioBulkActionInput {
  propertyIds: string[];
  action: PortfolioBulkAction;
  payload?: Record<string, unknown>;
}

export interface PortfolioBulkActionFailure {
  propertyId: string;
  reason: string;
}

export interface PortfolioBulkActionResponse {
  applied: number;
  failed: PortfolioBulkActionFailure[];
  auditLogId: string;
}

export async function mutatePortfolioBulkAction(
  input: PortfolioBulkActionInput,
): Promise<PortfolioBulkActionResponse> {
  if (PORTFOLIO_USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      applied: input.propertyIds.length,
      failed: [],
      auditLogId: `mock-${Date.now()}`,
    };
  }

  try {
    const { data } = await api.post<PortfolioBulkActionResponse>('/portfolio/bulk-action', input);
    return data;
  } catch (err) {
    console.warn('[mutatePortfolioBulkAction] endpoint indisponível, retornando mock:', err);
    return {
      applied: input.propertyIds.length,
      failed: [],
      auditLogId: `mock-fallback-${Date.now()}`,
    };
  }
}

// === Gap 2 — Pricing Rules ===
// Semana 5-6, Track 2. Tela `/properties/:id/pricing-rules` — accordion com 8
// regras por imóvel. Backend (Dev 1) ainda não entregou na semana 5, então o
// flag `NEXT_PUBLIC_PRICING_RULES_MOCK_DATA` controla mock (default true em dev).
// Quando backend entregar:
//   POST /properties/:id/pricing-rules/preview  → preview 14d
//   GET  /properties/:id/pricing-rules           → regras atuais
//   PUT  /properties/:id/pricing-rules           → salva (atomic)
//   POST /properties/:id/pricing-rules/copy-from/:sourceId → copia outro

export type PricingRuleType =
  | 'weekend_uplift'
  | 'weekday_discount'
  | 'gap_night_filler'
  | 'last_minute'
  | 'length_of_stay'
  | 'min_stay_dynamic'
  | 'occupancy_floor'
  | 'event_uplift';

export type PricingRule = {
  type: PricingRuleType;
  enabled: boolean;
  params: Record<string, number>;
  label: string;
  description: string;
};

export type PricingRulesResponse = {
  propertyId: string;
  rules: PricingRule[];
  updatedAt: string | null;
};

export type PricingRulesPreviewDay = {
  date: string;
  basePrice: number;
  rulesPrice: number;
  appliedRules: PricingRuleType[];
};

export type PricingRulesPreviewResponse = {
  days: PricingRulesPreviewDay[];
};

/** Defaults inteligentes — usados na primeira vez que o anfitrião abre a tela. */
export const PRICING_RULES_DEFAULTS: ReadonlyArray<PricingRule> = [
  {
    type: 'weekend_uplift',
    enabled: true,
    params: { percent: 15 },
    label: 'Uplift de fim de semana',
    description:
      'Sex/sáb costumam ter procura maior. Aumenta o preço base nesses dias automaticamente.',
  },
  {
    type: 'weekday_discount',
    enabled: true,
    params: { percent: -8 },
    label: 'Desconto dias úteis lentos',
    description:
      'Seg/ter/qua geralmente têm menos demanda. Aplica um desconto suave pra puxar reservas.',
  },
  {
    type: 'gap_night_filler',
    enabled: true,
    params: { percent: -20, maxNights: 2 },
    label: 'Gap night filler',
    description:
      'Quando sobra 1–2 noites entre duas reservas confirmadas, baixa o preço pra fechar o buraco e não perder a noite.',
  },
  {
    type: 'last_minute',
    enabled: true,
    params: { percent: -12, daysBefore: 3 },
    label: 'Last-minute',
    description:
      'Se faltam ≤3 dias pra data e ainda está vazio, é melhor ocupar com desconto do que ficar sem hóspede.',
  },
  {
    type: 'length_of_stay',
    enabled: false,
    params: { percent: -10, minNights: 7 },
    label: 'Desconto estadia longa',
    description:
      'Estadias ≥7 noites geram receita estável e menos turnover. Dá um desconto pra atrair esse perfil.',
  },
  {
    type: 'min_stay_dynamic',
    enabled: false,
    params: { baseMinNights: 2, highMinNights: 3, occupancyThreshold: 70 },
    label: 'Estadia mínima dinâmica',
    description:
      'Quando a ocupação no período subir acima de 70%, aumenta a estadia mínima automaticamente — protege margem em momentos quentes.',
  },
  {
    type: 'occupancy_floor',
    enabled: true,
    params: { minPrice: 180 },
    label: 'Piso de preço',
    description:
      'Garante que nenhuma regra (sozinha ou combinada) baixe o preço abaixo desse valor. Trava de segurança.',
  },
  {
    type: 'event_uplift',
    enabled: true,
    params: { percent: 25, radiusKm: 3 },
    label: 'Uplift por evento de alto impacto',
    description:
      'Quando há evento com impacto "alta" no raio de 3km da sua propriedade, aplica um uplift extra. Captura o pico de demanda.',
  },
];

const PRICING_RULES_USE_MOCK =
  (process.env.NEXT_PUBLIC_PRICING_RULES_MOCK_DATA ?? 'true').toLowerCase() !== 'false';

function clonePricingRules(rules: ReadonlyArray<PricingRule>): PricingRule[] {
  return rules.map((r) => ({
    type: r.type,
    enabled: r.enabled,
    params: { ...r.params },
    label: r.label,
    description: r.description,
  }));
}

function pricingRulesISODate(daysAhead: number, base?: Date): string {
  const d = base ? new Date(base) : new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function hashPropertyId(propertyId: string): number {
  let h = 0;
  for (let i = 0; i < propertyId.length; i++) {
    h = (h * 31 + propertyId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Gera 14 dias de mock realista. Baseline R$ 250–280 com leve variação por dia,
 * e aplica cada regra ligada localmente pra simular o preview.
 */
function generatePricingRulesPreviewMock(
  propertyId: string,
  rules: ReadonlyArray<PricingRule>,
): PricingRulesPreviewResponse {
  const h = hashPropertyId(propertyId);
  const baseline = 250 + (h % 30); // R$ 250–279 estável por imóvel
  const days: PricingRulesPreviewDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2 eventos de alto impacto em ~14 dias pra mock ficar interessante
  const eventDays = new Set<number>([3 + (h % 4), 9 + (h % 3)]);
  // Lacuna de gap-night entre duas reservas: dia 5
  const gapDays = new Set<number>([5]);

  for (let i = 0; i < 14; i++) {
    const iso = pricingRulesISODate(i, today);
    const weekday = (new Date(iso).getDay() + 7) % 7;
    const isWeekend = weekday === 5 || weekday === 6;
    const isWeekdaySlow = weekday === 1 || weekday === 2 || weekday === 3;
    const isGap = gapDays.has(i);
    const isLastMinute = i <= 3;
    const isHighEvent = eventDays.has(i);

    // base price com leve ondulação senoidal (~+/-5)
    const basePrice = Math.round(baseline + Math.sin(i / 2) * 5);
    let price = basePrice;
    const applied: PricingRuleType[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;
      switch (rule.type) {
        case 'weekend_uplift':
          if (isWeekend) {
            price = Math.round(price * (1 + (rule.params.percent ?? 0) / 100));
            applied.push(rule.type);
          }
          break;
        case 'weekday_discount':
          if (isWeekdaySlow) {
            price = Math.round(price * (1 + (rule.params.percent ?? 0) / 100));
            applied.push(rule.type);
          }
          break;
        case 'gap_night_filler':
          if (isGap) {
            price = Math.round(price * (1 + (rule.params.percent ?? 0) / 100));
            applied.push(rule.type);
          }
          break;
        case 'last_minute': {
          const within = (rule.params.daysBefore ?? 3);
          if (i <= within && isLastMinute) {
            price = Math.round(price * (1 + (rule.params.percent ?? 0) / 100));
            applied.push(rule.type);
          }
          break;
        }
        case 'length_of_stay':
          // No preview por dia não aplica — é por reserva. Ignora.
          break;
        case 'min_stay_dynamic':
          // Mesmo caso — não muda preço, muda min stay. Ignora no preço.
          break;
        case 'event_uplift':
          if (isHighEvent) {
            price = Math.round(price * (1 + (rule.params.percent ?? 0) / 100));
            applied.push(rule.type);
          }
          break;
        case 'occupancy_floor': {
          const floor = rule.params.minPrice ?? 0;
          if (price < floor) {
            price = floor;
            applied.push(rule.type);
          }
          break;
        }
      }
    }

    days.push({
      date: iso,
      basePrice,
      rulesPrice: price,
      appliedRules: applied,
    });
  }

  return { days };
}

const PRICING_RULES_MOCK_STORE: Record<string, PricingRulesResponse> = {};

function getOrInitMock(propertyId: string): PricingRulesResponse {
  if (!PRICING_RULES_MOCK_STORE[propertyId]) {
    PRICING_RULES_MOCK_STORE[propertyId] = {
      propertyId,
      rules: clonePricingRules(PRICING_RULES_DEFAULTS),
      updatedAt: null,
    };
  }
  return PRICING_RULES_MOCK_STORE[propertyId];
}

export async function fetchPricingRules(propertyId: string): Promise<PricingRulesResponse> {
  if (PRICING_RULES_USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    const stored = getOrInitMock(propertyId);
    return {
      propertyId: stored.propertyId,
      rules: clonePricingRules(stored.rules),
      updatedAt: stored.updatedAt,
    };
  }
  try {
    const { data } = await api.get<PricingRulesResponse>(
      `/properties/${propertyId}/pricing-rules`,
    );
    if (!data || !Array.isArray(data.rules) || data.rules.length === 0) {
      return {
        propertyId,
        rules: clonePricingRules(PRICING_RULES_DEFAULTS),
        updatedAt: null,
      };
    }
    return data;
  } catch (err) {
    console.warn('[fetchPricingRules] endpoint indisponível, usando defaults:', err);
    return {
      propertyId,
      rules: clonePricingRules(PRICING_RULES_DEFAULTS),
      updatedAt: null,
    };
  }
}

export async function savePricingRules(
  propertyId: string,
  rules: PricingRule[],
): Promise<PricingRulesResponse> {
  if (PRICING_RULES_USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 260));
    const updatedAt = new Date().toISOString();
    PRICING_RULES_MOCK_STORE[propertyId] = {
      propertyId,
      rules: clonePricingRules(rules),
      updatedAt,
    };
    return {
      propertyId,
      rules: clonePricingRules(rules),
      updatedAt,
    };
  }
  try {
    const { data } = await api.put<PricingRulesResponse>(
      `/properties/${propertyId}/pricing-rules`,
      { rules },
    );
    return data;
  } catch (err) {
    console.error('[savePricingRules] falha ao salvar:', err);
    throw err;
  }
}

export async function previewPricingRules(
  propertyId: string,
  rules: PricingRule[],
): Promise<PricingRulesPreviewResponse> {
  if (PRICING_RULES_USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 140));
    return generatePricingRulesPreviewMock(propertyId, rules);
  }
  try {
    const { data } = await api.post<PricingRulesPreviewResponse>(
      `/properties/${propertyId}/pricing-rules/preview`,
      { rules },
    );
    return data ?? { days: [] };
  } catch (err) {
    console.warn('[previewPricingRules] endpoint indisponível, usando mock:', err);
    return generatePricingRulesPreviewMock(propertyId, rules);
  }
}

export async function copyPricingRulesFromProperty(
  sourceId: string,
  targetId: string,
): Promise<PricingRulesResponse> {
  if (PRICING_RULES_USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    const source = getOrInitMock(sourceId);
    const updatedAt = new Date().toISOString();
    PRICING_RULES_MOCK_STORE[targetId] = {
      propertyId: targetId,
      rules: clonePricingRules(source.rules),
      updatedAt,
    };
    return {
      propertyId: targetId,
      rules: clonePricingRules(source.rules),
      updatedAt,
    };
  }
  try {
    const { data } = await api.post<PricingRulesResponse>(
      `/properties/${targetId}/pricing-rules/copy-from/${sourceId}`,
    );
    return data;
  } catch (err) {
    console.error('[copyPricingRulesFromProperty] falha:', err);
    throw err;
  }
}

// === Gap 3 — Market Intel ===
/**
 * Market Intel dashboard (Gap 3 — Track 2, semana 5-6).
 *
 * Endpoint planejado pelo Dev 1:
 *   GET /properties/:id/market-intel?from=&to=
 *   → MarketIntelResponse
 *
 * Enquanto o backend não entrega, este módulo serve mock realista controlado
 * por `NEXT_PUBLIC_MARKET_INTEL_MOCK_DATA` (default 'true' em dev).
 *
 * Caso especial: `propertyId === 'empty-comp-test'` retorna apenas 3
 * comparáveis pra testar o empty state da tela `/properties/:id/market`.
 */
export type ComparableProperty = {
  anonymousId: string;
  type: 'apartamento' | 'casa' | 'loft' | 'studio';
  bedrooms: number;
  medianAdr: number;
  occupancy: number;
  distanceKm: number;
  similarityScore: number;
};

export type MarketIntelDailyPoint = {
  date: string;
  yourAdr: number;
  medianAdr: number;
};

export type MarketIntelResponse = {
  propertyId: string;
  neighborhood: string;
  percentile: number;
  percentileTrend30d: number;
  comparablesCount: number;
  medianAdr: number;
  medianOccupancy: number;
  yourAdr: number;
  yourOccupancy: number;
  eventReactivity: number;
  daily: MarketIntelDailyPoint[];
  comparables: ComparableProperty[];
  updatedAt: string;
};

export type MarketIntelInput = {
  propertyId: string;
  from?: string;
  to?: string;
};

const MARKET_INTEL_USE_MOCK =
  (process.env.NEXT_PUBLIC_MARKET_INTEL_MOCK_DATA ?? 'true').toLowerCase() !== 'false';

const MARKET_INTEL_TYPES: ReadonlyArray<ComparableProperty['type']> = [
  'apartamento',
  'loft',
  'studio',
  'casa',
];

function marketIntelRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function marketIntelSeedFromString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function marketIntelDaysBetween(fromIso: string, toIso: string): number {
  const f = new Date(fromIso);
  const t = new Date(toIso);
  const ms = t.getTime() - f.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function marketIntelIsoOffset(daysAhead: number, base?: Date): string {
  const d = base ? new Date(base) : new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function generateMarketIntelDaily(
  propertyId: string,
  fromIso: string,
  totalDays: number,
): MarketIntelDailyPoint[] {
  const rng = marketIntelRng(marketIntelSeedFromString(`${propertyId}:daily`));
  const base = new Date(fromIso);
  const out: MarketIntelDailyPoint[] = [];

  // Curva orgânica — combina baseline (oscila com tendência leve de alta),
  // sazonalidade semanal (fim-de-semana +R$ 20-30) e ruído diário.
  for (let i = 0; i < totalDays; i++) {
    const date = marketIntelIsoOffset(i, base);
    const weekday = (new Date(date).getDay() + 7) % 7;
    const isWeekend = weekday === 5 || weekday === 6;

    const yourTrend = 260 + i * 0.6; // pequena alta ao longo dos 30d
    const yourWeek = isWeekend ? 28 : 0;
    const yourNoise = (rng() - 0.5) * 28;
    const yourAdr = Math.round(yourTrend + yourWeek + yourNoise);

    const medianTrend = 240 + i * 0.2;
    const medianWeek = isWeekend ? 18 : 0;
    const medianNoise = (rng() - 0.5) * 18;
    const medianAdr = Math.round(medianTrend + medianWeek + medianNoise);

    out.push({
      date,
      yourAdr: Math.max(220, Math.min(330, yourAdr)),
      medianAdr: Math.max(210, Math.min(280, medianAdr)),
    });
  }
  return out;
}

function generateMarketIntelComparables(
  propertyId: string,
  count: number,
): ComparableProperty[] {
  const rng = marketIntelRng(marketIntelSeedFromString(`${propertyId}:comps`));
  const out: ComparableProperty[] = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let i = 0; i < count; i++) {
    const type = MARKET_INTEL_TYPES[Math.floor(rng() * MARKET_INTEL_TYPES.length)];
    // bedrooms: studio sempre 0, demais 1-3
    const bedrooms = type === 'studio' ? 0 : 1 + Math.floor(rng() * 3);
    const medianAdr = Math.round(220 + rng() * 80); // R$ 220-300
    const occupancy = Number((0.58 + rng() * 0.32).toFixed(2)); // 58-90%
    const distanceKm = Number((0.4 + rng() * 2.6).toFixed(2)); // 0.4-3.0km
    // similarity inversamente proporcional à distância + leve ruído
    const similarityBase = 0.95 - distanceKm / 6;
    const similarityScore = Number(
      Math.max(0.45, Math.min(0.98, similarityBase + (rng() - 0.5) * 0.08)).toFixed(2),
    );

    out.push({
      anonymousId: letters.charAt(i % letters.length),
      type,
      bedrooms,
      medianAdr,
      occupancy,
      distanceKm,
      similarityScore,
    });
  }
  // Ordena por similaridade decrescente — mais relevantes primeiro
  return out.sort((a, b) => b.similarityScore - a.similarityScore);
}

function generateMarketIntelMock(input: MarketIntelInput): MarketIntelResponse {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultFrom = marketIntelIsoOffset(-29, today);
  const defaultTo = marketIntelIsoOffset(0, today);
  const fromIso = input.from ?? defaultFrom;
  const toIso = input.to ?? defaultTo;
  const totalDays = Math.max(1, Math.min(90, marketIntelDaysBetween(fromIso, toIso) + 1));

  const isEmpty = input.propertyId === 'empty-comp-test';
  const comparables = generateMarketIntelComparables(
    input.propertyId,
    isEmpty ? 3 : 10,
  );

  const daily = generateMarketIntelDaily(input.propertyId, fromIso, totalDays);
  const yourAdr = Math.round(
    daily.reduce((acc, p) => acc + p.yourAdr, 0) / Math.max(1, daily.length),
  );
  const medianAdrSeries = Math.round(
    daily.reduce((acc, p) => acc + p.medianAdr, 0) / Math.max(1, daily.length),
  );
  const medianOccupancy =
    comparables.length > 0
      ? Number(
          (
            comparables.reduce((acc, c) => acc + c.occupancy, 0) /
            comparables.length
          ).toFixed(2),
        )
      : 0;

  return {
    propertyId: input.propertyId,
    neighborhood: 'Pinheiros',
    percentile: isEmpty ? 0 : 73,
    percentileTrend30d: isEmpty ? 0 : 4,
    comparablesCount: comparables.length,
    medianAdr: medianAdrSeries,
    medianOccupancy,
    yourAdr,
    yourOccupancy: 0.78,
    eventReactivity: isEmpty ? 0 : 62,
    daily,
    comparables,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * fetchMarketIntel — comparáveis + percentile + série diária ADR (Gap 3).
 *
 * Quando `NEXT_PUBLIC_MARKET_INTEL_MOCK_DATA !== 'false'` (default), retorna
 * mock realista local. Caso contrário, chama
 * `GET /properties/:id/market-intel` com fallback gracioso pro mock se o
 * backend ainda não respondeu.
 */
export async function fetchMarketIntel(
  input: MarketIntelInput,
): Promise<MarketIntelResponse> {
  if (MARKET_INTEL_USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 220));
    return generateMarketIntelMock(input);
  }

  try {
    const { data } = await api.get<MarketIntelResponse>(
      `/properties/${encodeURIComponent(input.propertyId)}/market-intel`,
      {
        params: {
          from: input.from,
          to: input.to,
        },
      },
    );
    if (!data) throw new Error('empty response');
    return data;
  } catch (err) {
    console.warn('[fetchMarketIntel] endpoint indisponível, usando mock:', err);
    return generateMarketIntelMock(input);
  }
}
