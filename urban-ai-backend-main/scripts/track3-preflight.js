#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const envFileArg = process.argv.find((arg) => arg.startsWith('--env='));
const env = { ...process.env };

if (envFileArg) {
  Object.assign(env, readEnvFile(envFileArg.slice('--env='.length)));
} else {
  const defaultEnv = path.join(process.cwd(), '.env');
  if (fs.existsSync(defaultEnv)) Object.assign(env, readEnvFile(defaultEnv));
}

const groups = [
  stripeReadiness(env),
  emailReadiness(env),
  staysReadiness(env),
  supportReadiness(env),
  adminOpsReadiness(env),
  dataRoiReadiness(env),
];

const blockers = groups.flatMap((group) =>
  group.blockers.map((message) => `${group.label}: ${message}`),
);
const warnings = groups.flatMap((group) =>
  group.warnings.map((message) => `${group.label}: ${message}`),
);

console.log('Urban AI Track 3 preflight');
console.log(`Generated at: ${new Date().toISOString()}`);
console.log('');

for (const group of groups) {
  const status = group.blockers.length === 0 ? 'READY' : 'BLOCKED';
  console.log(`[${status}] ${group.label}`);
  if (group.blockers.length === 0 && group.warnings.length === 0) {
    console.log('  ok');
  }
  for (const blocker of group.blockers) console.log(`  BLOCKER: ${blocker}`);
  for (const warning of group.warnings) console.log(`  WARN: ${warning}`);
  console.log(`  Next: ${group.nextAction}`);
  console.log('');
}

console.log(`Summary: ${groups.length - groups.filter((g) => g.blockers.length > 0).length}/${groups.length} ready`);
console.log(`Blockers: ${blockers.length}`);
console.log(`Warnings: ${warnings.length}`);

if (strict && blockers.length > 0) {
  process.exitCode = 1;
}

function readEnvFile(filePath) {
  const absolute = path.resolve(filePath);
  const parsed = {};
  const content = fs.readFileSync(absolute, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) parsed[key] = value;
  }
  return parsed;
}

function value(env, key) {
  return String(env[key] || '').trim();
}

function has(env, key) {
  return value(env, key).length > 0;
}

function keyMode(key, expectedPrefix) {
  if (!key) return 'missing';
  if (key === `${expectedPrefix}_test` || key.startsWith(`${expectedPrefix}_test_`)) return 'test';
  if (key === `${expectedPrefix}_live` || key.startsWith(`${expectedPrefix}_live_`)) return 'live';
  return 'unknown';
}

function stripeReadiness(env) {
  const blockers = [];
  const warnings = [];
  const secretMode = keyMode(value(env, 'STRIPE_SECRET_KEY'), 'sk');
  const publishableKey =
    value(env, 'STRIPE_PUBLIC_KEY') || value(env, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  const publishableMode = keyMode(publishableKey, 'pk');

  requireEnv(env, blockers, 'STRIPE_SECRET_KEY');
  requireEnv(env, blockers, 'STRIPE_WEBHOOK_SECRET');
  if (!publishableKey) blockers.push('STRIPE_PUBLIC_KEY or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing');

  if (secretMode === 'unknown') blockers.push('STRIPE_SECRET_KEY must start with sk_test_ or sk_live_');
  if (publishableKey && publishableMode === 'unknown') {
    blockers.push('Stripe publishable key must start with pk_test_ or pk_live_');
  }
  if (
    secretMode !== 'missing' &&
    publishableMode !== 'missing' &&
    secretMode !== 'unknown' &&
    publishableMode !== 'unknown' &&
    secretMode !== publishableMode
  ) {
    blockers.push(`Stripe key modes differ: secret=${secretMode}, publishable=${publishableMode}`);
  }

  const priceKeys = [
    'STARTER_PRICE_MONTHLY',
    'STARTER_PRICE_QUARTERLY',
    'STARTER_PRICE_SEMESTRAL',
    'STARTER_PRICE_ANNUAL',
    'PROFISSIONAL_PRICE_MONTHLY',
    'PROFISSIONAL_PRICE_QUARTERLY',
    'PROFISSIONAL_PRICE_SEMESTRAL',
    'PROFISSIONAL_PRICE_ANNUAL',
  ];
  for (const key of priceKeys) requireEnv(env, blockers, key);

  optionalEnv(env, warnings, 'SUCCESS_URL');
  optionalEnv(env, warnings, 'CANCEL_URL');

  return {
    label: 'Stripe billing',
    blockers,
    warnings,
    nextAction: 'Run /admin/pricing-config sync check, checkout test card, webhook replay and cancellation smoke.',
  };
}

function emailReadiness(env) {
  const blockers = [];
  const warnings = [];
  requireEnv(env, blockers, 'MAILERSEND_API_KEY');
  requireEnv(env, blockers, 'EMAIL_SENDER');
  optionalEnv(env, warnings, 'MAILERSEND_DOMAIN_ID');
  optionalEnv(env, warnings, 'FRONT_URL');
  optionalEnv(env, warnings, 'RESET_PASS_URL');

  const senderDomain = value(env, 'EMAIL_SENDER').split('@').pop() || '';
  if (senderDomain && !senderDomain.endsWith('myurbanai.com')) {
    warnings.push(`EMAIL_SENDER domain is ${senderDomain}; confirm SPF/DKIM before paid beta`);
  }

  return {
    label: 'MailerSend',
    blockers,
    warnings,
    nextAction: 'Verify MailerSend domain, DKIM/SPF and send a real password reset/onboarding email.',
  };
}

function staysReadiness(env) {
  const blockers = [];
  const warnings = [];
  requireEnv(env, blockers, 'STAYS_API_BASE_URL');
  requireEnv(env, blockers, 'STAYS_TOKEN_ENCRYPTION_KEY');

  const key = value(env, 'STAYS_TOKEN_ENCRYPTION_KEY');
  if (key && !isLikelyStrongStaysKey(key)) {
    warnings.push('STAYS_TOKEN_ENCRYPTION_KEY should be 32 random bytes as base64 or 64 hex chars');
  }

  return {
    label: 'Stays beta private',
    blockers,
    warnings,
    nextAction: 'Use sandbox/API official URL, connect one controlled account, sync listings and run preview before push.',
  };
}

function supportReadiness(env) {
  const blockers = [];
  const warnings = [];
  if (!has(env, 'SUPPORT_EMAIL')) {
    warnings.push('SUPPORT_EMAIL is not set; app fallback is suporte@myurbanai.com');
  }
  if (!has(env, 'PRIVACY_EMAIL')) {
    warnings.push('PRIVACY_EMAIL is not set; app fallback is privacidade@myurbanai.com');
  }
  requireEnv(env, blockers, 'SUPPORT_OWNER_EMAIL');
  requireEnv(env, blockers, 'PRIVACY_OWNER_EMAIL');

  const emailValues = {
    SUPPORT_EMAIL: value(env, 'SUPPORT_EMAIL') || 'suporte@myurbanai.com',
    PRIVACY_EMAIL: value(env, 'PRIVACY_EMAIL') || 'privacidade@myurbanai.com',
    SUPPORT_OWNER_EMAIL: value(env, 'SUPPORT_OWNER_EMAIL'),
    PRIVACY_OWNER_EMAIL: value(env, 'PRIVACY_OWNER_EMAIL'),
  };

  for (const [key, email] of Object.entries(emailValues)) {
    const domain = email.split('@').pop() || '';
    if (domain && !domain.endsWith('myurbanai.com')) {
      warnings.push(`${key} domain is ${domain}; confirm this is intentional`);
    }
  }

  return {
    label: 'Support and LGPD',
    blockers,
    warnings,
    nextAction: 'Confirm inbox access, owners and P0/LGPD response ritual before accepting paid beta users.',
  };
}

function adminOpsReadiness(env) {
  const blockers = [];
  const warnings = [];

  requireEnv(env, blockers, 'JWT_SECRET');
  requireEnv(env, blockers, 'FRONT_BASE_URL');
  requireEnv(env, blockers, 'CORS_ALLOWED_ORIGINS');

  const appEnv = value(env, 'APP_ENV') || value(env, 'NODE_ENV') || 'development';
  const isProdLike = ['production', 'prod', 'staging'].includes(appEnv.toLowerCase());
  const dbSynchronize = value(env, 'DB_SYNCHRONIZE').toLowerCase();
  const migrationsRun = value(env, 'MIGRATIONS_RUN').toLowerCase();

  if (isProdLike && dbSynchronize === 'true') {
    blockers.push('DB_SYNCHRONIZE must be false in production/staging');
  }
  if (isProdLike && migrationsRun !== 'true') {
    warnings.push('MIGRATIONS_RUN should be true in production/staging cutover flow');
  }
  optionalEnv(env, warnings, 'SENTRY_DSN');
  optionalEnv(env, warnings, 'ADMIN_ALERT_EMAIL');

  return {
    label: 'Admin and ops',
    blockers,
    warnings,
    nextAction: 'Confirm admin users, audit-log visibility, job-run history and smoke the guarded admin mutations.',
  };
}

function dataRoiReadiness(env) {
  const blockers = [];
  const warnings = [];

  requireEnv(env, blockers, 'GOOGLE_MAPS_API_KEY');
  requireEnv(env, blockers, 'GEMINI_API_KEY');
  optionalEnv(env, warnings, 'AIRROI_API_KEY');
  optionalEnv(env, warnings, 'MAPBOX_TOKEN');

  const strategy = value(env, 'PRICING_STRATEGY') || 'rules';
  const validStrategies = new Set(['rules', 'xgboost', 'shadow', 'auto', 'adaptive']);
  if (!validStrategies.has(strategy)) {
    blockers.push(`PRICING_STRATEGY=${strategy} is not supported`);
  }

  if (value(env, 'PRICING_BOOTSTRAP_ON_BOOT').toLowerCase() === 'false') {
    warnings.push('PRICING_BOOTSTRAP_ON_BOOT=false; confirm this is intentional outside local tests');
  }

  return {
    label: 'Data, ROI and cases',
    blockers,
    warnings,
    nextAction: 'Run dataset diagnostics, pricing quality, ROI overview and capture 3 audited case studies before public proof claims.',
  };
}

function requireEnv(env, blockers, key) {
  if (!has(env, key)) blockers.push(`${key} is not set in the supplied env/runtime`);
}

function optionalEnv(env, warnings, key) {
  if (!has(env, key)) warnings.push(`${key} is not set`);
}

function isLikelyStrongStaysKey(key) {
  if (/^[a-f0-9]{64}$/i.test(key)) return true;
  try {
    return Buffer.from(key, 'base64').length === 32;
  } catch {
    return false;
  }
}
