import { api } from "./client";


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
