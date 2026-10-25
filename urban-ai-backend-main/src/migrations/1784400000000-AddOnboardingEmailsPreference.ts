import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Preferência dedicada para o drip de onboarding (D+1/D+3/D+7), com default true
 * (comportamento atual preservado). O descadastro por link assinado e o toggle
 * em Configurações > Comunicações desligam esta coluna.
 */
export class AddOnboardingEmailsPreference1784400000000 implements MigrationInterface {
  name = 'AddOnboardingEmailsPreference1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_communication_preferences'))) return;
    if (await queryRunner.hasColumn('user_communication_preferences', 'onboarding_emails')) return;
    try {
      await queryRunner.addColumn(
        'user_communication_preferences',
        new TableColumn({ name: 'onboarding_emails', type: 'boolean', default: true, isNullable: false }),
      );
    } catch (error: any) {
      if (!(error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? '')))) {
        throw error;
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_communication_preferences'))) return;
    if (await queryRunner.hasColumn('user_communication_preferences', 'onboarding_emails')) {
      await queryRunner.dropColumn('user_communication_preferences', 'onboarding_emails');
    }
  }
}
