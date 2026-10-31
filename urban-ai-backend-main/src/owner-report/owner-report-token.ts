import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Tokens opacos do relatório do proprietário (ADR 0027).
 *
 * Formato: `<aleatório>.<assinatura>`.
 *  - o aleatório vem de `crypto.randomBytes` (sem ID interno, sem dado pessoal);
 *  - a assinatura é HMAC-SHA256 (segredo do servidor, separado por `kind`) truncada em 128 bits:
 *    descarta token adulterado/lixo SEM consultar o banco, e impede forjar um token só
 *    com acesso de leitura ao banco;
 *  - link de relatório: o banco guarda só o SHA-256 do aleatório (vazamento do banco não dá
 *    link utilizável); descadastro: o banco guarda o aleatório (`unsubscribeRef`), inútil sem a assinatura.
 *
 * Sem segredo configurado nada é emitido nem aceito (degrada com aviso, não quebra o boot).
 */
export type OwnerTokenKind = 'link' | 'unsub';

const SIGNATURE_LENGTH = 22; // base64url de 16 bytes
const RANDOM_BYTES: Record<OwnerTokenKind, number> = { link: 32, unsub: 16 };
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,64}\.[A-Za-z0-9_-]{22}$/;

export const DEFAULT_LINK_TTL_DAYS = 30;
export const MAX_LINK_TTL_DAYS = 90;

function signingSecret(): string | null {
  const dedicated = process.env.OWNER_REPORT_TOKEN_SECRET?.trim();
  if (dedicated) return dedicated;
  const jwt = process.env.JWT_SECRET?.trim();
  return jwt ? `owner-report:${jwt}` : null;
}

export function isOwnerTokenSecretConfigured(): boolean {
  return signingSecret() !== null;
}

function sign(secret: string, kind: OwnerTokenKind, random: string): string {
  return createHmac('sha256', secret).update(`${kind}.${random}`).digest('base64url').slice(0, SIGNATURE_LENGTH);
}

export function hashTokenRandom(random: string): string {
  return createHash('sha256').update(random).digest('hex');
}

export type IssuedOwnerToken = {
  /** Token completo, a ser entregue UMA vez (link/e-mail). */
  token: string;
  /** Parte aleatória (para `unsub` é o `unsubscribeRef`). */
  random: string;
  /** SHA-256 do aleatório (para `link` é o que o banco guarda). */
  hash: string;
};

export function issueOwnerToken(kind: OwnerTokenKind): IssuedOwnerToken | null {
  const secret = signingSecret();
  if (!secret) return null;
  const random = randomBytes(RANDOM_BYTES[kind]).toString('base64url');
  return { token: `${random}.${sign(secret, kind, random)}`, random, hash: hashTokenRandom(random) };
}

/** Assina um aleatório já existente (ex.: `unsubscribeRef` guardado no proprietário). */
export function signOwnerToken(kind: OwnerTokenKind, random: string): string | null {
  const secret = signingSecret();
  if (!secret || !/^[A-Za-z0-9_-]{16,64}$/.test(random)) return null;
  return `${random}.${sign(secret, kind, random)}`;
}

/** Confere forma e assinatura em tempo constante; devolve o aleatório ou null. */
export function verifyOwnerToken(kind: OwnerTokenKind, token: unknown): { random: string; hash: string } | null {
  const secret = signingSecret();
  if (!secret || typeof token !== 'string' || token.length > 100 || !TOKEN_SHAPE.test(token)) return null;
  const [random, signature] = token.split('.');
  const expected = Buffer.from(sign(secret, kind, random));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { random, hash: hashTokenRandom(random) };
}

export type LinkState = 'valid' | 'expired' | 'revoked';

/** Revogação vence expiração: um link revogado nunca volta a "válido". */
export function evaluateLinkState(
  link: { expiresAt: Date | string; revokedAt?: Date | string | null },
  now: Date = new Date(),
): LinkState {
  if (link.revokedAt) return 'revoked';
  const expires = new Date(link.expiresAt).getTime();
  if (!Number.isFinite(expires) || expires <= now.getTime()) return 'expired';
  return 'valid';
}

/** TTL em dias: pedido do anfitrião > env `OWNER_REPORT_LINK_TTL_DAYS` > 30; limitado a 1..90. */
export function resolveLinkTtlDays(requested?: number | null): number {
  const clamp = (value: number) => Math.min(MAX_LINK_TTL_DAYS, Math.max(1, Math.floor(value)));
  if (requested !== undefined && requested !== null && Number.isFinite(Number(requested)) && Number(requested) > 0) {
    return clamp(Number(requested));
  }
  const fromEnv = Number(process.env.OWNER_REPORT_LINK_TTL_DAYS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? clamp(fromEnv) : DEFAULT_LINK_TTL_DAYS;
}

export function linkExpiryFrom(now: Date, ttlDays: number): Date {
  return new Date(now.getTime() + ttlDays * 86_400_000);
}
