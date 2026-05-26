const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mysql = require('mysql2/promise');

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const HEX_64 = /^[a-f0-9]{64}$/i;

const args = new Set(process.argv.slice(2));
const checkConfigOnly = args.has('--check-config');
const dryRun = args.has('--dry-run') || checkConfigOnly;
const emitTokens = args.has('--emit-tokens') || process.env.STAGING_AUTH_EMIT_TOKENS === 'true';

function argValue(name) {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function value(name) {
  return process.env[name]?.trim() || '';
}

function runtimeEnv() {
  return value('APP_ENV') || value('NODE_ENV');
}

function requireStagingGuard() {
  const env = runtimeEnv();
  if (env !== 'staging') {
    throw new Error('Refusing to run: APP_ENV or NODE_ENV must be exactly "staging".');
  }

  if (value('STAGING_AUTH_FIXTURES_ENABLED') !== 'true') {
    throw new Error('Refusing to run: set STAGING_AUTH_FIXTURES_ENABLED=true explicitly.');
  }
}

function assertPlaintextPassword(name, password) {
  if (!password) {
    throw new Error(`${name} is required.`);
  }
  if (password.length < 12) {
    throw new Error(`${name} must have at least 12 characters.`);
  }
  if (HEX_64.test(password)) {
    throw new Error(`${name} must be the plaintext test password, not a SHA-256 digest.`);
  }
  if (/^(password|changeme|urbanai|admin123)/i.test(password)) {
    throw new Error(`${name} is too weak for staging fixtures.`);
  }
}

function assertEmail(name, email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${name} must be a valid email.`);
  }
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '[configured]';
  return `${name.slice(0, 2)}***@${domain}`;
}

function fixtureConfig() {
  const adminEmail = value('STAGING_AUTH_ADMIN_EMAIL') || value('ENTERPRISE_GATE_ADMIN_EMAIL');
  const adminPassword = value('STAGING_AUTH_ADMIN_PASSWORD') || value('ENTERPRISE_GATE_ADMIN_PASSWORD');
  const hostEmail = value('STAGING_AUTH_HOST_EMAIL') || value('ENTERPRISE_GATE_HOST_EMAIL');
  const hostPassword = value('STAGING_AUTH_HOST_PASSWORD') || value('ENTERPRISE_GATE_HOST_PASSWORD');

  assertEmail('STAGING_AUTH_ADMIN_EMAIL', adminEmail);
  assertEmail('STAGING_AUTH_HOST_EMAIL', hostEmail);
  assertPlaintextPassword('STAGING_AUTH_ADMIN_PASSWORD', adminPassword);
  assertPlaintextPassword('STAGING_AUTH_HOST_PASSWORD', hostPassword);

  if (adminEmail.toLowerCase() === hostEmail.toLowerCase()) {
    throw new Error('Admin and host fixture emails must be different.');
  }

  return [
    {
      label: 'admin',
      role: 'admin',
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      username: value('STAGING_AUTH_ADMIN_USERNAME') || 'Urban AI Staging Admin',
    },
    {
      label: 'host',
      role: 'host',
      email: hostEmail.toLowerCase(),
      password: hostPassword,
      username: value('STAGING_AUTH_HOST_USERNAME') || 'Urban AI Staging Host',
    },
  ];
}

function databaseConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    };
  }

  return {
    host: value('DB_HOST'),
    port: Number(value('DB_PORT') || 3306),
    user: value('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: value('DB_NAME'),
  };
}

function assertDbConfig(config) {
  if (!config.host || !config.user || !config.database) {
    throw new Error('Database configuration is incomplete. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.');
  }

  const target = `${config.host} ${config.database}`.toLowerCase();
  if (/(^|[-_.])prod(uction)?($|[-_.])/.test(target)) {
    throw new Error('Refusing apparent production database target. Use the dedicated staging database.');
  }
}

function sha256(valueToHash) {
  return crypto.createHash('sha256').update(valueToHash).digest('hex');
}

function mysqlNow() {
  return new Date();
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

async function tableColumns(connection, database, tableName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?`,
    [database, tableName],
  );
  return new Set(rows.map((row) => row.columnName));
}

function requireColumns(columns, names) {
  const missing = names.filter((name) => !columns.has(name));
  if (missing.length) {
    throw new Error(`User table is missing required columns: ${missing.join(', ')}`);
  }
}

function buildInsert(columns, fixture, passwordHash) {
  const row = {
    id: crypto.randomUUID(),
    username: fixture.username,
    email: fixture.email,
    password: passwordHash,
    ativo: 1,
    role: fixture.role,
  };

  if (columns.has('createdAt')) row.createdAt = mysqlNow();
  if (columns.has('distance_km')) row.distance_km = 30;
  if (columns.has('pricingStrategy')) row.pricingStrategy = 'balanced';
  if (columns.has('operationMode')) row.operationMode = 'notifications';
  if (columns.has('company')) row.company = 'Urban AI QA';
  if (columns.has('airbnbHostId') && fixture.role === 'host') {
    row.airbnbHostId = 'staging-host-fixture';
  }

  return row;
}

async function passwordMatches(password, storedHash) {
  if (!storedHash) return false;
  const frontendSubmitted = sha256(password);

  if (storedHash === frontendSubmitted) return true;
  if (/^\$2[aby]\$/.test(storedHash)) {
    return (
      (await bcrypt.compare(frontendSubmitted, storedHash)) ||
      (await bcrypt.compare(password, storedHash))
    );
  }

  return false;
}

async function ensureUser(connection, columns, fixture) {
  const [rows] = await connection.execute(
    'SELECT `id`, `username`, `email`, `password`, `ativo`, `role` FROM `user` WHERE `email` = ? LIMIT 1 FOR UPDATE',
    [fixture.email],
  );

  const passwordOk = rows[0] ? await passwordMatches(fixture.password, rows[0].password) : false;
  const passwordHash = passwordOk ? null : await bcrypt.hash(sha256(fixture.password), BCRYPT_ROUNDS);

  if (!rows[0]) {
    if (dryRun) {
      return { label: fixture.label, email: fixture.email, role: fixture.role, status: 'would_create' };
    }

    const insertRow = buildInsert(columns, fixture, passwordHash);
    const keys = Object.keys(insertRow);
    await connection.execute(
      `INSERT INTO \`user\` (${keys.map(quoteIdentifier).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      keys.map((key) => insertRow[key]),
    );
    return {
      label: fixture.label,
      email: fixture.email,
      role: fixture.role,
      status: 'created',
      userId: insertRow.id,
      username: fixture.username,
    };
  }

  const existing = rows[0];
  const updates = {};
  if (existing.username !== fixture.username) updates.username = fixture.username;
  if (existing.role !== fixture.role) updates.role = fixture.role;
  if (Number(existing.ativo) !== 1) updates.ativo = 1;
  if (!passwordOk) updates.password = passwordHash;

  if (Object.keys(updates).length === 0) {
    return {
      label: fixture.label,
      email: fixture.email,
      role: fixture.role,
      status: 'unchanged',
      userId: existing.id,
      username: existing.username,
    };
  }

  if (dryRun) {
    return {
      label: fixture.label,
      email: fixture.email,
      role: fixture.role,
      status: 'would_update',
      userId: existing.id,
      updates: Object.keys(updates).filter((key) => key !== 'password'),
      passwordWouldRotate: Boolean(updates.password),
    };
  }

  const updateKeys = Object.keys(updates);
  await connection.execute(
    `UPDATE \`user\` SET ${updateKeys.map((key) => `${quoteIdentifier(key)} = ?`).join(', ')} WHERE \`id\` = ?`,
    [...updateKeys.map((key) => updates[key]), existing.id],
  );

  return {
    label: fixture.label,
    email: fixture.email,
    role: fixture.role,
    status: 'updated',
    userId: existing.id,
    username: fixture.username,
    updatedFields: updateKeys.filter((key) => key !== 'password'),
    passwordRotated: Boolean(updates.password),
  };
}

function signJwt(user, ttlSeconds) {
  const secret = value('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET is required when --emit-tokens is used.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.userId,
    username: user.username,
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function tokenTtlSeconds() {
  const configured = Number(value('STAGING_AUTH_JWT_TTL_SECONDS') || ACCESS_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured < 60 || configured > 3600) {
    throw new Error('STAGING_AUTH_JWT_TTL_SECONDS must be between 60 and 3600 seconds.');
  }
  return Math.floor(configured);
}

function assertEphemeralOutputPath(outputPath) {
  const resolved = path.resolve(outputPath);
  const cwd = path.resolve(process.cwd());
  const tmp = path.resolve(os.tmpdir());

  if (resolved.startsWith(cwd) && value('STAGING_AUTH_ALLOW_REPO_TOKEN_OUTPUT') !== 'true') {
    throw new Error('Refusing to write tokens inside the repo. Use an OS temp path or GITHUB_OUTPUT.');
  }

  if (!resolved.startsWith(tmp) && !process.env.GITHUB_OUTPUT && value('STAGING_AUTH_ALLOW_NON_TMP_TOKEN_OUTPUT') !== 'true') {
    throw new Error('Refusing to write tokens outside the OS temp directory without explicit override.');
  }

  return resolved;
}

function writeTokenOutputs(results) {
  if (!emitTokens) return;

  const ttl = tokenTtlSeconds();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const admin = results.find((result) => result.label === 'admin');
  const host = results.find((result) => result.label === 'host');
  const payload = {
    generatedAt: new Date().toISOString(),
    expiresAt,
    admin: {
      email: admin.email,
      userId: admin.userId,
      role: admin.role,
      accessToken: signJwt(admin, ttl),
    },
    host: {
      email: host.email,
      userId: host.userId,
      role: host.role,
      accessToken: signJwt(host, ttl),
    },
  };

  if (process.env.GITHUB_OUTPUT) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log(`::add-mask::${payload.admin.accessToken}`);
      console.log(`::add-mask::${payload.host.accessToken}`);
    }
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `ENTERPRISE_GATE_ADMIN_JWT=${payload.admin.accessToken}`,
        `ENTERPRISE_GATE_HOST_JWT=${payload.host.accessToken}`,
        `STAGING_AUTH_TOKENS_EXPIRE_AT=${expiresAt}`,
      ].join('\n') + '\n',
    );
    return;
  }

  const outputPath = argValue('--token-output') || value('STAGING_AUTH_TOKEN_OUTPUT');
  if (!outputPath) {
    throw new Error('--emit-tokens requires GITHUB_OUTPUT or STAGING_AUTH_TOKEN_OUTPUT/--token-output.');
  }

  const resolved = assertEphemeralOutputPath(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

async function main() {
  requireStagingGuard();
  const fixtures = fixtureConfig();

  if (checkConfigOnly) {
    console.log('[staging-auth-fixtures] Config OK for staging auth fixtures. No database connection was opened.');
    return;
  }

  const config = databaseConfig();
  assertDbConfig(config);

  const connection = await mysql.createConnection(config);
  const results = [];
  try {
    const columns = await tableColumns(connection, config.database, 'user');
    requireColumns(columns, ['id', 'username', 'email', 'password', 'ativo', 'role']);

    if (!dryRun) await connection.beginTransaction();
    for (const fixture of fixtures) {
      results.push(await ensureUser(connection, columns, fixture));
    }
    if (!dryRun) await connection.commit();
  } catch (error) {
    if (!dryRun) await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.end();
  }

  if (!dryRun) {
    writeTokenOutputs(results);
  }

  for (const result of results) {
    const bits = [
      `label=${result.label}`,
      `email=${maskEmail(result.email)}`,
      `role=${result.role}`,
      `status=${result.status}`,
    ];
    if (result.userId) bits.push(`userId=${result.userId}`);
    if (result.passwordRotated || result.passwordWouldRotate) bits.push('password=rotated');
    console.log(`[staging-auth-fixtures] ${bits.join(' ')}`);
  }

  if (emitTokens) {
    console.log('[staging-auth-fixtures] Token output written to the configured ephemeral destination.');
  }
}

main().catch((error) => {
  console.error(`[staging-auth-fixtures] Failed: ${error.message}`);
  process.exit(1);
});
