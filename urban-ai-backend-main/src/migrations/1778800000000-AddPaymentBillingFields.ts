import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentBillingFields1778800000000 implements MigrationInterface {
  name = 'AddPaymentBillingFields1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'billingCycle',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'listingsContratados',
        type: 'int',
        isNullable: true,
        default: 1,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'planName',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;

    for (const columnName of ['planName', 'listingsContratados', 'billingCycle']) {
      if (await queryRunner.hasColumn('payment', columnName)) {
        await queryRunner.dropColumn('payment', columnName);
      }
    }
  }

  private async addColumnIfMissing(queryRunner: QueryRunner, column: TableColumn): Promise<void> {
    if (await this.columnExists(queryRunner, column.name)) return;

    try {
      await queryRunner.addColumn('payment', column);
    } catch (error: any) {
      if (error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? ''))) {
        return;
      }
      throw error;
    }
  }

  private async columnExists(queryRunner: QueryRunner, columnName: string): Promise<boolean> {
    const rows = await queryRunner.query(
      `
        SELECT COUNT(*) AS count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'payment'
          AND COLUMN_NAME = ?
      `,
      [columnName],
    );
    return Number(rows?.[0]?.count ?? 0) > 0;
  }
}
