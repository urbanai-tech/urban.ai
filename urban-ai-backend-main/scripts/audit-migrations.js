#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BASELINE_HISTORICAL_TABLES = new Map([
  [
    'analise_endereco_evento',
    'present in docs/banco-antigo-schemas.md before Baseline1745500000000',
  ],
  [
    'email_confirmations',
    'present in docs/banco-antigo-schemas.md before Baseline1745500000000',
  ],
  [
    'notifications',
    'present in docs/banco-antigo-schemas.md before Baseline1745500000000',
  ],
]);

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const projectRoot = findProjectRoot(options.root);
const entitiesDir = path.resolve(projectRoot, options.entities || 'src/entities');
const migrationsDir = path.resolve(projectRoot, options.migrations || 'src/migrations');

const errors = [];
if (!fs.existsSync(entitiesDir)) errors.push(`Entities directory not found: ${entitiesDir}`);
if (!fs.existsSync(migrationsDir)) errors.push(`Migrations directory not found: ${migrationsDir}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(2);
}

const entities = readEntityMetadata(entitiesDir, projectRoot);
const migrations = readMigrations(migrationsDir, projectRoot);
const audit = auditCoverage(entities, migrations);

if (options.json) {
  console.log(
    JSON.stringify(
      {
        projectRoot,
        entitiesDir: relative(projectRoot, entitiesDir),
        migrationsDir: relative(projectRoot, migrationsDir),
        strict: options.strict,
        ...audit,
      },
      null,
      2,
    ),
  );
} else {
  printReport({
    projectRoot,
    entitiesDir,
    migrationsDir,
    strict: options.strict,
    audit,
  });
}

if (options.strict && audit.summary.suspected > 0) {
  process.exitCode = 1;
}

function parseArgs(args) {
  const parsed = {
    strict: false,
    json: false,
    help: false,
    root: '',
    entities: '',
    migrations: '',
  };

  for (const arg of args) {
    if (arg === '--strict') parsed.strict = true;
    else if (arg === '--json') parsed.json = true;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg.startsWith('--root=')) parsed.root = arg.slice('--root='.length);
    else if (arg.startsWith('--entities=')) parsed.entities = arg.slice('--entities='.length);
    else if (arg.startsWith('--migrations=')) parsed.migrations = arg.slice('--migrations='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(2);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Urban AI TypeORM migrations audit

Dry-run file audit for the DB_SYNCHRONIZE=false cutover. This script never opens
a database connection; it only reads entity and migration files.

Usage:
  node scripts/audit-migrations.js [--strict] [--json]

Options:
  --strict              Exit 1 when suspected uncovered entities are found.
  --json                Print machine-readable output.
  --root=<path>         Project root. Defaults to the backend root.
  --entities=<path>     Entities directory relative to root. Default: src/entities.
  --migrations=<path>   Migrations directory relative to root. Default: src/migrations.
  --help                Show this help.
`);
}

function findProjectRoot(explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);

  const candidates = [
    process.cwd(),
    path.resolve(__dirname, '..'),
    path.resolve(process.cwd(), 'urban-ai-backend-main'),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'src', 'entities')) &&
      fs.existsSync(path.join(candidate, 'src', 'migrations'))
    ) {
      return candidate;
    }
  }

  return path.resolve(__dirname, '..');
}

function readEntityMetadata(entitiesDir, projectRoot) {
  return walk(entitiesDir)
    .filter((file) => /\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
    .flatMap((file) => extractEntities(file, projectRoot))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
}

function extractEntities(filePath, projectRoot) {
  const content = fs.readFileSync(filePath, 'utf8');
  const entities = [];
  const entityRegex = /@Entity\b/g;
  let match;

  while ((match = entityRegex.exec(content)) !== null) {
    const decorator = readDecorator(content, match.index + '@Entity'.length);
    const classMatch = /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(
      content.slice(decorator.endIndex),
    );

    if (!classMatch) continue;

    const className = classMatch[1];
    const explicitTableName = extractExplicitTableName(decorator.argument);
    const tableName = explicitTableName || toSnakeCase(className);

    entities.push({
      className,
      tableName,
      explicitTableName: Boolean(explicitTableName),
      file: relative(projectRoot, filePath),
      evidence: [],
      status: 'unknown',
    });

    entityRegex.lastIndex = decorator.endIndex + classMatch.index + classMatch[0].length;
  }

  return entities;
}

function readDecorator(content, startIndex) {
  let index = startIndex;
  while (/\s/.test(content[index] || '')) index += 1;

  if (content[index] !== '(') return { argument: '', endIndex: index };

  const start = index;
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (; index < content.length; index += 1) {
    const char = content[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return {
          argument: content.slice(start + 1, index).trim(),
          endIndex: index + 1,
        };
      }
    }
  }

  return { argument: '', endIndex: startIndex };
}

function extractExplicitTableName(argument) {
  if (!argument) return '';

  const direct = /^\s*(['"`])([^'"`]+)\1/.exec(argument);
  if (direct) return direct[2].trim();

  const objectName = /\bname\s*:\s*(['"`])([^'"`]+)\1/.exec(argument);
  if (objectName) return objectName[2].trim();

  return '';
}

function readMigrations(migrationsDir, projectRoot) {
  return walk(migrationsDir)
    .filter((file) => /\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
    .map((file) => {
      const content = fs.readFileSync(file, 'utf8');
      const relFile = relative(projectRoot, file);
      return {
        file: relFile,
        baseName: path.basename(file),
        content,
        normalized: normalizeIdentifier(`${relFile}\n${content}`),
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

function auditCoverage(entities, migrations) {
  const hasHistoricalBaseline = migrations.some((migration) =>
    /Baseline1745500000000/.test(migration.content),
  );

  const auditedEntities = entities.map((entity) => {
    const direct = [];
    const weak = [];
    const tablePattern = makeIdentifierPattern(entity.tableName);
    const weakKeys = candidateWeakKeys(entity);
    const baselineReason = hasHistoricalBaseline
      ? BASELINE_HISTORICAL_TABLES.get(entity.tableName)
      : '';

    for (const migration of migrations) {
      if (tablePattern.test(migration.content)) {
        direct.push(migration.file);
        continue;
      }

      if (weakKeys.some((key) => key.length >= 3 && migration.normalized.includes(key))) {
        weak.push(migration.file);
      }
    }

    const status =
      direct.length > 0 || baselineReason
        ? 'covered'
        : weak.length > 0
          ? 'weak'
          : 'suspected';
    const evidence = [
      ...direct.map((file) => ({ strength: 'table-literal', file })),
      ...(baselineReason
        ? [
            {
              strength: 'historical-baseline',
              file: 'src/migrations/1745500000000-Baseline.ts',
              note: baselineReason,
            },
          ]
        : []),
      ...weak.map((file) => ({ strength: 'name-match', file })),
    ];

    return {
      ...entity,
      status,
      evidence,
    };
  });

  const summary = {
    entities: auditedEntities.length,
    migrations: migrations.length,
    covered: auditedEntities.filter((entity) => entity.status === 'covered').length,
    weak: auditedEntities.filter((entity) => entity.status === 'weak').length,
    suspected: auditedEntities.filter((entity) => entity.status === 'suspected').length,
  };

  return {
    summary,
    entities: auditedEntities,
    suspected: auditedEntities.filter((entity) => entity.status === 'suspected'),
    weak: auditedEntities.filter((entity) => entity.status === 'weak'),
  };
}

function candidateWeakKeys(entity) {
  const raw = [
    entity.className,
    entity.tableName,
    entity.tableName.replace(/s$/, ''),
    entity.file.replace(/\.entity\.(ts|js)$/i, '').replace(/\.(ts|js)$/i, ''),
  ];

  return [...new Set(raw.map(normalizeIdentifier).filter(Boolean))];
}

function printReport({ projectRoot, entitiesDir, migrationsDir, strict, audit }) {
  const { summary } = audit;

  console.log('Urban AI TypeORM migrations dry-run audit');
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log(`Project root: ${projectRoot}`);
  console.log(`Entities: ${relative(projectRoot, entitiesDir)}`);
  console.log(`Migrations: ${relative(projectRoot, migrationsDir)}`);
  console.log('Database connection: not used');
  console.log(`Mode: ${strict ? 'strict' : 'advisory'}`);
  console.log('');
  console.log(
    `Summary: ${summary.covered}/${summary.entities} covered, ` +
      `${summary.weak} weak, ${summary.suspected} suspected, ` +
      `${summary.migrations} migration files scanned`,
  );
  console.log('');

  if (audit.suspected.length > 0) {
    console.log('Suspected entities without migration coverage by table/entity name:');
    for (const entity of audit.suspected) {
      console.log(
        `  SUSPECT: ${entity.className} -> table "${entity.tableName}" (${entity.file})`,
      );
    }
    console.log('');
  } else {
    console.log('No suspected uncovered entities found.');
    console.log('');
  }

  if (audit.weak.length > 0) {
    console.log('Weak coverage only (migration mentions entity/table name but not table literal):');
    for (const entity of audit.weak) {
      console.log(`  WEAK: ${entity.className} -> table "${entity.tableName}" (${entity.file})`);
      for (const item of entity.evidence.slice(0, 3)) {
        console.log(`    ${item.strength}: ${item.file}`);
      }
      if (entity.evidence.length > 3) console.log(`    ... ${entity.evidence.length - 3} more`);
    }
    console.log('');
  }

  const baselineCovered = audit.entities.filter((entity) =>
    entity.evidence.some((item) => item.strength === 'historical-baseline'),
  );
  if (baselineCovered.length > 0) {
    console.log('Historical baseline coverage (legacy schema documented before baseline):');
    for (const entity of baselineCovered) {
      const item = entity.evidence.find((evidence) => evidence.strength === 'historical-baseline');
      console.log(`  COVERED: ${entity.className} -> table "${entity.tableName}"`);
      console.log(`    ${item.strength}: ${item.file}; ${item.note}`);
    }
    console.log('');
  }

  console.log('Coverage details:');
  for (const entity of audit.entities) {
    const label = entity.status.toUpperCase().padEnd(9, ' ');
    const evidence = entity.evidence[0]
      ? `${entity.evidence[0].strength} in ${entity.evidence[0].file}`
      : 'no matching migration evidence';
    console.log(`  ${label} ${entity.className} -> ${entity.tableName}; ${evidence}`);
  }
  console.log('');

  if (strict && summary.suspected > 0) {
    console.log('Strict result: failing because suspected uncovered entities were found.');
  } else if (strict) {
    console.log('Strict result: pass. No suspected uncovered entities found.');
  } else {
    console.log('Result: advisory pass. Use --strict to fail when suspected coverage gaps exist.');
  }
}

function walk(root) {
  const results = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

function makeIdentifierPattern(identifier) {
  return new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(identifier)}(?=$|[^A-Za-z0-9_])`);
}

function toSnakeCase(value) {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function normalizeIdentifier(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relative(from, target) {
  return path.relative(from, target).replace(/\\/g, '/') || '.';
}
