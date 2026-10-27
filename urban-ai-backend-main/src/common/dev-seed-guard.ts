/**
 * Trava do seed de desenvolvimento (`npm run seed:dev`).
 *
 * O seed cria usuarios com senha CONHECIDA, entao so pode rodar em ambiente
 * local. A decisao e pura (recebe o `process.env`), para ser testada sem banco
 * e para o script nao precisar de logica propria.
 *
 * Recusa quando QUALQUER uma destas condicoes e verdadeira:
 *  - APP_ENV (ou, na falta, NODE_ENV) nao e development/dev/local;
 *  - NODE_ENV ou APP_ENV declaram production/staging;
 *  - ha marcador de hospedagem (Railway, Vercel, Fly, Render, Heroku, Kubernetes);
 *  - o host do banco (DATABASE_URL ou DB_HOST) nao e localhost/127.0.0.1/::1,
 *    o servico `mysql` do Compose ou `host.docker.internal`.
 */

export const DEV_SEED_ALLOWED_ENVS = ['development', 'dev', 'local'];
export const DEV_SEED_ALLOWED_DB_HOSTS = ['localhost', '127.0.0.1', '::1', 'mysql', 'host.docker.internal'];
const FORBIDDEN_ENVS = ['production', 'prod', 'staging', 'stage'];
const HOSTING_MARKERS = [
  'RAILWAY_ENVIRONMENT',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID',
  'VERCEL',
  'FLY_APP_NAME',
  'RENDER',
  'DYNO',
  'KUBERNETES_SERVICE_HOST',
];

export interface DevSeedGuardResult {
  allowed: boolean;
  /** Motivos da recusa (vazio quando permitido). */
  reasons: string[];
  appEnv: string;
  dbHost: string;
}

function norm(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function resolveDbHost(env: Record<string, string | undefined>): string {
  const url = (env.DATABASE_URL ?? '').trim();
  if (url) {
    try {
      return new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    } catch {
      return '(DATABASE_URL invalida)';
    }
  }
  // Mesmo padrao do data-source.ts: sem DB_HOST, o runtime local usa localhost.
  return norm(env.DB_HOST) || 'localhost';
}

export function evaluateDevSeedGuard(env: Record<string, string | undefined>): DevSeedGuardResult {
  const reasons: string[] = [];
  const appEnvRaw = norm(env.APP_ENV);
  const nodeEnv = norm(env.NODE_ENV);
  const appEnv = appEnvRaw || nodeEnv;

  if (!DEV_SEED_ALLOWED_ENVS.includes(appEnv)) {
    reasons.push(
      `APP_ENV/NODE_ENV = "${appEnv || '(vazio)'}"; o seed so roda com ${DEV_SEED_ALLOWED_ENVS.join(' | ')}`,
    );
  }
  for (const [name, value] of [['APP_ENV', appEnvRaw], ['NODE_ENV', nodeEnv]] as const) {
    if (FORBIDDEN_ENVS.includes(value)) reasons.push(`${name} = "${value}" (ambiente nao local)`);
  }
  for (const marker of HOSTING_MARKERS) {
    if ((env[marker] ?? '').trim()) reasons.push(`variavel de hospedagem ${marker} presente`);
  }

  const dbHost = resolveDbHost(env);
  if (!DEV_SEED_ALLOWED_DB_HOSTS.includes(dbHost)) {
    reasons.push(
      `host do banco "${dbHost}" nao e local (permitidos: ${DEV_SEED_ALLOWED_DB_HOSTS.join(', ')})`,
    );
  }

  return { allowed: reasons.length === 0, reasons, appEnv, dbHost };
}
