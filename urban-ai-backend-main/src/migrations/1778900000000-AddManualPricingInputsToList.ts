import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddManualPricingInputsToList1778900000000 implements MigrationInterface {
  name = 'AddManualPricingInputsToList1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('list'))) return;

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'manualDailyPrice',
        type: 'float',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'averageMonthlyRevenue',
        type: 'float',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'pricingInputSource',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'pricingInputsUpdatedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('list'))) return;

    for (const columnName of [
      'pricingInputsUpdatedAt',
      'pricingInputSource',
      'averageMonthlyRevenue',
      'manualDailyPrice',
    ]) {
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
