import axios from "axios";
import { Connect, CreateAddressDto } from "../types/connect";
import { List, Address } from "../types/connect"; // Crie esse tipo DTO correspondente à entidade List
import { Subscription } from "../componentes/Subscription";
import {
  mockFetchHostEventCatalog,
  mockFetchHostEventDetail,
  mockFetchHostEventHeatmap,
  mockFetchHostEventRadar,
  mockSimulateHostEventPricing,
} from "./hostEventRadarMocks";
import { dateAtLocalOffset, formatLocalDate } from "../lib/date";

// Base URL configurada via variável de ambiente
const url = process.env.NEXT_PUBLIC_API_URL;
const enableContractFallback = process.env.NEXT_PUBLIC_ENABLE_CONTRACT_FALLBACK === "true";

export function getFriendlyApiErrorMessage(error: unknown, fallback?: string): string {
  const status = (error as any)?.response?.status;
  const code = (error as any)?.response?.data?.code;
  const userMessage = (error as any)?.userMessage;

  if (typeof userMessage === "string" && userMessage.trim()) return userMessage;

  if (code === "LISTINGS_QUOTA_EXCEEDED") {
    return "Você atingiu o limite de imóveis do seu plano. Ajuste seu plano para cadastrar mais imóveis.";
  }

  if (status === 400) return fallback ?? "Revise os dados informados e tente novamente.";
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if (status === 403) return "Você não tem permissão para fazer esta ação.";
  if (status === 404) return fallback ?? "Não encontramos essa informação agora.";
  if (status === 409) return fallback ?? "Essa ação entrou em conflito com uma informação já salva.";
  if (status === 422) return fallback ?? "Algum dado precisa ser corrigido antes de continuar.";
  if (status === 429) return "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.";
  if (status >= 500) return "A Urban AI encontrou uma instabilidade. Tente novamente em alguns instantes.";

  if ((error as any)?.code === "ECONNABORTED") {
    return "A conexão demorou mais que o esperado. Tente novamente.";
  }

  if ((error as any)?.message === "Network Error") {
    return "Não foi possível conectar com a Urban AI. Verifique sua internet e tente novamente.";
  }

  return fallback ?? "Não conseguimos concluir agora. Tente novamente em alguns instantes.";
}

// Cria instância do axios com baseURL
export const api = axios.create({
  baseURL: url,
  withCredentials: true,
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
 *   Exceção: rotas públicas (/lancamento, /landing, /precos, /sobre, /contato,
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

let refreshPromise: Promise<void> | null = null;

function shouldSkipRefresh(requestUrl: string): boolean {
  return (
    requestUrl.endsWith("/auth/login") ||
    requestUrl.endsWith("/auth/google") ||
    requestUrl.endsWith("/auth/register") ||
    requestUrl.endsWith("/auth/refresh") ||
    requestUrl.endsWith("/auth/logout")
  );
}

function refreshSessionOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const status = error?.response?.status;
    const originalRequest = error?.config as any;
    const requestUrl: string = originalRequest?.url ?? "";
    const pathname = window.location.pathname || "";
    error.userMessage = getFriendlyApiErrorMessage(error);

    // 401: primeiro tenta renovar via refresh cookie. Se falhar, cai no fluxo
    // antigo de limpar sessão/redirecionar.
    if (status === 401) {
      const canRefresh =
        originalRequest &&
        !originalRequest._retry &&
        !shouldSkipRefresh(requestUrl) &&
        !isPublicPath(pathname);

      if (canRefresh) {
        originalRequest._retry = true;
        try {
          await refreshSessionOnce();
          return api(originalRequest);
        } catch {
          // continua para o redirecionamento abaixo
        }
      }

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

    // 403: usuário logado mas sem permissão — manda pra página 403 amigável.
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
  internalNickname?: string | null;
  internalCode?: string | null;
  manualDailyPrice?: number | null;
  averageMonthlyRevenue?: number | null;
  dailyPrice?: number | null;
  pricingInputSource?: string | null;
  pricingInputsUpdatedAt: string | null;
  cep?: string | null;
  numero?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  addressLine?: string | null;
  locationLabel?: string | null;
  setupStatus?: PropertySetupStatus;
  nome: string;
};

function propertyIdentityValue(value?: string | null): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function pushUniquePropertyPart(parts: string[], value?: string | null) {
  const normalized = propertyIdentityValue(value);
  if (!normalized) return;
  const alreadyIncluded = parts.some(
    (part) => part.localeCompare(normalized, "pt-BR", { sensitivity: "accent" }) === 0,
  );
  if (!alreadyIncluded) parts.push(normalized);
}

export function formatPropertyIdentityLabel(property?: Partial<PropertyDropdown> | null): string {
  if (!property) return "Imóvel";
  const parts: string[] = [];
  pushUniquePropertyPart(parts, property.internalNickname);
  pushUniquePropertyPart(parts, property.internalCode);
  pushUniquePropertyPart(parts, property.propertyName);
  pushUniquePropertyPart(parts, property.nome);
  return parts.length > 0 ? parts.join(" - ") : property.id || "Imóvel";
}

export function formatPropertyPrimaryLabel(property?: Partial<PropertyDropdown> | null): string {
  if (!property) return "Imóvel";
  const parts: string[] = [];
  pushUniquePropertyPart(parts, property.internalNickname);
  pushUniquePropertyPart(parts, property.internalCode);
  if (parts.length === 0) {
    pushUniquePropertyPart(parts, property.propertyName);
    pushUniquePropertyPart(parts, property.nome);
  }
  return parts.length > 0 ? parts.join(" - ") : property.id || "Imóvel";
}

export function formatPropertySecondaryLabel(property?: Partial<PropertyDropdown> | null): string | null {
  if (!property) return null;
  const primary = formatPropertyPrimaryLabel(property);
  const rawName = propertyIdentityValue(property.propertyName) || propertyIdentityValue(property.nome);
  if (rawName && rawName.localeCompare(primary, "pt-BR", { sensitivity: "accent" }) !== 0) {
    return rawName;
  }
  return property.locationLabel || property.addressLine || null;
}

export function formatPropertySearchLabel(property?: Partial<PropertyDropdown> | null): string {
  if (!property) return "";
  return [
    formatPropertyIdentityLabel(property),
    property.id_do_anuncio ? `Airbnb ${property.id_do_anuncio}` : null,
    property.locationLabel,
    property.addressLine,
    property.id,
  ]
    .filter(Boolean)
    .join(" ");
}

export type PropertyDetail = {
  id: string;
  cep?: string | null;
  numero?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ativo?: boolean;
  created_at: string;
  updated_at: string;
  analisado?: string;
  list?: {
    id: string;
    titulo: string;
    id_do_anuncio?: string | null;
    internalNickname?: string | null;
    internalCode?: string | null;
    pictureUrl?: string | null;
    priceText?: string | null;
    raw?: number | null;
    currency?: string | null;
    dailyPrice?: number | null;
    manualDailyPrice?: number | null;
    averageMonthlyRevenue?: number | null;
    pricingInputSource?: string | null;
    pricingInputsUpdatedAt: string | null;
    hospedes?: number | null;
    quartos?: number | null;
    camas?: number | null;
    banheiros?: number | null;
    rating?: number | null;
    propertyType?: string | null;
    amenitiesCount?: number | null;
    neighborhood?: string | null;
    reviewCount?: number | null;
    lastScrapedAt: string | null;
  } | null;
};

export type PropertySetupStatus = {
  state: 'preparing' | 'ready' | 'error';
  currentStep: 'map' | 'events' | 'suggestions' | 'ready' | 'attention';
  publicLabel: string;
  publicDescription: string;
  steps: Array<{
    id: 'saved' | 'map' | 'events' | 'suggestions';
    label: string;
    status: 'complete' | 'active' | 'pending' | 'error';
  }>;
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

export type PropertyOccupancyStatus = 'booked' | 'available' | 'blocked' | 'unknown';

export type PropertyOccupancyRecord = {
  id: string;
  date: string;
  status: PropertyOccupancyStatus;
  revenue: number | null;
  listedPrice: number | null;
  currency: string;
  origin: string;
  nightsBooked: number | null;
  trainingReady: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PropertyOccupancyPayload = {
  date: string;
  status: PropertyOccupancyStatus;
  revenue?: number | null;
  listedPrice?: number | null;
  nightsBooked?: number | null;
};

export type PropertyIdentityUpdate = {
  addressId: string;
  listId: string;
  internalNickname: string | null;
  internalCode: string | null;
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

export async function updatePropertyIdentity(
  addressId: string,
  payload: { internalNickname?: string | null; internalCode?: string | null },
): Promise<PropertyIdentityUpdate> {
  const { data } = await api.patch(`/propriedades/${addressId}/identity`, payload);
  return data;
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

export async function getPropertyOccupancyHistory(
  addressId: string,
  params?: { from?: string; to?: string; limit?: number },
): Promise<PropertyOccupancyRecord[]> {
  const { data } = await api.get<PropertyOccupancyRecord[]>(
    `/propriedades/${addressId}/occupancy`,
    { params },
  );
  return data;
}

export async function upsertPropertyOccupancy(
  addressId: string,
  payload: PropertyOccupancyPayload,
): Promise<PropertyOccupancyRecord> {
  const { data } = await api.post<PropertyOccupancyRecord>(
    `/propriedades/${addressId}/occupancy`,
    payload,
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
    console.error("Erro ao criar sessão do portal de billing:", error);
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

export const getPropertyById = async (propertyId: string): Promise<PropertyDetail> => {
  const response = await api.get<PropertyDetail>(`/propriedades/${propertyId}`, {
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
  user?: User;
  motivo?: string;
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
  airbnbHostId?: string | null;
  role?: string;
  pricingStrategy?: string;
  operationMode?: string;
  percentualInicial?: number | null;
  percentualFinal?: number | null;
  createdAt: string;
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

export type CommunicationPreferences = {
  id: string;
  userId: string;
  emailPricing: boolean;
  pushPricing: boolean;
  weeklyReport: boolean;
  marketing: boolean;
  staysAlerts: boolean;
  billingAlerts: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpdateCommunicationPreferencesPayload = Partial<
  Pick<
    CommunicationPreferences,
    | "emailPricing"
    | "pushPricing"
    | "weeklyReport"
    | "marketing"
    | "staysAlerts"
    | "billingAlerts"
  >
>;

export async function fetchCommunicationPreferences(): Promise<CommunicationPreferences> {
  const { data } = await api.get<CommunicationPreferences>("/communication-preferences/me");
  return data;
}

export async function updateCommunicationPreferences(
  payload: UpdateCommunicationPreferencesPayload,
): Promise<CommunicationPreferences> {
  const { data } = await api.put<CommunicationPreferences>(
    "/communication-preferences/me",
    payload,
  );
  return data;
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

export const marcarTodasNotificacoesComoAbertas = async (): Promise<{ updated: boolean }> => {
  try {
    const { data } = await api.patch('/notifications/user/opened');
    return data;
  } catch (error) {
    console.error('Erro ao marcar todas as notificações como abertas:', error);
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
    console.error(`Erro ao registrar o preço aplicado da sugestão ${id}:`, error);
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
    console.error(`Erro ao registrar resultado da sugestão ${id}:`, error);
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

// =================== Host event radar (P0 - Maya Host) ===================

export type HostEventConfidence = 'low' | 'medium' | 'high';

export type EventCatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string | null;
  city: string;
  state: string;
  venueName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  imageUrl?: string | null;
  officialUrl?: string | null;
  source?: string | null;
  crawledUrl?: string | null;
  urbanScore: number | null;
  demandScore?: number | null;
  confidence?: HostEventConfidence;
  badges: string[];
};

export type EventDemandDriver = {
  key: string;
  label: string;
  weight: number;
  explanation: string;
};

export type PriceAbsorptionScenario = {
  id: string;
  label: string;
  dailyPriceCents: number | null;
  multiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  risk: 'low' | 'medium' | 'high';
  reading: string;
  recommended?: boolean;
};

export type EventPropertyImpact = {
  propertyId: string;
  propertyName: string;
  distanceKm: number | null;
  travelTimeMinutes?: number | null;
  propertyCaptureScore: number | null;
  currentPriceCents: number | null;
  recommendedPriceCents: number | null;
  minAbsorbablePriceCents: number | null;
  maxAbsorbablePriceCents: number | null;
  recommendedMultiplier: number | null;
  maxPlausibleMultiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  expectedIncrementalRevenueCents: number | null;
  confidence: HostEventConfidence;
  mainDrivers?: string[];
  affectedNights?: string[];
  recommendedAction: 'watch' | 'simulate' | 'apply' | 'review';
  absorptionScenarios?: PriceAbsorptionScenario[];
};

export type EventIntelligenceDetail = {
  event: EventCatalogItem;
  intelligence: {
    eventDemandScore: number | null;
    eventRevenuePotentialCents: number | null;
    demandRadiusKm: number | null;
    expectedAttendance: number | null;
    sourceReliabilityScore: number | null;
    confidence: HostEventConfidence;
    interpretation: string;
    drivers: EventDemandDriver[];
    riskFlags: string[];
    generatedAt: string;
    modelVersion: string;
    metricVersion: string;
    jobRunId?: string | null;
  };
};

export type DemandHeatmapCell = {
  cellId: string;
  h3Index?: string | null;
  geohash?: string | null;
  geohashPrecision?: number | null;
  bbox?: [number, number, number, number] | null;
  centerLat: number;
  centerLng: number;
  radiusKm?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  eventDemandScore: number | null;
  revenuePotentialCents: number | null;
  eventsCount: number;
  topEventIds: string[];
  affectedPropertiesCount: number;
  averageConfidence: HostEventConfidence;
  dominantCategory?: string | null;
  supplyCompressionScore?: number | null;
  dataStatus?: string | null;
};

export type HostEventRadarItem = EventCatalogItem & {
  intelligence?: EventIntelligenceDetail['intelligence'] | null;
  impactedProperties: EventPropertyImpact[];
  bestPropertyImpact?: EventPropertyImpact | null;
  eventRevenuePotentialCents?: number | null;
  demandRadiusKm?: number | null;
  heatLevel?: number | null;
  interpretation?: string | null;
};

export type HostEventCatalogFilters = {
  city?: string;
  from?: string;
  to?: string;
  category?: string;
  venue?: string;
  search?: string;
  source?: string;
  confidence?: HostEventConfidence | 'all';
  nearMyProperties?: boolean;
  radiusKm?: string | number;
  highImpact?: boolean;
};

export type HostEventRadarFilters = {
  from?: string;
  to?: string;
  propertyId?: string;
  category?: string;
  radiusKm?: string | number;
  confidence?: HostEventConfidence | 'all';
  eventId?: string;
};

export type HostEventCatalogResponse = {
  generatedAt: string;
  items: EventCatalogItem[];
  total: number;
  cities: string[];
  categories: string[];
  sources: string[];
  mock?: boolean;
};

export type HostEventRadarResponse = {
  generatedAt: string;
  summary: {
    revenuePotentialCents: number;
    relevantEvents: number;
    opportunityNights: number;
    impactedProperties: number;
    averageDemandScore: number | null;
  };
  events: HostEventRadarItem[];
  heatmap: DemandHeatmapCell[];
  mock?: boolean;
};

export type HostEventDetailResponse = EventIntelligenceDetail & {
  propertyImpacts: EventPropertyImpact[];
  relatedEvents?: EventCatalogItem[];
  mock?: boolean;
};

export type HostEventPricingSimulationInput = {
  propertyId?: string;
  scenarioId?: string;
  dailyPriceCents?: number;
};

export type HostEventPricingSimulationResponse = {
  eventId: string;
  propertyImpact: EventPropertyImpact | null;
  mock?: boolean;
};

function isSafeHostEventMockFallback(error: unknown): boolean {
  if (!enableContractFallback) return false;
  const status = (error as any)?.response?.status;
  if (status === 401 || status === 403) return false;
  return !status || status === 404 || status === 501 || status === 503;
}

function warnHostEventMock(endpoint: string, error: unknown) {
  console.warn(`[host-event-radar] usando mock temporário habilitado por NEXT_PUBLIC_ENABLE_CONTRACT_FALLBACK para ${endpoint}`, error);
}

function normalizeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCents(value: unknown): number | null {
  const parsed = normalizeNumber(value);
  if (parsed === null) return null;
  return parsed > 0 && parsed < 10000 ? Math.round(parsed * 100) : Math.round(parsed);
}

function normalizeConfidence(value: unknown): HostEventConfidence {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function confidencePercent(value: HostEventConfidence | undefined): number {
  if (value === 'high') return 86;
  if (value === 'low') return 38;
  return 64;
}

function confidenceFromPercent(value: number): HostEventConfidence {
  if (value >= 75) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

function normalizeCellConfidence(value: unknown, score?: number | null): HostEventConfidence {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  const numeric = normalizeNumber(value);
  if (numeric !== null) return confidenceFromPercent(numeric);
  if (typeof score === 'number') return confidenceFromPercent(score);
  return 'medium';
}

function normalizeBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const parsed = value.map((item) => normalizeNumber(item));
  if (parsed.some((item) => item === null)) return null;
  return parsed as [number, number, number, number];
}

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeoHash(latitude?: number | null, longitude?: number | null, precision = 5): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if ((longitude as number) >= mid) {
        ch = (ch << 1) + 1;
        lngRange = [mid, lngRange[1]];
      } else {
        ch <<= 1;
        lngRange = [lngRange[0], mid];
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if ((latitude as number) >= mid) {
        ch = (ch << 1) + 1;
        latRange = [mid, latRange[1]];
      } else {
        ch <<= 1;
        latRange = [latRange[0], mid];
      }
    }

    evenBit = !evenBit;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += GEOHASH_BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

function normalizeCatalogItem(raw: any): EventCatalogItem {
  return {
    id: String(raw?.id ?? raw?._id ?? raw?.eventId ?? ''),
    name: String(raw?.name ?? raw?.nome ?? raw?.title ?? 'Evento sem nome'),
    description: raw?.description ?? raw?.descricao ?? null,
    startsAt: String(raw?.startsAt ?? raw?.dataInicio ?? raw?.startDate ?? new Date().toISOString()),
    endsAt: raw?.endsAt ?? raw?.dataFim ?? raw?.endDate ?? null,
    city: String(raw?.city ?? raw?.cidade ?? 'São Paulo'),
    state: String(raw?.state ?? raw?.estado ?? 'SP'),
    venueName: raw?.venueName ?? raw?.venue ?? raw?.local ?? null,
    address: raw?.address ?? raw?.enderecoCompleto ?? raw?.endereco ?? null,
    latitude: normalizeNumber(raw?.latitude),
    longitude: normalizeNumber(raw?.longitude),
    category: raw?.category ?? raw?.categoria ?? null,
    imageUrl: raw?.imageUrl ?? raw?.imagem_url ?? raw?.image_url ?? null,
    officialUrl: raw?.officialUrl ?? raw?.linkSiteOficial ?? raw?.official_url ?? null,
    source: raw?.source ?? raw?.fonte ?? null,
    crawledUrl: raw?.crawledUrl ?? raw?.crawled_url ?? null,
    urbanScore: normalizeNumber(raw?.urbanScore ?? raw?.relevancia),
    demandScore: normalizeNumber(raw?.demandScore ?? raw?.eventDemandScore),
    confidence: raw?.confidence ? normalizeConfidence(raw?.confidence) : undefined,
    badges: Array.isArray(raw?.badges) ? raw.badges.map(String) : [],
  };
}

function normalizePropertyImpact(raw: any): EventPropertyImpact {
  return {
    propertyId: String(raw?.propertyId ?? raw?.imovelId ?? raw?.addressId ?? ''),
    propertyName: String(raw?.propertyName ?? raw?.imovel ?? raw?.name ?? 'Imóvel'),
    distanceKm: normalizeNumber(raw?.distanceKm ?? raw?.distanciaKm),
    travelTimeMinutes: normalizeNumber(raw?.travelTimeMinutes ?? raw?.tempoDeslocamentoMin) ?? undefined,
    propertyCaptureScore: normalizeNumber(raw?.propertyCaptureScore ?? raw?.captureScore),
    currentPriceCents: normalizeCents(raw?.currentPriceCents ?? raw?.currentPrice ?? raw?.diariaAtual),
    recommendedPriceCents: normalizeCents(raw?.recommendedPriceCents ?? raw?.recommendedPrice ?? raw?.precoRecomendado),
    minAbsorbablePriceCents: normalizeCents(raw?.minAbsorbablePriceCents ?? raw?.minAbsorbablePrice),
    maxAbsorbablePriceCents: normalizeCents(raw?.maxAbsorbablePriceCents ?? raw?.maxAbsorbablePrice),
    recommendedMultiplier: normalizeNumber(raw?.recommendedMultiplier ?? raw?.multiplicadorRecomendado),
    maxPlausibleMultiplier: normalizeNumber(raw?.maxPlausibleMultiplier ?? raw?.multiplicadorMaximo),
    bookingProbability: normalizeNumber(raw?.bookingProbability ?? raw?.chanceReserva),
    expectedRevenueCents: normalizeCents(raw?.expectedRevenueCents ?? raw?.expectedRevenue),
    expectedIncrementalRevenueCents: normalizeCents(raw?.expectedIncrementalRevenueCents ?? raw?.incrementalRevenue),
    confidence: normalizeConfidence(raw?.confidence),
    mainDrivers: Array.isArray(raw?.mainDrivers) ? raw.mainDrivers.map(String) : [],
    affectedNights: Array.isArray(raw?.affectedNights) ? raw.affectedNights.map(String) : [],
    recommendedAction: raw?.recommendedAction ?? 'simulate',
    absorptionScenarios: Array.isArray(raw?.absorptionScenarios)
      ? raw.absorptionScenarios.map((scenario: any) => ({
          id: String(scenario?.id ?? scenario?.label ?? 'scenario'),
          label: String(scenario?.label ?? 'Cenário'),
          dailyPriceCents: normalizeCents(scenario?.dailyPriceCents ?? scenario?.dailyPrice),
          multiplier: normalizeNumber(scenario?.multiplier),
          bookingProbability: normalizeNumber(scenario?.bookingProbability),
          expectedRevenueCents: normalizeCents(scenario?.expectedRevenueCents ?? scenario?.expectedRevenue),
          risk:
            scenario?.risk === 'low' || scenario?.risk === 'medium' || scenario?.risk === 'high'
              ? scenario.risk
              : 'medium',
          reading: String(scenario?.reading ?? scenario?.leitura ?? ''),
          recommended: Boolean(scenario?.recommended),
        }))
      : undefined,
  };
}

function normalizeRadarItem(raw: any, responseData?: any): HostEventRadarItem {
  const event = normalizeCatalogItem(raw?.event ?? raw);
  const impactsSource =
    raw?.impactedProperties ??
    raw?.propertyImpacts ??
    raw?.impacts ??
    responseData?.propertyImpacts?.[event.id] ??
    [];
  const impactedProperties = Array.isArray(impactsSource)
    ? impactsSource.map(normalizePropertyImpact)
    : [];
  const bestImpactSource = raw?.bestPropertyImpact ?? raw?.bestImpact ?? impactedProperties[0] ?? null;
  const intelligence = raw?.intelligence ?? null;

  return {
    ...event,
    intelligence,
    impactedProperties,
    bestPropertyImpact: bestImpactSource ? normalizePropertyImpact(bestImpactSource) : null,
    eventRevenuePotentialCents: normalizeCents(
      raw?.eventRevenuePotentialCents ??
        raw?.revenuePotential ??
        raw?.expectedIncrementalRevenueCents ??
        intelligence?.eventRevenuePotentialCents,
    ),
    demandRadiusKm: normalizeNumber(raw?.demandRadiusKm ?? intelligence?.demandRadiusKm),
    heatLevel: normalizeNumber(raw?.heatLevel ?? raw?.demandScore ?? raw?.eventDemandScore ?? intelligence?.eventDemandScore),
    interpretation: raw?.interpretation ?? intelligence?.interpretation ?? null,
  };
}

function normalizeHeatmapCell(raw: any): DemandHeatmapCell {
  const centerLat = normalizeNumber(raw?.centerLat ?? raw?.latitude);
  const centerLng = normalizeNumber(raw?.centerLng ?? raw?.longitude);
  const geohashPrecision = Number(raw?.geohashPrecision ?? raw?.geoHashPrecision ?? 5);
  const geohash =
    raw?.geohash ??
    raw?.geoHash ??
    encodeGeoHash(centerLat, centerLng, Number.isFinite(geohashPrecision) ? geohashPrecision : 5);
  const score = normalizeNumber(raw?.eventDemandScore ?? raw?.demandScore);

  return {
    cellId: String(raw?.cellId ?? raw?.id ?? raw?.h3Index ?? geohash ?? 'geo-cell'),
    h3Index: raw?.h3Index ?? raw?.h3 ?? null,
    geohash,
    geohashPrecision: Number.isFinite(geohashPrecision) ? geohashPrecision : 5,
    bbox: normalizeBbox(raw?.bbox),
    centerLat: centerLat ?? 0,
    centerLng: centerLng ?? 0,
    radiusKm: normalizeNumber(raw?.radiusKm),
    dateFrom: raw?.dateFrom ?? raw?.from ?? null,
    dateTo: raw?.dateTo ?? raw?.to ?? null,
    eventDemandScore: score,
    revenuePotentialCents: normalizeCents(raw?.revenuePotentialCents ?? raw?.revenuePotential),
    eventsCount: Number(raw?.eventsCount ?? raw?.count ?? 0),
    topEventIds: Array.isArray(raw?.topEventIds ?? raw?.eventIds)
      ? (raw?.topEventIds ?? raw?.eventIds).map(String)
      : [],
    affectedPropertiesCount: Number(raw?.affectedPropertiesCount ?? raw?.impactedPropertiesCount ?? 0),
    averageConfidence: normalizeCellConfidence(raw?.averageConfidence ?? raw?.averageConfidencePercent, score),
    dominantCategory: raw?.dominantCategory ?? raw?.category ?? null,
    supplyCompressionScore: normalizeNumber(raw?.supplyCompressionScore),
    dataStatus: raw?.dataStatus ?? null,
  };
}

function buildDerivedHostHeatmap(events: HostEventRadarItem[]): DemandHeatmapCell[] {
  const grouped = new Map<
    string,
    {
      geohash: string;
      latTotal: number;
      lngTotal: number;
      scoreTotal: number;
      confidenceTotal: number;
      revenuePotentialCents: number;
      eventIds: string[];
      properties: Set<string>;
      categories: Record<string, number>;
    }
  >();

  events.forEach((event) => {
    const geohash = encodeGeoHash(event.latitude, event.longitude, 5);
    if (!geohash) return;
    const current =
      grouped.get(geohash) ??
      {
        geohash,
        latTotal: 0,
        lngTotal: 0,
        scoreTotal: 0,
        confidenceTotal: 0,
        revenuePotentialCents: 0,
        eventIds: [],
        properties: new Set<string>(),
        categories: {},
      };

    current.latTotal += event.latitude as number;
    current.lngTotal += event.longitude as number;
    current.scoreTotal += event.demandScore ?? event.urbanScore ?? event.heatLevel ?? 0;
    current.confidenceTotal += confidencePercent(event.confidence);
    current.revenuePotentialCents += event.eventRevenuePotentialCents ?? 0;
    current.eventIds.push(event.id);
    event.impactedProperties.forEach((impact) => current.properties.add(impact.propertyId));
    if (event.category) current.categories[event.category] = (current.categories[event.category] ?? 0) + 1;
    grouped.set(geohash, current);
  });

  return Array.from(grouped.values()).map((cell) => {
    const eventsCount = cell.eventIds.length;
    const dominantCategory =
      Object.entries(cell.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      cellId: `geohash-${cell.geohash}`,
      geohash: cell.geohash,
      geohashPrecision: 5,
      h3Index: null,
      bbox: null,
      centerLat: cell.latTotal / eventsCount,
      centerLng: cell.lngTotal / eventsCount,
      radiusKm: null,
      dateFrom: null,
      dateTo: null,
      eventDemandScore: Math.round(cell.scoreTotal / eventsCount),
      revenuePotentialCents: cell.revenuePotentialCents,
      eventsCount,
      topEventIds: cell.eventIds.slice(0, 4),
      affectedPropertiesCount: cell.properties.size,
      averageConfidence: confidenceFromPercent(Math.round(cell.confidenceTotal / eventsCount)),
      dominantCategory,
      supplyCompressionScore: null,
      dataStatus: 'derived_from_events',
    };
  });
}

function completeHostHeatmap(rawCells: DemandHeatmapCell[], events: HostEventRadarItem[]): DemandHeatmapCell[] {
  const coveredEvents = new Set(rawCells.flatMap((cell) => cell.topEventIds));
  const derivedCells = buildDerivedHostHeatmap(events.filter((event) => !coveredEvents.has(event.id)));
  return [...rawCells, ...derivedCells].sort(
    (a, b) =>
      (b.eventDemandScore ?? 0) - (a.eventDemandScore ?? 0) ||
      (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0),
  );
}

function normalizeCatalogResponse(data: any): HostEventCatalogResponse {
  const rawItems = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
  const items: EventCatalogItem[] = rawItems.map(normalizeCatalogItem);
  return {
    generatedAt: String(data?.generatedAt ?? new Date().toISOString()),
    items,
    total: Number(data?.total ?? items.length),
    cities: Array.isArray(data?.cities) ? data.cities.map(String) : Array.from(new Set(items.map((item) => item.city))),
    categories: Array.isArray(data?.categories)
      ? data.categories.map(String)
      : Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[],
    sources: Array.isArray(data?.sources)
      ? data.sources.map(String)
      : Array.from(new Set(items.map((item) => item.source).filter(Boolean))) as string[],
  };
}

function normalizeRadarResponse(data: any): HostEventRadarResponse {
  const rawEvents = Array.isArray(data) ? data : data?.events ?? data?.items ?? data?.data ?? [];
  const events: HostEventRadarItem[] = rawEvents.map((raw: any) => normalizeRadarItem(raw, data));
  const rawHeatmap = Array.isArray(data?.heatmap)
    ? data.heatmap
    : Array.isArray(data?.cells)
      ? data.cells
      : [];
  const heatmap = completeHostHeatmap(rawHeatmap.map(normalizeHeatmapCell), events);
  const calculatedRevenue = events.reduce(
    (sum: number, event: HostEventRadarItem) => sum + (event.eventRevenuePotentialCents ?? 0),
    0,
  );
  const calculatedProperties = new Set(
    events.flatMap((event: HostEventRadarItem) =>
      event.impactedProperties.map((impact: EventPropertyImpact) => impact.propertyId),
    ),
  ).size;

  return {
    generatedAt: String(data?.generatedAt ?? new Date().toISOString()),
    summary: {
      revenuePotentialCents: Number(
        data?.summary?.revenuePotentialCents ??
          data?.summary?.estimatedRevenuePotentialCents ??
          data?.summary?.expectedIncrementalRevenueCents ??
          calculatedRevenue,
      ),
      relevantEvents: Number(data?.summary?.relevantEvents ?? data?.summary?.relevantEventsCount ?? events.length),
      opportunityNights: Number(data?.summary?.opportunityNights ?? data?.summary?.opportunityNightsCount ?? 0),
      impactedProperties: Number(
        data?.summary?.impactedProperties ??
          data?.summary?.affectedPropertiesCount ??
          data?.summary?.impactedPropertiesCount ??
          calculatedProperties,
      ),
      averageDemandScore: normalizeNumber(data?.summary?.averageDemandScore ?? data?.summary?.averageDemand),
    },
    events,
    heatmap,
  };
}

function normalizeDetailResponse(data: any, eventId: string): HostEventDetailResponse {
  const event = normalizeCatalogItem(data?.event ?? data);
  const detail: HostEventDetailResponse = {
    event: event.id ? event : { ...event, id: eventId },
    intelligence: data?.intelligence ?? {
      eventDemandScore: normalizeNumber(data?.eventDemandScore),
      eventRevenuePotentialCents: normalizeCents(data?.eventRevenuePotentialCents),
      demandRadiusKm: normalizeNumber(data?.demandRadiusKm),
      expectedAttendance: normalizeNumber(data?.expectedAttendance),
      sourceReliabilityScore: normalizeNumber(data?.sourceReliabilityScore),
      confidence: normalizeConfidence(data?.confidence),
      interpretation: String(data?.interpretation ?? ''),
      drivers: Array.isArray(data?.drivers) ? data.drivers : [],
      riskFlags: Array.isArray(data?.riskFlags) ? data.riskFlags.map(String) : [],
      generatedAt: String(data?.generatedAt ?? new Date().toISOString()),
      modelVersion: String(data?.modelVersion ?? 'unknown'),
      metricVersion: String(data?.metricVersion ?? 'unknown'),
      jobRunId: data?.jobRunId ?? null,
    },
    propertyImpacts: Array.isArray(data?.propertyImpacts)
      ? data.propertyImpacts.map(normalizePropertyImpact)
      : [],
    relatedEvents: Array.isArray(data?.relatedEvents)
      ? data.relatedEvents.map(normalizeCatalogItem)
      : [],
  };
  return detail;
}

export async function fetchHostEventCatalog(
  filters: HostEventCatalogFilters = {},
): Promise<HostEventCatalogResponse> {
  const endpoint = '/host/events/catalog';
  try {
    const { data } = await api.get(endpoint, { params: filters });
    return normalizeCatalogResponse(data);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventCatalog(filters);
  }
}

export async function fetchHostEventRadar(
  filters: HostEventRadarFilters = {},
): Promise<HostEventRadarResponse> {
  const endpoint = '/host/events/radar';
  try {
    const { data } = await api.get(endpoint, { params: filters });
    const response = normalizeRadarResponse(data);
    return filters.eventId
      ? {
          ...response,
          events: response.events.filter((event) => event.id === filters.eventId),
          heatmap: response.heatmap.filter((cell) => cell.topEventIds.includes(filters.eventId as string)),
        }
      : response;
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    const response = mockFetchHostEventRadar(filters);
    return filters.eventId
      ? {
          ...response,
          events: response.events.filter((event) => event.id === filters.eventId),
          heatmap: response.heatmap.filter((cell) => cell.topEventIds.includes(filters.eventId as string)),
        }
      : response;
  }
}

export async function fetchHostEventDetail(eventId: string): Promise<HostEventDetailResponse> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}`;
  try {
    const { data } = await api.get(endpoint);
    return normalizeDetailResponse(data, eventId);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventDetail(eventId);
  }
}

export async function fetchHostEventIntelligence(
  eventId: string,
): Promise<EventIntelligenceDetail> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}/intelligence`;
  try {
    const { data } = await api.get(endpoint);
    return {
      event: normalizeCatalogItem(data?.event ?? data),
      intelligence: data?.intelligence ?? data,
    };
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    const detail = mockFetchHostEventDetail(eventId);
    return { event: detail.event, intelligence: detail.intelligence };
  }
}

export async function fetchHostEventPropertyImpact(
  eventId: string,
): Promise<EventPropertyImpact[]> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}/property-impact`;
  try {
    const { data } = await api.get(endpoint);
    const rawItems = Array.isArray(data) ? data : data?.items ?? data?.propertyImpacts ?? [];
    return rawItems.map(normalizePropertyImpact);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventDetail(eventId).propertyImpacts;
  }
}

export async function fetchHostEventHeatmap(
  filters: HostEventRadarFilters = {},
): Promise<DemandHeatmapCell[]> {
  const endpoint = '/host/events/heatmap';
  try {
    const { data } = await api.get(endpoint, { params: filters });
    const rawItems = Array.isArray(data) ? data : data?.items ?? data?.heatmap ?? [];
    return rawItems.map(normalizeHeatmapCell);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventHeatmap();
  }
}

export async function simulateHostEventPricing(
  eventId: string,
  input: HostEventPricingSimulationInput = {},
): Promise<HostEventPricingSimulationResponse> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}/simulate-pricing`;
  try {
    const { data } = await api.post(endpoint, input);
    return {
      eventId,
      propertyImpact: data?.propertyImpact ? normalizePropertyImpact(data.propertyImpact) : null,
    };
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return {
      eventId,
      propertyImpact: mockSimulateHostEventPricing(eventId, input.propertyId),
      mock: true,
    };
  }
}


export type GetHostInfoResponse = {
  hostId: string | null;
  hostName: string | null;
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
  minProperties?: number | null;
  maxProperties?: number | null;
  maxCheckoutQuantity?: number | null;
  selfServiceEnabled?: boolean;
  sortOrder?: number;
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

export interface PricingQuote {
  quantity: number;
  billingCycle: BillingCycle;
  selfService: boolean;
  contactRequired: boolean;
  planName: string | null;
  planTitle: string;
  minProperties?: number | null;
  maxProperties?: number | null;
  pricePerPropertyMonthly?: number;
  monthlyEquivalentTotal?: number;
  cycleTotal?: number;
  monthsInCycle?: number;
  discountPercent?: number;
}

export const getPricingQuote = async (
  quantity: number,
  billingCycle: BillingCycle = 'annual',
): Promise<PricingQuote> => {
  const { data } = await api.get<PricingQuote>('/plans/quote', {
    params: { quantity, billingCycle },
  });
  return data;
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

// ================== ROI do anfitrião ==================

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

export async function fetchAdminAlphaDashboard(email: string) {
  const { data } = await api.get<AdminAlphaDashboard>('/admin/alpha/dashboard', { params: { email } });
  return data;
}

export async function fetchAdminAlphaRecommendations(email: string, limit = 250) {
  const { data } = await api.get<AdminAlphaRecommendationsExport>('/admin/alpha/recommendations', {
    params: { email, limit },
  });
  return data;
}

export async function runAdminAlphaReprocess(email: string) {
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
  createdAt: string;
  updatedAt: string;
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
  consentAcceptedAt: string | null;
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

export interface AdminPriceIntelligenceHealth {
  generatedAt: string;
  health: 'green' | 'amber' | 'red';
  windowDays: number;
  alerts: Array<{ severity: 'red' | 'amber' | 'info'; message: string }>;
  snapshots: {
    total: number;
    last24h: number;
    last7d: number;
    distinctListings: number;
    trainingReady: number;
    latestSnapshotAt: string | null;
  };
  observations: {
    total: number;
    last24h: number;
    last7d: number;
    distinctListings: number;
    trainingReady: number;
    coveragePercent: number;
    latestObservedAt: string | null;
  };
  suggestions: {
    total: number;
    last24h: number;
    last7d: number;
    future: number;
    verified: number;
    verifiedPercent: number;
    accepted: number;
    applied: number;
    pendingVerification: number;
    failedVerification: number;
  };
  jobs: {
    running: number;
    queued: number;
    queueAvailable?: boolean;
    queueUnavailableReason?: string | null;
    failedLast24h: number;
    avgDurationMs: number | null;
    lastRun: AdminJobRunResponse | null;
    lastSuccessAt: string | null;
    recent: AdminJobRunResponse[];
    byName?: Array<{
      name: string;
      total: number;
      successes: number;
      failures: number;
      running: number;
      successRate: number | null;
      avgDurationMs: number | null;
      lastRunAt: string | null;
      lastStatus: AdminJobRunResponse['status'] | null;
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      lastErrorMessage: string | null;
    }>;
  };
  schema?: {
    ok: boolean;
    checkedAt: string;
    missing: string[];
    checkError: string | null;
  };
  failuresByType: Array<{
    type: string;
    count: number;
    lastSeenAt: string | null;
  }>;
  problematicProperties: Array<{
    addressId: string | null;
    listId: string | null;
    title: string | null;
    userEmail: string | null;
    city: string | null;
    state: string | null;
    severity: 'red' | 'amber' | 'info';
    issue: string;
    lastSnapshotAt: string | null;
    lastObservationAt: string | null;
    suggestionsPending: number;
    failedSuggestions: number;
  }>;
  shortcuts: Array<{
    label: string;
    href: string;
    description?: string | null;
    kind?: 'primary' | 'secondary' | 'ghost';
  }>;
  endpointGaps?: string[];
}

export const fetchAdminPriceIntelligenceHealth = () =>
  api
    .get<AdminPriceIntelligenceHealth>('/admin/price-intelligence/health')
    .then((r) => r.data);

export interface AdminAirbnbPricingAttemptHealth {
  generatedAt: string;
  windowHours: number;
  health: 'green' | 'amber' | 'red';
  schema: {
    available: boolean;
    error: string | null;
  };
  summary: {
    total: number;
    successes: number;
    failures: number;
    pending: number;
    openPending: number;
    stalePending: number;
    avgDurationMs: number | null;
    latestAttemptAt: string | null;
  };
  failuresByReason: Array<{
    reason: string;
    count: number;
    avgDurationMs: number | null;
    lastSeenAt: string | null;
  }>;
  sources: Array<{
    source: string;
    total: number;
    successes: number;
    failures: number;
    pending: number;
    avgDurationMs: number | null;
    latestAttemptAt: string | null;
  }>;
  recent: Array<{
    id: string;
    listingId: string;
    userId: string | null;
    listId: string | null;
    addressId: string | null;
    checkIn: string;
    checkOut: string;
    source: string;
    status: string;
    reason: string | null;
    durationMs: number | null;
    priceTotal: number | null;
    dailyPrice: number | null;
    currency: string;
    finalUrl: string | null;
    metadata: Record<string, unknown> | null;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
}

export const fetchAdminAirbnbPricingAttemptHealth = (windowHours = 24) =>
  api
    .get<AdminAirbnbPricingAttemptHealth>('/admin/airbnb/pricing-attempts/health', {
      params: { windowHours },
    })
    .then((r) => r.data);

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
  minProperties?: number | null;
  maxProperties?: number | null;
  maxCheckoutQuantity?: number | null;
  selfServiceEnabled?: boolean;
  sortOrder?: number;
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
 * (Railway, Stripe, Gemini, Brevo etc.). Idempotente: por padrão NÃO
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

// =================== Contato público + admin ===================

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

// =================== Admin - Comunicacoes ===================

export type CommunicationChannel = 'email' | 'push' | 'in_app';
export type CommunicationStatus = 'sent' | 'failed' | 'skipped';

export interface CommunicationEvent {
  id: string;
  userId: string | null;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  kind: string | null;
  templateName: string | null;
  recipientEmail: string | null;
  recipientDeviceId: string | null;
  subject: string | null;
  title: string | null;
  provider: string | null;
  providerMessageId: string | null;
  failureReason: string | null;
  metadata?: Record<string, unknown> | null;
  metadataJson?: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface CommunicationEventListResponse {
  page: number;
  limit: number;
  total: number;
  byChannel: Array<{ channel: CommunicationChannel; count: number }>;
  byStatus: Array<{ status: CommunicationStatus; count: number }>;
  items: CommunicationEvent[];
}

export interface CommunicationSummary {
  windowHours: number;
  totals: Array<{ channel: CommunicationChannel; status: CommunicationStatus; count: number }>;
  recentFailures: CommunicationEvent[];
}

export const fetchAdminCommunications = (params: {
  page?: number;
  limit?: number;
  channel?: CommunicationChannel | 'all';
  status?: CommunicationStatus | 'all';
  kind?: string;
  search?: string;
}) =>
  api
    .get<CommunicationEventListResponse>('/admin/communications', { params })
    .then((r) => r.data);

export const fetchAdminCommunicationSummary = () =>
  api.get<CommunicationSummary>('/admin/communications/summary').then((r) => r.data);

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
  expectedAttendance?: number | null;
  venueName?: string | null;
  linkSiteOficial?: string | null;
  imagemUrl?: string | null;
  sourceId?: string | null;
  dedupHash?: string | null;
  source: string | null;
  outOfScope: boolean;
  pendingGeocode: boolean;
  ativo: boolean;
  latitude: number | null;
  longitude: number | null;
  enrichmentAttempts: number;
  enrichmentLastError: string | null;
  crawledUrl: string | null;
  canonicalName?: string | null;
  dedupStatus?: string | null;
  duplicateOfEventId?: string | null;
  identityConfidence?: number | null;
  sourceCount?: number;
  lastSeenAt: string | null;
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
  canonicalCount?: number;
  duplicateCount?: number;
  duplicateRatePercent?: number;
  sourceLinksCount?: number;
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

// =================== Event dedup review ===================

export type EventDedupCandidateStatus = 'pending' | 'approved' | 'rejected' | 'obsolete';
export type EventDedupConfidenceBand = 'high' | 'medium' | 'low';

export type EventDedupSignal =
  | string
  | {
      key?: string;
      label?: string;
      name?: string;
      value?: unknown;
      score?: number;
      weight?: number;
      matched?: boolean;
      canonicalValue?: unknown;
      duplicateValue?: unknown;
      detail?: string;
      [key: string]: unknown;
    };

export interface EventDedupEventSummary {
  id: string;
  nome: string;
  name?: string | null;
  title?: string | null;
  canonicalName: string | null;
  cidade: string | null;
  city?: string | null;
  estado: string | null;
  state?: string | null;
  dataInicio: string;
  startDate?: string | null;
  startsAt: string | null;
  date?: string | null;
  dataFim: string | null;
  endDate?: string | null;
  enderecoCompleto: string | null;
  address?: string | null;
  venueName?: string | null;
  venueType?: string | null;
  categoria?: string | null;
  category?: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  sourceId: string | null;
  dedupHash?: string | null;
  linkSiteOficial?: string | null;
  url?: string | null;
  crawledUrl?: string | null;
  dedupStatus: string | null;
  duplicateOfEventId: string | null;
  sourceCount: number;
  identityConfidence: number | null;
  ativo: boolean;
  [key: string]: unknown;
}

export type EventDedupCandidateEvent = EventDedupEventSummary;

export interface EventDedupCandidate {
  id: string;
  status: EventDedupCandidateStatus;
  confidenceBand: EventDedupConfidenceBand;
  score: number;
  reason: string | null;
  signals: Record<string, unknown> | EventDedupSignal[] | null;
  source: string | null;
  sourceId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  canonicalEvent: EventDedupEventSummary | null;
  duplicateEvent: EventDedupEventSummary | null;
}

export interface EventDedupCandidatesResponse {
  page: number;
  limit: number;
  total: number;
  status: EventDedupCandidateStatus | 'all';
  confidenceBand: EventDedupConfidenceBand | 'all';
  items: EventDedupCandidate[];
  summary?: {
    pending?: number;
    approved?: number;
    rejected?: number;
    high?: number;
    medium?: number;
    low?: number;
    avgScore?: number;
    [key: string]: unknown;
  };
}

export interface EventDedupScanResponse {
  generatedAt: string;
  window: { from: string; to: string };
  scanned?: number;
  compared?: number;
  candidates?: number;
  scannedEvents: number;
  reviewPendingEvents: number;
  created: number;
  updated: number;
  skipped: number;
  pendingTotal: number;
  highConfidence?: number;
  mediumConfidence?: number;
  lowConfidence?: number;
  durationMs?: number;
  message?: string;
  items: EventDedupCandidate[];
  [key: string]: unknown;
}

export interface EventDedupCandidatesQuery {
  page?: number;
  limit?: number;
  status?: EventDedupCandidateStatus | 'all';
  confidenceBand?: EventDedupConfidenceBand | 'all';
}

export interface EventDedupScanRequest {
  limit?: number;
  lookbackDays?: number;
  lookaheadDays?: number;
  minScore?: number;
  highScore?: number;
  includeInactive?: boolean;
}

type EventDedupCandidatesRawResponse =
  | EventDedupCandidatesResponse
  | EventDedupCandidate[]
  | {
      data?: EventDedupCandidate[];
      candidates?: EventDedupCandidate[];
      items?: EventDedupCandidate[];
      page?: number;
      limit?: number;
      total?: number;
      status?: EventDedupCandidateStatus | 'all';
      confidenceBand?: EventDedupConfidenceBand | 'all';
      summary?: EventDedupCandidatesResponse['summary'];
    };

function normalizeEventDedupCandidatesResponse(
  raw: EventDedupCandidatesRawResponse,
  params: EventDedupCandidatesQuery,
): EventDedupCandidatesResponse {
  if (Array.isArray(raw)) {
    return {
      page: params.page ?? 1,
      limit: params.limit ?? raw.length,
      total: raw.length,
      status: params.status ?? 'pending',
      confidenceBand: params.confidenceBand ?? 'all',
      items: raw,
    };
  }

  const shaped = raw as {
    data?: EventDedupCandidate[];
    candidates?: EventDedupCandidate[];
    items?: EventDedupCandidate[];
    page?: number;
    limit?: number;
    total?: number;
    status?: EventDedupCandidateStatus | 'all';
    confidenceBand?: EventDedupConfidenceBand | 'all';
    summary?: EventDedupCandidatesResponse['summary'];
  };
  const items = shaped.items ?? shaped.candidates ?? shaped.data ?? [];
  return {
    page: Number(shaped.page ?? params.page ?? 1),
    limit: Number(shaped.limit ?? params.limit ?? items.length),
    total: Number(shaped.total ?? items.length),
    status: shaped.status ?? params.status ?? 'pending',
    confidenceBand: shaped.confidenceBand ?? params.confidenceBand ?? 'all',
    items,
    summary: shaped.summary,
  };
}

export const fetchEventDedupCandidates = async (
  params: EventDedupCandidatesQuery = {},
): Promise<EventDedupCandidatesResponse> => {
  const { data } = await api
    .get<EventDedupCandidatesRawResponse>('/admin/events/dedup/candidates', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        status: params.status ?? 'pending',
        confidenceBand: params.confidenceBand ?? 'all',
      },
    });
  return normalizeEventDedupCandidatesResponse(data, params);
};

export const scanEventDedupCandidates = (body: EventDedupScanRequest = {}) =>
  api.post<EventDedupScanResponse>('/admin/events/dedup/scan', body).then((r) => r.data);

export const runEventDedupScan = scanEventDedupCandidates;

export const approveEventDedupCandidate = (id: string) =>
  api
    .post<EventDedupCandidate>(
      `/admin/events/dedup/candidates/${encodeURIComponent(id)}/approve`,
    )
    .then((r) => r.data);

export const rejectEventDedupCandidate = (id: string, reason?: string) =>
  api
    .post<EventDedupCandidate>(
      `/admin/events/dedup/candidates/${encodeURIComponent(id)}/reject`,
      { reason: reason?.trim() || undefined },
    )
    .then((r) => r.data);

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

// =================== Admin Event Radar (contrato v0) ===================

export type EventRadarConfidence = 'low' | 'medium' | 'high';
export type AdminEventRadarContractMode = 'backend' | 'contract-fallback';
export type AdminEventRadarScope = 'in' | 'out' | 'all';
export type AdminEventRadarHeatmapMetric =
  | 'demand'
  | 'revenue'
  | 'events'
  | 'properties'
  | 'blind_spots'
  | 'coverage';

export interface AdminEventRadarFilters {
  from?: string;
  to?: string;
  source?: string;
  category?: string;
  scope?: AdminEventRadarScope;
  confidence?: EventRadarConfidence | 'all';
  search?: string;
}

export interface AdminEventRadarKpis {
  demandPotentialScore: number;
  revenuePotentialCents: number;
  highPotentialEvents: number;
  affectedProperties: number;
  recommendationsGenerated: number;
  highPotentialWithoutRecommendation: number;
  averageConfidencePercent: number;
  weightedCoveragePercent: number;
}

export interface AdminEventRadarEvent {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  city: string;
  state: string;
  venueName: string | null;
  category: string | null;
  source: string | null;
  sourceId?: string | null;
  dedupHash?: string | null;
  demandScore: number | null;
  revenuePotentialCents: number | null;
  confidence: EventRadarConfidence;
  affectedPropertiesCount: number;
  recommendationsGenerated: number;
  demandRadiusKm: number | null;
  expectedAttendance: number | null;
  geocodeStatus: 'ok' | 'pending' | 'missing';
  enrichmentStatus: 'ok' | 'pending' | 'failed' | 'unknown';
  sourceStatus: 'fresh' | 'stale' | 'unknown';
  officialUrl: string | null;
  crawledUrl: string | null;
  imageUrl?: string | null;
  latitude: number | null;
  longitude: number | null;
  interpretation: string;
  riskFlags: string[];
  dataQualityFlags: string[];
  raw?: Record<string, unknown>;
}

export interface AdminEventRadarResponse {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  filters: AdminEventRadarFilters;
  kpis: AdminEventRadarKpis;
  events: AdminEventRadarEvent[];
  categories: string[];
  sources: string[];
  cities: string[];
}

export interface AdminEventRadarHeatmapCell {
  cellId: string;
  h3Index?: string | null;
  geohash?: string | null;
  geohashPrecision?: number | null;
  bbox?: [number, number, number, number] | null;
  label: string;
  city: string;
  state: string;
  centerLat: number | null;
  centerLng: number | null;
  eventDemandScore: number;
  revenuePotentialCents: number;
  eventsCount: number;
  topEventIds: string[];
  affectedPropertiesCount: number;
  averageConfidence: number;
  dominantCategory: string | null;
  supplyCompressionScore: number;
  coverageScore: number;
  dataStatus?: string | null;
}

export interface AdminEventRadarHeatmapResponse {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  metric: AdminEventRadarHeatmapMetric;
  cells: AdminEventRadarHeatmapCell[];
}

export type AdminEventRadarBlindSpotKind =
  | 'no_pricing'
  | 'missing_geocode'
  | 'missing_official_link'
  | 'stale_source'
  | 'duplicate_risk'
  | 'venue_gap'
  | 'low_coverage'
  | 'out_of_scope_high_potential';

export interface AdminEventRadarBlindSpot {
  id: string;
  kind: AdminEventRadarBlindSpotKind;
  severity: 'high' | 'medium' | 'low';
  title: string;
  eventId?: string | null;
  eventName?: string | null;
  city?: string | null;
  source?: string | null;
  demandScore?: number | null;
  revenuePotentialCents?: number | null;
  blockedBy: string;
  recommendedAction: string;
  href?: string | null;
}

export interface AdminEventRadarBlindSpotsResponse {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  summary: { high: number; medium: number; low: number; total: number };
  items: AdminEventRadarBlindSpot[];
}

export interface AdminEventRadarPropertyImpact {
  propertyId: string;
  propertyName: string;
  hostUserId?: string | null;
  hostEmail?: string | null;
  distanceKm: number | null;
  travelTimeMinutes?: number | null;
  propertyCaptureScore: number | null;
  currentPriceCents: number | null;
  recommendedPriceCents: number | null;
  minAbsorbablePriceCents: number | null;
  maxAbsorbablePriceCents: number | null;
  recommendedMultiplier: number | null;
  maxPlausibleMultiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  expectedIncrementalRevenueCents: number | null;
  confidence: EventRadarConfidence;
  recommendedAction: 'watch' | 'simulate' | 'apply' | 'review';
  mainDrivers?: string[];
}

export interface AdminEventRadarDetail {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  event: AdminEventRadarEvent;
  intelligence: {
    eventDemandScore: number | null;
    eventRevenuePotentialCents: number | null;
    demandRadiusKm: number | null;
    expectedAttendance: number | null;
    sourceReliabilityScore: number | null;
    confidence: EventRadarConfidence;
    interpretation: string;
    drivers: Array<{ key: string; label: string; weight: number; explanation: string }>;
    riskFlags: string[];
    dataQualityFlags: string[];
    generatedAt: string;
    modelVersion: string;
    metricVersion: string;
    jobRunId?: string | null;
  };
  operation: {
    geocodeStatus: AdminEventRadarEvent['geocodeStatus'];
    enrichmentStatus: AdminEventRadarEvent['enrichmentStatus'];
    sourceStatus: AdminEventRadarEvent['sourceStatus'];
    affectedPropertiesCount: number;
    recommendationsGenerated: number;
  };
  propertyImpact: AdminEventRadarPropertyImpact[];
  rawEvent: Record<string, unknown>;
}

const ADMIN_EVENT_RADAR_FALLBACK_GAPS = [
  'GET /admin/events/intelligence',
  'GET /admin/events/:eventId/intelligence',
  'GET /admin/events/:eventId/property-impact',
  'GET /admin/events/heatmap',
  'GET /admin/events/blind-spots',
  'POST /admin/events/:eventId/recompute-intelligence',
];

function isContractFallbackAllowed(error: unknown): boolean {
  if (!enableContractFallback) return false;
  const status = (error as any)?.response?.status;
  const message = (error as any)?.message;
  const code = (error as any)?.code;
  return status === 404 || status === 501 || message === 'Network Error' || code === 'ERR_NETWORK';
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceFromScore(score: number): EventRadarConfidence {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function confidenceToPercent(confidence: EventRadarConfidence): number {
  if (confidence === 'high') return 86;
  if (confidence === 'medium') return 64;
  return 38;
}

function inferFallbackDemandScore(event: EventListItem): number {
  const relevance = event.relevancia ?? 35;
  const attendance =
    event.expectedAttendance ??
    event.capacidadeEstimada ??
    event.venueCapacity ??
    0;
  const attendanceBoost = attendance > 0 ? Math.min(24, Math.log10(attendance + 1) * 8) : 0;
  const geoPenalty = event.pendingGeocode || !event.latitude || !event.longitude ? 12 : 0;
  const outOfScopePenalty = event.outOfScope ? 10 : 0;
  return clampPercent(relevance * 0.78 + attendanceBoost - geoPenalty - outOfScopePenalty);
}

function toFallbackRadarEvent(event: EventListItem): AdminEventRadarEvent {
  const demandScore = inferFallbackDemandScore(event);
  const confidence = confidenceFromScore(demandScore);
  const radius = event.raioImpactoKm ?? (demandScore >= 80 ? 8 : demandScore >= 60 ? 5 : 3);
  const affectedPropertiesCount = event.outOfScope
    ? 0
    : Math.max(0, Math.round((demandScore / 100) * radius * 1.35));
  const recommendationsGenerated =
    event.pendingGeocode || affectedPropertiesCount === 0
      ? 0
      : Math.max(0, Math.floor(affectedPropertiesCount * (demandScore >= 75 ? 0.7 : 0.35)));
  const expectedAttendance =
    event.expectedAttendance ?? event.capacidadeEstimada ?? event.venueCapacity ?? null;
  const revenuePotentialCents =
    demandScore > 0
      ? Math.round(demandScore * Math.max(1, affectedPropertiesCount) * 27500)
      : null;
  const hasCoords = Boolean(event.latitude && event.longitude);
  const enrichmentStatus =
    event.relevancia !== null
      ? 'ok'
      : event.enrichmentAttempts > 0
        ? 'failed'
        : 'pending';
  const sourceStatus =
    event.source && event.source.toLowerCase().includes('stale') ? 'stale' : event.source ? 'fresh' : 'unknown';
  const dataQualityFlags = [
    !hasCoords ? 'missing_coordinates' : '',
    !event.crawledUrl && !event.linkSiteOficial ? 'missing_source_url' : '',
    event.pendingGeocode ? 'pending_geocode' : '',
    event.outOfScope ? 'out_of_scope' : '',
  ].filter(Boolean);
  const riskFlags = [
    demandScore >= 75 && recommendationsGenerated === 0 ? 'high_demand_without_pricing' : '',
    enrichmentStatus === 'failed' ? 'enrichment_failed' : '',
  ].filter(Boolean);

  return {
    id: event.id,
    name: event.nome,
    startsAt: event.dataInicio,
    endsAt: event.dataFim ?? null,
    city: event.cidade,
    state: event.estado,
    venueName: event.venueName ?? null,
    category: event.categoria,
    source: event.source,
    sourceId: event.sourceId ?? null,
    dedupHash: event.dedupHash ?? null,
    demandScore,
    revenuePotentialCents,
    confidence,
    affectedPropertiesCount,
    recommendationsGenerated,
    demandRadiusKm: radius,
    expectedAttendance,
    geocodeStatus: hasCoords ? 'ok' : event.pendingGeocode ? 'pending' : 'missing',
    enrichmentStatus,
    sourceStatus,
    officialUrl: event.linkSiteOficial ?? null,
    crawledUrl: event.crawledUrl ?? null,
    imageUrl: event.imagemUrl ?? null,
    latitude: event.latitude,
    longitude: event.longitude,
    interpretation:
      'Fallback contratual: leitura estimada a partir de relevância, capacidade, coordenadas e escopo enquanto o endpoint de inteligência de eventos não está disponível.',
    riskFlags,
    dataQualityFlags,
    raw: event as unknown as Record<string, unknown>,
  };
}

function filterFallbackRadarEvents(
  events: AdminEventRadarEvent[],
  filters: AdminEventRadarFilters,
): AdminEventRadarEvent[] {
  const fromTime = filters.from ? new Date(filters.from).getTime() : null;
  const toTime = filters.to ? new Date(filters.to).getTime() : null;
  const search = filters.search?.trim().toLowerCase();
  return events.filter((event) => {
    const startsAt = new Date(event.startsAt).getTime();
    const outOfScope = event.dataQualityFlags.includes('out_of_scope');
    if (filters.scope === 'in' && outOfScope) return false;
    if (filters.scope === 'out' && !outOfScope) return false;
    if (fromTime !== null && Number.isFinite(startsAt) && startsAt < fromTime) return false;
    if (toTime !== null && Number.isFinite(startsAt) && startsAt > toTime) return false;
    if (filters.category && event.category !== filters.category) return false;
    if (filters.source && event.source !== filters.source) return false;
    if (filters.confidence && filters.confidence !== 'all' && event.confidence !== filters.confidence) return false;
    if (search) {
      const haystack = `${event.name} ${event.city} ${event.category ?? ''} ${event.source ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function buildFallbackRadarResponse(
  analytics: AdminEventsAnalytics,
  listing: EventsListResponse,
  filters: AdminEventRadarFilters,
): AdminEventRadarResponse {
  const generatedAt = new Date().toISOString();
  const events = filterFallbackRadarEvents(
    listing.items.map(toFallbackRadarEvent),
    filters,
  ).sort((a, b) => (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0));
  const kpis: AdminEventRadarKpis = {
    demandPotentialScore: events.reduce((sum, event) => sum + (event.demandScore ?? 0), 0),
    revenuePotentialCents: events.reduce((sum, event) => sum + (event.revenuePotentialCents ?? 0), 0),
    highPotentialEvents: events.filter((event) => (event.demandScore ?? 0) >= 75).length,
    affectedProperties: events.reduce((sum, event) => sum + event.affectedPropertiesCount, 0),
    recommendationsGenerated: events.reduce((sum, event) => sum + event.recommendationsGenerated, 0),
    highPotentialWithoutRecommendation: events.filter(
      (event) => (event.demandScore ?? 0) >= 75 && event.recommendationsGenerated === 0,
    ).length,
    averageConfidencePercent: events.length
      ? Math.round(events.reduce((sum, event) => sum + confidenceToPercent(event.confidence), 0) / events.length)
      : 0,
    weightedCoveragePercent: analytics.summary.coveragePercent,
  };
  return {
    generatedAt,
    contractMode: 'contract-fallback',
    endpointGaps: ADMIN_EVENT_RADAR_FALLBACK_GAPS,
    filters,
    kpis,
    events,
    categories: Array.from(new Set(events.map((event) => event.category).filter(Boolean))) as string[],
    sources: Array.from(new Set(events.map((event) => event.source).filter(Boolean))) as string[],
    cities: Array.from(new Set(events.map((event) => `${event.city}/${event.state}`))).sort(),
  };
}

function buildFallbackHeatmap(
  radar: AdminEventRadarResponse,
  metric: AdminEventRadarHeatmapMetric,
): AdminEventRadarHeatmapResponse {
  const grouped = new Map<string, AdminEventRadarHeatmapCell & { categories: string[] }>();
  for (const event of radar.events) {
    const key = `${event.city}-${event.state}`;
    const existing =
      grouped.get(key) ??
      {
        cellId: key,
        h3Index: null,
        geohash: encodeGeoHash(event.latitude, event.longitude, 5),
        geohashPrecision: 5,
        bbox: null,
        label: `${event.city}/${event.state}`,
        city: event.city,
        state: event.state,
        centerLat: event.latitude,
        centerLng: event.longitude,
        eventDemandScore: 0,
        revenuePotentialCents: 0,
        eventsCount: 0,
        topEventIds: [],
        affectedPropertiesCount: 0,
        averageConfidence: 0,
        dominantCategory: event.category,
        supplyCompressionScore: 0,
        coverageScore: 0,
        dataStatus: 'derived_from_events',
        categories: [],
      };
    existing.eventDemandScore += event.demandScore ?? 0;
    existing.revenuePotentialCents += event.revenuePotentialCents ?? 0;
    existing.eventsCount += 1;
    existing.topEventIds = [...existing.topEventIds, event.id].slice(0, 4);
    existing.affectedPropertiesCount += event.affectedPropertiesCount;
    existing.averageConfidence += confidenceToPercent(event.confidence);
    existing.supplyCompressionScore += Math.min(100, (event.demandScore ?? 0) + event.affectedPropertiesCount * 2);
    existing.coverageScore += event.geocodeStatus === 'ok' ? 100 : event.geocodeStatus === 'pending' ? 45 : 15;
    if (event.category) existing.categories.push(event.category);
    if (!existing.centerLat && event.latitude) existing.centerLat = event.latitude;
    if (!existing.centerLng && event.longitude) existing.centerLng = event.longitude;
    if (!existing.geohash) existing.geohash = encodeGeoHash(existing.centerLat, existing.centerLng, 5);
    grouped.set(key, existing);
  }

  const cells = Array.from(grouped.values()).map((cell) => {
    const categoryCounts = cell.categories.reduce<Record<string, number>>((acc, category) => {
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});
    const dominantCategory =
      Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? cell.dominantCategory;
    return {
      ...cell,
      eventDemandScore: clampPercent(cell.eventDemandScore / Math.max(1, cell.eventsCount)),
      averageConfidence: Math.round(cell.averageConfidence / Math.max(1, cell.eventsCount)),
      supplyCompressionScore: clampPercent(cell.supplyCompressionScore / Math.max(1, cell.eventsCount)),
      coverageScore: clampPercent(cell.coverageScore / Math.max(1, cell.eventsCount)),
      dominantCategory,
      categories: undefined,
    };
  });

  const metricValue = (cell: AdminEventRadarHeatmapCell) => {
    if (metric === 'revenue') return cell.revenuePotentialCents;
    if (metric === 'events') return cell.eventsCount;
    if (metric === 'properties') return cell.affectedPropertiesCount;
    if (metric === 'coverage') return 100 - cell.coverageScore;
    if (metric === 'blind_spots') return 100 - cell.coverageScore + Math.max(0, 75 - cell.averageConfidence);
    return cell.eventDemandScore;
  };

  return {
    generatedAt: radar.generatedAt,
    contractMode: radar.contractMode,
    endpointGaps: radar.endpointGaps,
    metric,
    cells: cells.sort((a, b) => metricValue(b) - metricValue(a)).slice(0, 12),
  };
}

function buildFallbackBlindSpots(radar: AdminEventRadarResponse): AdminEventRadarBlindSpotsResponse {
  const items: AdminEventRadarBlindSpot[] = [];
  for (const event of radar.events) {
    if ((event.demandScore ?? 0) >= 75 && event.recommendationsGenerated === 0) {
      items.push({
        id: `no-pricing-${event.id}`,
        kind: 'no_pricing',
        severity: 'high',
        title: 'Evento de alta demanda sem pricing',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: event.geocodeStatus !== 'ok' ? 'Coordenada pendente ou ausente' : 'Snapshot de impacto em imóveis ausente',
        recommendedAction: event.geocodeStatus !== 'ok' ? 'Rodar geocoder e reprocessar inteligência' : 'Gerar event_property_impact e recomendações',
        href: `/admin/events?search=${encodeURIComponent(event.name)}`,
      });
    }
    if (event.geocodeStatus !== 'ok') {
      items.push({
        id: `geo-${event.id}`,
        kind: 'missing_geocode',
        severity: (event.demandScore ?? 0) >= 70 ? 'high' : 'medium',
        title: 'Evento sem coordenada confiável',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: 'latitude/longitude ausentes ou geocode pendente',
        recommendedAction: 'Abrir cobertura/geocoder e resolver local antes de gerar pricing',
        href: '/admin/coverage',
      });
    }
    if (!event.officialUrl && !event.crawledUrl) {
      items.push({
        id: `link-${event.id}`,
        kind: 'missing_official_link',
        severity: (event.demandScore ?? 0) >= 70 ? 'medium' : 'low',
        title: 'Evento sem link de validação',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: 'link oficial/crawled URL ausente',
        recommendedAction: 'Completar fonte antes de recomendação forte',
        href: `/admin/events?search=${encodeURIComponent(event.name)}`,
      });
    }
    if (event.sourceStatus === 'stale') {
      items.push({
        id: `source-${event.id}`,
        kind: 'stale_source',
        severity: 'medium',
        title: 'Fonte stale em evento relevante',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: 'source sem atualização recente',
        recommendedAction: 'Investigar coletor e atualizar snapshot',
        href: '/admin/collectors-health',
      });
    }
  }

  const limited = items
    .sort((a, b) => {
      const severity = { high: 3, medium: 2, low: 1 };
      return severity[b.severity] - severity[a.severity] || (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0);
    })
    .slice(0, 40);
  const summary = limited.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      acc.total += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0, total: 0 },
  );
  return {
    generatedAt: radar.generatedAt,
    contractMode: radar.contractMode,
    endpointGaps: radar.endpointGaps,
    summary,
    items: limited,
  };
}

function buildFallbackDetail(event: AdminEventRadarEvent): AdminEventRadarDetail {
  return {
    generatedAt: new Date().toISOString(),
    contractMode: 'contract-fallback',
    endpointGaps: ADMIN_EVENT_RADAR_FALLBACK_GAPS,
    event,
    intelligence: {
      eventDemandScore: event.demandScore,
      eventRevenuePotentialCents: event.revenuePotentialCents,
      demandRadiusKm: event.demandRadiusKm,
      expectedAttendance: event.expectedAttendance,
      sourceReliabilityScore: event.sourceStatus === 'fresh' ? 70 : event.sourceStatus === 'stale' ? 35 : null,
      confidence: event.confidence,
      interpretation: event.interpretation,
      drivers: [
        {
          key: 'relevance',
          label: 'Relevância operacional',
          weight: event.demandScore ?? 0,
          explanation: 'Derivada do campo de relevância existente enquanto o snapshot de inteligência não existe.',
        },
        {
          key: 'coverage',
          label: 'Cobertura geografica',
          weight: event.geocodeStatus === 'ok' ? 100 : 35,
          explanation: event.geocodeStatus === 'ok' ? 'Evento possui coordenadas para impacto espacial.' : 'Coordenadas pendentes limitam recomendações.',
        },
        {
          key: 'property-impact',
          label: 'Impacto em imóveis',
          weight: event.affectedPropertiesCount,
          explanation: 'Contagem estimada no fallback; endpoint property-impact deve substituir este bloco.',
        },
      ],
      riskFlags: event.riskFlags,
      dataQualityFlags: event.dataQualityFlags,
      generatedAt: new Date().toISOString(),
      modelVersion: 'contract-fallback-v0',
      metricVersion: 'contract-fallback-v0',
      jobRunId: null,
    },
    operation: {
      geocodeStatus: event.geocodeStatus,
      enrichmentStatus: event.enrichmentStatus,
      sourceStatus: event.sourceStatus,
      affectedPropertiesCount: event.affectedPropertiesCount,
      recommendationsGenerated: event.recommendationsGenerated,
    },
    propertyImpact: [],
    rawEvent: event.raw ?? {},
  };
}

function contractDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function buildContractFallbackListing(scope: AdminEventRadarScope = 'in'): EventsListResponse {
  const items: EventListItem[] = [
    {
      id: 'contract-sp-festival-ibirapuera',
      nome: 'Festival urbano de música e gastronomia',
      cidade: 'São Paulo',
      estado: 'SP',
      dataInicio: contractDate(8),
      dataFim: contractDate(9),
      categoria: 'música',
      relevancia: 88,
      capacidadeEstimada: 42000,
      raioImpactoKm: 8,
      venueType: 'park',
      venueCapacity: 50000,
      expectedAttendance: 42000,
      venueName: 'Parque Ibirapuera',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-001',
      dedupHash: 'contract-fallback-sp-001',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: false,
      ativo: true,
      latitude: -23.5874,
      longitude: -46.6576,
      enrichmentAttempts: 1,
      enrichmentLastError: null,
      crawledUrl: null,
      lastSeenAt: null,
    },
    {
      id: 'contract-sp-tech-expo',
      nome: 'Congresso internacional de tecnologia',
      cidade: 'São Paulo',
      estado: 'SP',
      dataInicio: contractDate(18),
      dataFim: contractDate(20),
      categoria: 'negócios',
      relevancia: 82,
      capacidadeEstimada: 28000,
      raioImpactoKm: 7,
      venueType: 'expo_center',
      venueCapacity: 35000,
      expectedAttendance: 28000,
      venueName: 'Expo Center Norte',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-002',
      dedupHash: 'contract-fallback-sp-002',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: true,
      ativo: true,
      latitude: null,
      longitude: null,
      enrichmentAttempts: 0,
      enrichmentLastError: null,
      crawledUrl: 'https://example.invalid/event-radar-contract',
      lastSeenAt: null,
    },
    {
      id: 'contract-rj-arena-show',
      nome: 'Show de grande porte na Barra',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      dataInicio: contractDate(26),
      dataFim: contractDate(26),
      categoria: 'show',
      relevancia: 79,
      capacidadeEstimada: 18000,
      raioImpactoKm: 6,
      venueType: 'arena',
      venueCapacity: 22000,
      expectedAttendance: 18000,
      venueName: 'Arena da Barra',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-003',
      dedupHash: 'contract-fallback-rj-003',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: false,
      ativo: true,
      latitude: -22.9759,
      longitude: -43.3903,
      enrichmentAttempts: 1,
      enrichmentLastError: null,
      crawledUrl: null,
      lastSeenAt: null,
    },
    {
      id: 'contract-bh-design-week',
      nome: 'Semana de design e economia criativa',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      dataInicio: contractDate(34),
      dataFim: contractDate(37),
      categoria: 'cultura',
      relevancia: 68,
      capacidadeEstimada: 9000,
      raioImpactoKm: 5,
      venueType: 'convention_center',
      venueCapacity: 12000,
      expectedAttendance: 9000,
      venueName: 'Centro de Convenções',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-004',
      dedupHash: 'contract-fallback-bh-004',
      source: 'contract-fallback',
      outOfScope: true,
      pendingGeocode: false,
      ativo: true,
      latitude: -19.9245,
      longitude: -43.9352,
      enrichmentAttempts: 1,
      enrichmentLastError: null,
      crawledUrl: 'https://example.invalid/event-radar-contract',
      lastSeenAt: null,
    },
    {
      id: 'contract-campinas-universitario',
      nome: 'Encontro universitário regional',
      cidade: 'Campinas',
      estado: 'SP',
      dataInicio: contractDate(12),
      dataFim: contractDate(13),
      categoria: 'educação',
      relevancia: 57,
      capacidadeEstimada: 6000,
      raioImpactoKm: 4,
      venueType: 'campus',
      venueCapacity: 8000,
      expectedAttendance: 6000,
      venueName: 'Campus universitário',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-005',
      dedupHash: 'contract-fallback-cps-005',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: false,
      ativo: true,
      latitude: -22.8174,
      longitude: -47.0696,
      enrichmentAttempts: 2,
      enrichmentLastError: null,
      crawledUrl: 'https://example.invalid/event-radar-contract',
      lastSeenAt: null,
    },
  ];
  return {
    page: 1,
    limit: items.length,
    total: items.length,
    scope,
    items,
  };
}

function buildContractFallbackAnalytics(listing: EventsListResponse): AdminEventsAnalytics {
  const total = listing.items.length;
  const inScope = listing.items.filter((event) => !event.outOfScope).length;
  const outOfScope = total - inScope;
  const coordsMissing = listing.items.filter((event) => !event.latitude || !event.longitude).length;
  const relevanceMissing = listing.items.filter((event) => event.relevancia === null).length;
  return {
    summary: {
      total,
      ativos: total,
      inScope,
      outOfScope,
      coveragePercent: total ? Math.round(((total - coordsMissing) / total) * 100) : 0,
      enrichmentPercent: total ? Math.round(((total - relevanceMissing) / total) * 100) : 0,
      coordsMissing,
      relevanceMissing,
    },
    upcoming: { next7d: 0, next30d: inScope, next90d: total, megaUpcoming: 2 },
    byCategory: [],
    byCity: [],
    byRelevance: [],
    topUpcoming: [],
    lastCrawlAt: null,
  };
}

export async function fetchAdminEventRadar(
  filters: AdminEventRadarFilters = {},
): Promise<AdminEventRadarResponse> {
  try {
    const { data } = await api.get<AdminEventRadarResponse>('/admin/events/intelligence', {
      params: filters,
    });
    return { ...data, contractMode: data.contractMode ?? 'backend' };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    let analytics: AdminEventsAnalytics;
    let listing: EventsListResponse;
    try {
      [analytics, listing] = await Promise.all([
        fetchAdminEvents(),
        fetchAdminEventsList({
          page: 1,
          limit: 100,
          scope: filters.scope ?? 'in',
          source: filters.source,
          search: filters.search,
          upcoming: true,
        }),
      ]);
    } catch (legacyError) {
      if (!isContractFallbackAllowed(legacyError)) throw legacyError;
      listing = buildContractFallbackListing(filters.scope ?? 'in');
      analytics = buildContractFallbackAnalytics(listing);
    }
    return buildFallbackRadarResponse(analytics, listing, filters);
  }
}

export async function fetchAdminEventRadarHeatmap(params: {
  from?: string;
  to?: string;
  metric?: AdminEventRadarHeatmapMetric;
  source?: string;
  category?: string;
  scope?: AdminEventRadarScope;
  confidence?: EventRadarConfidence | 'all';
  search?: string;
} = {}): Promise<AdminEventRadarHeatmapResponse> {
  const metric = params.metric ?? 'demand';
  try {
    const { data } = await api.get<AdminEventRadarHeatmapResponse>('/admin/events/heatmap', {
      params: { ...params, metric },
    });
    return { ...data, metric, contractMode: data.contractMode ?? 'backend' };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    const radar = await fetchAdminEventRadar(params);
    return buildFallbackHeatmap(radar, metric);
  }
}

export async function fetchAdminEventRadarBlindSpots(
  filters: AdminEventRadarFilters = {},
): Promise<AdminEventRadarBlindSpotsResponse> {
  try {
    const { data } = await api.get<AdminEventRadarBlindSpotsResponse>('/admin/events/blind-spots', {
      params: filters,
    });
    return { ...data, contractMode: data.contractMode ?? 'backend' };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    const radar = await fetchAdminEventRadar(filters);
    return buildFallbackBlindSpots(radar);
  }
}

export async function fetchAdminEventRadarDetail(
  eventId: string,
  seed?: AdminEventRadarEvent,
): Promise<AdminEventRadarDetail> {
  try {
    const [{ data: detail }, impactResult] = await Promise.all([
      api.get<AdminEventRadarDetail>(`/admin/events/${eventId}/intelligence`),
      api
        .get<AdminEventRadarPropertyImpact[]>(`/admin/events/${eventId}/property-impact`)
        .then((r) => r.data)
        .catch((error) => {
          if (isContractFallbackAllowed(error)) return null;
          throw error;
        }),
    ]);
    return {
      ...detail,
      contractMode: detail.contractMode ?? 'backend',
      propertyImpact: impactResult ?? detail.propertyImpact ?? [],
    };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    if (seed) return buildFallbackDetail(seed);
    const listing = await fetchAdminEventsList({ page: 1, limit: 100, scope: 'all', upcoming: true });
    const event = listing.items.find((item) => item.id === eventId);
    if (!event) throw error;
    return buildFallbackDetail(toFallbackRadarEvent(event));
  }
}

export const recomputeAdminEventIntelligence = (eventId: string) =>
  api
    .post<{ ok: boolean; jobRunId?: string | null }>(
      `/admin/events/${eventId}/recompute-intelligence`,
    )
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
    brevoApiKeyConfigured: boolean;
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
    supportEmail?: string;
    privacyEmail?: string;
    supportEmailConfigured?: boolean;
    privacyEmailConfigured?: boolean;
    supportEmailDomainOk?: boolean;
    privacyEmailDomainOk?: boolean;
    supportOwnerEmail?: string;
    privacyOwnerEmail?: string;
    supportOwnerConfigured?: boolean;
    privacyOwnerConfigured?: boolean;
    supportOwnerDomainOk?: boolean;
    privacyOwnerDomainOk?: boolean;
  };
  integrationsReadiness?: Record<
    'stripe' | 'email' | 'stays' | 'support',
    {
      label: string;
      status: 'ready' | 'blocked';
      blockers: string[];
      nextAction: string;
    }
  >;
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

function isoFromDaysAhead(daysAhead: number): string {
  return formatLocalDate(dateAtLocalOffset(daysAhead));
}

/**
 * fetchPace — busca pace para um imóvel específico ou para o portfólio.
 *
 *
 * Range default: hoje até hoje+60 dias.
 */
export async function fetchPace(
  propertyId?: string,
  options?: { days?: number },
): Promise<PaceApiPoint[]> {
  const days = options?.days ?? 60;

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
    console.warn('[fetchPace] endpoint indisponível:', err);
    throw err;
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
 */
export type PortfolioEventImpact = 'alta' | 'media';

export interface PortfolioEvent {
  id: string;
  nome: string;
  impacto: PortfolioEventImpact;
}

export type PortfolioSignal =
  | number
  | {
      value?: number | null;
      score?: number | null;
      amount?: number | null;
      percent?: number | null;
      percentage?: number | null;
      label?: string | null;
      title?: string | null;
      description?: string | null;
      reason?: string | null;
      [key: string]: unknown;
    };

export interface PortfolioDay {
  date: string;
  sugestao: number | null;
  atual: number;
  base?: number | null;
  evento: PortfolioEvent | null;
  strategyApplied?: unknown;
  opportunity?: PortfolioSignal | null;
  risk?: PortfolioSignal | string | null;
  lift?: PortfolioSignal | null;
  confidence?: PortfolioSignal | string | number | null;
}

export interface PortfolioProperty {
  propertyId: string;
  name: string;
  thumbnail: string | null;
  days: PortfolioDay[];
  strategyApplied?: unknown;
  opportunity?: PortfolioSignal | null;
  risk?: PortfolioSignal | string | null;
  lift?: PortfolioSignal | null;
  confidence?: PortfolioSignal | string | number | null;
}

export interface PortfolioCalendarResponse {
  properties: PortfolioProperty[];
  summary?: Record<string, unknown> | null;
  opportunities?: PortfolioOpportunity[] | null;
  actionRuns?: PortfolioActionRun[] | null;
  range?: { from: string; to: string; days: number } | null;
}

export interface PortfolioCalendarInput {
  from: string;
  to: string;
  propertyIds?: string[];
  strategy?: string;
}

/**
 * fetchPortfolioCalendar — multi-imóvel calendar (Gap 1).
 *
 */
export async function fetchPortfolioCalendar(
  input: PortfolioCalendarInput,
): Promise<PortfolioCalendarResponse> {

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
    console.warn('[fetchPortfolioCalendar] endpoint indisponível:', err);
    throw err;
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
  | 'set-date-price'
  | 'accept-suggestions'
  | 'apply-internal'
  | string;

export interface PortfolioBulkActionInput {
  propertyIds: string[];
  action: PortfolioBulkAction;
  payload?: Record<string, unknown>;
  dates?: string[];
  from?: string;
  to?: string;
}

export interface PortfolioBulkActionFailure {
  propertyId: string;
  reason: string;
}

export interface PortfolioBulkActionResponse {
  applied?: number;
  failed?: PortfolioBulkActionFailure[];
  auditLogId?: string | null;
  actionRunId?: string | null;
  status?: string;
  summary?: Record<string, unknown> | null;
}

export interface PortfolioActionTarget {
  propertyId: string;
  date?: string;
}

export interface PortfolioActionSnapshot {
  revenue?: number | null;
  totalRevenue?: number | null;
  projectedRevenue?: number | null;
  averagePrice?: number | null;
  changedDays?: number | null;
  changedProperties?: number | null;
  [key: string]: unknown;
}

export interface PortfolioActionSimulationItem {
  propertyId?: string;
  propertyName?: string | null;
  date?: string | null;
  before?: number | Record<string, unknown> | null;
  after?: number | Record<string, unknown> | null;
  status?: string | null;
  estimatedLift?: number | null;
  applied?: boolean;
  reason?: string | null;
  [key: string]: unknown;
}

export interface PortfolioActionSimulationResponse {
  action?: PortfolioBulkAction;
  before?: PortfolioActionSnapshot | null;
  after?: PortfolioActionSnapshot | null;
  applied?: number | PortfolioActionSimulationItem[];
  failed?: PortfolioBulkActionFailure[];
  changes?: PortfolioActionSimulationItem[];
  items?: PortfolioActionSimulationItem[];
  summary?: (PortfolioActionSnapshot & {
    estimatedLift?: number | null;
    affectedProperties?: number | null;
    affectedDates?: number | null;
  }) | null;
  simulated?: boolean;
}

export interface PortfolioOpportunity {
  id?: string;
  propertyId?: string;
  propertyName?: string | null;
  date?: string | null;
  dates?: string[];
  recommendedDates?: string[];
  targetDates?: string[];
  title?: string | null;
  description?: string | null;
  reason?: string | null;
  recommendedAction?: string | null;
  strategyApplied?: unknown;
  opportunity?: PortfolioSignal | null;
  risk?: PortfolioSignal | string | null;
  lift?: PortfolioSignal | null;
  confidence?: PortfolioSignal | string | number | null;
  currentPrice?: number | null;
  suggestedPrice?: number | null;
  [key: string]: unknown;
}

export interface PortfolioActionRun {
  id: string;
  action: PortfolioBulkAction;
  status?: 'simulated' | 'applied' | 'failed' | 'partial' | string;
  applied?: number | null;
  failed?: number | PortfolioBulkActionFailure[] | null;
  auditLogId?: string | null;
  actionRunId?: string | null;
  propertyIds?: string[];
  selectedPropertyIds?: string[];
  targetDates?: string[];
  targets?: PortfolioActionTarget[];
  strategyApplied?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  summary?: Record<string, unknown> | null;
}

export interface PortfolioOpportunitiesResponse {
  range?: { from: string; to: string; days: number } | null;
  summary?: {
    opportunities?: number;
    estimatedLift?: number;
    affectedProperties?: number;
    averageRisk?: number;
    topLift?: number;
    [key: string]: unknown;
  } | null;
  opportunities: PortfolioOpportunity[];
}

export async function fetchPortfolioOpportunities(
  input: PortfolioCalendarInput,
): Promise<PortfolioOpportunitiesResponse> {
  try {
    const { data } = await api.get<PortfolioOpportunitiesResponse>('/portfolio/opportunities', {
      params: {
        from: input.from,
        to: input.to,
        propertyIds: input.propertyIds?.join(',') || undefined,
        strategy: input.strategy && input.strategy !== 'todas' ? input.strategy : undefined,
      },
    });
    return data ?? { opportunities: [] };
  } catch (err) {
    console.warn('[fetchPortfolioOpportunities] endpoint indisponível:', err);
    throw err;
  }
}

export async function simulatePortfolioAction(
  input: PortfolioBulkActionInput,
): Promise<PortfolioActionSimulationResponse> {

  try {
    const { data } = await api.post<PortfolioActionSimulationResponse>(
      '/portfolio/simulate-action',
      input,
    );
    return { ...(data ?? {}), simulated: data?.simulated ?? true };
  } catch (err) {
    console.warn('[simulatePortfolioAction] endpoint indisponível:', err);
    throw err;
  }
}

export async function mutatePortfolioBulkAction(
  input: PortfolioBulkActionInput,
): Promise<PortfolioBulkActionResponse> {

  try {
    const { data } = await api.post<PortfolioBulkActionResponse>('/portfolio/bulk-action', input);
    return data;
  } catch (err) {
    console.warn('[mutatePortfolioBulkAction] endpoint indisponível:', err);
    throw err;
  }
}

export async function fetchPortfolioActionRuns(limit = 8): Promise<PortfolioActionRun[]> {
  try {
    const { data } = await api.get<
      PortfolioActionRun[] | { runs?: PortfolioActionRun[]; items?: PortfolioActionRun[] }
    >('/portfolio/action-runs', {
      params: { limit },
    });
    if (Array.isArray(data)) return data;
    return data?.runs ?? data?.items ?? [];
  } catch (err) {
    const status = (err as any)?.response?.status;
    if (status === 404 || status === 405 || status === 501) {
      console.warn('[fetchPortfolioActionRuns] endpoint indisponível:', err);
      return [];
    }
    throw err;
  }
}

// === Gap 2 — Pricing Rules ===
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

export async function fetchPricingRules(propertyId: string): Promise<PricingRulesResponse> {
  try {
    const { data } = await api.get<PricingRulesResponse>(
      `/properties/${propertyId}/pricing-rules`,
    );
    if (!data) throw new Error('empty response');
    return data;
  } catch (err) {
    console.warn('[fetchPricingRules] endpoint indisponível:', err);
    throw err;
  }
}

export async function savePricingRules(
  propertyId: string,
  rules: PricingRule[],
): Promise<PricingRulesResponse> {
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
  try {
    const { data } = await api.post<PricingRulesPreviewResponse>(
      `/properties/${propertyId}/pricing-rules/preview`,
      { rules },
    );
    return data ?? { days: [] };
  } catch (err) {
    console.warn('[previewPricingRules] endpoint indisponível:', err);
    throw err;
  }
}

export async function copyPricingRulesFromProperty(
  sourceId: string,
  targetId: string,
): Promise<PricingRulesResponse> {
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

/**
 * fetchMarketIntel — comparáveis + percentile + série diária ADR (Gap 3).
 *
 */
export async function fetchMarketIntel(
  input: MarketIntelInput,
): Promise<MarketIntelResponse> {

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
    console.warn('[fetchMarketIntel] endpoint indisponível:', err);
    throw err;
  }
}

// === Gap 7 — AskUrban ===
//
// Assistente conversacional do anfitrião — drawer global acionado via
// Cmd+J / Ctrl+J.
// Quando o backend estiver de pé:
//   - GET    /ask/usage           → AskUsageResponse
//   - POST   /ask/question        body = AskRequestInput → AskResponse
//   - POST   /ask/feedback        body = { messageId, vote } → { ok: true }

export type AskCitation = { id: string; label: string; url?: string };

export type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AskCitation[];
  feedback?: 'up' | 'down';
  createdAt: string;
};

export type AskUsageResponse = {
  used: number;
  quota: number;
  hardCap: number;
  canUse: boolean;
  plan: string;
  reason:
    | null
    | 'no_active_subscription'
    | 'subscription_expired'
    | 'plan_not_allowed'
    | 'quota_exceeded'
    | 'hard_cap_exceeded';
};

export type AskRequestInput = {
  question: string;
  conversationId?: string;
};

export type AskResponse = {
  messageId: string;
  conversationId: string;
  content: string;
  citations: AskCitation[];
  usage: AskUsageResponse;
};

export async function fetchAskUsage(): Promise<AskUsageResponse> {
  const { data } = await api.get<AskUsageResponse>('/ask/usage');
  return data;
}

export async function postAskQuestion(
  input: AskRequestInput,
): Promise<AskResponse> {

  const { data } = await api.post<AskResponse>('/ask/question', input);
  return data;
}

export async function submitAskFeedback(
  messageId: string,
  vote: 'up' | 'down',
): Promise<{ ok: true }> {
  await api.post('/ask/feedback', { messageId, vote });
  return { ok: true };
}
