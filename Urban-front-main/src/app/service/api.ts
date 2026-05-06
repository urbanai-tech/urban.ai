import axios from "axios";
import { Connect, CreateAddressDto } from "../types/connect";
import { List, Address } from "../types/connect"; // Crie esse tipo DTO correspondente à entidade List
import { Subscription } from "../componentes/Subscription";

export interface PropertyAnalysisRequest {
  id: string;
  titulo: string;
  id_do_anuncio: string;
  pictureUrl: string;
  ativo: boolean;
  user: { id: string };
}

// ✅ Adicionado para resolver o erro de tipo
// TODO: tipar conforme o retorno real do backend
export type ProcessAnalysesResponse = any;

// Base URL configurada via variável de ambiente
const url = process.env.NEXT_PUBLIC_API_URL;
console.log("API Base URL:", url);

// Cria instância do axios com baseURL
export const api = axios.create({
  baseURL: url,
  // baseURL: 'https://urban-back-719774307855.us-central1.run.app',
});

// Função de teste para verificar a URL
export const teste = (): void => {
  console.log("API Base URL (teste):", url);
};

// Interceptor para incluir o token de autorização em todas as requisições
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor global para tratar expiração de token (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

/* ============================
 *    EMAIL / AUTENTICAÇÃO
 * ============================ */

/** Confirma e-mail no backend usando o token da URL */
export async function verifyEmail(token: string): Promise<{ ok: boolean }> {
  const { data } = await api.get<{ ok: boolean }>("/auth/verify-email", {
    params: { token },
  });
  return data;
}

/** Reenvia o e-mail de verificação (gera novo token no backend) */
export async function resendVerification(email: string, nome?: string): Promise<{ enviado: boolean; token?: string }> {
  const { data } = await api.post<{ enviado: boolean; token?: string }>("/email/send-verify", {
    email,
    nome,
  });
  return data;
}

/** Inicia fluxo de reset de senha (envia e-mail com link) */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>("/auth/request-password-reset", { email });
  return data;
}

/** Finaliza reset de senha com token + nova senha (SHA-256) */
export async function resetPassword(token: string, newPasswordSha256: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>("/auth/reset-password", {
    token,
    newPassword: newPasswordSha256,
  });
  return data;
}

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
export async function getUserManagedListingsWithCep(
  userId: string,
): Promise<any[]> {
  try {
    const { data } = await api.get<any[]>(
      `/connect/user-managed-listings-with-cep/${userId}`,
    );
    return data;
  } catch (error) {
    console.error("Erro ao buscar listings com CEP:", error);
    throw error;
  }
}

export type PropertyDropdown = {
  id: string;
  propertyName: string;
  userId: string;
  analisado	: string;
  image_url: string;
  latitude: number;
  longitude: number;
  id_do_anuncio?: string;
  nome: string;
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

export async function getUserAddresses(): Promise<List[]> {
  try {
    const { data } = await api.get<List[]>("/connect/user-addresses");
    return data;
  } catch (error) {
    console.error("Erro ao buscar endereços do usuário:", error);
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

export async function registerAddresses(
  addresses: Address[],
): Promise<Address[]> {
  try {
    const { data } = await api.post<Address[]>("/connect/addresses", addresses);
    return data;
  } catch (error) {
    console.error("Erro ao registrar endereços:", error);
    throw error;
  }
}

/** Cria múltiplos endereços (endpoint correto conforme guia) */
export async function createMultipleAddresses(
  addresses: CreateAddressDto[],
): Promise<Address[]> {
  try {
    const { data } = await api.post<Address[]>(
      "/connect/create-multiple-addresses",
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

export async function processAnalysesByProperty(
  payload: PropertyAnalysisRequest[]
): Promise<ProcessAnalysesResponse> {
  try {
    const { data } = await api.post<ProcessAnalysesResponse>(
      '/maps/processar-analises-by-property',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    return data;
  } catch (error: any) {
    console.error(
      'Erro ao processar análises por propriedade:',
      error?.response?.data ?? error
    );
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
  userId: string,
  pass: string
): Promise<UpdatePasswordResponse> => {
  try {
    const response = await api.post<UpdatePasswordResponse>('/email/update-password', {
      userId,
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

export const requestforgotPassword = async (email: string) => {
  try {
    const { data } = await api.post('/email/forgot-password', { email });
    return data;
  } catch (error) {
    console.error('Erro ao enviar e-mail de redefinição de senha:', error);
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

// ================== Stays integration (F6.4) ==================

export interface StaysAccountPublic {
  id: string;
  status: 'pending' | 'active' | 'error' | 'disconnected';
  clientId: string;
  lastSyncAt: string | null;
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

export async function staysConnect(
  clientId: string,
  accessToken: string,
): Promise<StaysAccountPublic> {
  const { data } = await api.post<StaysAccountPublic>('/stays/connect', {
    clientId,
    accessToken,
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
  api.post<{ ok: true; inviteUrl: string }>(`/admin/waitlist/${id}/invite`).then((r) => r.data);

export const updateWaitlistNotes = (id: string, notes: string | null) =>
  api.patch<WaitlistEntry>(`/admin/waitlist/${id}/notes`, { notes }).then((r) => r.data);

export const deleteWaitlistEntry = (id: string) =>
  api.delete<{ ok: true }>(`/admin/waitlist/${id}`).then((r) => r.data);

// =================== Eventos — Camada 3 (curadoria manual) ===================

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

export interface GeocoderStatus {
  pendingGeocode: number;
}

export const fetchGeocoderStatus = () =>
  api.get<GeocoderStatus>('/events/geocoder/status').then((r) => r.data);

export const runGeocoderNow = (limit = 30) =>
  api
    .post<{
      attempted: number;
      succeeded: number;
      failed: number;
      failures: Array<{ id: string; reason: string }>;
    }>(`/events/geocoder/run?limit=${limit}`)
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
