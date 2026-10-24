import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentTrialUsedAt1784100000000 implements MigrationInterface {
  name = 'AddPaymentTrialUsedAt1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;

    if (!(await queryRunner.hasColumn('payment', 'trialUsedAt'))) {
      try {
        await queryRunner.addColumn(
          'payment',
          new TableColumn({ name: 'trialUsedAt', type: 'timestamp', isNullable: true }),
        );
      } catch (error: any) {
        if (!(error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? '')))) {
          throw error;
        }
      }
    }

    // Backfill idempotente: quem já fez checkout de trial (planName = 'trial')
    // ou está em trialing não pode ganhar outro trial.
    await queryRunner.query(
      "UPDATE `payment` SET `trialUsedAt` = COALESCE(`startDate`, `createdAt`) " +
        "WHERE `trialUsedAt` IS NULL AND (`planName` = 'trial' OR `status` = 'trialing')",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment'))) return;
    if (await queryRunner.hasColumn('payment', 'trialUsedAt')) {
      await queryRunner.dropColumn('payment', 'trialUsedAt');
    }
  }
}
