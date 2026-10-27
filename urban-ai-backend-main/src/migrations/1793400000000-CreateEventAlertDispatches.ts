import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Idempotência e limites diários do push de evento relevante. Aditiva: só cria a tabela
 * `event_alert_dispatches` (nada existente muda); `down` a remove.
 */
export class CreateEventAlertDispatches1793400000000 implements MigrationInterface {
  name = 'CreateEventAlertDispatches1793400000000';

  private readonly table = 'event_alert_dispatches';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(this.table))) {
      await queryRunner.createTable(
        new Table({
          name: this.table,
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'event_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'property_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'sent_on', type: 'varchar', length: '10', isNullable: false },
            { name: 'createdAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
          ],
        }),
        true,
      );
    }

    const table = await queryRunner.getTable(this.table);
    const indices: TableIndex[] = [
      new TableIndex({ name: 'UQ_event_alert_dispatches_user_event', columnNames: ['user_id', 'event_id'], isUnique: true }),
      new TableIndex({ name: 'IDX_event_alert_dispatches_user_day', columnNames: ['user_id', 'sent_on'] }),
      new TableIndex({ name: 'IDX_event_alert_dispatches_property_day', columnNames: ['property_id', 'sent_on'] }),
    ];
    for (const index of indices) {
      if (!table?.indices.some((existing) => existing.name === index.name)) {
        await queryRunner.createIndex(this.table, index);
      }
    }

    await this.ensureForeignKey(queryRunner, 'user_id', 'user');
    await this.ensureForeignKey(queryRunner, 'event_id', 'events');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(this.table)) {
      await queryRunner.dropTable(this.table, true);
    }
  }

  private async ensureForeignKey(queryRunner: QueryRunner, column: string, referenced: string): Promise<void> {
    const table = await queryRunner.getTable(this.table);
    if (!table || !(await queryRunner.hasTable(referenced))) return;
    if (table.foreignKeys.some((fk) => fk.columnNames.includes(column))) return;
    await queryRunner.createForeignKey(
      this.table,
      new TableForeignKey({
        columnNames: [column],
        referencedTableName: referenced,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }
}
