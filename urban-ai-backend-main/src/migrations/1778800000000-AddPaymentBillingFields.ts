import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentBillingFields1778800000000 implements MigrationInterface {
  name = 'AddPaymentBillingFields1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;

    if (!(await queryRunner.hasColumn('payment', 'billingCycle'))) {
      await queryRunner.addColumn(
        'payment',
        new TableColumn({
          name: 'billingCycle',
          type: 'varchar',
          length: '32',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('payment', 'listingsContratados'))) {
      await queryRunner.addColumn(
        'payment',
        new TableColumn({
          name: 'listingsContratados',
          type: 'int',
          isNullable: true,
          default: 1,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('payment', 'planName'))) {
      await queryRunner.addColumn(
        'payment',
        new TableColumn({
          name: 'planName',
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;

    for (const columnName of ['planName', 'listingsContratados', 'billingCycle']) {
      if (await queryRunner.hasColumn('payment', columnName)) {
        await queryRunner.dropColumn('payment', columnName);
      }
    }
  }
}
