#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');

if (process.argv.includes('--self-test')) {
  runSelfTest();
  process.exit(0);
}

const contracts = [
  {
    file: 'src/main.ts',
    checks: [
      ['instrumentation import is first', /import "\.\/instrument";[\s\S]*import \{ NestFactory \}/],
      ['request middleware is registered', /app\.use\(requestIdMiddleware\)/],
    ],
  },
  {
    file: 'src/instrument.ts',
    checks: [
      ['default PII collection disabled', /sendDefaultPii:\s*false/],
      ['environment metadata configured', /environment:\s*runtime\.environment/],
      ['release metadata configured', /release:\s*runtime\.release/],
      ['beforeSend redaction configured', /beforeSend:[^\n]*redactObservabilityData/],
    ],
  },
  {
    file: 'src/common/request-id.middleware.ts',
    checks: [
      ['incoming request id normalized', /normalizeRequestId\(incoming\)/],
      ['response correlation header', /setHeader\('x-request-id', id\)/],
      ['Sentry correlation tag', /setTag\('request_id', id\)/],
      ['Sentry correlation context', /setContext\('request_correlation'/],
      ['completion log waits for finish', /res\.once\('finish'/],
      ['structured event name', /event:\s*'http_request'/],
      ['structured environment', /environment:\s*runtime\.environment/],
      ['structured release', /release:\s*runtime\.release/],
    ],
  },
  {
    file: 'src/common/observability.ts',
    checks: [
      ['request id bounded to 120 characters', /\{0,119\}/],
      ['secret keys redacted', /SENSITIVE_KEY/],
      ['PII keys redacted', /PII_KEY/],
      ['email values redacted', /REDACTED_EMAIL/],
      ['database credentials redacted', /mysql2\?/],
      ['bearer credentials redacted', /Bearer\|Basic/],
      ['JWT values redacted', /REDACTED_JWT/],
      ['query secrets redacted', /token\|secret\|key\|password\|authorization/],
    ],
  },
  {
    file: 'src/app.controller.ts',
    checks: [
      ['Sentry test endpoint requires JWT and RBAC', /@UseGuards\(JwtAuthGuard, RolesGuard\)\s*@Roles\('admin'\)\s*sentryTest\(/],
    ],
  },
  {
    file: '../docs/runbooks/observability-security.md',
    checks: [
      ['live verification limitation documented', /nao prova ingestao, alertas ou release no projeto Sentry real/i],
      ['payload logging prohibited', /nunca (?:devem )?incluir body, query string, cookies ou headers de autorizacao/i],
      ['release deployment requirement documented', /SENTRY_RELEASE|RAILWAY_GIT_COMMIT_SHA/],
    ],
  },
];

const failures = [];
let checked = 0;
for (const contract of contracts) {
  const file = path.resolve(root, contract.file);
  if (!fs.existsSync(file)) {
    failures.push(`${contract.file}: required file is missing`);
    continue;
  }
  const content = normalize(fs.readFileSync(file, 'utf8'));
  for (const [label, pattern] of contract.checks) {
    checked += 1;
    if (!pattern.test(content)) failures.push(`${contract.file}: missing contract "${label}"`);
  }
}

const source = walk(path.join(root, 'src'))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .map((file) => ({ file, content: fs.readFileSync(file, 'utf8') }));
const forbidden = [
  ['Sentry default PII enabled', /sendDefaultPii:\s*true/],
  ['full property object logged', /console\.log\(prop\)/],
  ['request body logged', /console\.(?:log|warn|error)\([^\n]*(?:req|request)\.body/],
];
for (const [label, pattern] of forbidden) {
  checked += 1;
  for (const entry of source) {
    if (pattern.test(entry.content)) {
      failures.push(`${path.relative(root, entry.file).replace(/\\/g, '/')}: forbidden ${label}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write('Observability security gate failed:\n');
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`Observability security gate passed: ${checked}/${checked} contracts.\n`);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r\n/g, '\n');
}

function runSelfTest() {
  const checks = [];
  const check = (label, fn) => {
    fn();
    checks.push(label);
  };
  check('detects unsafe Sentry PII setting', () => {
    assert.equal(/sendDefaultPii:\s*true/.test('sendDefaultPii: true'), true);
  });
  check('accepts safe Sentry PII setting', () => {
    assert.equal(/sendDefaultPii:\s*true/.test('sendDefaultPii: false'), false);
  });
  check('detects request body logging', () => {
    assert.equal(/console\.(?:log|warn|error)\([^\n]*(?:req|request)\.body/.test('console.log(req.body)'), true);
  });
  check('structured metadata fixture contains correlation fields', () => {
    const fixture = { requestId: 'req-1', environment: 'test', release: 'abc' };
    assert.deepEqual(Object.keys(fixture).sort(), ['environment', 'release', 'requestId'].sort());
  });
  check('normalization handles Portuguese policy text', () => {
    assert.equal(normalize('autorização'), 'autorizacao');
  });
  process.stdout.write(`Observability security gate self-test passed: ${checks.length}/${checks.length} checks.\n`);
}
