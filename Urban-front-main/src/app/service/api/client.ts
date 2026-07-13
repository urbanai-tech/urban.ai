import axios from "axios";
// Base URL configurada via variável de ambiente
const url = process.env.NEXT_PUBLIC_API_URL;
export const enableContractFallback = process.env.NEXT_PUBLIC_ENABLE_CONTRACT_FALLBACK === "true";

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
