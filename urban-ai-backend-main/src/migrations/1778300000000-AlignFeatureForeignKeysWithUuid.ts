import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

type OnDelete = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

export class AlignFeatureForeignKeysWithUuid1778300000000 implements MigrationInterface {
  name = 'AlignFeatureForeignKeysWithUuid1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureUuidColumn(queryRunner, 'stays_listings', 'propriedade_id', true);
    await this.ensureUuidColumn(queryRunner, 'price_snapshots', 'list_id', true);
    await this.ensureUuidColumn(queryRunner, 'price_snapshots', 'address_id', true);
    await this.ensureUuidColumn(queryRunner, 'occupancy_history', 'list_id', false);
    await this.ensureUuidColumn(queryRunner, 'occupancy_history', 'address_id', true);
    await this.ensureUuidColumn(queryRunner, 'event_proximity_features', 'list_id', false);
    await this.ensureUuidColumn(queryRunner, 'event_proximity_features', 'address_id', true);

    await this.ensureForeignKey(queryRunner, 'stays_accounts', ['user_id'], 'user', ['id'], 'CASCADE');
    await this.ensureForeignKey(queryRunner, 'stays_listings', ['stays_account_id'], 'stays_accounts', ['id'], 'CASCADE');
    await this.ensureForeignKey(queryRunner, 'stays_listings', ['propriedade_id'], 'list', ['id'], 'SET NULL');
    await this.ensureForeignKey(queryRunner, 'price_snapshots', ['list_id'], 'list', ['id'], 'SET NULL');
    await this.ensureForeignKey(queryRunner, 'price_snapshots', ['address_id'], 'addresses', ['id'], 'SET NULL');
    await this.ensureForeignKey(queryRunner, 'occupancy_history', ['list_id'], 'list', ['id'], 'CASCADE');
    await this.ensureForeignKey(queryRunner, 'occupancy_history', ['address_id'], 'addresses', ['id'], 'SET NULL');
    await this.ensureForeignKey(queryRunner, 'occupancy_history', ['user_id'], 'user', ['id'], 'CASCADE');
    await this.ensureForeignKey(queryRunner, 'event_proximity_features', ['list_id'], 'list', ['id'], 'CASCADE');
    await this.ensureForeignKey(queryRunner, 'event_proximity_features', ['address_id'], 'addresses', ['id'], 'SET NULL');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: this only aligns relationship columns with the current UUID entities.
  }

  private async ensureUuidColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    isNullable: boolean,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const column = table?.findColumnByName(columnName);
    if (!table || !column) return;

    await this.dropForeignKeysForColumns(queryRunner, tableName, [columnName]);

    if (column.type === 'varchar' && String(column.length) === '36') {
      return;
    }

    await queryRunner.changeColumn(
      tableName,
      column,
      new TableColumn({
        ...column,
        type: 'varchar',
        length: '36',
        isNullable,
      }),
    );
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    columnNames: string[],
    referencedTableName: string,
    referencedColumnNames: string[],
    onDelete: OnDelete,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const refTable = await queryRunner.getTable(referencedTableName);
    if (!table || !refTable) return;

    await this.dropForeignKeysForColumns(queryRunner, tableName, columnNames);

    await queryRunner.createForeignKey(
      tableName,
      new TableForeignKey({
        columnNames,
        referencedTableName,
        referencedColumnNames,
        onDelete,
      }),
    );
  }

  private async dropForeignKeysForColumns(
    queryRunner: QueryRunner,
    tableName: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    for (const foreignKey of table.foreignKeys) {
      const sameColumns =
        foreignKey.columnNames.length === columnNames.length &&
        foreignKey.columnNames.every((column, index) => column === columnNames[index]);

      if (sameColumns) {
        await queryRunner.dropForeignKey(tableName, foreignKey);
      }
    }
  }
}
