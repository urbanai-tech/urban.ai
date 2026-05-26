#!/usr/bin/env node

import fs from 'node:fs';

const PRODUCTION_HOSTS = new Set([
  'app.myurbanai.com',
  'myurbanai.com',
  'www.myurbanai.com',
  'urbanai-production-85fd.up.railway.app',
]);

const NON_PRODUCTION_HOST_PATTERN = /(^|[-.])(staging|stage|stg|preview|dev|qa|test|sandbox|local)([-.]|$)/i;

const GATES = {
  'authenticated-smoke': {
    label: 'Playwright authenticated smoke',
    requiredUrls: [
      { key: 'E2E_BASE_URL', aliases: ['FRONTEND_BASE_URL'] },
      { key: 'E2E_API_URL', aliases: ['NEXT_PUBLIC_API_URL', 'BACKEND_BASE_URL'] },
    ],
    requiredPairs: [
      {
        label: 'authentication credentials',
        pairs: [
          ['E2E_AUTH_EMAIL', 'E2E_AUTH_PASSWORD'],
          ['E2E_EMAIL', 'E2E_PASSWORD'],
        ],
      },
    ],
  },
  'product-audit': {
    label: 'Produto - E2E audit admin/host',
    requiredUrls: [
      { key: 'E2E_BASE_URL', aliases: ['FRONTEND_BASE_URL'] },
      { key: 'E2E_API_URL', aliases: ['BACKEND_BASE_URL'] },
    ],
    requiredPairs: [
      {
        label: 'audit credentials',
        pairs: [
          ['E2E_EMAIL', 'E2E_PASSWORD'],
          ['E2E_AUTH_EMAIL', 'E2E_AUTH_PASSWORD'],
        ],
      },
    ],
  },
  'enterprise-live-gate': {
    label: 'Enterprise live gate staging',
    requiredUrls: [
      { key: 'ENTERPRISE_GATE_BACKEND_URL', aliases: ['E2E_API_URL', 'BACKEND_BASE_URL'] },
      { key: 'ENTERPRISE_GATE_FRONTEND_URL', aliases: ['E2E_BASE_URL', 'FRONTEND_BASE_URL'] },
    ],
    requiredCredentialGroups: [
      {
        label: 'admin live-gate identity',
        alternatives: [
          ['ENTERPRISE_GATE_ADMIN_JWT'],
          ['ADMIN_JWT'],
          ['ENTERPRISE_GATE_ADMIN_EMAIL', 'ENTERPRISE_GATE_ADMIN_PASSWORD'],
          ['E2E_AUTH_EMAIL', 'E2E_AUTH_PASSWORD'],
          ['E2E_EMAIL', 'E2E_PASSWORD'],
        ],
      },
      {
        label: 'host live-gate identity',
        alternatives: [
          ['ENTERPRISE_GATE_HOST_JWT'],
          ['HOST_JWT'],
          ['ENTERPRISE_GATE_HOST_EMAIL', 'ENTERPRISE_GATE_HOST_PASSWORD'],
          ['E2E_HOST_EMAIL', 'E2E_HOST_PASSWORD'],
          ['E2E_AUTH_EMAIL', 'E2E_AUTH_PASSWORD'],
          ['E2E_EMAIL', 'E2E_PASSWORD'],
        ],
      },
    ],
  },
};

function parseArgs(argv) {
  const options = { gate: '', help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--gate') {
      options.gate = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--gate=')) {
      options.gate = arg.slice('--gate='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/staging-gate-preflight.mjs --gate authenticated-smoke',
    '  node scripts/staging-gate-preflight.mjs --gate product-audit',
    '  node scripts/staging-gate-preflight.mjs --gate enterprise-live-gate',
    '',
    'The preflight prints presence/absence only. Secret values are never printed.',
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const gate = GATES[options.gate];
  if (!gate) {
    throw new Error(`Unknown or missing --gate. Expected one of: ${Object.keys(GATES).join(', ')}`);
  }

  const result = evaluateGate(options.gate, gate, process.env);
  writeGitHubOutputs(result);
  writeGitHubSummary(result);
  logResult(result);

  if (result.fatal.length > 0) {
    process.exitCode = 1;
  }
}

function evaluateGate(id, gate, env) {
  const targetEnv = firstValue(env, ['ENTERPRISE_GATE_ENV', 'E2E_TARGET_ENV', 'APP_ENV']) || 'staging';
  const missing = [];
  const fatal = [];
  const checks = [];

  if (String(targetEnv).toLowerCase() === 'production') {
    fatal.push('Target environment is production; staging gates refuse to run against production.');
  }

  for (const requirement of gate.requiredUrls || []) {
    const found = findValue(env, [requirement.key, ...(requirement.aliases || [])]);
    if (!found.value) {
      missing.push(`${requirement.key}${requirement.aliases?.length ? ` (${requirement.aliases.join(' or ')})` : ''}`);
      checks.push({ name: requirement.key, status: 'missing', detail: 'URL not configured' });
      continue;
    }

    const validation = validateStagingUrl(found.value, env);
    if (!validation.ok) fatal.push(`${found.key}: ${validation.reason}`);
    checks.push({
      name: requirement.key,
      status: validation.ok ? 'ready' : 'blocked',
      detail: `${found.key}=${sanitizeUrl(found.value)}`,
    });
  }

  for (const requirement of gate.requiredPairs || []) {
    const matched = (requirement.pairs || []).find((pair) => pair.every((key) => hasValue(env[key])));
    if (!matched) {
      missing.push(`${requirement.label}: ${requirement.pairs.map((pair) => pair.join('/')).join(' or ')}`);
      checks.push({ name: requirement.label, status: 'missing', detail: 'credentials not configured' });
    } else {
      checks.push({ name: requirement.label, status: 'ready', detail: `found ${matched.join('/')}` });
    }
  }

  for (const requirement of gate.requiredCredentialGroups || []) {
    const matched = (requirement.alternatives || []).find((keys) => keys.every((key) => hasValue(env[key])));
    if (!matched) {
      missing.push(`${requirement.label}: ${requirement.alternatives.map((keys) => keys.join('/')).join(' or ')}`);
      checks.push({ name: requirement.label, status: 'missing', detail: 'credentials not configured' });
    } else {
      checks.push({ name: requirement.label, status: 'ready', detail: `found ${matched.join('/')}` });
    }
  }

  const shouldRun = fatal.length === 0 && missing.length === 0;
  return {
    id,
    label: gate.label,
    targetEnv,
    shouldRun,
    missing,
    fatal,
    checks,
    reason: shouldRun
      ? 'ready'
      : [...fatal, ...missing].join('; ').slice(0, 900),
  };
}

function validateStagingUrl(value, env) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    return { ok: false, reason: 'invalid URL' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: `unsupported protocol ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (PRODUCTION_HOSTS.has(hostname) || /(^|[-.])production([-.]|$)/i.test(hostname)) {
    return { ok: false, reason: `production host is not allowed (${hostname})` };
  }

  if (isLocalhost(hostname) || NON_PRODUCTION_HOST_PATTERN.test(hostname)) {
    return { ok: true };
  }

  if (env.E2E_ALLOW_NON_STANDARD_STAGING_URL === 'YES') {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      `host ${hostname} does not look like staging/local. ` +
      'Set E2E_ALLOW_NON_STANDARD_STAGING_URL=YES only for a reviewed non-production URL.',
  };
}

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function firstValue(env, keys) {
  return findValue(env, keys).value;
}

function findValue(env, keys) {
  for (const key of keys) {
    if (hasValue(env[key])) return { key, value: String(env[key]).trim() };
  }
  return { key: '', value: '' };
}

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function writeGitHubOutputs(result) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  fs.appendFileSync(
    output,
    [
      `should_run=${result.shouldRun ? 'true' : 'false'}`,
      `target_env=${singleLine(result.targetEnv)}`,
      `skip_reason=${singleLine(result.reason)}`,
      '',
    ].join('\n'),
  );
}

function writeGitHubSummary(result) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  const rows = result.checks
    .map((check) => `| ${markdownCell(check.name)} | ${markdownCell(check.status)} | ${markdownCell(check.detail)} |`)
    .join('\n');
  fs.appendFileSync(
    summary,
    [
      `## ${result.label} preflight`,
      '',
      `Target env: \`${markdownCell(result.targetEnv)}\``,
      `Decision: **${result.shouldRun ? 'run' : 'skip'}**`,
      result.reason && result.reason !== 'ready' ? `Reason: ${markdownCell(result.reason)}` : '',
      '',
      '| Requirement | Status | Detail |',
      '| --- | --- | --- |',
      rows,
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

function logResult(result) {
  if (result.shouldRun) {
    console.log(`[preflight] ${result.label}: ready for ${result.targetEnv}.`);
    return;
  }

  const annotation = result.fatal.length > 0 ? 'error' : 'warning';
  console.log(`::${annotation}::${result.label} preflight ${result.fatal.length > 0 ? 'blocked' : 'skipped'}: ${result.reason}`);
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_) {
    return '[invalid-url]';
  }
}

function singleLine(value) {
  return String(value || '').replace(/\r?\n/g, ' ').replace(/%/g, '%25');
}

function markdownCell(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  console.error(usage());
  process.exitCode = 1;
}
