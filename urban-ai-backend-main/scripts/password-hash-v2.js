/**
 * Espelho CommonJS do esquema de senha v2 de src/auth/password-hashing.ts, para os
 * scripts de staging que rodam com `node` puro (sem dist/ nem ts-node).
 * A paridade com a implementação TS é coberta por src/auth/password-hashing.spec.ts.
 *
 * v2 = `pw:v2:` + bcrypt(12) da senha em texto puro, que precisa caber em 72 bytes
 * UTF-8 (o bcrypt ignoraria o excedente). Os scripts sempre têm a senha em claro:
 * aqui não existe janela para o sha256 hex do front antigo.
 */
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;
const PASSWORD_V2_PREFIX = 'pw:v2:';

function fitsBcrypt(password) {
  return Buffer.byteLength(String(password), 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;
}

async function hashPasswordV2(password, rounds = BCRYPT_ROUNDS) {
  if (!fitsBcrypt(password)) {
    throw new RangeError(`Senha acima de ${BCRYPT_MAX_PASSWORD_BYTES} bytes não pode ser gravada.`);
  }
  return PASSWORD_V2_PREFIX + (await bcrypt.hash(String(password), rounds));
}

/**
 * O hash gravado já é v2 E confere com a senha em claro? Linhas legadas devolvem
 * false de propósito: o script as regrava em v2 (idempotente a partir daí).
 */
async function isCurrentPasswordHash(password, storedHash) {
  const stored = String(storedHash || '');
  if (!password || !fitsBcrypt(password) || !stored.startsWith(PASSWORD_V2_PREFIX)) return false;
  return bcrypt.compare(String(password), stored.slice(PASSWORD_V2_PREFIX.length));
}

module.exports = {
  BCRYPT_ROUNDS,
  BCRYPT_MAX_PASSWORD_BYTES,
  PASSWORD_V2_PREFIX,
  fitsBcrypt,
  hashPasswordV2,
  isCurrentPasswordHash,
};
