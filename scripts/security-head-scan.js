'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const maxBytes = 5 * 1024 * 1024;
const binaryExtensions = new Set([
  '.avi', '.doc', '.docx', '.gif', '.ico', '.jpeg', '.jpg', '.mov', '.mp3',
  '.mp4', '.pdf', '.png', '.tar', '.tgz', '.wav', '.webp', '.xls', '.xlsx',
  '.zip',
]);

const contentRules = [
  ['private-key', /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,255}\b/g],
  ['github-fine-grained-token', /\bgithub_pat_[A-Za-z0-9_]{40,255}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['openai-api-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,255}\b/g],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{20,255}\b/g],
  ['stripe-live-secret', /\bsk_live_[0-9A-Za-z]{20,255}\b/g],
];

function repositoryFiles() {
  // Includes tracked files plus non-ignored additions. In CI's clean checkout
  // this is exactly the committed HEAD; locally it also protects pending files.
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean);
}

function isExampleEnv(relativePath) {
  return /(?:^|\/)\.env(?:\.[^/]+)?\.(?:example|sample|template)$/i.test(relativePath)
    || /(?:^|\/)\.env\.example$/i.test(relativePath);
}

function artifactRule(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const base = path.posix.basename(normalized);
  const extension = path.posix.extname(base).toLowerCase();

  if (/^\.env(?:\.[^/]+)?$/i.test(base) && !isExampleEnv(normalized)) {
    return 'environment-file';
  }
  if (['.pem', '.p12', '.pfx'].includes(extension)) return 'private-key-artifact';
  if (extension === '.key' && !/package-lock|yarn\.lock|pnpm-lock/i.test(base)) {
    return 'private-key-artifact';
  }
  if (['.sql', '.sqlite', '.sqlite3'].includes(extension)) return 'database-dump';
  if (extension === '.db' && /(?:dump|backup|prod|production|customer|user)/i.test(base)) {
    return 'database-dump';
  }
  if (/^(?:credentials?|service[-_]?account|secrets?)(?:\.[^.]+)?\.json$/i.test(base)) {
    return 'credential-bundle';
  }
  if (/emails?.*\.(?:csv|json|pdf|txt)$/i.test(base)) return 'pii-export';
  if (/(?:dump|backup|export).*(?:prod|production|customer|users?)/i.test(base)
    && ['.csv', '.json', '.txt', '.zip', '.gz'].includes(extension)) {
    return 'sensitive-export';
  }
  return null;
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let position = 0; position < index; position += 1) {
    if (content.charCodeAt(position) === 10) line += 1;
  }
  return line;
}

function scan() {
  const findings = [];
  const files = repositoryFiles();

  for (const relativePath of files) {
    const artifact = artifactRule(relativePath);
    if (artifact) findings.push({ file: relativePath, rule: artifact });

    const absolutePath = path.join(root, relativePath);
    let stats;
    try {
      stats = fs.statSync(absolutePath);
    } catch {
      continue;
    }
    if (!stats.isFile() || stats.size > maxBytes) continue;
    if (binaryExtensions.has(path.extname(relativePath).toLowerCase())) continue;

    const content = fs.readFileSync(absolutePath, 'utf8');
    if (content.includes('\0')) continue;
    for (const [rule, expression] of contentRules) {
      expression.lastIndex = 0;
      const match = expression.exec(content);
      if (match) {
        findings.push({
          file: relativePath,
          line: lineNumberAt(content, match.index),
          rule,
        });
      }
    }
  }

  return { files: files.length, findings };
}

function selfTest() {
  const samples = new Map([
    ['private-key', ['-----BEGIN ', 'PRIVATE KEY-----'].join('')],
    ['aws-access-key', ['AKIA', '1234567890ABCDEF'].join('')],
    ['github-token', ['ghp_', 'A'.repeat(36)].join('')],
    ['github-fine-grained-token', ['github_pat_', 'A'.repeat(50)].join('')],
    ['google-api-key', ['AIza', 'A'.repeat(35)].join('')],
    ['openai-api-key', ['sk-proj-', 'A'.repeat(40)].join('')],
    ['slack-token', ['xoxb-', 'A'.repeat(24)].join('')],
    ['stripe-live-secret', ['sk_live_', 'A'.repeat(24)].join('')],
  ]);
  const failures = [];
  for (const [rule, expression] of contentRules) {
    expression.lastIndex = 0;
    if (!expression.test(samples.get(rule))) failures.push(rule);
  }
  if (artifactRule('config/.env.production') !== 'environment-file') failures.push('environment-file');
  if (artifactRule('config/.env.production.example') !== null) failures.push('environment-example');
  if (artifactRule('private/service-account.json') !== 'credential-bundle') failures.push('credential-bundle');
  if (artifactRule('exports/export-production-users.csv') !== 'sensitive-export') failures.push('sensitive-export');
  if (failures.length > 0) {
    process.stderr.write(`Security scanner self-test failed: ${failures.join(', ')}.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Security scanner self-test passed: ${contentRules.length + 4} detector assertions.\n`);
  }
}

if (process.argv.includes('--self-test')) {
  selfTest();
  return;
}

const result = scan();
if (result.findings.length > 0) {
  process.stderr.write(`Security HEAD scan failed with ${result.findings.length} finding(s). Values are never printed.\n`);
  for (const finding of result.findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    process.stderr.write(`- ${location} [${finding.rule}]\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Security HEAD scan passed: ${result.files} repository files, no secret or sensitive-artifact findings.\n`);
}
