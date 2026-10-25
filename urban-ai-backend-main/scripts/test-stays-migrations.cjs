/**
 * Drill com MySQL real das migrations Stays. Cria e derruba só o próprio banco
 * sintético aleatório; nunca toca outro schema.
 *
 *   STAYS_MYSQL_TEST_URL=mysql://root:senha@127.0.0.1:13367 node scripts/test-stays-migrations.cjs [--full-schema]
 */
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { AddStaysProviderMetadata1788600000000 } = require('../src/migrations/1788600000000-AddStaysProviderMetadata');
const { ScopeStaysListingsToAccount1788610000000 } = require('../src/migrations/1788610000000-ScopeStaysListingsToAccount');
const { StaysAccountSlugAndFailureCounter1792800000000 } = require('../src/migrations/1792800000000-StaysAccountSlugAndFailureCounter');

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
  const evidence = { databaseEngine: null, scenarios: [], slugConversion: null, syntheticDataOnly: true };
  try {
    evidence.databaseEngine = (await admin.query('SELECT VERSION() AS version'))[0][0].version;
    await admin.query('CREATE DATABASE `' + database + '`');
    created = true;
    source = new DataSource({ type: 'mysql', host: options.host, port: options.port,
      username: options.user, password: options.password, database, synchronize: false, logging: false });
    await source.initialize();
    const runner = source.createQueryRunner();
    await runner.connect();
    const metadata = new AddStaysProviderMetadata1788600000000();
    const scope = new ScopeStaysListingsToAccount1788610000000();
    const slug = new StaysAccountSlugAndFailureCounter1792800000000();
    try {
      for (const oldIndex of ['IDX_stays_listings_listing_id', 'IDX_generated_legacy_unique']) {
        await runner.query('CREATE TABLE stays_accounts (id varchar(36) PRIMARY KEY) ENGINE=InnoDB');
        await runner.query('CREATE TABLE stays_listings (id varchar(36) PRIMARY KEY, stays_account_id varchar(36) NOT NULL, staysListingId varchar(64) NOT NULL, CONSTRAINT fk_drill_account FOREIGN KEY (stays_account_id) REFERENCES stays_accounts(id), UNIQUE INDEX `' + oldIndex + '` (staysListingId)) ENGINE=InnoDB');
        await runner.query("INSERT INTO stays_accounts VALUES ('account-a'), ('account-b')");
        await runner.query("INSERT INTO stays_listings VALUES ('listing-a', 'account-a', 'same-remote')");
        for (let i = 0; i < 2; i++) { // idempotência: roda duas vezes
          await metadata.up(runner);
          await scope.up(runner);
          await slug.up(runner);
        }
        assert.equal(await runner.hasColumn('stays_accounts', 'apiBaseUrl'), false, 'URL livre não volta a existir');
        assert.equal(await runner.hasColumn('stays_accounts', 'apiAccountSlug'), true);
        assert.equal(Number((await runner.query("SELECT consecutiveFailures AS n FROM stays_accounts WHERE id = 'account-a'"))[0].n), 0);
        await runner.query('UPDATE stays_listings SET providerMetadata = ? WHERE id = ?', [JSON.stringify({ currency: 'BRL', propertyId: 'building' }), 'listing-a']);
        await runner.query("UPDATE stays_accounts SET apiAccountSlug = 'conta-a' WHERE id = 'account-a'");
        await runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('listing-b', 'account-b', 'same-remote')");
        await assert.rejects(runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('duplicate', 'account-a', 'same-remote')"), (error) => error.driverError?.code === 'ER_DUP_ENTRY');
        await assert.rejects(scope.down(runner), /Cannot restore global Stays uniqueness/);
        assert.equal(Number((await runner.query('SELECT COUNT(*) AS n FROM stays_listings'))[0].n), 2);
        assert.equal((await runner.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(providerMetadata, '$.currency')) AS currency FROM stays_listings WHERE id = 'listing-a'"))[0].currency, 'BRL');
        await runner.query("DELETE FROM stays_listings WHERE id = 'listing-b'");
        await slug.down(runner);
        assert.equal(await runner.hasColumn('stays_accounts', 'apiAccountSlug'), false);
        await scope.down(runner);
        await assert.rejects(runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('orphan', 'missing-account', 'unique-remote')"), (error) => error.driverError?.code === 'ER_NO_REFERENCED_ROW_2');
        await assert.rejects(runner.query("INSERT INTO stays_listings (id, stays_account_id, staysListingId) VALUES ('listing-b', 'account-b', 'same-remote')"), (error) => error.driverError?.code === 'ER_DUP_ENTRY');
        await metadata.down(runner);
        assert.equal(await runner.hasColumn('stays_listings', 'providerMetadata'), false);
        assert.deepEqual(await runner.query('SELECT id, stays_account_id, staysListingId FROM stays_listings'), [{ id: 'listing-a', stays_account_id: 'account-a', staysListingId: 'same-remote' }]);
        await runner.query('DROP TABLE stays_listings');
        await runner.query('DROP TABLE stays_accounts');
        evidence.scenarios.push({ oldIndex, up: 'passed', rerun: 'passed', tenantUniqueness: 'passed', guardedDown: 'passed', down: 'passed', foreignKeyPreserved: 'passed', legacyDataPreserved: 'passed' });
      }

      // Ambiente que rodou a versão antiga (PR #19) e tem apiBaseUrl gravada.
      await runner.query('CREATE TABLE stays_accounts (id varchar(36) PRIMARY KEY, apiBaseUrl varchar(255) NULL) ENGINE=InnoDB');
      await runner.query("INSERT INTO stays_accounts VALUES ('ok-1', 'https://acme.stays.net'), ('ok-2', 'https://beta.stays.net/external/v1/'), ('none', NULL), ('bad', 'https://evil.example')");
      await assert.rejects(slug.up(runner), /Refusing to convert 1 Stays account URL\(s\).*bad/);
      assert.equal(await runner.hasColumn('stays_accounts', 'apiAccountSlug'), false, 'recusa antes de qualquer DDL');
      await runner.query("UPDATE stays_accounts SET apiBaseUrl = NULL WHERE id = 'bad'");
      await slug.up(runner);
      await slug.up(runner);
      const converted = await runner.query('SELECT id, apiAccountSlug FROM stays_accounts ORDER BY id');
      assert.deepEqual(converted.map((row) => [row.id, row.apiAccountSlug]), [['bad', null], ['none', null], ['ok-1', 'acme'], ['ok-2', 'beta']]);
      await runner.query("UPDATE stays_accounts SET apiBaseUrl = NULL WHERE id = 'ok-1'");
      await slug.down(runner);
      assert.equal((await runner.query("SELECT apiBaseUrl FROM stays_accounts WHERE id = 'ok-1'"))[0].apiBaseUrl, 'https://acme.stays.net');
      assert.equal(await runner.hasColumn('stays_accounts', 'consecutiveFailures'), false);
      await runner.query('DROP TABLE stays_accounts');
      evidence.slugConversion = { converted: 2, ambiguousRefusedBeforeDdl: 'passed', rerun: 'passed', downRestoresUrl: 'passed' };
    } finally { await runner.release(); }

    // Exercita o schema completo das entidades, sem config de produção nem
    // replay das migrations históricas não relacionadas.
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
          const baseline = await fullSource.driver.createSchemaBuilder().log();
          await slug.down(fullRunner);
          await scope.down(fullRunner);
          await metadata.down(fullRunner);
          await metadata.up(fullRunner);
          await scope.up(fullRunner);
          await slug.up(fullRunner);
          const restored = await fullSource.driver.createSchemaBuilder().log();
          assert.deepEqual(restored.upQueries.map((query) => query.query), baseline.upQueries.map((query) => query.query));
          assert.equal(await fullRunner.hasColumn('stays_accounts', 'apiAccountSlug'), true);
          assert.equal(await fullRunner.hasColumn('stays_accounts', 'consecutiveFailures'), true);
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
