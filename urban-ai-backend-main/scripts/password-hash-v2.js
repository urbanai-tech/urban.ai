/**
 * Espelho CommonJS do esquema de senha v2 de src/auth/password-hashing.ts, para os
 * scripts de staging que rodam com `node` puro (sem dist/ nem ts-node).
 * A paridade com a implementação TS é coberta por src/auth/password-hashing.spec.ts.
 *
 * Os scripts sempre têm a senha em texto puro: aqui não existe janela para o
 * sha256 hex do front antigo.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 12;
const PASSWORD_V2_PREFIX = 'pw:v2:';
const PASSWORD_V2_DOMAIN = 'urban-ai/password/v2';

function preHashV2(password) {
  return crypto.createHmac('sha256', PASSWORD_V2_DOMAIN).update(String(password), 'utf8').digest('base64');
}

async function hashPasswordV2(password, rounds = BCRYPT_ROUNDS) {
  return PASSWORD_V2_PREFIX + (await bcrypt.hash(preHashV2(password), rounds));
}

/**
 * O hash gravado já é v2 E confere com a senha em claro? Linhas legadas devolvem
 * false de propósito: o script as regrava em v2 (idempotente a partir daí).
 */
async function isCurrentPasswordHash(password, storedHash) {
  const stored = String(storedHash || '');
  if (!password || !stored.startsWith(PASSWORD_V2_PREFIX)) return false;
  return bcrypt.compare(preHashV2(password), stored.slice(PASSWORD_V2_PREFIX.length));
}

module.exports = { BCRYPT_ROUNDS, PASSWORD_V2_PREFIX, hashPasswordV2, isCurrentPasswordHash };
