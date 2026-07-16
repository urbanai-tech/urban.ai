#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const TRACKER = path.join(__dirname, 'scheduled-jobs-tracker.json');
const EXPECTED_JOB_COUNT = 21;
const IDEMPOTENCY_STATUSES = new Set(['protected', 'read-only', 'review-required']);
const TRACKING_STATUSES = new Set(['tracked', 'gap-reviewed']);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function decorators(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}

function literal(node, sourceFile) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return node.getText(sourceFile);
}

function objectOptions(node, sourceFile) {
  const result = {};
  if (!node || !ts.isObjectLiteralExpression(node)) return result;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = property.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
    result[key] = literal(property.initializer, sourceFile);
  }
  return result;
}

function collectCronJobs(sourceFiles) {
  const jobs = [];
  for (const [file, text] of sourceFiles) {
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement)) continue;
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        for (const decorator of decorators(member)) {
          if (!ts.isCallExpression(decorator.expression)) continue;
          const call = decorator.expression;
          if (call.expression.getText(sourceFile) !== 'Cron') continue;
          const options = objectOptions(call.arguments[1], sourceFile);
          jobs.push({
            file: file.replace(/\\/g, '/'),
            method: member.name.getText(sourceFile),
            className: statement.name?.text || '(anonymous)',
            line: sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1,
            expression: literal(call.arguments[0], sourceFile),
            name: typeof options.name === 'string' ? options.name : null,
            timeZone: typeof options.timeZone === 'string' ? options.timeZone : null,
            waitForCompletion: options.waitForCompletion === true,
            body: member.body?.getText(sourceFile) || '',
            source: text,
          });
        }
      }
    }
  }
  return jobs;
}

function hasAdminJobRunTracking(job) {
  return /\b(?:runCronWithTracking|runScheduledJob(?:OncePerWindow)?|runOncePerWindow)\s*\(/.test(job.body);
}

function audit(sourceFiles, tracker, options = {}) {
  const jobs = collectCronJobs(sourceFiles);
  const sourceByFile = new Map(sourceFiles);
  const findings = [];
  const reviewedGaps = [];
  const strict = Boolean(options.strict);
  const jobKeys = new Set(jobs.map((job) => `${job.file}#${job.method}`));
  const trackerKeys = new Set(tracker.map((entry) => `${entry.file}#${entry.method}`));

  if (jobs.length !== EXPECTED_JOB_COUNT) {
    findings.push(`inventory: expected ${EXPECTED_JOB_COUNT} cron jobs, found ${jobs.length}`);
  }

  const seenNames = new Map();
  for (const job of jobs) {
    const key = `${job.file}#${job.method}`;
    if (!job.name) findings.push(`${key}: missing explicit cron name`);
    if (!job.timeZone) findings.push(`${key}: missing explicit timeZone`);
    if (!job.waitForCompletion) findings.push(`${key}: missing waitForCompletion=true overlap guard`);
    if (job.name) {
      const previous = seenNames.get(job.name);
      if (previous) findings.push(`${key}: duplicate cron name "${job.name}" also used by ${previous}`);
      seenNames.set(job.name, key);
    }
    if (!trackerKeys.has(key)) findings.push(`${key}: missing tracker entry`);
  }

  for (const entry of tracker) {
    const key = `${entry.file}#${entry.method}`;
    if (!jobKeys.has(key)) {
      findings.push(`${key}: stale tracker entry`);
      continue;
    }
    const job = jobs.find((candidate) => `${candidate.file}#${candidate.method}` === key);
    if (entry.name !== job.name) findings.push(`${key}: tracker name does not match decorator`);
    if (entry.timeZone !== job.timeZone) findings.push(`${key}: tracker timeZone does not match decorator`);
    if (!TRACKING_STATUSES.has(entry.adminJobRun)) findings.push(`${key}: invalid AdminJobRun status`);
    if (!IDEMPOTENCY_STATUSES.has(entry.idempotency?.status)) findings.push(`${key}: invalid idempotency status`);
    if (!entry.idempotency?.strategy) findings.push(`${key}: missing idempotency strategy`);
    if (!entry.idempotency?.evidencePattern) {
      findings.push(`${key}: missing idempotency evidence pattern`);
    } else {
      try {
        const evidenceFile = entry.idempotency.evidenceFile || entry.file;
        const evidenceSource = sourceByFile.get(evidenceFile);
        if (typeof evidenceSource !== 'string') {
          findings.push(`${key}: idempotency evidence file not found (${evidenceFile})`);
        } else if (!new RegExp(entry.idempotency.evidencePattern).test(evidenceSource)) {
          findings.push(`${key}: idempotency evidence pattern not found`);
        }
      } catch (error) {
        findings.push(`${key}: invalid idempotency evidence regex (${error.message})`);
      }
    }

    const detectedTracking = hasAdminJobRunTracking(job);
    if (entry.adminJobRun === 'tracked' && !detectedTracking) {
      findings.push(`${key}: tracker claims AdminJobRun but handler has no tracking wrapper`);
    }
    if (entry.adminJobRun === 'gap-reviewed' && detectedTracking) {
      findings.push(`${key}: stale AdminJobRun gap; tracking wrapper is now present`);
    }
    if (entry.adminJobRun === 'gap-reviewed') reviewedGaps.push(`${key}: AdminJobRun gap`);
    if (entry.idempotency?.status === 'review-required') reviewedGaps.push(`${key}: idempotency review`);
  }

  if (strict) findings.push(...reviewedGaps.map((gap) => `strict: ${gap}`));
  return { jobs, findings, reviewedGaps };
}

function fixture(file, source) {
  return [[file, source]];
}

function runSelfTest() {
  const goodSource = `
    import { Cron } from '@nestjs/schedule';
    class Fixture {
      @Cron('0 * * * *', { name: 'fixture', timeZone: 'UTC', waitForCompletion: true })
      async tick() { return runScheduledJob(this.runner, 'fixture', async () => this.pendingOnly()); }
      pendingOnly() {}
    }
  `;
  const tracker = [{
    file: 'fixture.ts', method: 'tick', name: 'fixture', timeZone: 'UTC', adminJobRun: 'tracked',
    idempotency: { status: 'protected', strategy: 'pending-only', evidencePattern: 'pendingOnly' },
  }];
  const checks = [];
  const check = (name, fn) => { fn(); checks.push(name); };

  check('accepts a fully controlled job', () => {
    const result = audit(fixture('fixture.ts', goodSource), tracker, { expectedCount: 1 });
    assert.equal(result.findings.filter((item) => !item.startsWith('inventory:')).length, 0);
  });
  check('detects missing timezone', () => {
    const source = goodSource.replace("timeZone: 'UTC', ", '');
    assert.ok(audit(fixture('fixture.ts', source), tracker).findings.some((item) => item.includes('timeZone')));
  });
  check('detects overlap regression', () => {
    const source = goodSource.replace('waitForCompletion: true', 'waitForCompletion: false');
    assert.ok(audit(fixture('fixture.ts', source), tracker).findings.some((item) => item.includes('overlap guard')));
  });
  check('detects missing AdminJobRun wrapper', () => {
    const source = goodSource.replace("return runScheduledJob(this.runner, 'fixture', async () => this.pendingOnly());", 'return this.pendingOnly();');
    assert.ok(audit(fixture('fixture.ts', source), tracker).findings.some((item) => item.includes('no tracking wrapper')));
  });
  check('detects stale tracker location', () => {
    const stale = [{ ...tracker[0], method: 'oldTick' }];
    assert.ok(audit(fixture('fixture.ts', goodSource), stale).findings.some((item) => item.includes('stale tracker')));
  });
  check('detects duplicate cron names', () => {
    const source = goodSource.replace('\n    }\n  ', `
      @Cron('5 * * * *', { name: 'fixture', timeZone: 'UTC', waitForCompletion: true })
      async tickTwo() { return runScheduledJob(this.runner, 'fixture', async () => this.pendingOnly()); }
    }
  `);
    assert.ok(audit(fixture('fixture.ts', source), tracker).findings.some((item) => item.includes('duplicate cron name')));
  });
  check('strict mode promotes reviewed gaps', () => {
    const reviewed = [{ ...tracker[0], adminJobRun: 'gap-reviewed', idempotency: { ...tracker[0].idempotency, status: 'review-required' } }];
    const source = goodSource.replace("return runScheduledJob(this.runner, 'fixture', async () => this.pendingOnly());", 'return this.pendingOnly();');
    assert.ok(audit(fixture('fixture.ts', source), reviewed, { strict: true }).findings.some((item) => item.startsWith('strict:')));
  });
  check('accepts evidence from an explicitly referenced implementation file', () => {
    const externalEvidence = [{
      ...tracker[0],
      idempotency: { ...tracker[0].idempotency, evidenceFile: 'claim.ts', evidencePattern: 'durableClaim' },
    }];
    const result = audit([...fixture('fixture.ts', goodSource), ['claim.ts', 'const durableClaim = true;']], externalEvidence);
    assert.ok(!result.findings.some((item) => item.includes('idempotency evidence')));
  });

  process.stdout.write(`Scheduled jobs gate self-test passed: ${checks.length}/${checks.length} detectors.\n`);
}

function main() {
  if (process.argv.includes('--self-test')) return runSelfTest();
  const sourceFiles = walk(SRC)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => [path.relative(ROOT, file).replace(/\\/g, '/'), fs.readFileSync(file, 'utf8')]);
  const tracker = JSON.parse(fs.readFileSync(TRACKER, 'utf8'));
  const result = audit(sourceFiles, tracker, { strict: process.argv.includes('--strict') });

  if (result.findings.length) {
    process.stderr.write('Scheduled jobs gate failed:\n');
    result.findings.forEach((finding) => process.stderr.write(`- ${finding}\n`));
    process.exitCode = 1;
    return;
  }

  const tracked = result.jobs.filter(hasAdminJobRunTracking).length;
  const idempotencyProtected = tracker.filter((entry) => entry.idempotency.status !== 'review-required').length;
  process.stdout.write(
    `Scheduled jobs gate passed: ${result.jobs.length}/${EXPECTED_JOB_COUNT} inventoried, ` +
      `${result.jobs.length}/${result.jobs.length} timezone+overlap controlled, ` +
      `${tracked}/${result.jobs.length} AdminJobRun tracked, ` +
      `${idempotencyProtected}/${result.jobs.length} idempotency classified safe.\n`,
  );
  if (result.reviewedGaps.length) {
    process.stdout.write(`Reviewed gaps (${result.reviewedGaps.length}):\n`);
    result.reviewedGaps.forEach((gap) => process.stdout.write(`- ${gap}\n`));
  }
}

main();
