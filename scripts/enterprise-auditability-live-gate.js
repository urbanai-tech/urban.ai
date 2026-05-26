#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 12_000;
const SECRET_KEYS = [
  'ENTERPRISE_GATE_ADMIN_JWT',
  'ADMIN_JWT',
  'ENTERPRISE_GATE_HOST_JWT',
  'HOST_JWT',
  'ENTERPRISE_GATE_HEALTH_TOKEN',
  'HEALTH_READINESS_TOKEN',
  'ENTERPRISE_GATE_EVENTS_INGEST_KEY',
  'EVENTS_INGEST_API_KEY',
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const env = loadEnv(options.envFile);
  const config = resolveConfig(env, options);
  const evidence = {
    generatedAt: new Date().toISOString(),
    runId: config.runId,
    environment: config.environment,
    dryRun: options.dryRun,
    allowMutations: options.allowMutations,
    backendUrl: sanitizeUrl(config.backendUrl),
    frontendUrl: sanitizeUrl(config.frontendUrl),
    checks: [],
  };

  if (options.dryRun) {
    evidence.checks = plannedChecks(config, options);
    const markdown = renderMarkdown(evidence);
    writeOrPrint(markdown, options.output);
    return;
  }

  await runCheck(evidence, 'backend.live', 'GET /health/live returns status ok', async () => {
    const response = await requestJson(`${config.backendUrl}/health/live`);
    assert(response.statusCode === 200, `expected HTTP 200, got ${response.statusCode}`);
    assert(response.body?.status === 'ok', `expected body.status=ok, got ${response.body?.status}`);
    return { statusCode: response.statusCode, status: response.body.status, uptimeSec: response.body.uptimeSec };
  });

  if (config.healthToken) {
    await runCheck(evidence, 'backend.health', 'GET /health is fully ready', async () => {
      const response = await requestJson(`${config.backendUrl}/health`, { headers: bearer(config.healthToken) });
      assert(response.statusCode === 200, `expected HTTP 200, got ${response.statusCode}`);
      assert(response.body?.status === 'ok', `expected health status ok, got ${response.body?.status}`);
      return {
        statusCode: response.statusCode,
        status: response.body.status,
        env: response.body?.app?.env,
        db: response.body?.checks?.db?.status,
      };
    });
  } else {
    addSkipped(evidence, 'backend.health', 'Detailed /health needs ENTERPRISE_GATE_HEALTH_TOKEN or HEALTH_READINESS_TOKEN.');
  }

  await runCheck(evidence, 'frontend.root', 'Frontend root responds', async () => {
    const response = await requestText(config.frontendUrl);
    assert(response.statusCode < 400, `expected HTTP <400, got ${response.statusCode}`);
    return { statusCode: response.statusCode, bytes: response.text.length };
  });

  if (config.adminJwt) {
    await runAdminReadChecks(evidence, config);
  } else {
    addSkipped(evidence, 'admin.readonly', 'Admin read-only checks need ENTERPRISE_GATE_ADMIN_JWT or ADMIN_JWT.');
  }

  if (config.hostJwt) {
    await runAskChecks(evidence, config, options);
  } else {
    addSkipped(evidence, 'ask.entitlement', 'AskUrban live checks need ENTERPRISE_GATE_HOST_JWT or HOST_JWT.');
  }

  if (config.eventsIngestKey && !options.skipEventsIngest) {
    await runEventsIngestCheck(evidence, config, options);
  } else if (options.skipEventsIngest) {
    addSkipped(evidence, 'events.ingest', 'Skipped by --skip-events-ingest.', false);
  } else {
    addSkipped(evidence, 'events.ingest', 'Events ingest check needs ENTERPRISE_GATE_EVENTS_INGEST_KEY or EVENTS_INGEST_API_KEY.');
  }

  const markdown = renderMarkdown(evidence);
  writeOrPrint(markdown, options.output);

  const failed = evidence.checks.filter((check) => check.status === 'fail');
  const skippedRequired = evidence.checks.filter((check) => check.status === 'skip' && check.required !== false);
  if (failed.length > 0 || (options.strict && skippedRequired.length > 0)) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    environment: process.env.ENTERPRISE_GATE_ENV || 'staging',
    dryRun: false,
    strict: false,
    allowMutations: false,
    skipEventsIngest: false,
    output: null,
    envFile: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--allow-mutations') options.allowMutations = true;
    else if (arg === '--skip-events-ingest') options.skipEventsIngest = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--env=')) options.environment = arg.slice('--env='.length);
    else if (arg.startsWith('--env-file=')) options.envFile = arg.slice('--env-file='.length);
    else if (arg === '--output' || arg === '-o') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires a file path.`);
      options.output = value;
      index += 1;
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.environment = String(options.environment || 'staging').toLowerCase();
  if (!['local', 'staging', 'production'].includes(options.environment)) {
    throw new Error('--env must be local, staging or production.');
  }

  return options;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/enterprise-auditability-live-gate.js --dry-run',
    '  node scripts/enterprise-auditability-live-gate.js --env=staging --strict --output docs/evidence/live-gate.md',
    '  node scripts/enterprise-auditability-live-gate.js --env=staging --allow-mutations',
    '',
    'Required env for live checks:',
    '  ENTERPRISE_GATE_BACKEND_URL or BACKEND_BASE_URL or E2E_API_URL',
    '  ENTERPRISE_GATE_FRONTEND_URL or FRONTEND_BASE_URL or E2E_BASE_URL',
    '',
    'Optional env:',
    '  ENTERPRISE_GATE_HEALTH_TOKEN or HEALTH_READINESS_TOKEN',
    '  ENTERPRISE_GATE_ADMIN_JWT or ADMIN_JWT',
    '  ENTERPRISE_GATE_HOST_JWT or HOST_JWT',
    '  ENTERPRISE_GATE_EVENTS_INGEST_KEY or EVENTS_INGEST_API_KEY',
    '  ENTERPRISE_GATE_POST_ASK_QUESTION=true',
    '  ENTERPRISE_GATE_PROD_MUTATION_OK=YES',
  ].join('\n');
}

function loadEnv(envFile) {
  const env = { ...process.env };
  const candidates = envFile ? [path.resolve(envFile)] : [];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) Object.assign(env, readEnvFile(filePath));
  }
  return env;
}

function readEnvFile(filePath) {
  const parsed = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function resolveConfig(env, options) {
  const backendUrl = firstEnv(env, ['ENTERPRISE_GATE_BACKEND_URL', 'BACKEND_BASE_URL', 'E2E_API_URL']);
  const frontendUrl = firstEnv(env, ['ENTERPRISE_GATE_FRONTEND_URL', 'FRONTEND_BASE_URL', 'E2E_BASE_URL']);
  if (!backendUrl && !options.dryRun) throw new Error('Missing ENTERPRISE_GATE_BACKEND_URL/BACKEND_BASE_URL/E2E_API_URL.');
  if (!frontendUrl && !options.dryRun) throw new Error('Missing ENTERPRISE_GATE_FRONTEND_URL/FRONTEND_BASE_URL/E2E_BASE_URL.');

  return {
    environment: options.environment,
    backendUrl: trimSlash(backendUrl || '<backend-url>'),
    frontendUrl: trimSlash(frontendUrl || '<frontend-url>'),
    healthToken: firstEnv(env, ['ENTERPRISE_GATE_HEALTH_TOKEN', 'HEALTH_READINESS_TOKEN']),
    adminJwt: firstEnv(env, ['ENTERPRISE_GATE_ADMIN_JWT', 'ADMIN_JWT']),
    hostJwt: firstEnv(env, ['ENTERPRISE_GATE_HOST_JWT', 'HOST_JWT']),
    eventsIngestKey: firstEnv(env, ['ENTERPRISE_GATE_EVENTS_INGEST_KEY', 'EVENTS_INGEST_API_KEY']),
    postAskQuestion: String(env.ENTERPRISE_GATE_POST_ASK_QUESTION || '').toLowerCase() === 'true',
    prodMutationOk: env.ENTERPRISE_GATE_PROD_MUTATION_OK === 'YES',
    runId: env.ENTERPRISE_GATE_RUN_ID || `enterprise-gate-${new Date().toISOString().replace(/[-:.]/g, '')}`,
  };
}

function firstEnv(env, keys) {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function plannedChecks(config, options) {
  return [
    planned('backend.live', `GET ${config.backendUrl}/health/live`),
    config.healthToken
      ? planned('backend.health', `GET ${config.backendUrl}/health with readiness bearer`)
      : skippedPlan('backend.health', 'Needs ENTERPRISE_GATE_HEALTH_TOKEN or HEALTH_READINESS_TOKEN.'),
    planned('frontend.root', `GET ${config.frontendUrl}`),
    config.adminJwt
      ? planned('admin.readonly', 'GET /admin/dashboard-summary, /admin/jobs/runs, /admin/audit-logs, /admin/stays/health')
      : skippedPlan('admin.readonly', 'Needs admin JWT.'),
    config.hostJwt
      ? planned('ask.entitlement', 'GET /ask/usage and blocked-user POST assertion when canUse=false')
      : skippedPlan('ask.entitlement', 'Needs host JWT.'),
    config.eventsIngestKey && !options.skipEventsIngest
      ? planned('events.ingest', 'POST /events/ingest with controlled smoke payload only when mutations are allowed')
      : skippedPlan('events.ingest', 'Needs ingest key or was skipped.'),
  ];
}

function planned(name, detail) {
  return { name, status: 'planned', description: detail, durationMs: 0, result: null };
}

function skippedPlan(name, detail) {
  return { name, status: 'skip', description: detail, durationMs: 0, result: null };
}

async function runAdminReadChecks(evidence, config) {
  const headers = bearer(config.adminJwt);
  const endpoints = [
    ['/admin/dashboard-summary', 'admin.dashboard-summary'],
    ['/admin/jobs/runs?limit=5', 'admin.jobs-runs'],
    ['/admin/audit-logs?limit=5', 'admin.audit-logs'],
    ['/admin/stays/health', 'admin.stays-health'],
  ];

  for (const [endpoint, name] of endpoints) {
    await runCheck(evidence, name, `GET ${endpoint}`, async () => {
      const response = await requestJson(`${config.backendUrl}${endpoint}`, { headers });
      assert(response.statusCode === 200, `expected HTTP 200, got ${response.statusCode}`);
      return summarizeJson(response.body);
    });
  }
}

async function runAskChecks(evidence, config) {
  const headers = bearer(config.hostJwt);
  let usage = null;

  await runCheck(evidence, 'ask.usage', 'GET /ask/usage returns server-side entitlement', async () => {
    const response = await requestJson(`${config.backendUrl}/ask/usage`, { headers });
    assert(response.statusCode === 200, `expected HTTP 200, got ${response.statusCode}`);
    usage = response.body;
    assert(typeof usage?.canUse === 'boolean', 'canUse must be boolean');
    assert(typeof usage?.plan === 'string', 'plan must be string');
    assert(typeof usage?.quota === 'number', 'quota must be number');
    assert(typeof usage?.hardCap === 'number', 'hardCap must be number');
    return {
      canUse: usage.canUse,
      plan: usage.plan,
      reason: usage.reason,
      used: usage.used,
      quota: usage.quota,
      hardCap: usage.hardCap,
    };
  });

  if (!usage) return;

  if (!usage.canUse) {
    await runCheck(evidence, 'ask.blocked-question', 'POST /ask/question blocks disallowed/quota users', async () => {
      const response = await requestJson(`${config.backendUrl}/ask/question`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'Smoke enterprise: esta conta deve ser bloqueada?' }),
      });
      assert([403, 429].includes(response.statusCode), `expected 403 or 429, got ${response.statusCode}`);
      return { statusCode: response.statusCode, reason: response.body?.reason || response.body?.usage?.reason };
    });
  } else if (config.postAskQuestion) {
    await runCheck(evidence, 'ask.allowed-question', 'POST /ask/question succeeds for allowed user', async () => {
      const response = await requestJson(`${config.backendUrl}/ask/question`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'Smoke enterprise: resuma meus dados auditaveis.' }),
      });
      assert(response.statusCode >= 200 && response.statusCode < 300, `expected 2xx, got ${response.statusCode}`);
      return { statusCode: response.statusCode, messageId: response.body?.messageId, usage: response.body?.usage };
    });
  } else {
    addSkipped(
      evidence,
      'ask.allowed-question',
      'Allowed-user POST skipped; set ENTERPRISE_GATE_POST_ASK_QUESTION=true to create a live AskUrban message.',
      false,
    );
  }
}

async function runEventsIngestCheck(evidence, config, options) {
  const prodMutationBlocked = config.environment === 'production' && !config.prodMutationOk;
  if (!options.allowMutations || prodMutationBlocked) {
    addSkipped(
      evidence,
      'events.ingest',
      prodMutationBlocked
        ? 'Production mutation blocked. Set --allow-mutations and ENTERPRISE_GATE_PROD_MUTATION_OK=YES only for a controlled prod smoke.'
        : 'Mutation blocked by default. Re-run with --allow-mutations in staging.',
      false,
    );
    return;
  }

  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const sourceId = config.runId.slice(0, 120);
  await runCheck(evidence, 'events.ingest', 'POST /events/ingest creates/updates controlled smoke event', async () => {
    const response = await requestJson(`${config.backendUrl}/events/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-urban-events-ingest-key': config.eventsIngestKey,
        'x-urban-collector': 'enterprise-live-gate',
        'x-urban-collector-version': sourceId,
        'x-urban-ingest-run-id': config.runId,
      },
      body: JSON.stringify({
        events: [
          {
            nome: `Enterprise live gate ${config.environment}`,
            dataInicio: future,
            enderecoCompleto: 'Avenida Paulista, 1578 - Sao Paulo - SP',
            cidade: 'Sao Paulo',
            estado: 'SP',
            categoria: 'smoke',
            source: 'enterprise-live-gate',
            sourceId,
            venueType: 'other',
            expectedAttendance: 1,
          },
        ],
      }),
    });
    assert(response.statusCode === 200, `expected HTTP 200, got ${response.statusCode}`);
    assert(response.body?.total === 1, `expected total=1, got ${response.body?.total}`);
    return {
      total: response.body.total,
      created: response.body.created,
      updated: response.body.updated,
      skipped: response.body.skipped,
      resultStatus: response.body.results?.[0]?.status,
      auditLookup: 'GET /admin/audit-logs?action=events.ingest.batch',
    };
  });
}

async function runCheck(evidence, name, description, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    evidence.checks.push({
      name,
      status: 'pass',
      description,
      durationMs: Date.now() - started,
      result,
    });
  } catch (error) {
    evidence.checks.push({
      name,
      status: 'fail',
      description,
      durationMs: Date.now() - started,
      error: sanitizeText(error.message || String(error)),
    });
  }
}

function addSkipped(evidence, name, description, required = true) {
  evidence.checks.push({ name, status: 'skip', description, durationMs: 0, result: null, required });
}

async function requestJson(url, options = {}) {
  const response = await request(url, options);
  let body = null;
  try {
    body = response.text ? JSON.parse(response.text) : null;
  } catch (_) {
    throw new Error(`Response from ${sanitizeUrl(url)} is not JSON: ${response.text.slice(0, 200)}`);
  }
  return { ...response, body };
}

async function requestText(url, options = {}) {
  return request(url, options);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    return { statusCode: response.status, headers: Object.fromEntries(response.headers.entries()), text };
  } finally {
    clearTimeout(timeout);
  }
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function summarizeJson(value) {
  if (Array.isArray(value)) return { kind: 'array', count: value.length };
  if (!value || typeof value !== 'object') return { kind: typeof value };
  const keys = Object.keys(value).slice(0, 20);
  const out = { kind: 'object', keys };
  if (value.generatedAt) out.generatedAt = value.generatedAt;
  if (value.health) out.health = value.health;
  if (value.status) out.status = value.status;
  if (typeof value.total === 'number') out.total = value.total;
  if (Array.isArray(value.items)) out.items = value.items.length;
  return out;
}

function renderMarkdown(evidence) {
  const rows = evidence.checks.map((check) => [
    check.name,
    check.status.toUpperCase(),
    `${check.durationMs || 0}ms`,
    check.error || check.description,
  ]);
  const passed = evidence.checks.filter((check) => check.status === 'pass').length;
  const failed = evidence.checks.filter((check) => check.status === 'fail').length;
  const skipped = evidence.checks.filter((check) => check.status === 'skip').length;
  const planned = evidence.checks.filter((check) => check.status === 'planned').length;

  const lines = [
    '# Enterprise Auditability Live Gate',
    '',
    `Generated at: ${evidence.generatedAt}`,
    `Run id: \`${sanitizeText(evidence.runId)}\``,
    `Environment: \`${sanitizeText(evidence.environment)}\``,
    `Dry run: ${evidence.dryRun ? 'yes' : 'no'}`,
    `Mutations allowed: ${evidence.allowMutations ? 'yes' : 'no'}`,
    `Backend URL: \`${evidence.backendUrl}\``,
    `Frontend URL: \`${evidence.frontendUrl}\``,
    '',
    '## Summary',
    '',
    `Pass: ${passed}`,
    `Fail: ${failed}`,
    `Skip: ${skipped}`,
    `Planned: ${planned}`,
    '',
    markdownTable(['Check', 'Status', 'Duration', 'Detail'], rows),
    '',
    '## Detailed Results',
    '',
  ];

  for (const check of evidence.checks) {
    lines.push(`### ${check.name}`);
    lines.push('');
    lines.push(`- Status: ${check.status}`);
    lines.push(`- Description: ${sanitizeText(check.description)}`);
    if (check.error) lines.push(`- Error: ${sanitizeText(check.error)}`);
    if (check.result) {
      lines.push('');
      lines.push('```json');
      lines.push(sanitizeText(JSON.stringify(check.result, null, 2)));
      lines.push('```');
    }
    lines.push('');
  }

  lines.push('## Secret Hygiene');
  lines.push('');
  lines.push('- JWTs, API keys, passwords and authorization headers are never printed.');
  lines.push('- Mutating checks are skipped by default; staging mutation requires `--allow-mutations`.');
  lines.push('- Production mutation also requires `ENTERPRISE_GATE_PROD_MUTATION_OK=YES`.');
  lines.push('');

  return `${sanitizeText(lines.join('\n'))}\n`;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.map(markdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
  ].join('\n');
}

function markdownCell(value) {
  return sanitizeText(String(value ?? '')).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function writeOrPrint(markdown, output) {
  if (!output) {
    process.stdout.write(markdown);
    return;
  }
  const outputPath = path.resolve(process.cwd(), output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown, 'utf8');
  process.stdout.write(`Enterprise gate evidence written to ${outputPath}\n`);
}

function sanitizeUrl(value) {
  const text = sanitizeText(String(value || ''));
  try {
    const parsed = new URL(text);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_) {
    return text;
  }
}

function sanitizeText(value) {
  let sanitized = String(value || '');
  for (const key of SECRET_KEYS) {
    const secret = process.env[key];
    if (secret) sanitized = sanitized.split(secret).join('[redacted]');
  }
  return sanitized
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [redacted]')
    .replace(/\b(sk|pk)_(live|test)_[A-Za-z0-9_]+/g, '$1_$2_[redacted]')
    .replace(/\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '[redacted-jwt]')
    .replace(/\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)=)[^\s&]+/gi, '$1[redacted]');
}

main().catch((error) => {
  process.stderr.write(`${sanitizeText(error.message || String(error))}\n`);
  process.exitCode = 1;
});
