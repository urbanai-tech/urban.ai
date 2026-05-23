#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXPECTED_TABLES = [
  'user',
  'payment',
  'plans',
  'list',
  'addresses',
  'events',
  'analise_preco',
  'ask_urban_messages',
  'price_snapshots',
  'occupancy_history',
  'event_proximity_features',
  'pricing_rule_configs',
  'admin_job_runs',
  'admin_audit_logs',
  'stays_accounts',
  'stays_listings',
  'price_updates',
  'migrations',
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const env = loadEnv(options.envFile);
  const databaseUrl = options.databaseUrl || env.RESTORE_DATABASE_URL || env.DATABASE_URL || '';
  const startedAt = new Date();

  if (options.dryRun) {
    const markdown = renderMarkdown({
      generatedAt: startedAt.toISOString(),
      mode: 'dry-run',
      database: sanitizeDatabaseUrl(databaseUrl || 'mysql://<user>:<pass>@<host>:3306/<database>'),
      checks: plannedChecks(),
    });
    writeOrPrint(markdown, options.output);
    return;
  }

  if (!databaseUrl) {
    throw new Error('RESTORE_DATABASE_URL or --database-url is required.');
  }
  assertNotProductionTarget(databaseUrl, options);

  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection(databaseUrl);
  const checks = [];

  try {
    await runSqlCheck(checks, 'connection', 'SELECT 1 against restored database', async () => {
      const [rows] = await connection.query('SELECT DATABASE() AS dbName, NOW() AS now');
      return rows[0];
    });

    const presentTables = await tableSet(connection);
    await runValueCheck(checks, 'schema.expected_tables', 'Expected operational tables exist', () => {
      const missing = EXPECTED_TABLES.filter((table) => !presentTables.has(table));
      if (missing.length) throw new Error(`Missing tables: ${missing.join(', ')}`);
      return { expected: EXPECTED_TABLES.length, present: EXPECTED_TABLES.length };
    });

    await runSqlCheck(checks, 'schema.row_counts', 'Read row counts from core tables', async () => {
      const counts = {};
      for (const table of EXPECTED_TABLES.filter((name) => presentTables.has(name))) {
        const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
        counts[table] = Number(rows[0].total);
      }
      return counts;
    });

    await runSqlCheck(checks, 'schema.latest_timestamps', 'Read latest timestamps where available', async () => {
      const latest = {};
      for (const table of EXPECTED_TABLES.filter((name) => presentTables.has(name))) {
        const columns = await columnSet(connection, table);
        const candidates = ['updatedAt', 'createdAt', 'criadoEm', 'dataInicio', 'startedAt'].filter((column) =>
          columns.has(column),
        );
        if (!candidates.length) continue;
        const column = candidates[0];
        const [rows] = await connection.query(`SELECT MAX(\`${column}\`) AS latest FROM \`${table}\``);
        latest[table] = { column, latest: rows[0].latest };
      }
      return latest;
    });

    await runSqlCheck(checks, 'auditability.tables_nonempty', 'Auditability tables are readable', async () => {
      const required = ['admin_job_runs', 'admin_audit_logs'];
      const result = {};
      for (const table of required) {
        if (!presentTables.has(table)) {
          result[table] = { present: false, total: null };
          continue;
        }
        const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
        result[table] = { present: true, total: Number(rows[0].total) };
      }
      return result;
    });
  } finally {
    await connection.end();
  }

  const markdown = renderMarkdown({
    generatedAt: startedAt.toISOString(),
    mode: 'execute',
    database: sanitizeDatabaseUrl(databaseUrl),
    checks,
  });
  writeOrPrint(markdown, options.output);

  if (checks.some((check) => check.status === 'fail')) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    help: false,
    output: null,
    envFile: null,
    databaseUrl: null,
    allowProductionTarget: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--allow-production-target') options.allowProductionTarget = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--env=')) options.envFile = arg.slice('--env='.length);
    else if (arg.startsWith('--database-url=')) options.databaseUrl = arg.slice('--database-url='.length);
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
    '  node scripts/restore-drill-verify.js --dry-run',
    '  RESTORE_DATABASE_URL=mysql://... node scripts/restore-drill-verify.js --output ../docs/evidence/restore-drill.md',
    '',
    'This script performs read-only checks against a restored staging/temp database.',
    'It refuses obvious production targets unless --allow-production-target is supplied.',
  ].join('\n');
}

function loadEnv(envFileArg) {
  const env = { ...process.env };
  if (!envFileArg) return env;
  const filePath = path.resolve(envFileArg);
  if (fs.existsSync(filePath)) Object.assign(env, readEnvFile(filePath));
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

function assertNotProductionTarget(databaseUrl, options) {
  if (options.allowProductionTarget) return;
  const lower = String(databaseUrl).toLowerCase();
  const risky = ['prod', 'production', 'myurbanai.com'].some((token) => lower.includes(token));
  if (risky) {
    throw new Error('Refusing apparent production database target. Use a staging/temp restore URL or pass --allow-production-target intentionally.');
  }
}

async function tableSet(connection) {
  const [rows] = await connection.query(
    'SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()',
  );
  return new Set(rows.map((row) => row.tableName));
}

async function columnSet(connection, table) {
  const [rows] = await connection.query(
    'SELECT column_name AS columnName FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
    [table],
  );
  return new Set(rows.map((row) => row.columnName));
}

async function runSqlCheck(checks, name, description, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    checks.push({ name, status: 'pass', description, durationMs: Date.now() - startedAt, result });
  } catch (error) {
    checks.push({ name, status: 'fail', description, durationMs: Date.now() - startedAt, error: sanitizeText(error.message || String(error)) });
  }
}

async function runValueCheck(checks, name, description, fn) {
  return runSqlCheck(checks, name, description, fn);
}

function plannedChecks() {
  return [
    { name: 'connection', status: 'planned', description: 'SELECT 1 against restored database', durationMs: 0 },
    { name: 'schema.expected_tables', status: 'planned', description: `Verify ${EXPECTED_TABLES.length} expected tables`, durationMs: 0 },
    { name: 'schema.row_counts', status: 'planned', description: 'Read COUNT(*) from core tables', durationMs: 0 },
    { name: 'schema.latest_timestamps', status: 'planned', description: 'Read latest timestamps where available', durationMs: 0 },
    { name: 'auditability.tables_nonempty', status: 'planned', description: 'Verify admin_job_runs/admin_audit_logs are readable', durationMs: 0 },
  ];
}

function renderMarkdown(evidence) {
  const passed = evidence.checks.filter((check) => check.status === 'pass').length;
  const failed = evidence.checks.filter((check) => check.status === 'fail').length;
  const planned = evidence.checks.filter((check) => check.status === 'planned').length;
  const lines = [
    '# Restore Drill Verification',
    '',
    `Generated at: ${evidence.generatedAt}`,
    `Mode: ${evidence.mode}`,
    `Database: \`${evidence.database}\``,
    '',
    '## Summary',
    '',
    `Pass: ${passed}`,
    `Fail: ${failed}`,
    `Planned: ${planned}`,
    '',
    markdownTable(
      ['Check', 'Status', 'Duration', 'Detail'],
      evidence.checks.map((check) => [
        check.name,
        check.status.toUpperCase(),
        `${check.durationMs || 0}ms`,
        check.error || check.description,
      ]),
    ),
    '',
    '## Details',
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

  lines.push('## Notes');
  lines.push('');
  lines.push('- This verifier is read-only; it does not restore, migrate or mutate data.');
  lines.push('- Use it after restoring a prod snapshot into staging or a temporary DB.');
  lines.push('- Do not paste raw database URLs into evidence; this script redacts credentials.');
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
  process.stdout.write(`Restore drill evidence written to ${outputPath}\n`);
}

function sanitizeDatabaseUrl(raw) {
  try {
    const parsed = new URL(raw);
    parsed.username = parsed.username ? '[redacted]' : '';
    parsed.password = parsed.password ? '[redacted]' : '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (_) {
    return sanitizeText(raw);
  }
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/(mysql2?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi, '$1[redacted]:[redacted]@')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [redacted]')
    .replace(/\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)=)[^\s&]+/gi, '$1[redacted]');
}

main().catch((error) => {
  process.stderr.write(`${sanitizeText(error.message || String(error))}\n`);
  process.exitCode = 1;
});
