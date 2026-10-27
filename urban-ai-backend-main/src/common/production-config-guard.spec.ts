import { assertSafeProductionConfig, evaluateProductionConfig } from './production-config-guard';

describe('production-config-guard', () => {
  const strong = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
  const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

  it('não recusa nada em development/test/local', () => {
    for (const name of ['development', 'test', 'local']) {
      const report = evaluateProductionConfig(env({ APP_ENV: name, DB_SYNCHRONIZE: 'true', JWT_SECRET: 'x' }));
      expect(report.protectedRuntime).toBe(false);
      expect(report.errors).toEqual([]);
    }
  });

  it('usa NODE_ENV quando APP_ENV não existe e APP_ENV tem precedência', () => {
    expect(evaluateProductionConfig(env({ NODE_ENV: 'production', DB_SYNCHRONIZE: 'true' })).errors).toHaveLength(1);
    expect(
      evaluateProductionConfig(env({ NODE_ENV: 'production', APP_ENV: 'development', DB_SYNCHRONIZE: 'true' })).errors,
    ).toEqual([]);
  });

  describe('padrão (sem CONFIG_GUARD_STRICT): só avisa alto', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    it('DB_SYNCHRONIZE=true em production e staging não derruba o boot', () => {
      for (const name of ['production', 'staging']) {
        const report = assertSafeProductionConfig(env({ APP_ENV: name, DB_SYNCHRONIZE: 'true', JWT_SECRET: strong }));
        expect(report.errors).toHaveLength(1);
      }
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('DB_SYNCHRONIZE'));
    });

    it('JWT_SECRET fraco avisa; segredo forte não gera nada', () => {
      expect(() => assertSafeProductionConfig(env({ APP_ENV: 'production', JWT_SECRET: 'short' }))).not.toThrow();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
      warn.mockClear();
      assertSafeProductionConfig(env({ APP_ENV: 'production', JWT_SECRET: strong }));
      expect(warn).not.toHaveBeenCalled();
    });

    it('CONFIG_GUARD_STRICT diferente de true não ativa o modo estrito', () => {
      expect(() =>
        assertSafeProductionConfig(env({ APP_ENV: 'production', DB_SYNCHRONIZE: 'true', CONFIG_GUARD_STRICT: 'false' })),
      ).not.toThrow();
    });
  });

  describe('CONFIG_GUARD_STRICT=true: fail-closed', () => {
    it('recusa DB_SYNCHRONIZE=true em production e staging', () => {
      for (const name of ['production', 'staging']) {
        expect(() =>
          assertSafeProductionConfig(
            env({ APP_ENV: name, DB_SYNCHRONIZE: 'true', JWT_SECRET: strong, CONFIG_GUARD_STRICT: 'true' }),
          ),
        ).toThrow(/DB_SYNCHRONIZE/);
      }
    });

    it('recusa JWT_SECRET curto ou placeholder, mas aceita segredo forte', () => {
      const strict = { APP_ENV: 'production', CONFIG_GUARD_STRICT: 'true' };
      expect(() => assertSafeProductionConfig(env({ ...strict, JWT_SECRET: 'short' }))).toThrow(/JWT_SECRET/);
      expect(() => assertSafeProductionConfig(env({ ...strict, JWT_SECRET: 'ChangeMe' }))).toThrow(/JWT_SECRET/);
      expect(() => assertSafeProductionConfig(env({ ...strict, JWT_SECRET: strong }))).not.toThrow();
    });
  });

  it('não recusa o que está ausente (cada módulo já falha fechado) nem DB_SYNCHRONIZE=false', () => {
    expect(() => assertSafeProductionConfig(env({ APP_ENV: 'production', DB_SYNCHRONIZE: 'false' }))).not.toThrow();
  });

  it('só avisa para Stripe de teste em production e webhook ausente', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const report = assertSafeProductionConfig(
      env({ APP_ENV: 'production', JWT_SECRET: strong, STRIPE_SECRET_KEY: 'sk_test_abc' }),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(
      evaluateProductionConfig(
        env({ APP_ENV: 'staging', STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec_x' }),
      ).warnings,
    ).toEqual([]);
    warn.mockRestore();
  });
});
