import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Pausa por cota (downgrade / fim de assinatura): o imóvel acima do que o plano
 * cobre fica `ativo = false` (nenhum cron/análise o processa) e ganha
 * `quota_paused_at` para o reconciliador saber que foi PAUSADO POR COTA — e não
 * desativado pelo usuário — e poder reativá-lo quando a cota voltar a subir.
 * Nada é apagado. Idempotente.
 */
export class AddAddressQuotaPausedAt1784500000000 implements MigrationInterface {
  name = 'AddAddressQuotaPausedAt1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('addresses'))) return;
    if (await queryRunner.hasColumn('addresses', 'quota_paused_at')) return;

    try {
      await queryRunner.addColumn(
        'addresses',
        new TableColumn({ name: 'quota_paused_at', type: 'timestamp', isNullable: true }),
      );
    } catch (error: any) {
      if (!(error?.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(String(error?.message ?? '')))) {
        throw error;
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('addresses'))) return;
    if (await queryRunner.hasColumn('addresses', 'quota_paused_at')) {
      await queryRunner.dropColumn('addresses', 'quota_paused_at');
    }
  }
}
