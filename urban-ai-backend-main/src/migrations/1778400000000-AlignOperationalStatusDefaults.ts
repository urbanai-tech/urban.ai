import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignOperationalStatusDefaults1778400000000 implements MigrationInterface {
  name = 'AlignOperationalStatusDefaults1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.changeVarcharDefault(queryRunner, 'addresses', 'analisado', 'pending');
    await this.changeEnumDefault(queryRunner, 'process_status', 'status', 'completed');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.changeVarcharDefault(queryRunner, 'addresses', 'analisado', 'running');
    await this.changeEnumDefault(queryRunner, 'process_status', 'status', 'running');
  }

  private async changeVarcharDefault(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    defaultValue: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const column = table?.findColumnByName(columnName);
    if (!column) return;

    const length = column.length || '255';
    const nullable = column.isNullable ? 'NULL' : 'NOT NULL';
    await queryRunner.query(
      `ALTER TABLE \`${tableName}\` MODIFY \`${columnName}\` varchar(${length}) ${nullable} DEFAULT '${defaultValue}'`,
    );
  }

  private async changeEnumDefault(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    defaultValue: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const column = table?.findColumnByName(columnName);
    if (!column) return;

    const nullable = column.isNullable ? 'NULL' : 'NOT NULL';
    await queryRunner.query(
      `ALTER TABLE \`${tableName}\` MODIFY \`${columnName}\` enum('running','completed','error') ${nullable} DEFAULT '${defaultValue}'`,
    );
  }
}
