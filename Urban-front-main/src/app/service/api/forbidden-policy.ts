/**
 * Política de 403 do interceptor global.
 *
 * Um 403 de negócio (com `code` conhecido) NÃO é falta de permissão: quem trata
 * é a tela que disparou a chamada (upsell de quota, verificação de e-mail).
 * Somente 403 "crus" (autorização real) levam o usuário para /forbidden.
 */
export const BUSINESS_FORBIDDEN_CODES = [
  "LISTINGS_QUOTA_EXCEEDED",
  "EMAIL_NOT_VERIFIED",
] as const;

export type BusinessForbiddenCode = (typeof BUSINESS_FORBIDDEN_CODES)[number];

type ErrorLike = {
  response?: { status?: number; data?: { code?: unknown } };
};

export function getBusinessForbiddenCode(error: unknown): BusinessForbiddenCode | null {
  const response = (error as ErrorLike | null | undefined)?.response;
  if (response?.status !== 403) return null;
  const code = response.data?.code;
  return (BUSINESS_FORBIDDEN_CODES as readonly unknown[]).includes(code)
    ? (code as BusinessForbiddenCode)
    : null;
}

export function isBusinessForbidden(error: unknown): boolean {
  return getBusinessForbiddenCode(error) !== null;
}

/**
 * 402 Payment Required: o backend exige assinatura ativa para a rota
 * (code SUBSCRIPTION_REQUIRED). NÃO é falta de permissão, então jamais vai para
 * /forbidden: o interceptor avisa o PaymentCheckGuard, que abre o paywall existente.
 */
export const SUBSCRIPTION_REQUIRED_CODE = "SUBSCRIPTION_REQUIRED";

export function isSubscriptionRequiredError(error: unknown): boolean {
  const response = (error as ErrorLike | null | undefined)?.response;
  return response?.status === 402 && response.data?.code === SUBSCRIPTION_REQUIRED_CODE;
}

/**
 * Rota de resolução para EMAIL_NOT_VERIFIED: o /post-login lê o perfil e
 * encaminha quem ainda não verificou o e-mail para /confirm-email/{email}.
 */
export const EMAIL_NOT_VERIFIED_REDIRECT_PATH = "/post-login";
