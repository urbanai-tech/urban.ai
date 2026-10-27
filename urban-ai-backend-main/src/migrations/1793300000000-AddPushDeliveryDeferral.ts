import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Push adiado pelo horário de silêncio (22h-8h São Paulo): em vez de descartar, a entrega fica
 * gravada com `deliverAfter` (08:00 BRT), `expiresAt` e `tag` (para colapsar duplicatas).
 * Aditiva e idempotente: colunas nulas, linhas existentes não mudam; `down` remove tudo.
 */
export class AddPushDeliveryDeferral1793300000000 implements MigrationInterface {
  name = 'AddPushDeliveryDeferral1793300000000';

  private readonly columns: TableColumn[] = [
    new TableColumn({ name: 'deliverAfter', type: 'datetime', isNullable: true }),
    new TableColumn({ name: 'expiresAt', type: 'datetime', isNullable: true }),
    new TableColumn({ name: 'tag', type: 'varchar', length: '120', isNullable: true }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('push_deliveries'))) return;

    for (const column of this.columns) {
      if (!(await queryRunner.hasColumn('push_deliveries', column.name))) {
        await queryRunner.addColumn('push_deliveries', column);
      }
    }

    const table = await queryRunner.getTable('push_deliveries');
    if (!table?.indices.some((index) => index.name === 'IDX_push_deliveries_deferred')) {
      await queryRunner.createIndex(
        'push_deliveries',
        new TableIndex({ name: 'IDX_push_deliveries_deferred', columnNames: ['deliverAfter'] }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('push_deliveries'))) return;

    const table = await queryRunner.getTable('push_deliveries');
    if (table?.indices.some((index) => index.name === 'IDX_push_deliveries_deferred')) {
      await queryRunner.dropIndex('push_deliveries', 'IDX_push_deliveries_deferred');
    }
    for (const column of [...this.columns].reverse()) {
      if (await queryRunner.hasColumn('push_deliveries', column.name)) {
        await queryRunner.dropColumn('push_deliveries', column.name);
      }
    }
  }
}
