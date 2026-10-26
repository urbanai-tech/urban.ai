import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Plano B do scraping (ADR 0010): colunas para o anfitrião informar o preço-base mínimo,
 * o de fim de semana e os dados essenciais do imóvel, com marcador de origem e data.
 * Aditiva e idempotente (só adiciona colunas nulas); `down` as remove.
 */
export class AddHostInputBaselineToList1793000000000 implements MigrationInterface {
  name = 'AddHostInputBaselineToList1793000000000';

  private readonly columns: TableColumn[] = [
    new TableColumn({ name: 'minDailyPrice', type: 'float', isNullable: true }),
    new TableColumn({ name: 'weekendDailyPrice', type: 'float', isNullable: true }),
    new TableColumn({ name: 'hostInputUpdatedAt', type: 'timestamp', isNullable: true }),
    new TableColumn({ name: 'essentialsSource', type: 'varchar', length: '16', isNullable: true }),
    new TableColumn({ name: 'essentialsUpdatedAt', type: 'timestamp', isNullable: true }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('list'))) return;

    for (const column of this.columns) {
      if (!(await queryRunner.hasColumn('list', column.name))) {
        await queryRunner.addColumn('list', column);
      }
    }

    // Backfill: valores manuais antigos já são "informados pelo anfitrião".
    await queryRunner.query(
      `UPDATE \`list\` SET \`hostInputUpdatedAt\` = COALESCE(\`pricingInputsUpdatedAt\`, CURRENT_TIMESTAMP)
       WHERE \`manualDailyPrice\` IS NOT NULL AND \`manualDailyPrice\` > 0 AND \`hostInputUpdatedAt\` IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('list'))) return;

    for (const column of [...this.columns].reverse()) {
      if (await queryRunner.hasColumn('list', column.name)) {
        await queryRunner.dropColumn('list', column.name);
      }
    }
  }
}
