#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const selfTest = process.argv.includes('--self-test');

const contracts = [
  {
    file: '.github/workflows/backup-db.yml',
    checks: [
      ['scheduled backup', /schedule:\s*[\s\S]*?cron:/i],
      ['manual dispatch', /workflow_dispatch:/i],
      ['single backup concurrency group', /group:\s*backup-mysql/i],
      ['running backup is never cancelled', /cancel-in-progress:\s*false/i],
      ['scheduled runs restricted to canonical repository', /github\.event_name\s*==\s*'workflow_dispatch'[\s\S]*github\.repository\s*==\s*'urbanai-tech\/urban\.ai'/i],
      ['bounded timeout', /timeout-minutes:\s*60/i],
      ['database secret preflight', /DATABASE_URL secret[^\n]*configurado/i],
      ['password masking', /::add-mask::[^\n]*db_pass/i],
      ['transaction-safe dump', /--single-transaction/i],
      ['routines included', /--routines/i],
      ['triggers included', /--triggers/i],
      ['events included', /--events/i],
      ['pipeline fails closed', /set -euo pipefail/i],
      ['gzip integrity', /gzip -t "\$BACKUP_FILE"/i],
      ['minimum byte threshold', /BACKUP_MIN_BYTES/i],
      ['minimum table threshold', /BACKUP_MIN_TABLES/i],
      ['schema content validation', /CREATE TABLE/i],
      ['checksum generation', /sha256sum "\$BACKUP_FILE"/i],
      ['S3 off-site destination', /aws s3 cp "\$BACKUP_FILE"/i],
      ['B2 off-site destination', /b2 upload-file/i],
      ['failure notification', /if:\s*\$\{\{ failure\(\)/i],
    ],
  },
  {
    file: '.github/workflows/restore-drill.yml',
    checks: [
      ['restore drill uses the declared 24-hour RPO by default', /MAX_BACKUP_AGE_HOURS:[^\n]*'24'/i],
      ['off-site encryption is verified', /get-bucket-encryption/i],
      ['supported server-side encryption is enforced', /AES256[\s\S]*aws:kms/i],
      ['off-site versioning is observed', /get-bucket-versioning/i],
      ['empty versioning status is normalized', /VERSIONING_STATUS="not-enabled"/i],
      ['checkout uses the Node 24 action runtime', /actions\/checkout@v6/i],
      ['artifact upload uses the Node 24 action runtime', /actions\/upload-artifact@v6/i],
      ['off-site lifecycle is observed', /get-bucket-lifecycle-configuration/i],
      ['restore evidence records encryption', /Off-site server-side encryption/i],
      ['restore evidence records versioning', /Off-site bucket versioning/i],
      ['restore evidence records lifecycle controls', /Off-site lifecycle rules detected/i],
    ],
  },
  {
    file: 'urban-ai-backend-main/scripts/mysql-backup.js',
    checks: [
      ['safe mode is default', /const dryRun = !args\.execute/],
      ['mutation requires explicit execute flag', /--execute/],
      ['dry-run exits before run', /if \(dryRun\)[\s\S]*process\.exit\(0\)[\s\S]*run\(plan/],
      ['credentials are redacted', /MYSQL_PWD=<redacted>/],
      ['backup self-test exists', /function runSelfTest\(\)/],
      ['mysqldump uses direct spawn', /spawn\('mysqldump', plan\.dumpArgs/],
    ],
  },
  {
    file: 'urban-ai-backend-main/scripts/restore-drill-verify.js',
    checks: [
      ['restore verifier self-test exists', /function runSelfTest\(\)/],
      ['production target guard exists', /assertNotProductionTarget\(databaseUrl, options\)/],
      ['production override is explicit', /--allow-production-target/],
      ['evidence redacts database credentials', /sanitizeDatabaseUrl/],
      ['restore verifier is documented read-only', /This verifier is read-only/],
      ['audit tables are verified', /auditability\.tables_nonempty/],
    ],
    sqlReadOnly: true,
  },
  {
    file: 'docs/runbooks/backup-restore.md',
    checks: [
      ['restore is exercised outside production first', /staging|temporari/i],
      ['RPO is defined', /\bRPO\b/i],
      ['RTO is defined', /\bRTO\b/i],
      ['evidence is required', /docs\/evidence/i],
      ['postmortem is required', /postmortem/i],
      ['automatic migrations disabled on first restore boot', /MIGRATIONS_RUN=false/i],
      ['real drill remains explicit', /primeiro drill real/i],
    ],
  },
  {
    file: 'docs/runbooks/disaster-recovery.md',
    checks: [
      ['off-site recovery source', /S3|B2/i],
      ['native snapshot recovery source', /Railway/i],
      ['compressed dump integrity check', /gzip -t/i],
      ['checksum comparison', /sha256/i],
      ['migrations disabled for first boot', /MIGRATIONS_RUN=false/i],
      ['restore verifier is required', /restore-drill-verify\.js/i],
      ['RPO is declared', /\bRPO\b/i],
      ['RTO is declared', /\bRTO\b/i],
    ],
  },
  {
    file: 'docs/runbooks/release-gate.md',
    checks: [
      ['minimum rollback is documented', /Rollback minimo/i],
      ['database rollback requires backup', /Banco:[^\n]*backup/i],
      ['destructive rollback is prohibited', /nao rodar rollback destrutivo/i],
      ['release decision is recorded', /aprovado, bloqueado ou rollback/i],
    ],
  },
  {
    file: 'docs/runbooks/migrations-cutover.md',
    checks: [
      ['recent backup prerequisite', /Backup recente/i],
      ['manual dump prerequisite', /Dump manual/i],
      ['migration revert command', /npm run migration:revert/i],
      ['migration auto-run can be disabled', /MIGRATIONS_RUN=false/i],
      ['snapshot restore fallback', /restaurar snapshot/i],
    ],
  },
  {
    file: 'docs/runbooks/staging-release-drill.md',
    checks: [
      ['rollback owner is assigned', /Responsavel[^\n]*rollback/i],
      ['backup restore runbook is linked', /backup-restore\.md/i],
      ['rollback decision is recorded', /aprovado\/bloqueado\/rollback/i],
      ['destructive migration blocks release', /migration tem risco destrutivo sem backup/i],
    ],
  },
  {
    file: 'docs/runbooks/incident-response/db-down.md',
    checks: [
      ['emergency restore points to canonical runbook', /backup-restore\.md/i],
      ['current state snapshot required before restore', /Restaurar backup sem snapshot do estado atual/i],
      ['forensic preservation is explicit', /forensic/i],
    ],
  },
];

if (selfTest) {
  runSelfTest();
  process.exit(0);
}

const failures = [];
let checked = 0;
let sqlQueries = 0;

for (const contract of contracts) {
  const absolute = path.join(root, contract.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`${contract.file}: required file is missing`);
    continue;
  }

  const content = normalize(fs.readFileSync(absolute, 'utf8'));
  for (const [label, pattern] of contract.checks) {
    checked += 1;
    if (!pattern.test(content)) failures.push(`${contract.file}: missing contract "${label}"`);
  }

  if (contract.sqlReadOnly) {
    const queries = extractConnectionQueries(content);
    checked += 1;
    sqlQueries += queries.length;
    if (queries.length === 0) {
      failures.push(`${contract.file}: no SQL queries found for read-only audit`);
    } else {
      const mutations = queries.filter((query) => !/^\s*SELECT\b/i.test(query));
      if (mutations.length > 0) {
        failures.push(`${contract.file}: restore verifier contains non-SELECT SQL`);
      }
    }
  }
}

if (failures.length > 0) {
  process.stderr.write('Resilience/DR gate failed:\n');
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  `Resilience/DR gate passed: ${checked}/${checked} contracts across ${contracts.length} files; ` +
    `${sqlQueries} restore queries verified read-only.\n`,
);

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r\n/g, '\n');
}

function extractConnectionQueries(content) {
  const queries = [];
  const pattern = /connection\.query\(\s*([`'"])([\s\S]*?)\1/g;
  let match;
  while ((match = pattern.exec(content)) !== null) queries.push(match[2]);
  return queries;
}

function runSelfTest() {
  const checks = [];
  const check = (name, fn) => {
    fn();
    checks.push(name);
  };

  check('normalization removes accents and CRLF drift', () => {
    assert.equal(normalize('Restauração\r\n'), 'Restauracao\n');
  });

  check('contract patterns fail closed', () => {
    const pattern = /cancel-in-progress:\s*false/i;
    assert.equal(pattern.test('cancel-in-progress: false'), true);
    assert.equal(pattern.test('cancel-in-progress: true'), false);
  });

  check('SQL extractor accepts read-only queries', () => {
    const queries = extractConnectionQueries("connection.query('SELECT 1')");
    assert.deepEqual(queries, ['SELECT 1']);
    assert.equal(queries.every((query) => /^\s*SELECT\b/i.test(query)), true);
  });

  check('SQL extractor exposes mutating queries', () => {
    const queries = extractConnectionQueries('connection.query(`DELETE FROM user`)');
    assert.equal(queries.every((query) => /^\s*SELECT\b/i.test(query)), false);
  });

  check('workflow safety fixture requires integrity and concurrency', () => {
    const fixture = 'group: backup-mysql\ncancel-in-progress: false\ngzip -t "$BACKUP_FILE"\n';
    assert.match(fixture, /group:\s*backup-mysql/i);
    assert.match(fixture, /cancel-in-progress:\s*false/i);
    assert.match(fixture, /gzip -t "\$BACKUP_FILE"/i);
  });

  process.stdout.write(`Resilience/DR gate self-test passed: ${checks.length}/${checks.length} checks.\n`);
}
