import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddAirbnbObservationFieldsToPriceSnapshots1780800000000 implements MigrationInterface {
  name = 'AddAirbnbObservationFieldsToPriceSnapshots1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureColumn(queryRunner, new TableColumn({
      name: 'observedCheckIn',
      type: 'date',
      isNullable: true,
    }));
    await this.ensureColumn(queryRunner, new TableColumn({
      name: 'observedCheckOut',
      type: 'date',
      isNullable: true,
    }));
    await this.ensureColumn(queryRunner, new TableColumn({
      name: 'observedNights',
      type: 'int',
      isNullable: true,
    }));
    await this.ensureColumn(queryRunner, new TableColumn({
      name: 'observedTotalPriceCents',
      type: 'int',
      isNullable: true,
    }));
    await this.ensureColumn(queryRunner, new TableColumn({
      name: 'observedSource',
      type: 'varchar',
      length: '32',
      isNullable: true,
    }));
    await this.ensureColumn(queryRunner, new TableColumn({
      name: 'observedAt',
      type: 'datetime',
      isNullable: true,
    }));
    await this.ensureColumn(queryRunner, new TableColumn({
      name: 'observationMetadata',
      type: 'text',
      isNullable: true,
    }));

    await this.ensureIndex(
      queryRunner,
      'IDX_price_snapshots_airbnb_observed_window',
      ['origin', 'snapshotDate', 'externalListingId', 'observedCheckIn', 'observedNights'],
    );
    await this.ensureIndex(
      queryRunner,
      'IDX_price_snapshots_observed_at',
      ['origin', 'observedAt'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('price_snapshots');
    if (!table) return;

    for (const indexName of [
      'IDX_price_snapshots_airbnb_observed_window',
      'IDX_price_snapshots_observed_at',
    ]) {
      const index = table.indices.find((candidate) => candidate.name === indexName);
      if (index) await queryRunner.dropIndex('price_snapshots', index);
    }

    for (const columnName of [
      'observationMetadata',
      'observedAt',
      'observedSource',
      'observedTotalPriceCents',
      'observedNights',
      'observedCheckOut',
      'observedCheckIn',
    ]) {
      if (table.findColumnByName(columnName)) {
        await queryRunner.dropColumn('price_snapshots', columnName);
      }
    }
  }

  private async ensureColumn(queryRunner: QueryRunner, column: TableColumn): Promise<void> {
    const exists = await queryRunner.hasColumn('price_snapshots', column.name);
    if (!exists) await queryRunner.addColumn('price_snapshots', column);
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    name: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable('price_snapshots');
    if (!table || table.indices.some((index) => index.name === name)) return;
    await queryRunner.createIndex('price_snapshots', new TableIndex({ name, columnNames }));
  }
}
