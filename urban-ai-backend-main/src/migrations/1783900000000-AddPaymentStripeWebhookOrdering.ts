import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentStripeWebhookOrdering1783900000000 implements MigrationInterface {
  name = 'AddPaymentStripeWebhookOrdering1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'lastStripeEventCreated',
        type: 'bigint',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'recentStripeEventIds',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;
    for (const columnName of ['recentStripeEventIds', 'lastStripeEventCreated']) {
      if (await queryRunner.hasColumn('payment', columnName)) {
        await queryRunner.dropColumn('payment', columnName);
      }
    }
  }

  private async addColumnIfMissing(queryRunner: QueryRunner, column: TableColumn): Promise<void> {
    if (await queryRunner.hasColumn('payment', column.name)) return;
    try {
      await queryRunner.addColumn('payment', column);
    } catch (error: any) {
      if (error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? ''))) {
        return;
      }
      throw error;
    }
  }
}
