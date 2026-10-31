import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

/**
 * Camada de fontes de mercado (ADR 0028). Aditiva e idempotente:
 *  - `external_listing` ganha colunas opcionais (bairro, tipo, ocupação observada, id do Airbnb,
 *    data de coleta, licença, lote); linhas existentes do Inside Airbnb são marcadas `cc_by_4`
 *    e ganham `collectedAt = snapshotDate`; as demais ficam `unknown` (nunca entram no mercado);
 *  - cria `market_listing_observation` (histórico por anúncio e data) e `market_ingest_log`.
 * `down` remove tudo o que esta migration criou (os dados importados pelo admin se perdem).
 */
export class MarketMultiSourceLayer1793730000000 implements MigrationInterface {
  name = 'MarketMultiSourceLayer1793730000000';

  private readonly columns: TableColumn[] = [
    new TableColumn({ name: 'neighborhood', type: 'varchar', length: '96', isNullable: true }),
    new TableColumn({ name: 'listingType', type: 'varchar', length: '24', isNullable: true }),
    new TableColumn({ name: 'occupancyRate', type: 'float', isNullable: true }),
    new TableColumn({ name: 'airbnbListingId', type: 'varchar', length: '32', isNullable: true }),
    new TableColumn({ name: 'collectedAt', type: 'date', isNullable: true }),
    new TableColumn({ name: 'license', type: 'varchar', length: '32', isNullable: true }),
    new TableColumn({ name: 'ingestBatchId', type: 'varchar', length: '36', isNullable: true }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('external_listing')) {
      for (const column of this.columns) {
        if (!(await queryRunner.hasColumn('external_listing', column.name))) {
          await queryRunner.addColumn('external_listing', column);
        }
      }
      await queryRunner.query(
        "UPDATE `external_listing` SET `license` = 'cc_by_4', `collectedAt` = `snapshotDate`, `airbnbListingId` = `externalId` WHERE `source` = 'inside-airbnb' AND `license` IS NULL",
      );
      await queryRunner.query("UPDATE `external_listing` SET `license` = 'unknown' WHERE `license` IS NULL");
      const table = await queryRunner.getTable('external_listing');
      if (!table?.indices.some((index) => index.name === 'IDX_external_listing_source_collected')) {
        await queryRunner.createIndex(
          'external_listing',
          new TableIndex({ name: 'IDX_external_listing_source_collected', columnNames: ['source', 'collectedAt'] }),
        );
      }
    }

    if (!(await queryRunner.hasTable('market_listing_observation'))) {
      await queryRunner.createTable(
        new Table({
          name: 'market_listing_observation',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'externalListingId', type: 'varchar', length: '36', isNullable: false },
            { name: 'observedOn', type: 'date', isNullable: false },
            { name: 'priceCents', type: 'int', isNullable: true },
            { name: 'occupancyRate', type: 'float', isNullable: true },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'market_listing_observation',
        new TableIndex({
          name: 'UQ_market_obs_listing_date',
          columnNames: ['externalListingId', 'observedOn'],
          isUnique: true,
        }),
      );
      await queryRunner.createIndex(
        'market_listing_observation',
        new TableIndex({ name: 'IDX_market_obs_date', columnNames: ['observedOn'] }),
      );
    }

    if (!(await queryRunner.hasTable('market_ingest_log'))) {
      await queryRunner.createTable(
        new Table({
          name: 'market_ingest_log',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'source', type: 'varchar', length: '32', isNullable: false },
            { name: 'city', type: 'varchar', length: '48', isNullable: false },
            { name: 'license', type: 'varchar', length: '32', isNullable: false },
            { name: 'collectedAt', type: 'date', isNullable: true },
            { name: 'fileName', type: 'varchar', length: '255', isNullable: true },
            { name: 'rowsParsed', type: 'int', default: 0, isNullable: false },
            { name: 'rowsImported', type: 'int', default: 0, isNullable: false },
            { name: 'rowsSkipped', type: 'int', default: 0, isNullable: false },
            { name: 'observationsImported', type: 'int', default: 0, isNullable: false },
            { name: 'importedByUserId', type: 'varchar', length: '36', isNullable: true },
            { name: 'createdAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'market_ingest_log',
        new TableIndex({ name: 'IDX_market_ingest_source_created', columnNames: ['source', 'createdAt'] }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('market_ingest_log')) await queryRunner.dropTable('market_ingest_log', true);
    if (await queryRunner.hasTable('market_listing_observation')) {
      await queryRunner.dropTable('market_listing_observation', true);
    }
    if (await queryRunner.hasTable('external_listing')) {
      const table = await queryRunner.getTable('external_listing');
      if (table?.indices.some((index) => index.name === 'IDX_external_listing_source_collected')) {
        await queryRunner.dropIndex('external_listing', 'IDX_external_listing_source_collected');
      }
      for (const column of [...this.columns].reverse()) {
        if (await queryRunner.hasColumn('external_listing', column.name)) {
          await queryRunner.dropColumn('external_listing', column.name);
        }
      }
    }
  }
}
