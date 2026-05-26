const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function requireStaging() {
  const appEnv = String(process.env.APP_ENV || '').trim().toLowerCase();
  if (appEnv !== 'staging') {
    console.log('[staging-smoke-users] skipped: APP_ENV is not staging.');
    return false;
  }

  if (!enabled(process.env.STAGING_SMOKE_USERS_ENABLED) && !enabled(process.env.STAGING_AUTH_FIXTURES_ENABLED)) {
    console.log('[staging-smoke-users] skipped: STAGING_SMOKE_USERS_ENABLED/STAGING_AUTH_FIXTURES_ENABLED is not true.');
    return false;
  }

  return true;
}

function dbConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

function validateDbConfig(config) {
  const missing = [];
  if (!config.host) missing.push('DB_HOST or DATABASE_URL host');
  if (!config.user) missing.push('DB_USER or DATABASE_URL user');
  if (!config.password) missing.push('DB_PASSWORD or DATABASE_URL password');
  if (!config.database) missing.push('DB_NAME or DATABASE_URL database');
  if (missing.length) {
    throw new Error(`[staging-smoke-users] missing database config: ${missing.join(', ')}`);
  }
}

function maskedEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '[invalid-email]';
  return `${name.slice(0, 2)}***@${domain}`;
}

function normalizePassword(password) {
  const value = String(password || '');
  if (SHA256_HEX_REGEX.test(value)) return value;
  return crypto.createHash('sha256').update(value).digest('hex');
}

function loadUsers() {
  const users = [
    {
      role: 'admin',
      email:
        process.env.STAGING_SMOKE_ADMIN_EMAIL ||
        process.env.STAGING_AUTH_ADMIN_EMAIL ||
        process.env.ENTERPRISE_GATE_ADMIN_EMAIL ||
        process.env.E2E_AUTH_EMAIL,
      password:
        process.env.STAGING_SMOKE_ADMIN_PASSWORD ||
        process.env.STAGING_AUTH_ADMIN_PASSWORD ||
        process.env.ENTERPRISE_GATE_ADMIN_PASSWORD ||
        process.env.E2E_AUTH_PASSWORD,
      username: process.env.STAGING_SMOKE_ADMIN_USERNAME || process.env.STAGING_AUTH_ADMIN_USERNAME || 'Urban Staging Admin',
    },
    {
      role: 'host',
      email:
        process.env.STAGING_SMOKE_HOST_EMAIL ||
        process.env.STAGING_AUTH_HOST_EMAIL ||
        process.env.ENTERPRISE_GATE_HOST_EMAIL ||
        process.env.E2E_HOST_EMAIL,
      password:
        process.env.STAGING_SMOKE_HOST_PASSWORD ||
        process.env.STAGING_AUTH_HOST_PASSWORD ||
        process.env.ENTERPRISE_GATE_HOST_PASSWORD ||
        process.env.E2E_HOST_PASSWORD,
      username: process.env.STAGING_SMOKE_HOST_USERNAME || process.env.STAGING_AUTH_HOST_USERNAME || 'Urban Staging Host',
    },
  ];

  const enabledUsers = users.filter((user) => user.email || user.password);
  const missing = enabledUsers.flatMap((user) => {
    const fields = [];
    if (!user.email) fields.push(`${user.role}:email`);
    if (!user.password) fields.push(`${user.role}:password`);
    return fields;
  });

  if (missing.length) {
    throw new Error(`[staging-smoke-users] incomplete user config: ${missing.join(', ')}`);
  }

  if (!enabledUsers.length) {
    throw new Error('[staging-smoke-users] set at least STAGING_SMOKE_ADMIN_EMAIL/PASSWORD or STAGING_SMOKE_HOST_EMAIL/PASSWORD.');
  }

  return enabledUsers.map((user) => ({
    ...user,
    email: String(user.email).trim().toLowerCase(),
    password: normalizePassword(user.password),
  }));
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [tableName],
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function passwordMatches(submitted, storedHash) {
  if (!storedHash) return false;
  if (/^\$2[aby]\$/.test(storedHash)) {
    if (await bcrypt.compare(submitted, storedHash)) return true;
    if (!SHA256_HEX_REGEX.test(submitted)) {
      const asSha = crypto.createHash('sha256').update(submitted).digest('hex');
      return bcrypt.compare(asSha, storedHash);
    }
    return false;
  }
  if (SHA256_HEX_REGEX.test(storedHash)) {
    const submittedSha = SHA256_HEX_REGEX.test(submitted)
      ? submitted
      : crypto.createHash('sha256').update(submitted).digest('hex');
    return submittedSha === storedHash;
  }
  return false;
}

async function upsertUser(connection, user) {
  const [rows] = await connection.execute(
    'SELECT id, email, password, role, ativo FROM `user` WHERE email = ? LIMIT 1',
    [user.email],
  );

  const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
  const existing = rows?.[0];
  if (!existing) {
    await connection.execute(
      `
        INSERT INTO \`user\`
          (id, username, email, password, createdAt, distance_km, ativo, pricingStrategy, operationMode, role)
        VALUES
          (?, ?, ?, ?, NOW(), 30, true, 'balanced', 'notifications', ?)
      `,
      [crypto.randomUUID(), user.username, user.email, passwordHash, user.role],
    );
    return 'created';
  }

  const shouldUpdatePassword = !(await passwordMatches(user.password, existing.password));
  if (shouldUpdatePassword) {
    await connection.execute(
      'UPDATE `user` SET username = ?, password = ?, role = ?, ativo = true WHERE id = ?',
      [user.username, passwordHash, user.role, existing.id],
    );
    return 'updated-password-role';
  }

  if (existing.role !== user.role || existing.ativo !== 1) {
    await connection.execute(
      'UPDATE `user` SET username = ?, role = ?, ativo = true WHERE id = ?',
      [user.username, user.role, existing.id],
    );
    return 'updated-role';
  }

  return 'unchanged';
}

async function main() {
  if (!requireStaging()) return;

  const config = dbConfig();
  validateDbConfig(config);

  const users = loadUsers();
  const connection = await mysql.createConnection(config);
  try {
    if (!(await tableExists(connection, 'user'))) {
      throw new Error('[staging-smoke-users] table `user` does not exist yet; enable after schema bootstrap/migrations.');
    }

    for (const user of users) {
      const action = await upsertUser(connection, user);
      console.log(`[staging-smoke-users] ${action}: ${user.role} ${maskedEmail(user.email)}`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
