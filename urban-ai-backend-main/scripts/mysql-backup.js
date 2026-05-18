#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.dryRun && args.execute) {
  console.error('Use apenas um modo: --dry-run ou --execute.');
  process.exit(1);
}

const dryRun = !args.execute;
const env = loadEnv(args.envFile);
const now = new Date();
const label = sanitizeLabel(args.label || env.BACKUP_LABEL || (dryRun ? 'dry-run' : 'manual'));
const backupFile = `urban-ai-${label}-${timestamp(now)}.sql.gz`;
const outDir = path.resolve(args.outDir || env.BACKUP_OUT_DIR || process.cwd());
const outPath = path.join(outDir, backupFile);
const validation = validateConfig(env, args.target || 'auto', dryRun);

console.log('Urban AI MySQL backup');
console.log(`Generated at: ${now.toISOString()}`);
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
console.log('');

if (dryRun) {
  console.log('Dry-run seguro: nenhum comando sera executado e credenciais reais nao sao obrigatorias.');
  console.log('');
}

for (const warning of validation.warnings) console.log(`WARN: ${warning}`);

if (validation.errors.length > 0) {
  for (const error of validation.errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

const plan = buildPlan(validation.config, backupFile, outPath);

console.log('Plano:');
console.log(`  Database: ${validation.config.db.host}:${validation.config.db.port}/${validation.config.db.name}`);
console.log(`  Output: ${outPath}`);
console.log(`  Destination: ${describeDestination(validation.config.destination)}`);
console.log('');

console.log('Comandos equivalentes (sanitizados):');
for (const command of plan.sanitizedCommands) console.log(`  ${command}`);
console.log('');

if (dryRun) {
  console.log('Resultado: dry-run concluido. Reexecute com --execute para gerar e enviar o backup.');
  process.exit(0);
}

run(plan, validation.config).catch((error) => {
  console.error(`Backup failed: ${sanitizeMessage(error.message || String(error))}`);
  process.exit(1);
});

function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    execute: false,
    help: false,
    envFile: null,
    label: null,
    outDir: null,
    target: null,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--execute' || arg === '--no-dry-run') parsed.execute = true;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg.startsWith('--env=')) parsed.envFile = arg.slice('--env='.length);
    else if (arg.startsWith('--label=')) parsed.label = arg.slice('--label='.length);
    else if (arg.startsWith('--out-dir=')) parsed.outDir = arg.slice('--out-dir='.length);
    else if (arg.startsWith('--target=')) parsed.target = arg.slice('--target='.length).toLowerCase();
    else {
      console.error(`Argumento desconhecido: ${arg}`);
      process.exit(1);
    }
  }

  if (parsed.target && !['auto', 's3', 'b2'].includes(parsed.target)) {
    console.error('--target deve ser auto, s3 ou b2.');
    process.exit(1);
  }

  return parsed;
}

function loadEnv(envFileArg) {
  const env = { ...process.env };
  const candidates = [];

  if (envFileArg) {
    candidates.push(path.resolve(envFileArg));
  } else {
    candidates.push(path.join(process.cwd(), '.env'));
    candidates.push(path.resolve(__dirname, '..', '.env'));
  }

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) Object.assign(env, readEnvFile(filePath));
  }

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) parsed[key] = value;
  }
  return parsed;
}

function validateConfig(env, target, dryRun) {
  const errors = [];
  const warnings = [];
  const db = readDbConfig(env, dryRun);
  const destination = readDestinationConfig(env, target, dryRun, warnings);

  if (!dryRun) {
    requireValue(errors, db.host, 'DATABASE_URL host ou DB_HOST');
    requireValue(errors, db.user, 'DATABASE_URL usuario ou DB_USER');
    requireValue(errors, db.password, 'DATABASE_URL senha ou DB_PASSWORD');
    requireValue(errors, db.name, 'DATABASE_URL database ou DB_NAME');

    if (destination.type === 's3') {
      requireValue(errors, destination.bucket, 'S3_BUCKET');
      requireValue(errors, env.AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID');
      requireValue(errors, env.AWS_SECRET_ACCESS_KEY, 'AWS_SECRET_ACCESS_KEY');
    } else if (destination.type === 'b2') {
      requireValue(errors, destination.bucket, 'B2_BUCKET');
      requireValue(errors, env.B2_APPLICATION_KEY_ID, 'B2_APPLICATION_KEY_ID');
      requireValue(errors, env.B2_APPLICATION_KEY, 'B2_APPLICATION_KEY');
    } else {
      errors.push('Configure um destino completo: S3_BUCKET + AWS_* ou B2_BUCKET + B2_*.');
    }
  }

  if (db.source === 'placeholder') warnings.push('Usando placeholders de DB porque o modo atual e dry-run.');
  if (destination.placeholder) warnings.push('Usando placeholders de destino porque o modo atual e dry-run.');

  return { errors, warnings, config: { db, destination, env } };
}

function readDbConfig(env, dryRun) {
  if (value(env, 'DATABASE_URL')) {
    try {
      const parsed = new URL(env.DATABASE_URL);
      if (!['mysql:', 'mysql2:'].includes(parsed.protocol)) {
        return placeholderDb(dryRun, `DATABASE_URL scheme nao suportado: ${parsed.protocol}`);
      }
      return {
        source: 'DATABASE_URL',
        host: parsed.hostname,
        port: parsed.port || '3306',
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        name: decodeURIComponent((parsed.pathname || '').replace(/^\//, '')),
      };
    } catch {
      return placeholderDb(dryRun, 'DATABASE_URL invalido');
    }
  }

  const discrete = {
    source: 'DB_*',
    host: value(env, 'DB_HOST'),
    port: value(env, 'DB_PORT') || '3306',
    user: value(env, 'DB_USER'),
    password: value(env, 'DB_PASSWORD'),
    name: value(env, 'DB_NAME'),
  };

  if (dryRun && !discrete.host && !discrete.user && !discrete.password && !discrete.name) {
    return placeholderDb(true);
  }

  return discrete;
}

function placeholderDb(dryRun, reason) {
  if (!dryRun) {
    return {
      source: reason || 'missing',
      host: '',
      port: '3306',
      user: '',
      password: '',
      name: '',
    };
  }

  return {
    source: 'placeholder',
    host: '<DB_HOST>',
    port: '<DB_PORT>',
    user: '<DB_USER>',
    password: '<DB_PASSWORD>',
    name: '<DB_NAME>',
  };
}

function readDestinationConfig(env, target, dryRun, warnings) {
  const hasS3 = has(env, 'S3_BUCKET');
  const hasB2 = has(env, 'B2_BUCKET');

  if (target === 's3' || (target === 'auto' && hasS3)) {
    if (hasS3 || !dryRun) {
      if (hasS3 && hasB2 && target === 'auto') warnings.push('S3_BUCKET e B2_BUCKET presentes; S3 sera usado.');
      return {
        type: 's3',
        bucket: value(env, 'S3_BUCKET'),
        region: value(env, 'AWS_REGION') || value(env, 'AWS_DEFAULT_REGION') || 'us-east-1',
        prefix: trimSlashes(value(env, 'BACKUP_PREFIX') || 'mysql'),
        placeholder: false,
      };
    }
    return placeholderDestination('s3');
  }

  if (target === 'b2' || (target === 'auto' && hasB2)) {
    if (hasB2 || !dryRun) {
      return {
        type: 'b2',
        bucket: value(env, 'B2_BUCKET'),
        prefix: trimSlashes(value(env, 'BACKUP_PREFIX') || 'mysql'),
        placeholder: false,
      };
    }
    return placeholderDestination('b2');
  }

  return dryRun ? placeholderDestination('s3') : { type: 'none' };
}

function placeholderDestination(type) {
  return {
    type,
    bucket: type === 's3' ? '<S3_BUCKET>' : '<B2_BUCKET>',
    region: 'us-east-1',
    prefix: 'mysql',
    placeholder: true,
  };
}

function buildPlan(config, backupFile, outPath) {
  const dumpArgs = [
    `--host=${config.db.host}`,
    `--port=${config.db.port}`,
    `--user=${config.db.user}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--events',
    '--quick',
    '--set-gtid-purged=OFF',
    '--no-tablespaces',
    config.db.name,
  ];
  const remoteKey = `${config.destination.prefix}/${backupFile}`;
  const sanitizedCommands = [
    `MYSQL_PWD=<redacted> mysqldump ${dumpArgs.map(shellQuote).join(' ')} | gzip -9 > ${shellQuote(outPath)}`,
  ];
  const upload = { type: config.destination.type, remoteKey };

  if (config.destination.type === 's3') {
    upload.command = [
      'aws',
      's3',
      'cp',
      outPath,
      `s3://${config.destination.bucket}/${remoteKey}`,
      '--storage-class',
      'STANDARD_IA',
    ];
    upload.env = { AWS_REGION: config.destination.region };
    sanitizedCommands.push(upload.command.map(shellQuote).join(' '));
  } else if (config.destination.type === 'b2') {
    upload.authCommand = ['b2', 'authorize-account'];
    upload.command = ['b2', 'upload-file', config.destination.bucket, outPath, remoteKey];
    sanitizedCommands.push('B2_APPLICATION_KEY_ID=<redacted> B2_APPLICATION_KEY=<redacted> b2 authorize-account');
    sanitizedCommands.push(upload.command.map(shellQuote).join(' '));
  }

  return { dumpArgs, outPath, sanitizedCommands, upload };
}

async function run(plan, config) {
  fs.mkdirSync(path.dirname(plan.outPath), { recursive: true });
  await dumpDatabase(plan, config);
  const size = fs.statSync(plan.outPath).size;
  console.log(`Backup gerado: ${plan.outPath} (${formatBytes(size)})`);
  await uploadBackup(plan, config);
  console.log('Resultado: backup concluido com sucesso.');
}

async function dumpDatabase(plan, config) {
  console.log('Executando mysqldump...');
  const dump = spawn('mysqldump', plan.dumpArgs, {
    env: { ...process.env, MYSQL_PWD: config.db.password },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const gzip = zlib.createGzip({ level: 9 });
  const output = fs.createWriteStream(plan.outPath, { flags: 'wx' });
  let stderr = '';

  dump.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const completion = new Promise((resolve, reject) => {
    dump.on('error', reject);
    dump.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysqldump saiu com codigo ${code}: ${stderr.trim()}`));
    });
  });

  await Promise.all([pipeline(dump.stdout, gzip, output), completion]);
}

async function uploadBackup(plan, config) {
  if (plan.upload.type === 's3') {
    console.log(`Enviando para s3://${config.destination.bucket}/${plan.upload.remoteKey}...`);
    await runCommand(plan.upload.command, {
      ...process.env,
      AWS_REGION: config.destination.region,
      AWS_DEFAULT_REGION: config.destination.region,
    });
    return;
  }

  if (plan.upload.type === 'b2') {
    console.log(`Enviando para b2://${config.destination.bucket}/${plan.upload.remoteKey}...`);
    const b2Env = {
      ...process.env,
      B2_APPLICATION_KEY_ID: config.env.B2_APPLICATION_KEY_ID,
      B2_APPLICATION_KEY: config.env.B2_APPLICATION_KEY,
    };
    await runCommand(plan.upload.authCommand, b2Env);
    await runCommand(plan.upload.command, b2Env);
  }
}

function runCommand(command, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      env,
      stdio: ['ignore', 'inherit', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command[0]} saiu com codigo ${code}: ${stderr.trim()}`));
    });
  });
}

function printHelp() {
  console.log(`Urban AI MySQL backup

Uso:
  node scripts/mysql-backup.js [--dry-run]
  node scripts/mysql-backup.js --execute [--target=s3|b2] [--label=manual] [--out-dir=/tmp]

Opcoes:
  --dry-run          Modo seguro padrao. Nao exige credenciais reais e nao executa comandos.
  --execute          Gera o dump e envia para S3 ou B2.
  --target=auto      Detecta S3_BUCKET ou B2_BUCKET. Valores: auto, s3, b2.
  --env=.env         Carrega variaveis de um arquivo .env.
  --label=texto      Label usada no nome do arquivo.
  --out-dir=path     Diretorio local para o .sql.gz.
  --help             Mostra esta ajuda.
`);
}

function requireValue(errors, actual, label) {
  if (!String(actual || '').trim()) errors.push(`${label} nao configurado.`);
}

function value(env, key) {
  return String(env[key] || '').trim();
}

function has(env, key) {
  return value(env, key).length > 0;
}

function timestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function sanitizeLabel(label) {
  return String(label || 'manual')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'manual';
}

function trimSlashes(input) {
  return String(input || '').replace(/^\/+|\/+$/g, '');
}

function shellQuote(valueToQuote) {
  const text = String(valueToQuote);
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function describeDestination(destination) {
  if (destination.type === 's3') return `s3://${destination.bucket}/${destination.prefix}/`;
  if (destination.type === 'b2') return `b2://${destination.bucket}/${destination.prefix}/`;
  return 'none';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 'B';
  for (const next of units) {
    size /= 1024;
    unit = next;
    if (size < 1024) break;
  }
  return `${size.toFixed(1)} ${unit}`;
}

function sanitizeMessage(message) {
  let sanitized = String(message);
  for (const secretKey of [
    'DATABASE_URL',
    'DB_PASSWORD',
    'AWS_SECRET_ACCESS_KEY',
    'B2_APPLICATION_KEY',
    'B2_APPLICATION_KEY_ID',
  ]) {
    const secret = env[secretKey];
    if (secret) sanitized = sanitized.split(secret).join('<redacted>');
  }
  return sanitized;
}
