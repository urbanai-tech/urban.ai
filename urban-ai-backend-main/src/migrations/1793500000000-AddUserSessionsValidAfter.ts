import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Corte de sessões por usuário: `sessions_valid_after` é atualizado quando a senha é
 * redefinida/trocada e o JwtStrategy recusa access tokens emitidos antes dele.
 * Aditiva e idempotente: coluna nula, ninguém é deslogado ao aplicar; `down` remove a coluna.
 */
export class AddUserSessionsValidAfter1793500000000 implements MigrationInterface {
  name = 'AddUserSessionsValidAfter1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user'))) return;
    if (!(await queryRunner.hasColumn('user', 'sessions_valid_after'))) {
      await queryRunner.addColumn(
        'user',
        new TableColumn({ name: 'sessions_valid_after', type: 'datetime', isNullable: true, default: null }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user'))) return;
    if (await queryRunner.hasColumn('user', 'sessions_valid_after')) {
      await queryRunner.dropColumn('user', 'sessions_valid_after');
    }
  }
}
