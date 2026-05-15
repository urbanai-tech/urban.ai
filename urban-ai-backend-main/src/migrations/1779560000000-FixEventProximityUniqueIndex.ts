import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class FixEventProximityUniqueIndex1779560000000 implements MigrationInterface {
  name = 'FixEventProximityUniqueIndex1779560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_proximity_features';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const expectedColumns = ['list_id', 'snapshotDate'];
    const existing = table.indices.find((index) => index.name === 'IDX_event_proximity_list_date');
    const isExpected =
      existing?.isUnique === true &&
      existing.columnNames.length === expectedColumns.length &&
      expectedColumns.every((column) => existing.columnNames.includes(column));

    if (isExpected) return;

    if (existing) {
      await queryRunner.dropIndex(tableName, existing);
    }

    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: 'IDX_event_proximity_list_date',
        columnNames: expectedColumns,
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_proximity_features';
    const table = await queryRunner.getTable(tableName);
    const existing = table?.indices.find((index) => index.name === 'IDX_event_proximity_list_date');
    if (existing) {
      await queryRunner.dropIndex(tableName, existing);
    }
  }
}
