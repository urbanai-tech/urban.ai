import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Descadastro com um clique (RFC 8058) para e-mails NÃO transacionais.
 * Token assinado por HMAC-SHA256 com segredo do servidor: não exige login,
 * não expira (o link de descadastro precisa funcionar em e-mails antigos) e a
 * operação que ele autoriza é idempotente (só desliga uma preferência).
 */
export const UNSUBSCRIBE_CATEGORIES = ['onboarding', 'weekly_report', 'pricing', 'marketing', 'owner_reports'] as const;
export type UnsubscribeCategory = (typeof UNSUBSCRIBE_CATEGORIES)[number];

const TOKEN_VERSION = 'v1';
const USER_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function signingSecret(): string | null {
  const dedicated = process.env.UNSUBSCRIBE_TOKEN_SECRET?.trim();
  if (dedicated) return dedicated;
  const jwt = process.env.JWT_SECRET?.trim();
  return jwt ? `unsubscribe:${jwt}` : null;
}

function sign(secret: string, userId: string, category: string): string {
  return createHmac('sha256', secret).update(`${TOKEN_VERSION}.${userId}.${category}`).digest('base64url');
}

export function createUnsubscribeToken(userId: string, category: UnsubscribeCategory): string | null {
  const secret = signingSecret();
  if (!secret || !USER_ID_PATTERN.test(userId)) return null;
  return `${TOKEN_VERSION}.${userId}.${category}.${sign(secret, userId, category)}`;
}

export function verifyUnsubscribeToken(
  token: unknown,
): { userId: string; category: UnsubscribeCategory } | null {
  const secret = signingSecret();
  if (!secret || typeof token !== 'string' || token.length > 256) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return null;
  const [, userId, category, signature] = parts;
  if (!USER_ID_PATTERN.test(userId)) return null;
  if (!(UNSUBSCRIBE_CATEGORIES as readonly string[]).includes(category)) return null;
  const expected = Buffer.from(sign(secret, userId, category));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { userId, category: category as UnsubscribeCategory };
}

/** Headers RFC 8058; null quando não há segredo ou URL pública configurados. */
export function buildListUnsubscribeHeaders(
  userId: string,
  category: UnsubscribeCategory,
): Record<string, string> | null {
  const base = (process.env.API_URL || '').trim().replace(/\/$/, '');
  const token = createUnsubscribeToken(userId, category);
  if (!base || !token) return null;
  return {
    'List-Unsubscribe': `<${base}/unsubscribe?token=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
