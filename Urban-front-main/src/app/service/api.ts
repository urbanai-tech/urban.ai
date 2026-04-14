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

export async function createCheckoutSession(planId: string): Promise<{ sessionId: string }> {
  try {
    const { data } = await api.post<{ sessionId: string }>(
      "/payments/create-checkout-session",
      { plan: planId }
    );
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
  percentualInicial?: number;
  percentualFinal?: number;
};

// Resposta normalizada para sempre expor { profile: { phone, company } }
export type ProfileResponse = {
  id: string;
  username: string;
  email: string;
  distanceKm?: number;
  pricingStrategy?: string;
  operationMode?: string;
  percentualInicial?: number;
  percentualFinal?: number;
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
 * Busca os percentuais do usuário pelo ID ou token atual.
 * @param payload Opcional: inicial e final (dependendo da API)
 * @returns Dados retornados pela API
 */
export const requestFindPercentualByUserId = async (payload?: PercentualPayload) => {
  try {
    const { data } = await api.get('/propriedades/findPercentualByUserId', {
      data: payload, // Axios permite enviar body em GET (depende do backend)
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar percentuais do usuário:', error);
    throw error;
  }
};

