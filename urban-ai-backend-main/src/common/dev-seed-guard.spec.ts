import { evaluateDevSeedGuard, resolveDbHost } from './dev-seed-guard';

describe('evaluateDevSeedGuard', () => {
  const compose = { APP_ENV: 'development', NODE_ENV: 'development', DB_HOST: 'mysql' };

  it('permite o ambiente do Compose (servico mysql)', () => {
    expect(evaluateDevSeedGuard(compose)).toMatchObject({ allowed: true, reasons: [], dbHost: 'mysql' });
  });

  it('permite desenvolvimento no host com localhost, inclusive sem DB_HOST', () => {
    expect(evaluateDevSeedGuard({ APP_ENV: 'local', DB_HOST: '127.0.0.1' }).allowed).toBe(true);
    expect(evaluateDevSeedGuard({ NODE_ENV: 'dev' }).allowed).toBe(true);
  });

  it('recusa producao e staging, mesmo com banco local', () => {
    expect(evaluateDevSeedGuard({ ...compose, APP_ENV: 'production' }).allowed).toBe(false);
    expect(evaluateDevSeedGuard({ ...compose, APP_ENV: 'staging' }).allowed).toBe(false);
    expect(evaluateDevSeedGuard({ ...compose, NODE_ENV: 'production' }).allowed).toBe(false);
  });

  it('recusa quando o ambiente nao esta definido', () => {
    expect(evaluateDevSeedGuard({ DB_HOST: 'localhost' }).allowed).toBe(false);
  });

  it('recusa banco remoto, por DB_HOST e por DATABASE_URL', () => {
    expect(evaluateDevSeedGuard({ ...compose, DB_HOST: 'db.exemplo.internal' }).allowed).toBe(false);
    expect(
      evaluateDevSeedGuard({ APP_ENV: 'development', DATABASE_URL: 'mysql://u:p@maglev.proxy.rlwy.net:3306/railway' })
        .allowed,
    ).toBe(false);
    expect(
      evaluateDevSeedGuard({ APP_ENV: 'development', DATABASE_URL: 'mysql://u:p@localhost:3306/ai_urban' }).allowed,
    ).toBe(true);
  });

  it('recusa quando ha marcador de hospedagem, mesmo com APP_ENV=development', () => {
    const result = evaluateDevSeedGuard({ ...compose, RAILWAY_ENVIRONMENT: 'production' });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('RAILWAY_ENVIRONMENT');
  });

  it('resolveDbHost segue o padrao do data-source (localhost sem DB_HOST) e trata IPv6', () => {
    expect(resolveDbHost({})).toBe('localhost');
    expect(resolveDbHost({ DATABASE_URL: 'mysql://u:p@[::1]:3306/x' })).toBe('::1');
    expect(resolveDbHost({ DATABASE_URL: 'nao-e-url' })).toContain('invalida');
  });
});
