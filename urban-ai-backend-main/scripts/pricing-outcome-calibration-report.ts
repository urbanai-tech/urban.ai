#!/usr/bin/env ts-node

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { PricingDecisionSnapshot } from '../src/entities/pricing-decision-snapshot.entity';
import { PricingOutcomeLearningService } from '../src/knn-engine/pricing-outcome-learning.service';

type CliOptions = {
  help: boolean;
  input?: string;
  output?: string;
  allowDbRead: boolean;
  limit: number;
  minTotalTrainingRows: number;
  minRowsPerScenario: number;
  minRowsPerConfidence: number;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const service = new PricingOutcomeLearningService();
  const startedAt = new Date();

  if (!options.input && !options.allowDbRead) {
    const markdown = renderDryRunPlan(options, startedAt.toISOString());
    writeOrPrint(markdown, options.output);
    return;
  }

  const snapshots = options.input
    ? readSnapshotsFixture(options.input)
    : await readSnapshotsFromDb(options.limit);
  const rows = service.buildAbsorptionLearningDataset(snapshots);
  const summary = service.summarizeAbsorptionCalibration(rows);
  const readiness = service.evaluateCalibrationReadiness(rows, {
    minTotalTrainingRows: options.minTotalTrainingRows,
    minRowsPerScenario: options.minRowsPerScenario,
    minRowsPerConfidence: options.minRowsPerConfidence,
  });
  const calibration = service.buildProbabilityCalibration(rows, {
    minSampleSize: options.minTotalTrainingRows,
  });

  const markdown = renderReport({
    generatedAt: startedAt.toISOString(),
    source: options.input ? `fixture:${path.resolve(options.input)}` : 'database-readonly',
    limit: options.limit,
    summary,
    readiness,
    calibration,
  });
  writeOrPrint(markdown, options.output);
}

async function readSnapshotsFromDb(limit: number): Promise<Array<Partial<PricingDecisionSnapshot>>> {
  assertSafeDbRead();
  const { AppDataSource } = await import('../src/data-source');
  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(PricingDecisionSnapshot);
    return repo.find({
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(50_000, Math.round(limit))),
    });
  } finally {
    await AppDataSource.destroy();
  }
}

function readSnapshotsFixture(filePath: string): Array<Partial<PricingDecisionSnapshot>> {
  const resolved = path.resolve(filePath);
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Fixture must be a JSON array of PricingDecisionSnapshot-like objects.');
  }
  return parsed;
}

function assertSafeDbRead() {
  const runtimeEnv = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL || '';
  const blockedEnv = ['production', 'prod'].includes(runtimeEnv);
  const blockedUrl = /railway|prod|production/i.test(databaseUrl);
  if (blockedEnv || blockedUrl) {
    throw new Error(
      'Refusing DB read against production-like environment. Use a local/staging snapshot or JSON fixture.',
    );
  }
}

function renderDryRunPlan(options: CliOptions, generatedAt: string): string {
  return [
    '# Pricing Outcome Calibration Report - Dry Run',
    '',
    `Generated at: ${generatedAt}`,
    '',
    'No database connection was opened and no rows were read.',
    '',
    '## Planned Readiness Criteria',
    '',
    `- Total training rows: >= ${options.minTotalTrainingRows}`,
    `- Rows per observed scenario bucket: >= ${options.minRowsPerScenario}`,
    `- Rows per observed confidence bucket: >= ${options.minRowsPerConfidence}`,
    '',
    '## Safe Commands',
    '',
    '```bash',
    'npx ts-node -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --dry-run',
    'npx ts-node -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --input ./tmp/pricing-decision-snapshots.fixture.json --output ../docs/evidence/outcome-calibration-report.md',
    'APP_ENV=staging npx ts-node -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --allow-db-read --limit 5000 --output ../docs/evidence/outcome-calibration-report.md',
    '```',
    '',
    'DB mode is read-only by convention in this script, but it is blocked for production-like env names or URLs.',
    '',
  ].join('\n');
}

function renderReport(input: {
  generatedAt: string;
  source: string;
  limit: number;
  summary: ReturnType<PricingOutcomeLearningService['summarizeAbsorptionCalibration']>;
  readiness: ReturnType<PricingOutcomeLearningService['evaluateCalibrationReadiness']>;
  calibration: ReturnType<PricingOutcomeLearningService['buildProbabilityCalibration']>;
}): string {
  const readiness = input.readiness.ready ? 'ready' : 'not_ready';
  return [
    '# Pricing Outcome Calibration Report',
    '',
    `Generated at: ${input.generatedAt}`,
    `Source: ${input.source}`,
    `Limit: ${input.limit}`,
    `Readiness: ${readiness}`,
    '',
    '## Summary',
    '',
    `- Candidate rows: ${input.summary.candidateRows}`,
    `- Training rows: ${input.summary.trainingRows}`,
    `- Observed absorption rate: ${input.summary.observedAbsorptionRate}`,
    `- Predicted absorption rate: ${input.summary.predictedAbsorptionRate}`,
    `- Probability delta: ${input.summary.probabilityDelta}`,
    `- Brier score: ${input.summary.brierScore}`,
    `- Mean revenue delta cents: ${input.summary.meanRevenueDeltaCents ?? 'n/a'}`,
    '',
    '## Readiness Criteria',
    '',
    `- Total training rows: ${input.readiness.trainingRows}/${input.readiness.criteria.minTotalTrainingRows}`,
    `- Min rows per scenario bucket: ${input.readiness.criteria.minRowsPerScenario}`,
    `- Min rows per confidence bucket: ${input.readiness.criteria.minRowsPerConfidence}`,
    '',
    '## Gaps',
    '',
    ...(input.readiness.gaps.length ? input.readiness.gaps.map((gap) => `- ${gap}`) : ['- none']),
    '',
    '## Scenario Coverage',
    '',
    renderBucketTable(input.readiness.scenarioCoverage),
    '',
    '## Confidence Coverage',
    '',
    renderBucketTable(input.readiness.confidenceCoverage),
    '',
    '## Calibration Input',
    '',
    '```json',
    JSON.stringify(input.calibration, null, 2),
    '```',
    '',
  ].join('\n');
}

function renderBucketTable(buckets: Array<{ key: string; sampleSize: number; observedAbsorptionRate: number; predictedAbsorptionRate: number; brierScore: number }>): string {
  if (!buckets.length) return '_No training buckets._';
  return [
    '| Bucket | Sample | Observed | Predicted | Brier |',
    '|---|---:|---:|---:|---:|',
    ...buckets.map(
      (bucket) =>
        `| ${bucket.key} | ${bucket.sampleSize} | ${bucket.observedAbsorptionRate} | ${bucket.predictedAbsorptionRate} | ${bucket.brierScore} |`,
    ),
  ].join('\n');
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    allowDbRead: false,
    limit: 5000,
    minTotalTrainingRows: 60,
    minRowsPerScenario: 20,
    minRowsPerConfidence: 20,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') {
      // Dry-run is the default when neither --input nor --allow-db-read is provided.
    } else if (arg === '--allow-db-read') options.allowDbRead = true;
    else if (arg === '--input') options.input = requireValue(arg, next, () => index += 1);
    else if (arg === '--output') options.output = requireValue(arg, next, () => index += 1);
    else if (arg === '--limit') options.limit = numberArg(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--min-total') options.minTotalTrainingRows = numberArg(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--min-scenario') options.minRowsPerScenario = numberArg(arg, requireValue(arg, next, () => index += 1));
    else if (arg === '--min-confidence') options.minRowsPerConfidence = numberArg(arg, requireValue(arg, next, () => index += 1));
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function requireValue(flag: string, value: string | undefined, advance: () => void): string {
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  advance();
  return value;
}

function numberArg(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function writeOrPrint(markdown: string, output?: string) {
  if (!output) {
    process.stdout.write(markdown);
    return;
  }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(path.resolve(output), markdown, 'utf8');
}

function usage(): string {
  return [
    'Usage: ts-node -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts [options]',
    '',
    'Options:',
    '  --dry-run             Print planned checks without opening DB (default)',
    '  --input <json>        Read PricingDecisionSnapshot-like rows from a JSON fixture',
    '  --allow-db-read       Read snapshots from configured non-production DB',
    '  --limit <n>           Max snapshots to read in DB mode (default: 5000)',
    '  --min-total <n>       Minimum total training rows (default: 60)',
    '  --min-scenario <n>    Minimum rows per observed scenario bucket (default: 20)',
    '  --min-confidence <n>  Minimum rows per observed confidence bucket (default: 20)',
    '  --output <file>       Write Markdown report to file',
  ].join('\n');
}

main().catch((error) => {
  process.stderr.write(`[pricing-outcome-calibration-report] ${(error as Error).message}\n`);
  process.exitCode = 1;
});
