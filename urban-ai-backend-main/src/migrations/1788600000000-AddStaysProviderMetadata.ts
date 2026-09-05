import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStaysProviderMetadata1788600000000 implements MigrationInterface {
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
