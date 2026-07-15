'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rules = [
  ['sql-export', /(?:^|\/)(?:inserts?|extract)[^/]*\.(?:sql|py)$/i],
  ['database-dump', /(?:^|\/)(?:.*(?:dump|backup).*)?[^/]*\.sql$/i],
  ['pii-export', /(?:^|\/).*emails?[^/]*\.(?:csv|json|pdf|sql|txt|xlsx)$/i],
  ['credential-source', /(?:^|\/)(?:credentials?|secrets?)\.(?:js|json|py|ts)$/i],
  ['environment-file', /(?:^|\/)\.env(?:\.[^/]+)?$/i],
  ['private-key-artifact', /(?:^|\/)[^/]*\.(?:key|p12|pem|pfx)$/i],
];

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function classify(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (/(?:^|\/)\.env(?:\.[^/]+)?\.(?:example|sample|template)$/i.test(normalized)) {
    return null;
  }
  for (const [rule, expression] of rules) {
    if (expression.test(normalized)) return rule;
  }
  return null;
}

function audit() {
  const objects = git(['rev-list', '--objects', '--all']);
  const findings = [];
  const seen = new Set();

  for (const line of objects.split(/\r?\n/)) {
    const separator = line.indexOf(' ');
    if (separator < 0) continue;
    const object = line.slice(0, separator);
    const filePath = line.slice(separator + 1).trim();
    const rule = classify(filePath);
    const key = `${object}\0${filePath}`;
    if (!rule || seen.has(key)) continue;
    seen.add(key);
    findings.push({ object, path: filePath.replace(/\\/g, '/'), rule });
  }

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.object.localeCompare(b.object));
  return findings;
}

function selfTest() {
  const cases = [
    ['docs/prod-dump.sql', 'database-dump'],
    ['docs/inserts-only.sql', 'sql-export'],
    ['docs/Emails Urban AI.pdf', 'pii-export'],
    ['config/credentials.py', 'credential-source'],
    ['service/.env.production', 'environment-file'],
    ['keys/signing.pem', 'private-key-artifact'],
    ['docs/architecture.md', null],
    ['service/.env.example', null],
  ];
  const failures = cases.filter(([sample, expected]) => classify(sample) !== expected);
  if (failures.length) {
    process.stderr.write(`Sensitive history self-test failed: ${failures.length} case(s).\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Sensitive history self-test passed: ${cases.length} assertions.\n`);
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const findings = audit();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ findings }, null, 2)}\n`);
  } else if (!findings.length) {
    process.stdout.write('Sensitive history audit passed: no matching historical path found.\n');
  } else {
    process.stdout.write(
      `Sensitive history audit found ${findings.length} historical object/path reference(s). Content was not read.\n`,
    );
    for (const finding of findings) {
      process.stdout.write(`- ${finding.path} [${finding.rule}] object=${finding.object}\n`);
    }
  }
  if (findings.length && process.argv.includes('--strict')) process.exitCode = 1;
}
