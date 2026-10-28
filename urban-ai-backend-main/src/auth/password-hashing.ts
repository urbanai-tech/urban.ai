import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Esquema de senha (ADR 0025).
 *
 * O cliente envia a senha em texto puro (sob TLS) e TODO hash acontece aqui.
 *
 * Formatos que podem estar em `user.password`:
 *  - v2 (atual):  `pw:v2:` + bcrypt(12) de base64(HMAC-SHA256(PASSWORD_V2_DOMAIN, senha)).
 *    O pré-hash no servidor resolve o limite de 72 bytes do bcrypt (sempre 44 bytes
 *    ASCII, sem NUL) sem truncar nem recusar senhas longas. O HMAC usa uma chave
 *    fixa de separação de domínio, não um segredo: não há pepper para gerenciar.
 *  - legado bcrypt: bcrypt de sha256hex(senha) — o que o front antigo mandava —
 *    ou, em contas definidas pelo admin, bcrypt da senha em texto puro.
 *  - legado sha256: sha256hex(senha) puro (contas muito antigas).
 *  - `google_*`: conta só Google, nunca autentica por senha.
 *
 * Login de conta legada com a senha em texto puro: o servidor calcula o sha256,
 * valida e regrava em v2 (migração transparente, sem reset forçado).
 *
 * Janela de compatibilidade: um bundle antigo em cache ainda manda sha256hex(senha).
 * Até LEGACY_CLIENT_HASH_DEFAULT_UNTIL (ou AUTH_LEGACY_CLIENT_HASH_UNTIL), um
 * hex de 64 caracteres é aceito como credencial SÓ para linhas legadas (é o
 * pass-the-hash que já existia; linhas v2 nunca aceitam). Depois da data, o hex
 * passa a ser tratado como uma senha qualquer e o pass-the-hash acaba para todos.
 */

export const BCRYPT_ROUNDS = 12;
export const PASSWORD_V2_PREFIX = 'pw:v2:';
const PASSWORD_V2_DOMAIN = 'urban-ai/password/v2';
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;
const BCRYPT_REGEX = /^\$2[aby]\$/;

/** Fim padrão da janela em que o backend aceita o sha256hex do front antigo. */
export const LEGACY_CLIENT_HASH_DEFAULT_UNTIL = '2026-11-30T03:00:00Z';

export type PasswordVerification = {
  ok: boolean;
  /** true quando a linha deve ser regravada em v2 (só quando recebemos a senha em claro). */
  needsRehash: boolean;
};

const FAIL: PasswordVerification = { ok: false, needsRehash: false };

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_REGEX.test(value);
}

export function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && BCRYPT_REGEX.test(value);
}

export function isPasswordV2(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PASSWORD_V2_PREFIX);
}

/** Hash armazenado que custa um bcrypt para verificar (v2 ou bcrypt legado). */
export function isSlowPasswordHash(value: unknown): boolean {
  return isPasswordV2(value) || isBcryptHash(value);
}

/**
 * A janela do hash legado do cliente está aberta? `AUTH_LEGACY_CLIENT_HASH_UNTIL`
 * aceita uma data ISO (encurta/estende) ou `off` (fecha já).
 */
export function isLegacyClientHashAccepted(
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = String(env.AUTH_LEGACY_CLIENT_HASH_UNTIL ?? '').trim();
  if (/^(off|false|0|no)$/i.test(raw)) return false;
  const until = Date.parse(raw || LEGACY_CLIENT_HASH_DEFAULT_UNTIL);
  if (!Number.isFinite(until)) return false; // valor inválido: fecha (falha segura)
  return now.getTime() < until;
}

function sha256Hex(value: string): string {
  // Só para comparar com o formato legado (o front antigo fazia exatamente isto:
  // SHA-256 dos bytes UTF-8, hex minúsculo). Nunca é o formato gravado em v2.
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); // lgtm[js/insufficient-password-hash]
}

function preHashV2(password: string): string {
  // Pré-hash rápido só para caber no bcrypt (72 bytes); o custo vem do bcrypt(12) por cima.
  return crypto.createHmac('sha256', PASSWORD_V2_DOMAIN).update(password, 'utf8').digest('base64'); // lgtm[js/insufficient-password-hash]
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), 'utf8');
  const right = Buffer.from(b.toLowerCase(), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Hash v2 de uma senha em texto puro. */
export async function hashPasswordV2(password: string, rounds: number = BCRYPT_ROUNDS): Promise<string> {
  return PASSWORD_V2_PREFIX + (await bcrypt.hash(preHashV2(password), rounds));
}

/**
 * Hash para gravar uma senha nova (cadastro, convite, reset, admin).
 * Durante a janela, um hex de 64 caracteres vem do bundle antigo (é o sha256 da
 * senha): grava no formato legado bcrypt(hex), para que o login seguinte com a
 * senha em claro funcione e migre a linha para v2. Fora da janela, é senha comum.
 */
export async function hashPasswordForStorage(input: string, now: Date = new Date()): Promise<string> {
  if (isSha256Hex(input) && isLegacyClientHashAccepted(now)) {
    return bcrypt.hash(input.toLowerCase(), BCRYPT_ROUNDS);
  }
  return hashPasswordV2(input);
}

/**
 * Confere a credencial enviada contra o hash armazenado.
 * Nunca registra nem devolve a senha.
 */
export async function verifyPassword(
  submitted: string,
  storedHash: string | null | undefined,
  now: Date = new Date(),
): Promise<PasswordVerification> {
  if (typeof submitted !== 'string' || !submitted) return FAIL;
  if (!storedHash || storedHash.startsWith('google_')) return FAIL;

  if (isPasswordV2(storedHash)) {
    // Linha v2: só a senha em claro. Um sha256hex do front antigo não passa aqui.
    const ok = await bcrypt.compare(preHashV2(submitted), storedHash.slice(PASSWORD_V2_PREFIX.length));
    return { ok, needsRehash: false };
  }

  const submittedIsHex = isSha256Hex(submitted);
  const legacyWindow = submittedIsHex && isLegacyClientHashAccepted(now);

  if (isBcryptHash(storedHash)) {
    // bcrypt(sha256hex(senha)): o servidor calcula o sha256 da senha em claro.
    if (await bcrypt.compare(sha256Hex(submitted), storedHash)) return { ok: true, needsRehash: true };
    // bcrypt(senha) definido pelo admin. Um hex de 64 não entra aqui fora da
    // janela: senão o próprio sha256hex vazado seria aceito contra bcrypt(sha256hex).
    if (!submittedIsHex && (await bcrypt.compare(submitted, storedHash))) return { ok: true, needsRehash: true };
    // Janela: bundle antigo mandando sha256hex. Sem a senha em claro não há como migrar.
    if (legacyWindow && (await bcrypt.compare(submitted.toLowerCase(), storedHash))) {
      return { ok: true, needsRehash: false };
    }
    return FAIL;
  }

  if (isSha256Hex(storedHash)) {
    if (safeEqualHex(sha256Hex(submitted), storedHash)) return { ok: true, needsRehash: true };
    if (legacyWindow && safeEqualHex(submitted, storedHash)) return { ok: true, needsRehash: false };
    return FAIL;
  }

  return FAIL;
}
