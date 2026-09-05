/** Real MySQL drill. Creates and drops only its own random, synthetic database. */
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { AddStaysProviderMetadata1788600000000 } = require('../src/migrations/1788600000000-AddStaysProviderMetadata');
const { ScopeStaysListingsToAccount1788610000000 } = require('../src/migrations/1788610000000-ScopeStaysListingsToAccount');

async function main() {
  const target = new URL(process.env.STAYS_MYSQL_TEST_URL || 'mysql://root@127.0.0.1:13367');
  if (target.protocol !== 'mysql:' || target.hostname !== '127.0.0.1' ||
      !target.port || target.port === '3306' || (target.pathname && target.pathname !== '/') || target.search || target.hash) {
    throw new Error('Use a dedicated loopback MySQL test server on a non-default port, with no database in the URL.');
  }
  const options = { host: target.hostname, port: Number(target.port),
    user: decodeURIComponent(target.username), password: decodeURIComponent(target.password) };
  const admin = await mysql.createConnection(options);
  const database = 'stays_drill_' + randomBytes(12).toString('hex');
  let created = false;
  let source;
  const evidence = { databaseEngine: null, scenarios: [], syntheticDataOnly: true };
  try {
    evidence.databaseEngine = (await admin.query('SELECT VERSION() AS version'))[0][0].version;
    await admin.query('CREATE DATABASE `' + database + '`');
    created = true;
    source = new DataSource({ type: 'mysql', host: options.host, port: options.port,
      username: options.user, password: options.password, database, synchronize: false, logging: false });
    await source.initialize();
    const runner = source.createQueryRunner();
    await runner.connect();
    try {
      for (const oldIndex of ['IDX_stays_listings_listing_id', 'IDX_generated_legacy_unique']) {
        await runner.query('CREATE TABLE stays_accounts (id varchar(36) PRIMARY KEY) ENGINE=InnoDB');
        await runner.query('CREATE TABLE stays_listings (id varchar(36) PRIMARY KEY, stays_account_id varchar(36) NOT NULL, staysListingId varchar(64) NOT NULL, CONSTRAINT fk_drill_account FOREIGN KEY (stays_account_id) REFERENCES stays_accounts(id), UNIQUE INDEX `' + oldIndex + '` (staysListingId)) ENGINE=InnoDB');
        await runner.query("INSERT INTO stays_accounts VALUES ('account-a'), ('account-b')");
        await runner.query("INSERT INTO stays_listings VALUES ('listing-a', 'account-a', 'same-remote')");
        const metadata = new AddStaysProviderMetadata1788600000000();
        const scope = new ScopeStaysListingsToAccount1788610000000();
        await metadata.up(runner);
        await scope.up(runner);
        await metadata.up(runner);
        await scope.up(runner);
        await runner.query('UPDATE stays_listings SET providerMetadata = ? WHERE id = ?', [JSON.stringify({ currency: 'BRL', propertyId: 'building' }), 'listing-a']);
        await runner.query("UPDATE stays_accounts SET apiBaseUrl = 'https://a.stays.net' WHERE id = 'account-a'");
        await runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('listing-b', 'account-b', 'same-remote')");
        await assert.rejects(runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('duplicate', 'account-a', 'same-remote')"), (error) => error.driverError?.code === 'ER_DUP_ENTRY');
        await assert.rejects(scope.down(runner), /Cannot restore global Stays uniqueness/);
        assert.equal(await runner.hasColumn('stays_accounts', 'apiBaseUrl'), true);
        assert.equal(Number((await runner.query('SELECT COUNT(*) AS n FROM stays_listings'))[0].n), 2);
        assert.equal((await runner.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(providerMetadata, '$.currency')) AS currency FROM stays_listings WHERE id = 'listing-a'"))[0].currency, 'BRL');
        await runner.query("DELETE FROM stays_listings WHERE id = 'listing-b'");
        await scope.down(runner);
        assert.equal(await runner.hasColumn('stays_accounts', 'apiBaseUrl'), false);
        await assert.rejects(runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('orphan', 'missing-account', 'unique-remote')"), (error) => error.driverError?.code === 'ER_NO_REFERENCED_ROW_2');
        await assert.rejects(runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('listing-b', 'account-b', 'same-remote')"), (error) => error.driverError?.code === 'ER_DUP_ENTRY');
        await metadata.down(runner);
        assert.equal(await runner.hasColumn('stays_listings', 'providerMetadata'), false);
        assert.deepEqual(await runner.query('SELECT id, stays_account_id, staysListingId FROM stays_listings'), [{ id: 'listing-a', stays_account_id: 'account-a', staysListingId: 'same-remote' }]);
        await runner.query('DROP TABLE stays_listings');
        await runner.query('DROP TABLE stays_accounts');
        evidence.scenarios.push({ oldIndex, up: 'passed', rerun: 'passed', tenantUniqueness: 'passed', guardedDown: 'passed', down: 'passed', foreignKeyPreserved: 'passed', legacyDataPreserved: 'passed' });
      }
    } finally { await runner.release(); }
    // Exercise the complete current entity schema, without importing production
    // configuration or replaying unrelated historical migrations.
    if (process.argv.includes('--full-schema')) {
      const fullSource = new DataSource({ ...source.options, entities: [
        path.join(__dirname, '../src/**/*.entity.ts'), path.join(__dirname, '../src/entities/*.ts'),
      ] });
      await fullSource.initialize();
      try {
        await fullSource.synchronize();
        const fullRunner = fullSource.createQueryRunner();
        await fullRunner.connect();
        try {
          const metadata = new AddStaysProviderMetadata1788600000000();
          const scope = new ScopeStaysListingsToAccount1788610000000();
          const baseline = await fullSource.driver.createSchemaBuilder().log();
          await scope.down(fullRunner);
          await metadata.down(fullRunner);
          await metadata.up(fullRunner);
          await scope.up(fullRunner);
          const restored = await fullSource.driver.createSchemaBuilder().log();
          assert.deepEqual(restored.upQueries.map((query) => query.query), baseline.upQueries.map((query) => query.query));
          assert.equal(await fullRunner.hasColumn('stays_accounts', 'apiBaseUrl'), true);
          assert.equal(await fullRunner.hasColumn('stays_listings', 'providerMetadata'), true);
          evidence.fullEntitySchema = { entities: fullSource.entityMetadatas.length, roundTrip: 'passed', additionalSchemaDrift: 0 };
        } finally { await fullRunner.release(); }
      } finally { await fullSource.destroy(); }
    }
  } finally {
    if (source?.isInitialized) await source.destroy();
    if (created) await admin.query('DROP DATABASE `' + database + '`');
    await admin.end();
  }
  console.log(JSON.stringify(evidence, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
