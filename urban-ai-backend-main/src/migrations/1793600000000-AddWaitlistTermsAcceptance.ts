import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Prova de consentimento na lista de espera: `termsAcceptedAt` (quando) e `termsVersion`
 * (qual versão dos Termos/Privacidade) do cadastro público.
 * Aditiva e idempotente: colunas nulas (linhas existentes não têm aceite registrado);
 * `down` remove as colunas.
 */
export class AddWaitlistTermsAcceptance1793600000000 implements MigrationInterface {
  name = 'AddWaitlistTermsAcceptance1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('waitlist'))) return;
    if (!(await queryRunner.hasColumn('waitlist', 'termsAcceptedAt'))) {
      await queryRunner.addColumn(
        'waitlist',
        new TableColumn({ name: 'termsAcceptedAt', type: 'datetime', isNullable: true, default: null }),
      );
    }
    if (!(await queryRunner.hasColumn('waitlist', 'termsVersion'))) {
      await queryRunner.addColumn(
        'waitlist',
        new TableColumn({ name: 'termsVersion', type: 'varchar', length: '32', isNullable: true, default: null }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('waitlist'))) return;
    if (await queryRunner.hasColumn('waitlist', 'termsVersion')) {
      await queryRunner.dropColumn('waitlist', 'termsVersion');
    }
    if (await queryRunner.hasColumn('waitlist', 'termsAcceptedAt')) {
      await queryRunner.dropColumn('waitlist', 'termsAcceptedAt');
    }
  }
}
