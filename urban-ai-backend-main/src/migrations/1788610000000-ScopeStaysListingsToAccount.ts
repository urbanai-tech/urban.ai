import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class ScopeStaysListingsToAccount1788610000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('stays_accounts', 'apiBaseUrl'))) {
      await queryRunner.addColumn('stays_accounts', new TableColumn({
        name: 'apiBaseUrl', type: 'varchar', length: '255', isNullable: true,
      }));
    }
    const table = await queryRunner.getTable('stays_listings');
    if (!table) throw new Error('stays_listings is required');
    if (!table.indices.some((index) => index.name === 'IDX_stays_listings_account_remote')) {
      await queryRunner.createIndex('stays_listings', new TableIndex({
        name: 'IDX_stays_listings_account_remote', columnNames: ['stays_account_id', 'staysListingId'], isUnique: true,
      }));
    }
    // Also handles installations whose old index was named by synchronize.
    for (const index of table.indices) {
      if (index.isUnique && index.columnNames.length === 1 && index.columnNames[0] === 'staysListingId') {
        await queryRunner.dropIndex('stays_listings', index);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query('SELECT staysListingId FROM stays_listings GROUP BY staysListingId HAVING COUNT(*) > 1 LIMIT 1');
    if (duplicates.length) throw new Error('Cannot restore global Stays uniqueness while multiple accounts share a remote ID');
    const table = await queryRunner.getTable('stays_listings');
    if (!table) throw new Error('stays_listings is required');
    if (!table.indices.some((index) => index.isUnique && index.columnNames.length === 1 && index.columnNames[0] === 'staysListingId')) {
      await queryRunner.createIndex('stays_listings', new TableIndex({
        name: 'IDX_stays_listings_listing_id', columnNames: ['staysListingId'], isUnique: true,
      }));
    }
    if (table.indices.some((index) => index.name === 'IDX_stays_listings_account_remote')) {
      // InnoDB can discard an implicit FK index when the new composite covers it.
      // Restore an account-leading index before removing that composite on rollback.
      if (!table.indices.some((index) => index.name !== 'IDX_stays_listings_account_remote' && index.columnNames[0] === 'stays_account_id')) {
        await queryRunner.createIndex('stays_listings', new TableIndex({
          name: 'IDX_stays_listings_account', columnNames: ['stays_account_id'],
        }));
      }
      await queryRunner.dropIndex('stays_listings', 'IDX_stays_listings_account_remote');
    }
    if (await queryRunner.hasColumn('stays_accounts', 'apiBaseUrl')) {
      await queryRunner.dropColumn('stays_accounts', 'apiBaseUrl');
    }
  }
}
