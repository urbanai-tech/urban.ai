import {
  evaluateLinkState,
  hashTokenRandom,
  isOwnerTokenSecretConfigured,
  issueOwnerToken,
  linkExpiryFrom,
  resolveLinkTtlDays,
  signOwnerToken,
  verifyOwnerToken,
} from './owner-report-token';

describe('token do relatório do proprietário', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, OWNER_REPORT_TOKEN_SECRET: 'segredo-de-teste' };
    delete process.env.JWT_SECRET;
    delete process.env.OWNER_REPORT_LINK_TTL_DAYS;
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  describe('assinatura e adulteração', () => {
    it('emite e verifica; o token não contém ID nem dado pessoal', () => {
      const issued = issueOwnerToken('link')!;
      expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{22}$/);
      const verified = verifyOwnerToken('link', issued.token);
      expect(verified).toEqual({ random: issued.random, hash: issued.hash });
      // O banco guarda o hash, nunca o token.
      expect(issued.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(issued.token).not.toContain(issued.hash);
    });

    it('cada emissão gera um token diferente', () => {
      expect(issueOwnerToken('link')!.token).not.toBe(issueOwnerToken('link')!.token);
    });

    it('rejeita qualquer adulteração (aleatório, assinatura, truncado, extra)', () => {
      const { token } = issueOwnerToken('link')!;
      const [random, signature] = token.split('.');
      const flip = (value: string) => `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
      expect(verifyOwnerToken('link', `${flip(random)}.${signature}`)).toBeNull();
      expect(verifyOwnerToken('link', `${random}.${flip(signature)}`)).toBeNull();
      expect(verifyOwnerToken('link', token.slice(0, -1))).toBeNull();
      expect(verifyOwnerToken('link', `${token}x`)).toBeNull();
      expect(verifyOwnerToken('link', random)).toBeNull();
      expect(verifyOwnerToken('link', `${random}.`)).toBeNull();
      expect(verifyOwnerToken('link', '')).toBeNull();
      expect(verifyOwnerToken('link', undefined)).toBeNull();
      expect(verifyOwnerToken('link', { token })).toBeNull();
      expect(verifyOwnerToken('link', 'a'.repeat(500))).toBeNull();
    });

    it('token de um tipo não vale como outro (link x descadastro)', () => {
      const link = issueOwnerToken('link')!;
      const unsub = issueOwnerToken('unsub')!;
      expect(verifyOwnerToken('unsub', link.token)).toBeNull();
      expect(verifyOwnerToken('link', unsub.token)).toBeNull();
    });

    it('token assinado com outro segredo não vale', () => {
      const { token } = issueOwnerToken('link')!;
      process.env.OWNER_REPORT_TOKEN_SECRET = 'outro-segredo';
      expect(verifyOwnerToken('link', token)).toBeNull();
    });

    it('assina um aleatório existente (ref do descadastro) de forma estável', () => {
      const { random } = issueOwnerToken('unsub')!;
      const token = signOwnerToken('unsub', random)!;
      expect(signOwnerToken('unsub', random)).toBe(token);
      expect(verifyOwnerToken('unsub', token)?.random).toBe(random);
      expect(signOwnerToken('unsub', 'curto')).toBeNull();
    });

    it('sem segredo nada é emitido nem aceito (degrada sem quebrar)', () => {
      const { token } = issueOwnerToken('link')!;
      delete process.env.OWNER_REPORT_TOKEN_SECRET;
      expect(isOwnerTokenSecretConfigured()).toBe(false);
      expect(issueOwnerToken('link')).toBeNull();
      expect(signOwnerToken('unsub', 'a'.repeat(22))).toBeNull();
      expect(verifyOwnerToken('link', token)).toBeNull();
    });

    it('usa o JWT_SECRET (com prefixo próprio) quando não há segredo dedicado', () => {
      delete process.env.OWNER_REPORT_TOKEN_SECRET;
      process.env.JWT_SECRET = 'jwt-de-teste';
      const { token } = issueOwnerToken('link')!;
      expect(verifyOwnerToken('link', token)).not.toBeNull();
      process.env.OWNER_REPORT_TOKEN_SECRET = 'jwt-de-teste';
      expect(verifyOwnerToken('link', token)).toBeNull();
    });

    it('hash é SHA-256 determinístico do aleatório', () => {
      expect(hashTokenRandom('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
  });

  describe('expiração e revogação', () => {
    const now = new Date('2026-11-01T12:00:00Z');

    it('válido antes de expirar, expirado no instante e depois', () => {
      expect(evaluateLinkState({ expiresAt: new Date('2026-11-01T12:00:01Z') }, now)).toBe('valid');
      expect(evaluateLinkState({ expiresAt: new Date('2026-11-01T12:00:00Z') }, now)).toBe('expired');
      expect(evaluateLinkState({ expiresAt: new Date('2026-10-01T00:00:00Z') }, now)).toBe('expired');
    });

    it('revogado nunca volta a valer, mesmo dentro do prazo', () => {
      const link = { expiresAt: new Date('2026-12-01T00:00:00Z'), revokedAt: new Date('2026-11-01T11:00:00Z') };
      expect(evaluateLinkState(link, now)).toBe('revoked');
      // Revogação vence a expiração.
      expect(evaluateLinkState({ ...link, expiresAt: new Date('2026-10-01T00:00:00Z') }, now)).toBe('revoked');
    });

    it('data inválida é tratada como expirada (fail-closed)', () => {
      expect(evaluateLinkState({ expiresAt: 'lixo' }, now)).toBe('expired');
    });

    it('TTL: padrão 30 dias, configurável por env e por pedido, limitado a 1..90', () => {
      expect(resolveLinkTtlDays()).toBe(30);
      process.env.OWNER_REPORT_LINK_TTL_DAYS = '45';
      expect(resolveLinkTtlDays()).toBe(45);
      expect(resolveLinkTtlDays(7)).toBe(7);
      expect(resolveLinkTtlDays(500)).toBe(90);
      expect(resolveLinkTtlDays(0)).toBe(45);
      process.env.OWNER_REPORT_LINK_TTL_DAYS = 'abc';
      expect(resolveLinkTtlDays(null)).toBe(30);
      expect(linkExpiryFrom(now, 30).toISOString()).toBe('2026-12-01T12:00:00.000Z');
    });
  });
});
