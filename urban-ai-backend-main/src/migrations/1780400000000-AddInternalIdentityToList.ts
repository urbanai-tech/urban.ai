import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInternalIdentityToList1780400000000 implements MigrationInterface {
  name = 'AddInternalIdentityToList1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('list'))) return;

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'internalNickname',
        type: 'varchar',
        length: '80',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'internalCode',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('list'))) return;

    for (const columnName of ['internalCode', 'internalNickname']) {
      if (await queryRunner.hasColumn('list', columnName)) {
        await queryRunner.dropColumn('list', columnName);
      }
    }
  }

  private async addColumnIfMissing(queryRunner: QueryRunner, column: TableColumn): Promise<void> {
    if (await queryRunner.hasColumn('list', column.name)) return;

    try {
      await queryRunner.addColumn('list', column);
    } catch (error: any) {
      if (error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? ''))) {
        return;
      }
      throw error;
    }
  }
}
