/**
 * Trava de configuração perigosa em produção/staging (falha no boot).
 *
 * Só recusa valores ATIVAMENTE perigosos; variável ausente continua seguindo o
 * comportamento atual de cada módulo (a maioria já falha fechado). Em
 * development/test/local não recusa nada, para não atrapalhar dev e testes.
 *
 * Por padrão NÃO derruba o boot: os erros viram avisos altos. Com CONFIG_GUARD_STRICT=true
 * (fail-closed) os erros lançam no boot.
 *
 * Considera perigoso quando APP_ENV (ou, na falta, NODE_ENV) é production/staging e:
 *  - DB_SYNCHRONIZE=true (o TypeORM altera/apaga colunas sozinho; schema é só via migration);
 *  - JWT_SECRET é placeholder conhecido ou tem menos de 16 caracteres (HS256 força-bruta).
 * Avisa (sem recusar), para não derrubar um deploy legítimo:
 *  - STRIPE_SECRET_KEY de teste (sk_test_) em production;
 *  - STRIPE_SECRET_KEY presente sem STRIPE_WEBHOOK_SECRET.
 */

const PROTECTED_ENVS = ['production', 'prod', 'staging', 'stage'];
const WEAK_JWT_SECRETS = [
  'secret',
  'changeme',
  'change-me',
  'change_me',
  'jwt_secret',
  'jwtsecret',
  'your-secret',
  'your_secret',
  'supersecret',
  'password',
  'test',
  'dev',
];
export const MIN_JWT_SECRET_LENGTH = 16;

export interface ProductionConfigReport {
  protectedRuntime: boolean;
  errors: string[];
  warnings: string[];
}

function norm(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function evaluateProductionConfig(env: NodeJS.ProcessEnv): ProductionConfigReport {
  const runtime = norm(env.APP_ENV) || norm(env.NODE_ENV) || 'development';
  const protectedRuntime = PROTECTED_ENVS.includes(runtime);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!protectedRuntime) return { protectedRuntime, errors, warnings };

  if (norm(env.DB_SYNCHRONIZE) === 'true') {
    errors.push('DB_SYNCHRONIZE=true é proibido em production/staging: use migrations (MIGRATIONS_RUN=true).');
  }

  const jwtSecret = (env.JWT_SECRET ?? '').trim();
  if (jwtSecret && (jwtSecret.length < MIN_JWT_SECRET_LENGTH || WEAK_JWT_SECRETS.includes(jwtSecret.toLowerCase()))) {
    errors.push(
      `JWT_SECRET fraco: use um segredo aleatório com pelo menos ${MIN_JWT_SECRET_LENGTH} caracteres (ideal 32+).`,
    );
  }

  const stripeKey = (env.STRIPE_SECRET_KEY ?? '').trim();
  if (stripeKey) {
    if (runtime === 'production' && stripeKey.startsWith('sk_test_')) {
      warnings.push('STRIPE_SECRET_KEY é uma chave de TESTE (sk_test_) em production: nenhuma cobrança real será feita.');
    }
    if (!(env.STRIPE_WEBHOOK_SECRET ?? '').trim()) {
      warnings.push('STRIPE_WEBHOOK_SECRET ausente: o webhook do Stripe será recusado e assinaturas não sincronizam.');
    }
  }

  return { protectedRuntime, errors, warnings };
}

/** Avisa alto sobre configuração perigosa; lança no boot só com CONFIG_GUARD_STRICT=true. */
export function assertSafeProductionConfig(env: NodeJS.ProcessEnv = process.env): ProductionConfigReport {
  const report = evaluateProductionConfig(env);
  for (const warning of report.warnings) {
    console.warn(`[config] ${warning}`);
  }
  if (report.errors.length > 0) {
    if (norm(env.CONFIG_GUARD_STRICT) !== 'true') {
      for (const error of report.errors) {
        console.warn(`[config] ATENÇÃO (defina CONFIG_GUARD_STRICT=true para falhar o boot): ${error}`);
      }
      return report;
    }
    throw new Error(`Configuração insegura para ${env.APP_ENV || env.NODE_ENV}:\n- ${report.errors.join('\n- ')}`);
  }
  return report;
}
