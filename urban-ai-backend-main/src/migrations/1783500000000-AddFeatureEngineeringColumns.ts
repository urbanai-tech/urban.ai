import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * F6.1 Tier 1 (IA-1) — colunas de feature engineering.
 *
 *  - addresses.metro_distance_km (float) — distância à estação de metrô/CPTM mais
 *    próxima, populada por FeatureEngineeringService.computeMetroDistancePending().
 *  - list.category (varchar 16) — categoria do imóvel (Economico/Standard/Premium),
 *    derivada por FeatureEngineeringService (label/feature do KNN).
 *
 * (amenitiesCount já existe em `list`.)
 *
 * Idempotente: checa existência de cada coluna. Roda depois de CatchupCoreEntities
 * (que cria as tabelas core).
 */
export class AddFeatureEngineeringColumns1783500000000 implements MigrationInterface {
  name = 'AddFeatureEngineeringColumns1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const addresses = await queryRunner.getTable('addresses');
    if (addresses && !addresses.columns.some((c) => c.name === 'metro_distance_km')) {
      await queryRunner.addColumn(
        'addresses',
        new TableColumn({ name: 'metro_distance_km', type: 'float', isNullable: true }),
      );
    }

    const list = await queryRunner.getTable('list');
    if (list && !list.columns.some((c) => c.name === 'category')) {
      await queryRunner.addColumn(
        'list',
        new TableColumn({ name: 'category', type: 'varchar', length: '16', isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const addresses = await queryRunner.getTable('addresses');
    if (addresses && addresses.columns.some((c) => c.name === 'metro_distance_km')) {
      await queryRunner.dropColumn('addresses', 'metro_distance_km');
    }
    const list = await queryRunner.getTable('list');
    if (list && list.columns.some((c) => c.name === 'category')) {
      await queryRunner.dropColumn('list', 'category');
    }
  }
}
