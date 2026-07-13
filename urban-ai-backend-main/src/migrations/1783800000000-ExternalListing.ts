import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Comps externos de treino (Inside Airbnb etc.) — bootstrap do KNN.
 * Idempotente.
 */
export class ExternalListing1783800000000 implements MigrationInterface {
  name = 'ExternalListing1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('external_listing')) return;

    await queryRunner.createTable(
      new Table({
        name: 'external_listing',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'externalId', type: 'varchar', length: '32' },
          { name: 'source', type: 'varchar', length: '32', default: "'inside-airbnb'" },
          { name: 'city', type: 'varchar', length: '48' },
          { name: 'snapshotDate', type: 'date', isNullable: true },
          { name: 'latitude', type: 'float' },
          { name: 'longitude', type: 'float' },
          { name: 'priceCents', type: 'int', isNullable: true },
          { name: 'roomType', type: 'varchar', length: '48', isNullable: true },
          { name: 'bedrooms', type: 'int', isNullable: true },
          { name: 'bathrooms', type: 'float', isNullable: true },
          { name: 'accommodates', type: 'int', isNullable: true },
          { name: 'minNights', type: 'int', isNullable: true },
          { name: 'availability365', type: 'int', isNullable: true },
          { name: 'numReviews', type: 'int', isNullable: true },
          { name: 'reviewScore', type: 'float', isNullable: true },
          { name: 'amenitiesCount', type: 'int', isNullable: true },
          { name: 'category', type: 'varchar', length: '16', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'external_listing',
      new TableIndex({ name: 'IDX_external_listing_city_geo', columnNames: ['city', 'latitude', 'longitude'] }),
    );
    await queryRunner.createIndex(
      'external_listing',
      new TableIndex({
        name: 'UQ_external_listing_source_ext',
        columnNames: ['source', 'externalId'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('external_listing')) {
      await queryRunner.dropTable('external_listing');
    }
  }
}
