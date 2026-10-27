#!/usr/bin/env node
/**
 * Verificação SOMENTE LEITURA: lista endereços (tabela `addresses`) com coordenadas
 * em 0,0 ou fora de faixa (lat ±90, lng ±180). Não grava nada: só executa SELECT.
 *
 * Contexto: bug do onboarding (Number(null) === 0) podia salvar o imóvel no Golfo da Guiné.
 * Veja docs/runbooks/enderecos-coordenadas-zero.md.
 *
 * Uso (a partir de urban-ai-backend-main/):
 *   node scripts/check-address-coordinates.js [--env-file caminho/.env] [--limit 200] [--sql]
 *
 * Conexão: DATABASE_URL (ou MYSQL_URL/MYSQL_PUBLIC_URL) ou DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME;
 * DB_SSL=true liga TLS. Saída: contagem + amostra (sem senha, sem e-mail). Exit 0 sempre que a consulta
 * roda; exit 2 se encontrar linhas ruins (útil como alerta), exit 1 em erro.
 */
const fs = require('fs');
const path = require('path');

const WHERE_SQL = [
  '(latitude IS NOT NULL OR longitude IS NOT NULL)',
  'AND (',
  '  (latitude = 0 AND longitude = 0)',
  '  OR latitude NOT BETWEEN -90 AND 90',
  '  OR longitude NOT BETWEEN -180 AND 180',
  ')',
].join('\n  ');

const COUNT_SQL = `SELECT COUNT(*) AS total FROM addresses WHERE ${WHERE_SQL}`;
const sampleSql = (limit) =>
  `SELECT id, cidade, estado, latitude, longitude, ativo FROM addresses WHERE ${WHERE_SQL} ORDER BY id LIMIT ${limit}`;

function parseArgs(argv) {
  const out = { envFile: '', limit: 200, sql: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') out.envFile = argv[++i] || '';
    else if (arg === '--limit') out.limit = Math.max(1, Math.min(5000, Number.parseInt(argv[++i], 10) || 200));
    else if (arg === '--sql') out.sql = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

function readEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

function loadEnv(envFile) {
  const env = { ...process.env };
  const candidates = envFile
    ? [path.resolve(envFile)]
    : [path.join(process.cwd(), '.env'), path.resolve(__dirname, '..', '.env')];
  for (const file of candidates) if (fs.existsSync(file)) Object.assign(env, readEnvFile(file));
  return env;
}

function readDbConfig(env) {
  const ssl = String(env.DB_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined;
  const url = env.DATABASE_URL || env.MYSQL_PUBLIC_URL || env.MYSQL_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      ssl,
    };
  }
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/check-address-coordinates.js [--env-file .env] [--limit 200] [--sql]');
    return 0;
  }
  if (args.sql) {
    console.log('-- Somente leitura. Rode no cliente SQL (staging/prod) para contar e listar:');
    console.log(`${COUNT_SQL};`);
    console.log(`${sampleSql(args.limit)};`);
    return 0;
  }

  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection(readDbConfig(loadEnv(args.envFile)));
  try {
    await connection.query('SET SESSION TRANSACTION READ ONLY');
    const [countRows] = await connection.query(COUNT_SQL);
    const total = Number(countRows?.[0]?.total ?? 0);
    console.log(`Endereços com coordenadas em 0,0 ou fora de faixa: ${total}`);
    if (total === 0) return 0;
    const [rows] = await connection.query(sampleSql(args.limit));
    console.table(rows);
    console.log('Nada foi alterado. Corrija pela rotina de geocodificação (veja o runbook) após revisar a lista.');
    return 2;
  } finally {
    await connection.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`ERRO: ${String(error?.message || error).replace(/(mysql2?:\/\/)[^@\s]+@/gi, '$1[redacted]@')}`);
    process.exit(1);
  });
