import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class HardenEmailConfirmations1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('email_confirmations', 'purpose'))) {
      await queryRunner.addColumn(
        'email_confirmations',
        new TableColumn({
          name: 'purpose',
          type: 'varchar',
          length: '64',
          default: "'email_confirmation'",
          isNullable: false,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('email_confirmations', 'attemptCount'))) {
      await queryRunner.addColumn(
        'email_confirmations',
        new TableColumn({
          name: 'attemptCount',
          type: 'int',
          default: 0,
          isNullable: false,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('email_confirmations', 'lockedUntil'))) {
      await queryRunner.addColumn(
        'email_confirmations',
        new TableColumn({
          name: 'lockedUntil',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }

    const table = await queryRunner.getTable('email_confirmations');
    if (table && !table.indices.some((index) => index.name === 'IDX_email_confirmation_purpose')) {
      await queryRunner.createIndex(
        'email_confirmations',
        new TableIndex({
          name: 'IDX_email_confirmation_purpose',
          columnNames: ['userId', 'purpose', 'confirmed'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('email_confirmations');
    if (table?.indices.some((index) => index.name === 'IDX_email_confirmation_purpose')) {
      await queryRunner.dropIndex('email_confirmations', 'IDX_email_confirmation_purpose');
    }
    for (const column of ['lockedUntil', 'attemptCount', 'purpose']) {
      if (await queryRunner.hasColumn('email_confirmations', column)) {
        await queryRunner.dropColumn('email_confirmations', column);
      }
    }
  }
}
