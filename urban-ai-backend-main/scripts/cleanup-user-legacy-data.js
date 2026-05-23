#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!args.userId) {
  console.error('ERROR: --user-id=<uuid> e obrigatorio.');
  printHelp();
  process.exit(2);
}

const dryRun = !args.execute;
const cutoff = parseCutoff(args.before || '2026-01-01');
const env = loadEnv(args.envFile);
const dbConfig = readDbConfig(env);

main().catch((error) => {
  console.error(`ERROR: ${sanitizeMessage(error.message || String(error))}`);
  process.exit(1);
});

async function main() {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('Urban AI legacy user cleanup');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
    console.log(`User: ${args.userId}`);
    console.log(`Cutoff: ${cutoff}`);
    console.log('');

    const tasks = await buildTasks(connection);
    const reports = [];

    for (const task of tasks) {
      if (!(await tableExists(connection, task.table))) {
        reports.push({ name: task.name, table: task.table, skipped: 'table_missing' });
        continue;
      }

      const [countRows] = await connection.execute(task.countSql, task.params);
      const count = Number(countRows?.[0]?.count ?? 0);
      const [sampleRows] = await connection.execute(task.sampleSql, task.params);
      reports.push({ name: task.name, table: task.table, count, sample: sampleRows });
    }

    printReport(reports);

    if (dryRun) {
      console.log('');
      console.log('Resultado: dry-run concluido. Nada foi apagado.');
      console.log('Para executar de verdade, reexecute com --execute depois de revisar a amostra.');
      return;
    }

    await connection.beginTransaction();
    try {
      for (const task of tasks) {
        if (!(await tableExists(connection, task.table))) continue;
        const [result] = await connection.execute(task.deleteSql, task.params);
        console.log(`Deleted ${result.affectedRows ?? 0} row(s): ${task.name}`);
      }
      await connection.commit();
      console.log('');
      console.log('Resultado: limpeza executada com sucesso.');
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

async function buildTasks(connection) {
  const userId = args.userId;
  const staleAnalysisWhere = `
    usuario_proprietario_id = ?
    AND (
      criado_em < ?
      OR endereco_id IS NULL
      OR endereco_id NOT IN (SELECT id FROM addresses WHERE user_id = ?)
      OR endereco_id IN (
        SELECT a.id
        FROM addresses a
        LEFT JOIN list l ON l.id = a.list_id
        WHERE a.user_id = ?
          AND (a.ativo = 0 OR COALESCE(l.ativo, 0) = 0)
      )
    )
  `;
  const staleAnalysisParams = [userId, cutoff, userId, userId];
  const tasks = [
    {
      name: 'pricing suggestions antigas/obsoletas',
      table: 'analise_preco',
      params: staleAnalysisParams,
      countSql: `SELECT COUNT(*) AS count FROM analise_preco WHERE ${staleAnalysisWhere}`,
      sampleSql: `
        SELECT id, criado_em, endereco_id, evento_id, seu_preco_atual, preco_sugerido, diferenca_percentual, status, aceito
        FROM analise_preco
        WHERE ${staleAnalysisWhere}
        ORDER BY criado_em ASC
        LIMIT 10
      `,
      deleteSql: `DELETE FROM analise_preco WHERE ${staleAnalysisWhere}`,
    },
    {
      name: 'analises de evento antigas/obsoletas',
      table: 'analise_endereco_evento',
      params: staleAnalysisParams,
      countSql: `SELECT COUNT(*) AS count FROM analise_endereco_evento WHERE ${staleAnalysisWhere}`,
      sampleSql: `
        SELECT id, criado_em, endereco_id, evento_id, transport_mode, distancia_metros
        FROM analise_endereco_evento
        WHERE ${staleAnalysisWhere}
        ORDER BY criado_em ASC
        LIMIT 10
      `,
      deleteSql: `DELETE FROM analise_endereco_evento WHERE ${staleAnalysisWhere}`,
    },
  ];

  if (await tableExists(connection, 'pricing_input_history')) {
    tasks.push({
      name: 'historico de inputs de pricing antigo',
      table: 'pricing_input_history',
      params: [userId, cutoff],
      countSql: 'SELECT COUNT(*) AS count FROM pricing_input_history WHERE user_id = ? AND created_at < ?',
      sampleSql: `
        SELECT id, created_at, list_id, address_id, source, previousManualDailyPrice, newManualDailyPrice
        FROM pricing_input_history
        WHERE user_id = ? AND created_at < ?
        ORDER BY created_at ASC
        LIMIT 10
      `,
      deleteSql: 'DELETE FROM pricing_input_history WHERE user_id = ? AND created_at < ?',
    });
  }

  if (args.includeNotifications) {
    tasks.push({
      name: 'notificacoes antigas',
      table: 'notifications',
      params: [userId, cutoff],
      countSql: 'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND createdAt < ?',
      sampleSql: `
        SELECT id, createdAt, title, redirect_to, sent, opened
        FROM notifications
        WHERE user_id = ? AND createdAt < ?
        ORDER BY createdAt ASC
        LIMIT 10
      `,
      deleteSql: 'DELETE FROM notifications WHERE user_id = ? AND createdAt < ?',
    });
  }

  if (args.includeInactiveAddresses) {
    tasks.push({
      name: 'enderecos inativos antigos',
      table: 'addresses',
      params: [userId, cutoff],
      countSql: 'SELECT COUNT(*) AS count FROM addresses WHERE user_id = ? AND ativo = 0 AND created_at < ?',
      sampleSql: `
        SELECT id, created_at, list_id, cidade, estado, analisado
        FROM addresses
        WHERE user_id = ? AND ativo = 0 AND created_at < ?
        ORDER BY created_at ASC
        LIMIT 10
      `,
      deleteSql: 'DELETE FROM addresses WHERE user_id = ? AND ativo = 0 AND created_at < ?',
    });

    tasks.push({
      name: 'listas inativas sem endereco',
      table: 'list',
      params: [userId, userId, cutoff],
      countSql: `
        SELECT COUNT(*) AS count
        FROM list l
        WHERE l.user_id = ?
          AND l.ativo = 0
          AND NOT EXISTS (
            SELECT 1
            FROM addresses a
            WHERE a.list_id = l.id
              AND NOT (a.user_id = ? AND a.ativo = 0 AND a.created_at < ?)
          )
      `,
      sampleSql: `
        SELECT l.id, l.id_do_anuncio, l.titulo, l.ativo
        FROM list l
        WHERE l.user_id = ?
          AND l.ativo = 0
          AND NOT EXISTS (
            SELECT 1
            FROM addresses a
            WHERE a.list_id = l.id
              AND NOT (a.user_id = ? AND a.ativo = 0 AND a.created_at < ?)
          )
        LIMIT 10
      `,
      deleteSql: `
        DELETE FROM list
        WHERE user_id = ?
          AND ativo = 0
          AND NOT EXISTS (
            SELECT 1
            FROM addresses a
            WHERE a.list_id = list.id
              AND NOT (a.user_id = ? AND a.ativo = 0 AND a.created_at < ?)
          )
      `,
    });
  }

  return tasks;
}

function parseArgs(argv) {
  const parsed = {
    execute: false,
    help: false,
    userId: '',
    before: '',
    envFile: '',
    includeInactiveAddresses: false,
    includeNotifications: false,
  };

  for (const arg of argv) {
    if (arg === '--execute') parsed.execute = true;
    else if (arg === '--dry-run') parsed.execute = false;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--include-inactive-addresses') parsed.includeInactiveAddresses = true;
    else if (arg === '--include-notifications') parsed.includeNotifications = true;
    else if (arg.startsWith('--user-id=')) parsed.userId = arg.slice('--user-id='.length);
    else if (arg.startsWith('--before=')) parsed.before = arg.slice('--before='.length);
    else if (arg.startsWith('--env=')) parsed.envFile = arg.slice('--env='.length);
    else {
      console.error(`Argumento desconhecido: ${arg}`);
      process.exit(2);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Urban AI legacy user cleanup

Remove registros historicos/obsoletos de um usuario, com dry-run por padrao.
O escopo principal limpa sugestoes de preco e analises evento-endereco antigas
ou ligadas a imoveis inativos/orfaos.

Usage:
  node scripts/cleanup-user-legacy-data.js --user-id=<uuid> [--before=2026-01-01]
  node scripts/cleanup-user-legacy-data.js --user-id=<uuid> --execute

Options:
  --user-id=<uuid>                Usuario alvo.
  --before=<YYYY-MM-DD>           Cutoff exclusivo. Default: 2026-01-01.
  --include-inactive-addresses    Tambem apaga enderecos inativos antigos e listas inativas orfas.
  --include-notifications         Tambem apaga notificacoes antigas do usuario.
  --execute                       Executa DELETEs dentro de transacao.
  --dry-run                       Padrao. Mostra contagens/amostras sem apagar.
  --env=<path>                    Arquivo .env. Default: ./env atual ou backend/.env.
  --help                          Mostra ajuda.
`);
}

function parseCutoff(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('--before deve estar no formato YYYY-MM-DD.');
  }
  return value;
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

function readDbConfig(env) {
  const url = env.DATABASE_URL || env.MYSQL_PUBLIC_URL || env.MYSQL_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      ssl: readSslConfig(env),
      multipleStatements: false,
    };
  }

  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: readSslConfig(env),
    multipleStatements: false,
  };
}

function readSslConfig(env) {
  if (String(env.DB_SSL || '').toLowerCase() === 'true') return { rejectUnauthorized: false };
  return undefined;
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [tableName],
  );
  return Number(rows?.[0]?.count ?? 0) > 0;
}

function printReport(reports) {
  for (const report of reports) {
    if (report.skipped) {
      console.log(`${report.name}: SKIP (${report.skipped})`);
      continue;
    }

    console.log(`${report.name}: ${report.count} row(s)`);
    for (const row of report.sample || []) {
      console.log(`  - ${JSON.stringify(row, sanitizeRow)}`);
    }
  }
}

function sanitizeRow(key, value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function sanitizeMessage(message) {
  return String(message)
    .replace(/(mysql2?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi, '$1[redacted]:[redacted]@')
    .replace(/(password|passwd|pwd)=([^;\s]+)/gi, '$1=[redacted]');
}
