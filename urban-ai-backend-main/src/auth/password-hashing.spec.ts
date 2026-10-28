import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  BCRYPT_MAX_PASSWORD_BYTES,
  LEGACY_CLIENT_HASH_DEFAULT_UNTIL,
  PASSWORD_V2_PREFIX,
  hashPasswordForStorage,
  hashPasswordV2,
  isLegacyClientHashAccepted,
  isSlowPasswordHash,
  verifyPassword,
} from './password-hashing';

// Espelho CommonJS usado pelos scripts de staging (node puro).
const scriptHelper = require('../../scripts/password-hash-v2.js');

const sha256 = (value: string) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

describe('password-hashing (esquema v2 + compatibilidade legada)', () => {
  const oldEnv = process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL;
  const OPEN = '2999-01-01T00:00:00Z';
  afterEach(() => {
    if (oldEnv === undefined) delete process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL;
    else process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL = oldEnv;
  });

  describe('isLegacyClientHashAccepted', () => {
    it('uses the default sunset date when the env is unset', () => {
      const until = Date.parse(LEGACY_CLIENT_HASH_DEFAULT_UNTIL);
      expect(isLegacyClientHashAccepted(new Date(until - 1), {})).toBe(true);
      expect(isLegacyClientHashAccepted(new Date(until), {})).toBe(false);
    });

    it('honours an ISO override, "off", and fails closed on garbage', () => {
      const now = new Date('2026-11-01T00:00:00Z');
      expect(isLegacyClientHashAccepted(now, { AUTH_LEGACY_CLIENT_HASH_UNTIL: '2026-12-01' })).toBe(true);
      expect(isLegacyClientHashAccepted(now, { AUTH_LEGACY_CLIENT_HASH_UNTIL: '2026-10-01' })).toBe(false);
      expect(isLegacyClientHashAccepted(now, { AUTH_LEGACY_CLIENT_HASH_UNTIL: 'off' })).toBe(false);
      expect(isLegacyClientHashAccepted(now, { AUTH_LEGACY_CLIENT_HASH_UNTIL: 'not-a-date' })).toBe(false);
    });
  });

  describe('v2', () => {
    it('stores prefix + bcrypt, never the password or its sha256', async () => {
      const stored = await hashPasswordV2('Senha123!', 4);
      expect(stored.startsWith(`${PASSWORD_V2_PREFIX}$2b$04$`)).toBe(true);
      expect(stored).not.toContain('Senha123!');
      expect(stored).not.toContain(sha256('Senha123!'));
      expect(isSlowPasswordHash(stored)).toBe(true);
    });

    it('accepts only the plain password (never the legacy digest, even within the window)', async () => {
      process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL = OPEN;
      const stored = await hashPasswordV2('Senha123!', 4);
      await expect(verifyPassword('Senha123!', stored)).resolves.toEqual({ ok: true, needsRehash: false });
      await expect(verifyPassword('Senha123?', stored)).resolves.toEqual({ ok: false, needsRehash: false });
      await expect(verifyPassword(sha256('Senha123!'), stored)).resolves.toEqual({ ok: false, needsRehash: false });
    });

    it('is bcrypt of the plain password itself (no pre-hash)', async () => {
      const stored = await hashPasswordV2('Senha123!', 4);
      expect(await bcrypt.compare('Senha123!', stored.slice(PASSWORD_V2_PREFIX.length))).toBe(true);
    });

    it('accepts exactly 72 bytes and refuses to store more (counted in UTF-8 bytes, not characters)', async () => {
      const exactly72 = 'á'.repeat(36); // 36 caracteres, 72 bytes
      const stored = await hashPasswordV2(exactly72, 4);
      await expect(verifyPassword(exactly72, stored)).resolves.toMatchObject({ ok: true });

      expect(BCRYPT_MAX_PASSWORD_BYTES).toBe(72);
      await expect(hashPasswordV2(`${exactly72}a`, 4)).rejects.toBeInstanceOf(RangeError); // 73 bytes, 37 chars
      await expect(hashPasswordForStorage('a'.repeat(73))).rejects.toBeInstanceOf(RangeError);
    });

    it('never accepts a > 72-byte submission against a v2 row (no acceptance by truncation)', async () => {
      const base = 'a'.repeat(72);
      const stored = await hashPasswordV2(base, 4);
      // bcrypt puro aceitaria isto (ignora o que passa de 72 bytes); o v2 recusa.
      expect(await bcrypt.compare(`${base}EXTRA`, stored.slice(PASSWORD_V2_PREFIX.length))).toBe(true);
      await expect(verifyPassword(`${base}EXTRA`, stored)).resolves.toEqual({ ok: false, needsRehash: false });
    });
  });

  describe('linhas legadas', () => {
    it('bcrypt(sha256hex): plain password verifies server-side and asks for rehash', async () => {
      const stored = await bcrypt.hash(sha256('Senha123!'), 4);
      await expect(verifyPassword('Senha123!', stored)).resolves.toEqual({ ok: true, needsRehash: true });
      await expect(verifyPassword('errada', stored)).resolves.toEqual({ ok: false, needsRehash: false });
    });

    it('matches the old browser helper encoding (UTF-8 bytes, lowercase hex)', async () => {
      // Valor do teste do front (account-privacy.test.mjs) para "abc".
      expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      const stored = await bcrypt.hash(sha256('Sênha#çã😀'), 4);
      await expect(verifyPassword('Sênha#çã😀', stored)).resolves.toMatchObject({ ok: true, needsRehash: true });
    });

    it('a legacy password over 72 bytes still logs in but keeps the legacy row (no rehash)', async () => {
      const long = 'senha-longa-'.repeat(8); // 96 bytes
      await expect(verifyPassword(long, await bcrypt.hash(sha256(long), 4))).resolves.toEqual({ ok: true, needsRehash: false });
      await expect(verifyPassword(long, sha256(long))).resolves.toEqual({ ok: true, needsRehash: false });
    });

    it('bcrypt(plain) set by an admin: plain password verifies and asks for rehash', async () => {
      const stored = await bcrypt.hash('Senha123!', 4);
      await expect(verifyPassword('Senha123!', stored)).resolves.toEqual({ ok: true, needsRehash: true });
    });

    it('raw sha256 hex row: plain password verifies and asks for rehash', async () => {
      await expect(verifyPassword('Senha123!', sha256('Senha123!'))).resolves.toEqual({ ok: true, needsRehash: true });
      await expect(verifyPassword('errada', sha256('Senha123!'))).resolves.toEqual({ ok: false, needsRehash: false });
    });

    it('within the window accepts the old client digest for legacy rows, without rehash', async () => {
      process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL = OPEN;
      const digest = sha256('Senha123!');
      await expect(verifyPassword(digest, await bcrypt.hash(digest, 4))).resolves.toEqual({ ok: true, needsRehash: false });
      await expect(verifyPassword(digest.toUpperCase(), await bcrypt.hash(digest, 4))).resolves.toMatchObject({ ok: true });
      await expect(verifyPassword(digest, digest)).resolves.toEqual({ ok: true, needsRehash: false });
      await expect(verifyPassword(sha256('errada'), await bcrypt.hash(digest, 4))).resolves.toMatchObject({ ok: false });
    });

    it('after the window rejects the old client digest (pass-the-hash closed)', async () => {
      process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL = 'off';
      const digest = sha256('Senha123!');
      await expect(verifyPassword(digest, await bcrypt.hash(digest, 4))).resolves.toMatchObject({ ok: false });
      await expect(verifyPassword(digest, digest)).resolves.toMatchObject({ ok: false });
      // A senha em claro segue funcionando.
      await expect(verifyPassword('Senha123!', await bcrypt.hash(digest, 4))).resolves.toMatchObject({ ok: true });
    });

    it('rejects google_* rows, empty input and unknown formats', async () => {
      await expect(verifyPassword('x', 'google_123')).resolves.toMatchObject({ ok: false });
      await expect(verifyPassword('', await hashPasswordV2('x', 4))).resolves.toMatchObject({ ok: false });
      await expect(verifyPassword('x', 'plaintext-in-db')).resolves.toMatchObject({ ok: false });
      await expect(verifyPassword('x', null)).resolves.toMatchObject({ ok: false });
    });
  });

  describe('hashPasswordForStorage', () => {
    it('stores a plain password as v2', async () => {
      const stored = await hashPasswordForStorage('Senha123!');
      expect(stored.startsWith(PASSWORD_V2_PREFIX)).toBe(true);
    });

    it('within the window stores an old-client digest in the legacy format (upgradable on next plain login)', async () => {
      process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL = OPEN;
      const stored = await hashPasswordForStorage(sha256('Senha123!'));
      expect(stored).toMatch(/^\$2[aby]\$12\$/);
      await expect(verifyPassword('Senha123!', stored)).resolves.toEqual({ ok: true, needsRehash: true });
    });

    it('after the window a 64-hex value is just a password (v2)', async () => {
      process.env.AUTH_LEGACY_CLIENT_HASH_UNTIL = 'off';
      const value = sha256('qualquer');
      const stored = await hashPasswordForStorage(value);
      expect(stored.startsWith(PASSWORD_V2_PREFIX)).toBe(true);
      await expect(verifyPassword(value, stored)).resolves.toMatchObject({ ok: true });
    });
  });

  describe('paridade com scripts/password-hash-v2.js (staging)', () => {
    it('produces hashes the server accepts, and recognises server hashes as current', async () => {
      const fromScript = await scriptHelper.hashPasswordV2('Fixture#Senha2026', 4);
      expect(scriptHelper.PASSWORD_V2_PREFIX).toBe(PASSWORD_V2_PREFIX);
      await expect(verifyPassword('Fixture#Senha2026', fromScript)).resolves.toEqual({ ok: true, needsRehash: false });

      const fromServer = await hashPasswordV2('Fixture#Senha2026', 4);
      await expect(scriptHelper.isCurrentPasswordHash('Fixture#Senha2026', fromServer)).resolves.toBe(true);
      await expect(scriptHelper.isCurrentPasswordHash('outra', fromServer)).resolves.toBe(false);
      // Mesmo limite de 72 bytes nos dois lados.
      expect(scriptHelper.BCRYPT_MAX_PASSWORD_BYTES).toBe(BCRYPT_MAX_PASSWORD_BYTES);
      await expect(scriptHelper.hashPasswordV2('a'.repeat(73), 4)).rejects.toBeInstanceOf(RangeError);
      const at72 = await hashPasswordV2('b'.repeat(72), 4);
      await expect(scriptHelper.isCurrentPasswordHash(`${'b'.repeat(72)}X`, at72)).resolves.toBe(false);
      // Linha legada não conta como atual: o script regrava em v2.
      await expect(
        scriptHelper.isCurrentPasswordHash('Fixture#Senha2026', await bcrypt.hash(sha256('Fixture#Senha2026'), 4)),
      ).resolves.toBe(false);
    });
  });
});
