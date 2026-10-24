import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Registro de aceite dos Termos/Privacidade no cadastro (prova de consentimento).
 * Contas anteriores ficam com null (aceite não registrado), sem backfill:
 * não inventamos consentimento que não foi dado.
 */
export class AddUserTermsAcceptance1784300000000 implements MigrationInterface {
  name = 'AddUserTermsAcceptance1784300000000';

  private async addColumnIfMissing(queryRunner: QueryRunner, column: TableColumn): Promise<void> {
    if (await queryRunner.hasColumn('user', column.name)) return;
    try {
      await queryRunner.addColumn('user', column);
    } catch (error: any) {
      if (!(error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? '')))) {
        throw error;
      }
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user'))) return;

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({ name: 'terms_accepted_at', type: 'timestamp', isNullable: true }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({ name: 'terms_version', type: 'varchar', length: '32', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user'))) return;
    for (const name of ['terms_version', 'terms_accepted_at']) {
      if (await queryRunner.hasColumn('user', name)) {
        await queryRunner.dropColumn('user', name);
      }
    }
  }
}
