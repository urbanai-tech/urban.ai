const mysql = require('mysql2/promise');

const runtimeEnv = process.env.APP_ENV || process.env.NODE_ENV || '';
const shouldRun =
  runtimeEnv === 'staging' &&
  process.env.DB_SYNCHRONIZE === 'true' &&
  process.env.DB_SCHEMA_BOOTSTRAP_REPAIR !== 'false';
const metadataTables = new Set(['migrations', 'typeorm_metadata']);

if (!shouldRun) {
  process.exit(0);
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
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}

async function repairWaitlistAutoIncrement(connection, database) {
  const [columns] = await connection.execute(
    `SELECT EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'waitlist'
        AND COLUMN_NAME = 'position'`,
    [database],
  );

  const positionColumn = columns[0];
  if (!positionColumn || !String(positionColumn.EXTRA || '').includes('auto_increment')) {
    return;
  }

  console.log('[schema-repair] Removing stale AUTO_INCREMENT from waitlist.position');

  try {
    await connection.execute('ALTER TABLE `waitlist` MODIFY `position` INT NOT NULL');
    return;
  } catch (error) {
    const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM `waitlist`');
    const count = Number(rows[0]?.count || 0);
    if (count > 0) {
      throw error;
    }

    console.log('[schema-repair] Dropping empty partial waitlist table after ALTER failed');
    await connection.execute('DROP TABLE `waitlist`');
  }
}

async function dropEmptyPartialSchema(connection, database) {
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'`,
    [database],
  );

  if (tables.length === 0) {
    return;
  }

  for (const table of tables) {
    const tableName = quoteIdentifier(table.tableName);
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${tableName}`);
    const count = Number(rows[0]?.count || 0);
    if (count > 0 && !metadataTables.has(table.tableName)) {
      console.log(
        `[schema-repair] Existing staging schema has data in ${table.tableName} (${count} rows); skipping empty-schema reset`,
      );
      return;
    }
  }

  console.log(`[schema-repair] Dropping ${tables.length} empty partial staging tables before sync`);
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      const tableName = quoteIdentifier(table.tableName);
      await connection.query(`DROP TABLE ${tableName}`);
    }
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

async function main() {
  const config = databaseConfig();
  if (!config.host || !config.user || !config.database) {
    throw new Error('Database configuration is incomplete for staging schema repair');
  }

  const connection = await mysql.createConnection(config);
  try {
    await dropEmptyPartialSchema(connection, config.database);
    await repairWaitlistAutoIncrement(connection, config.database);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('[schema-repair] Failed:', error.message);
  process.exit(1);
});
