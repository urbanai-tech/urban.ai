import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Histórico de mudanças de evento (first_seen, remarcação, venue, URL, cancelamento). Aditiva: cria
 * `event_change_history` e semeia um `first_seen` por evento existente a partir de `events.createdAt`
 * (idempotente). `down` remove a tabela; nada em `events` muda.
 */
export class CreateEventChangeHistory1793710000000 implements MigrationInterface {
  name = 'CreateEventChangeHistory1793710000000';

  private readonly table = 'event_change_history';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(this.table))) {
      await queryRunner.createTable(
        new Table({
          name: this.table,
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'eventId', type: 'varchar', length: '36', isNullable: false },
            { name: 'changeType', type: 'varchar', length: '24', isNullable: false },
            { name: 'field', type: 'varchar', length: '32', isNullable: true },
            { name: 'oldValue', type: 'text', isNullable: true },
            { name: 'newValue', type: 'text', isNullable: true },
            { name: 'source', type: 'varchar', length: '64', isNullable: true },
            { name: 'detectedAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
            { name: 'meta', type: 'text', isNullable: true },
          ],
        }),
        true,
      );
    }

    const table = await queryRunner.getTable(this.table);
    const indices: TableIndex[] = [
      new TableIndex({ name: 'IDX_event_change_history_event', columnNames: ['eventId', 'detectedAt'] }),
      new TableIndex({ name: 'IDX_event_change_history_type', columnNames: ['changeType', 'detectedAt'] }),
      new TableIndex({ name: 'IDX_event_change_history_detected', columnNames: ['detectedAt'] }),
    ];
    for (const index of indices) {
      if (!table?.indices.some((existing) => existing.name === index.name)) {
        await queryRunner.createIndex(this.table, index);
      }
    }

    if (
      table &&
      (await queryRunner.hasTable('events')) &&
      !table.foreignKeys.some((fk) => fk.columnNames.includes('eventId'))
    ) {
      await queryRunner.createForeignKey(
        this.table,
        new TableForeignKey({
          columnNames: ['eventId'],
          referencedTableName: 'events',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    // Semeia o first_seen dos eventos já existentes (momento em que o registro foi criado).
    if (await queryRunner.hasTable('events')) {
      await queryRunner.query(
        `INSERT INTO event_change_history (id, eventId, changeType, source, detectedAt, meta)
         SELECT UUID(), e.id, 'first_seen', e.source, e.createdAt, '{"backfilled":true}'
         FROM events e
         WHERE NOT EXISTS (
           SELECT 1 FROM event_change_history h WHERE h.eventId = e.id AND h.changeType = 'first_seen'
         )`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(this.table)) {
      await queryRunner.dropTable(this.table, true);
    }
  }
}
