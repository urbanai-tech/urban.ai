import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Separa "e-mail verificado" de `ativo` (bloqueio administrativo).
 *
 * Antes desta coluna o cadastro criava a conta com `ativo = true`, então a
 * confirmação de e-mail nunca era exigida. Contas existentes foram criadas
 * nesse regime: o backfill as marca como verificadas na data de criação para
 * ninguém perder acesso. Só contas novas (e-mail/senha) começam como null.
 */
export class AddUserEmailVerifiedAt1784200000000 implements MigrationInterface {
  name = 'AddUserEmailVerifiedAt1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user'))) return;

    if (!(await queryRunner.hasColumn('user', 'email_verified_at'))) {
      try {
        await queryRunner.addColumn(
          'user',
          new TableColumn({ name: 'email_verified_at', type: 'timestamp', isNullable: true }),
        );
      } catch (error: any) {
        if (!(error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? '')))) {
          throw error;
        }
      }
    }

    // Backfill idempotente: só toca em quem ainda está null.
    await queryRunner.query(
      'UPDATE `user` SET `email_verified_at` = COALESCE(`createdAt`, NOW()) WHERE `email_verified_at` IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user'))) return;
    if (await queryRunner.hasColumn('user', 'email_verified_at')) {
      await queryRunner.dropColumn('user', 'email_verified_at');
    }
  }
}
