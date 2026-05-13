import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ExpandStaysAccessTokenForEncryption1778200000000 implements MigrationInterface {
  name = 'ExpandStaysAccessTokenForEncryption1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('stays_accounts');
    if (!table) return;

    const column = table.findColumnByName('accessToken');
    if (!column) return;

    if (Number(column.length || 0) < 2048) {
      await queryRunner.changeColumn(
        'stays_accounts',
        column,
        new TableColumn({
          ...column,
          type: 'varchar',
          length: '2048',
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('stays_accounts');
    if (!table) return;

    const column = table.findColumnByName('accessToken');
    if (!column) return;

    if (Number(column.length || 0) > 512) {
      await queryRunner.changeColumn(
        'stays_accounts',
        column,
        new TableColumn({
          ...column,
          type: 'varchar',
          length: '512',
          isNullable: false,
        }),
      );
    }
  }
}
