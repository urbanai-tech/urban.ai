#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const GROUPS = [
  {
    id: 'live_gate_readonly',
    label: 'Enterprise live gate read-only',
    required: ['ENTERPRISE_GATE_BACKEND_URL', 'ENTERPRISE_GATE_FRONTEND_URL', 'ENTERPRISE_GATE_HEALTH_TOKEN'],
    recommended: ['ENTERPRISE_GATE_ADMIN_JWT', 'ENTERPRISE_GATE_HOST_JWT'],
    aliases: { ENTERPRISE_GATE_HEALTH_TOKEN: ['HEALTH_READINESS_TOKEN'] },
    command:
      'node scripts/enterprise-auditability-live-gate.js --env=staging --strict --skip-events-ingest --output docs/evidence/enterprise-live-gate-staging.md',
  },
  {
    id: 'events_ingest_smoke',
    label: 'Events ingest controlled smoke',
    required: ['ENTERPRISE_GATE_BACKEND_URL', 'ENTERPRISE_GATE_EVENTS_INGEST_KEY'],
    aliases: { ENTERPRISE_GATE_EVENTS_INGEST_KEY: ['EVENTS_INGEST_API_KEY'] },
    command:
      'node scripts/enterprise-auditability-live-gate.js --env=staging --strict --allow-mutations --output docs/evidence/enterprise-live-gate-staging.md',
  },
  {
    id: 'restore_drill',
    label: 'Restore drill verifier',
    required: ['RESTORE_DATABASE_URL'],
    command:
      'cd urban-ai-backend-main && node scripts/restore-drill-verify.js --output ../docs/evidence/restore-drill-YYYY-QX.md',
  },
  {
    id: 'stays_real_smoke',
    label: 'Stays sandbox/assisted account smoke',
    required: ['STAYS_API_BASE_URL', 'STAYS_TOKEN_ENCRYPTION_KEY'],
    recommended: [
      'STAYS_AUTO_APPLY_ENABLED',
      'STAYS_AUTO_APPLY_DRY_RUN',
      'STAYS_AUTO_APPLY_ALLOWED_USER_IDS',
      'STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS',
    ],
    aliases: {
      STAYS_AUTO_APPLY_ALLOWED_USER_IDS: ['STAYS_AUTO_APPLY_USER_ALLOWLIST'],
      STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS: ['STAYS_AUTO_APPLY_LISTING_ALLOWLIST'],
    },
    command: 'Seguir docs/runbooks/stays-beta-private-smoke.md com conta sandbox/assistida.',
  },
];

function parseArgs(argv) {
  const options = { output: null, envFile: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
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
  return options;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/enterprise-access-readiness.js',
    '  node scripts/enterprise-access-readiness.js --output docs/evidence/enterprise-access-readiness.md',
    '  node scripts/enterprise-access-readiness.js --env-file .env.staging',
    '',
    'This script reports presence/absence only. It never prints secret values.',
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const env = loadEnv(options.envFile);
  const result = {
    generatedAt: new Date().toISOString(),
    envFile: options.envFile ? path.resolve(options.envFile) : null,
    groups: GROUPS.map((group) => evaluateGroup(group, env)),
  };
  const markdown = renderMarkdown(result);
  writeOrPrint(markdown, options.output);

  if (result.groups.some((group) => group.requiredMissing.length > 0)) {
    process.exitCode = 1;
  }
}

function loadEnv(envFile) {
  const env = { ...process.env };
  const candidates = envFile
    ? [path.resolve(envFile)]
    : [
        path.resolve('.env'),
        path.resolve('urban-ai-backend-main/.env'),
        path.resolve('Urban-front-main/.env'),
        path.resolve('Urban-front-main/.env.local'),
      ];

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

function evaluateGroup(group, env) {
  const aliases = group.aliases || {};
  const required = (group.required || []).map((key) => presence(key, env, aliases[key]));
  const recommended = (group.recommended || []).map((key) => presence(key, env, aliases[key]));
  return {
    id: group.id,
    label: group.label,
    status: required.every((item) => item.present) ? 'ready' : 'blocked',
    required,
    recommended,
    requiredMissing: required.filter((item) => !item.present).map((item) => item.key),
    recommendedMissing: recommended.filter((item) => !item.present).map((item) => item.key),
    command: group.command,
  };
}

function presence(key, env, aliases = []) {
  const candidates = [key, ...(aliases || [])];
  const foundAs = candidates.find((candidate) => hasValue(env[candidate])) || null;
  return { key, present: Boolean(foundAs), foundAs };
}

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function renderMarkdown(result) {
  const ready = result.groups.filter((group) => group.status === 'ready').length;
  const lines = [
    '# Enterprise Access Readiness',
    '',
    `Generated at: ${result.generatedAt}`,
    `Env file: ${result.envFile ? `\`${sanitizePath(result.envFile)}\`` : 'process + default local env files'}`,
    '',
    'This file reports presence/absence only. Secret values are not printed.',
    '',
    '## Summary',
    '',
    `Ready groups: ${ready}/${result.groups.length}`,
    '',
    markdownTable(
      ['Group', 'Status', 'Missing Required', 'Missing Recommended'],
      result.groups.map((group) => [
        group.label,
        group.status.toUpperCase(),
        group.requiredMissing.join(', ') || 'none',
        group.recommendedMissing.join(', ') || 'none',
      ]),
    ),
    '',
    '## Details',
    '',
  ];

  for (const group of result.groups) {
    lines.push(`### ${group.label}`);
    lines.push('');
    lines.push(`- Status: ${group.status}`);
    lines.push(`- Command when ready: \`${group.command}\``);
    lines.push('');
    lines.push(markdownTable(['Variable', 'Type', 'Present', 'Found as'], [
      ...group.required.map((item) => [item.key, 'required', item.present ? 'yes' : 'no', item.foundAs || '']),
      ...group.recommended.map((item) => [item.key, 'recommended', item.present ? 'yes' : 'no', item.foundAs || '']),
    ]));
    lines.push('');
  }

  lines.push('## Next Step');
  lines.push('');
  lines.push('Set the missing variables in the terminal/session, GitHub secrets, Railway variables or a local env file, then re-run this script. Do not paste secret values into chat or evidence files.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.map(markdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
  ].join('\n');
}

function markdownCell(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function sanitizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function writeOrPrint(markdown, output) {
  if (!output) {
    process.stdout.write(markdown);
    return;
  }
  const outputPath = path.resolve(process.cwd(), output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown, 'utf8');
  process.stdout.write(`Enterprise access readiness written to ${outputPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message || String(error)}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exitCode = 1;
}
