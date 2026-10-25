import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Metadados do contrato público Stays por listing (shortId, propertyId, moeda,
 * masters de preço). Usado para bloquear escrita em listings herdados/masters.
 * Idempotente.
 */
export class AddStaysProviderMetadata1788600000000 implements MigrationInterface {
  name = 'AddStaysProviderMetadata1788600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('stays_listings', 'providerMetadata'))) {
      await queryRunner.addColumn('stays_listings', new TableColumn({
        name: 'providerMetadata', type: 'json', isNullable: true,
      }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('stays_listings', 'providerMetadata')) {
      await queryRunner.dropColumn('stays_listings', 'providerMetadata');
    }
  }
}
