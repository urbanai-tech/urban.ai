import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * O ID remoto Stays só é único dentro da conta: duas contas podem ter o mesmo
 * `_id`. Troca o unique global por (stays_account_id, staysListingId).
 *
 * Portado do PR #19 SEM a coluna `apiBaseUrl` (URL livre = SSRF); o destino
 * da conta agora é o slug de 1792800000000-StaysAccountSlugAndFailureCounter.
 * Ambientes que já rodaram a versão antiga têm `apiBaseUrl`; aquela migration
 * converte o valor para slug.
 */
export class ScopeStaysListingsToAccount1788610000000 implements MigrationInterface {
  name = 'ScopeStaysListingsToAccount1788610000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('stays_listings');
    if (!table) throw new Error('stays_listings is required');
    if (!table.indices.some((index) => index.name === 'IDX_stays_listings_account_remote')) {
      await queryRunner.createIndex('stays_listings', new TableIndex({
        name: 'IDX_stays_listings_account_remote', columnNames: ['stays_account_id', 'staysListingId'], isUnique: true,
      }));
    }
    // Também cobre instalações cujo índice antigo foi nomeado pelo synchronize.
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
      // O InnoDB pode descartar o índice implícito da FK quando o composto o cobre.
      // Restaura um índice iniciado por stays_account_id antes de remover o composto.
      if (!table.indices.some((index) => index.name !== 'IDX_stays_listings_account_remote' && index.columnNames[0] === 'stays_account_id')) {
        await queryRunner.createIndex('stays_listings', new TableIndex({
          name: 'IDX_stays_listings_account', columnNames: ['stays_account_id'],
        }));
      }
      await queryRunner.dropIndex('stays_listings', 'IDX_stays_listings_account_remote');
    }
  }
}
