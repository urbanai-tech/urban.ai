#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SELF = 'scripts/knn-legacy-dependency-gate.js';
const LEGACY_ROOT = 'urban-ai-knn-main/';
const TEXT_EXTENSIONS = new Set([
  '.cjs', '.js', '.json', '.jsx', '.mjs', '.py', '.sh', '.ts', '.tsx',
  '.yaml', '.yml', '.toml', '.ini', '.env', '.example', '.dockerfile',
]);
const ROOT_CONFIGS = new Set([
  'Dockerfile', 'Procfile', 'package.json', 'railway.json', 'railway.toml',
  'compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml',
]);
const EXECUTABLE_ROOTS = [
  '.github/', 'scripts/', 'Urban-front-main/', 'dashboard/',
  'urban-ai-backend-main/', 'urban-pipeline-main/', 'urban-webscraping-main/',
];
const RULES = [
  {
    id: 'legacy-service-path',
    pattern: /\burban-ai-knn-main\b/i,
    reason: 'reference to the standalone legacy service directory',
  },
  {
    id: 'legacy-http-endpoint',
    pattern: /\/api\/pricing\/suggest\b/i,
    reason: 'reference to the standalone pricing endpoint',
  },
  {
    id: 'legacy-service-env',
    pattern: /\b(?:KNN_(?:URL|BASE_URL|API_URL|SERVICE_URL|HOST|ENDPOINT)|URBAN_KNN_URL)\b/i,
    reason: 'environment variable that can reconnect the standalone service',
  },
  {
    id: 'legacy-package-dependency',
    pattern: /["']urban-ai-knn["']/i,
    reason: 'package dependency on the standalone legacy implementation',
  },
  {
    id: 'legacy-deploy-target',
    pattern: /(?:railway\s+(?:up|deploy)|--service|service\s*:|image\s*:|working-directory\s*:)[^\n]{0,80}\b(?:urban-ai-knn(?:-main)?|knn[-_](?:service|legacy))\b/i,
    reason: 'deployment configuration that targets a standalone KNN service',
  },
  {
    id: 'legacy-service-url',
    pattern: /https?:\/\/[^\s"'`]*knn[^\s"'`]*/i,
    reason: 'HTTP URL that appears to target a KNN service',
  },
];

function normalize(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isExecutableSurface(file) {
  const normalized = normalize(file);
  if (normalized === SELF || normalized.startsWith(LEGACY_ROOT)) return false;
  if (/(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|uv\.lock)$/.test(normalized)) return false;
  if (!EXECUTABLE_ROOTS.some((prefix) => normalized.startsWith(prefix)) && !ROOT_CONFIGS.has(normalized)) {
    return false;
  }
  const basename = path.posix.basename(normalized);
  if (ROOT_CONFIGS.has(basename)) return true;
  return TEXT_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase());
}

function isAllowedMaintenanceReference(file, line, ruleId) {
  if (!['legacy-service-path', 'legacy-deploy-target'].includes(ruleId)
      || file !== '.github/workflows/ci.yml') return false;
  const trimmed = line.trim();
  return trimmed === 'urban-ai-knn-main/package-lock.json'
    || trimmed === 'working-directory: urban-ai-knn-main';
}

function scanFile(file, content) {
  if (!isExecutableSurface(file)) return [];
  const findings = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const rule of RULES) {
      if (rule.pattern.test(line) && !isAllowedMaintenanceReference(file, line, rule.id)) {
        findings.push({ file, line: index + 1, rule: rule.id, reason: rule.reason });
      }
    }
  }
  return findings;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function listFiles(source) {
  const output = source === 'head'
    ? git(['ls-tree', '-r', '--name-only', 'HEAD'])
    : git(['ls-files', '--cached', '--others', '--exclude-standard']);
  return output ? output.split(/\r?\n/).map(normalize) : [];
}

function readFile(file, source) {
  try {
    return source === 'head'
      ? execFileSync('git', ['show', `HEAD:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
      : fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return null;
  }
}

function runGate(source) {
  if (source === 'head') return runHeadGate();
  const files = listFiles(source);
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    if (!isExecutableSurface(file)) continue;
    const content = readFile(file, source);
    if (content === null) continue;
    scanned += 1;
    findings.push(...scanFile(file, content));
  }
  const result = { source, scannedFiles: scanned, findings };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (findings.length) process.exitCode = 1;
}

function runHeadGate() {
  const candidateFiles = listFiles('head').filter(isExecutableSurface).length;
  const grepPattern = 'urban-ai-knn|knn[-_](service|legacy)|/api/pricing/suggest|KNN_(URL|BASE_URL|API_URL|SERVICE_URL|HOST|ENDPOINT)|URBAN_KNN_URL|https?://[^[:space:]"' + "'" + '`]*knn';
  const grep = spawnSync(
    'git',
    ['grep', '-I', '-n', '-i', '-E', grepPattern, 'HEAD'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  if (![0, 1].includes(grep.status)) {
    throw new Error(`git grep failed: ${grep.stderr || `exit ${grep.status}`}`);
  }

  const findings = [];
  const scannedFiles = new Set();
  for (const match of (grep.stdout || '').split(/\r?\n/)) {
    if (!match) continue;
    const parsed = /^HEAD:(.*?):(\d+):(.*)$/.exec(match);
    if (!parsed) continue;
    const [, rawFile, lineNumber, line] = parsed;
    const file = normalize(rawFile);
    if (!isExecutableSurface(file)) continue;
    scannedFiles.add(file);
    for (const finding of scanFile(file, line)) {
      findings.push({ ...finding, line: Number(lineNumber) });
    }
  }

  const result = {
    source: 'head',
    candidateFiles,
    matchedExecutableFiles: scannedFiles.size,
    findings,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (findings.length) process.exitCode = 1;
  return result;
}

function runSelfTest() {
  const cases = [
    ['embedded backend engine remains allowed', 'urban-ai-backend-main/src/app.ts', "import '../knn-engine/pricing-engine';", 0],
    ['standalone directory dependency is blocked', 'urban-ai-backend-main/src/app.ts', "require('../../urban-ai-knn-main/pricing-engine')", 1],
    ['legacy endpoint is blocked', 'Urban-front-main/src/api.ts', "fetch('/api/pricing/suggest')", 1],
    ['legacy service env is blocked', 'urban-ai-backend-main/src/config.ts', 'process.env.KNN_SERVICE_URL', 1],
    ['legacy package dependency is blocked', 'urban-ai-backend-main/package.json', '"urban-ai-knn": "1.0.0"', 1],
    ['CI maintenance working directory is allowed', '.github/workflows/ci.yml', 'working-directory: urban-ai-knn-main', 0],
    ['CI deployment command is blocked', '.github/workflows/deploy.yml', 'railway up --service urban-ai-knn-main', 2],
    ['alternate deployment target is blocked', '.github/workflows/deploy.yml', 'railway deploy --service knn-legacy', 1],
    ['legacy source itself is outside the consumer boundary', 'urban-ai-knn-main/server.js', "app.post('/api/pricing/suggest')", 0],
  ];
  let passed = 0;
  for (const [name, file, content, expected] of cases) {
    const actual = scanFile(file, content).length;
    if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
    passed += 1;
  }
  process.stdout.write(`KNN legacy dependency gate self-test: ${passed}/${cases.length} passed\n`);
}

if (process.argv.includes('--self-test')) runSelfTest();
else runGate(process.argv.includes('--head') ? 'head' : 'worktree');
