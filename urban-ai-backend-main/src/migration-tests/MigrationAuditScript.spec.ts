import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const auditScript = resolve(__dirname, '../../scripts/audit-migrations.js');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'urban-ai-migration-audit-'));
  mkdirSync(join(root, 'src', 'entities'), { recursive: true });
  mkdirSync(join(root, 'src', 'migrations'), { recursive: true });
  writeFileSync(
    join(root, 'src', 'entities', 'example.entity.ts'),
    "@Entity('examples')\nexport class Example {}\n",
  );
  return root;
}

function migration(root: string, name: string, body: string) {
  writeFileSync(join(root, 'src', 'migrations', name), body);
}

describe('audit-migrations strict structural gate', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('accepts covered migrations with matching timestamp and up/down methods', () => {
    const root = fixture();
    roots.push(root);
    migration(
      root,
      '1800000000000-CreateExamples.ts',
      `export class CreateExamples1800000000000 {
        async up() { return 'examples'; }
        async down() { return 'examples'; }
      }`,
    );

    const output = execFileSync(
      process.execPath,
      [auditScript, '--strict', '--json', `--root=${root}`],
      { encoding: 'utf8' },
    );
    const report = JSON.parse(output);

    expect(report.summary).toMatchObject({
      migrations: 1,
      covered: 1,
      reversible: 1,
      structuralIssues: 0,
    });
  });

  it('fails strict mode when a migration has no rollback method', () => {
    const root = fixture();
    roots.push(root);
    migration(
      root,
      '1800000000000-CreateExamples.ts',
      `export class CreateExamples1800000000000 {
        async up() { return 'examples'; }
      }`,
    );

    const result = spawnSync(
      process.execPath,
      [auditScript, '--strict', '--json', `--root=${root}`],
      { encoding: 'utf8' },
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.structure.issues).toContainEqual(
      expect.objectContaining({ code: 'missing-down' }),
    );
  });

  it('fails strict mode for duplicate migration timestamps', () => {
    const root = fixture();
    roots.push(root);
    migration(
      root,
      '1800000000000-CreateExamples.ts',
      `export class CreateExamples1800000000000 {
        async up() { return 'examples'; }
        async down() { return 'examples'; }
      }`,
    );
    migration(
      root,
      '1800000000000-AdjustExamples.ts',
      `export class AdjustExamples1800000000000 {
        async up() { return 'examples'; }
        async down() { return 'examples'; }
      }`,
    );

    const result = spawnSync(
      process.execPath,
      [auditScript, '--strict', '--json', `--root=${root}`],
      { encoding: 'utf8' },
    );
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.structure.issues).toContainEqual(
      expect.objectContaining({ code: 'duplicate-timestamp' }),
    );
  });
});
