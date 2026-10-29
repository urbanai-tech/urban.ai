import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Esquema de senha (ADR 0025).
 *
 * O cliente envia a senha em texto puro (sob TLS) e TODO hash acontece aqui.
 *
 * Formatos que podem estar em `user.password`:
 *  - v2 (atual):  `pw:v2:` + bcrypt(12) da senha em texto puro.
 *    O bcrypt só usa os primeiros 72 bytes: senhas acima disso são RECUSADAS ao
 *    definir (DTOs com @MaxUtf8Bytes e defesa aqui) e nunca conferem contra v2,
 *    para não haver aceitação por truncamento.
 *  - legado bcrypt: bcrypt de sha256hex(senha) — o que o front antigo mandava —
 *    ou, em contas definidas pelo admin, bcrypt da senha em texto puro.
 *  - legado sha256: sha256hex(senha) puro (contas muito antigas).
 *  - `google_*`: conta só Google, nunca autentica por senha.
 *
 * Login de conta legada com a senha em texto puro: o servidor calcula o sha256,
 * valida e regrava em v2 (migração transparente, sem reset forçado). Se essa
 * senha passar de 72 bytes, a linha fica legada (não dá para gravá-la em v2).
 *
 * Janela de compatibilidade: um bundle antigo em cache ainda manda sha256hex(senha).
 * Até LEGACY_CLIENT_HASH_DEFAULT_UNTIL (ou AUTH_LEGACY_CLIENT_HASH_UNTIL), um
 * hex de 64 caracteres é aceito como credencial SÓ para linhas legadas (é o
 * pass-the-hash que já existia; linhas v2 nunca aceitam). Depois da data, o hex
 * passa a ser tratado como uma senha qualquer e o pass-the-hash acaba para todos.
 */

export const BCRYPT_ROUNDS = 12;
export const PASSWORD_V2_PREFIX = 'pw:v2:';
/** Limite do bcrypt: bytes além disso seriam ignorados em silêncio. */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;
export const PASSWORD_TOO_LONG_MESSAGE =
  'A senha pode ter no máximo 72 bytes (cerca de 72 letras sem acento; acentos e emojis ocupam mais). Use uma senha um pouco menor.';
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

export function passwordByteLength(password: string): number {
  return Buffer.byteLength(password, 'utf8');
}

/** A senha cabe inteira no bcrypt (≤ 72 bytes UTF-8)? */
export function fitsBcrypt(password: string): boolean {
  return passwordByteLength(password) <= BCRYPT_MAX_PASSWORD_BYTES;
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

/**
 * SÓ PARA LINHAS LEGADAS — não é hash de armazenamento.
 *
 * Reproduz o que o front antigo fazia no navegador (SHA-256 dos bytes UTF-8, hex
 * minúsculo) para conferir senhas gravadas como bcrypt(sha256hex(senha)) ou
 * sha256hex(senha). É inerente à migração dessas linhas: sem isto, todo usuário
 * antigo precisaria redefinir a senha. O resultado nunca é gravado; quem confere
 * com sucesso é regravado em v2 (bcrypt da senha). Alerta CodeQL
 * js/insufficient-password-hash aqui é esperado (ADR 0025).
 */
function legacyClientDigest(password: string): string {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), 'utf8');
  const right = Buffer.from(b.toLowerCase(), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Hash v2 de uma senha em texto puro. Recusa > 72 bytes (o bcrypt truncaria). */
export async function hashPasswordV2(password: string, rounds: number = BCRYPT_ROUNDS): Promise<string> {
  if (!fitsBcrypt(password)) {
    throw new RangeError(`Senha acima de ${BCRYPT_MAX_PASSWORD_BYTES} bytes não pode ser gravada.`);
  }
  return PASSWORD_V2_PREFIX + (await bcrypt.hash(password, rounds));
}

/**
 * Hash para gravar uma senha nova (cadastro, convite, reset, admin).
 * Durante a janela, um hex de 64 caracteres vem do bundle antigo (é o sha256 da
 * senha): grava no formato legado bcrypt(hex), para que o login seguinte com a
 * senha em claro funcione e migre a linha para v2. Fora da janela, é senha comum.
 * Lança RangeError para senha > 72 bytes (defesa em profundidade: os DTOs já recusam).
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
    // > 72 bytes nunca confere: o bcrypt ignoraria o excedente (aceitação por truncamento).
    if (!fitsBcrypt(submitted)) return FAIL;
    const ok = await bcrypt.compare(submitted, storedHash.slice(PASSWORD_V2_PREFIX.length));
    return { ok, needsRehash: false };
  }

  const submittedIsHex = isSha256Hex(submitted);
  const legacyWindow = submittedIsHex && isLegacyClientHashAccepted(now);
  // Senha legada > 72 bytes confere, mas não cabe em v2: a linha fica legada.
  const upgradable = fitsBcrypt(submitted);

  if (isBcryptHash(storedHash)) {
    // bcrypt(sha256hex(senha)): o servidor calcula o sha256 da senha em claro.
    if (await bcrypt.compare(legacyClientDigest(submitted), storedHash)) return { ok: true, needsRehash: upgradable };
    // bcrypt(senha) definido pelo admin. Um hex de 64 não entra aqui fora da
    // janela: senão o próprio sha256hex vazado seria aceito contra bcrypt(sha256hex).
    if (!submittedIsHex && (await bcrypt.compare(submitted, storedHash))) return { ok: true, needsRehash: upgradable };
    // Janela: bundle antigo mandando sha256hex. Sem a senha em claro não há como migrar.
    if (legacyWindow && (await bcrypt.compare(submitted.toLowerCase(), storedHash))) {
      return { ok: true, needsRehash: false };
    }
    return FAIL;
  }

  if (isSha256Hex(storedHash)) {
    if (safeEqualHex(legacyClientDigest(submitted), storedHash)) return { ok: true, needsRehash: upgradable };
    if (legacyWindow && safeEqualHex(submitted, storedHash)) return { ok: true, needsRehash: false };
    return FAIL;
  }

  return FAIL;
}
