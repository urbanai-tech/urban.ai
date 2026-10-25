/**
 * Links de autenticação SEM segredo/PII na URL.
 *
 * Path e query vão para histórico do navegador, logs de servidor/CDN, Referer,
 * Sentry e analytics. Por isso:
 *  - o token de redefinição de senha viaja no FRAGMENTO (`/reset-password#token=...`),
 *    que nunca sai do navegador;
 *  - o e-mail pendente de confirmação fica em sessionStorage (`/confirm-email`).
 * Funções puras/defensivas, cobertas por scripts/auth-links.test.mjs.
 */

export const RESET_PASSWORD_PATH = "/reset-password";
export const CONFIRM_EMAIL_PATH = "/confirm-email";
export const PENDING_EMAIL_KEY = "urbanai:confirm-email";
export const PENDING_RESET_TOKEN_KEY = "urbanai:reset-token";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Lê `token` de um fragmento como `#token=abc` (ou `token=abc`). */
export function parseResetTokenFromHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("token")?.trim();
  return token ? token : null;
}

/** Decodifica um segmento de path sem estourar em `%` malformado. */
export function safeDecodeSegment(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function stashPendingEmail(email: string, storage: StorageLike | null = defaultStorage()): void {
  const value = email.trim();
  if (!storage || !value) return;
  try {
    storage.setItem(PENDING_EMAIL_KEY, value);
  } catch {
    /* storage bloqueado: a página pede o e-mail digitado */
  }
}

export function readPendingEmail(storage: StorageLike | null = defaultStorage()): string {
  if (!storage) return "";
  try {
    return storage.getItem(PENDING_EMAIL_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function clearPendingEmail(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(PENDING_EMAIL_KEY);
  } catch {
    /* noop */
  }
}

/** `ana.host@urbanai.com` -> `an***@urbanai.com` (mesmo formato dos logs do backend). */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return "";
  const local = value.slice(0, at);
  return `${local.slice(0, local.length > 2 ? 2 : 1)}***${value.slice(at)}`;
}

/** True quando o campo de e-mail do perfil difere do e-mail salvo (sem diferenciar caixa). */
export function isEmailChange(saved: string | null | undefined, typed: string | null | undefined): boolean {
  const next = (typed ?? "").trim().toLowerCase();
  if (!next) return false;
  return next !== (saved ?? "").trim().toLowerCase();
}

/** Mensagem amigável para erros do PUT /auth/profile ao trocar o e-mail (por `code`/status do backend). */
export function emailChangeErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { code?: string; message?: string } } } | null)
    ?.response;
  const code = response?.data?.code;
  if (code === "INVALID_PASSWORD") return "Senha incorreta. Confira e tente de novo.";
  if (code === "PASSWORD_REQUIRED") return "Informe sua senha atual para alterar o e-mail.";
  if (code === "EMAIL_CHANGE_NOT_ALLOWED") {
    return "Contas conectadas pelo Google não podem trocar o e-mail por aqui.";
  }
  if (response?.status === 409) return "Este e-mail já está em uso por outra conta.";
  return "Não foi possível salvar seu perfil.";
}

/** Troca a URL atual (sem fragmento/query/segredo) sem recarregar a página. */
export function scrubCurrentUrl(path: string): void {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(window.history.state, "", path);
  } catch {
    /* noop */
  }
}
