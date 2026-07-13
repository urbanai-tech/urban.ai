import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

/**
 * IA-3b/3c — âncora histórica de eventos recorrentes + coluna de público histórico.
 *
 *  - cria `event_historical_multiplier` (público/ocupação/multiplicador realizado
 *    por evento canônico), populada por Wikidata/notícias/feedback loop.
 *  - adiciona `events.historicalAttendance` (int) — prior de público herdado das
 *    edições passadas, aplicado pelo EventHistoricalService.
 *
 * Idempotente: checa existência de tabela/coluna/índice. Roda depois de
 * CatchupCoreEntities (que cria `events`).
 */
export class EventHistoricalMultiplier1783700000000 implements MigrationInterface {
  name = 'EventHistoricalMultiplier1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('event_historical_multiplier'))) {
      await queryRunner.createTable(
        new Table({
          name: 'event_historical_multiplier',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'canonicalName', type: 'varchar', length: '255' },
            { name: 'displayName', type: 'varchar', length: '255', isNullable: true },
            { name: 'realAttendance', type: 'int', isNullable: true },
            { name: 'realOccupancy', type: 'float', isNullable: true },
            { name: 'realMultiplier', type: 'float', isNullable: true },
            { name: 'avgDemandScore', type: 'float', isNullable: true },
            { name: 'sampleSize', type: 'int', default: 0 },
            { name: 'lastYear', type: 'int', isNullable: true },
            { name: 'source', type: 'varchar', length: '16', default: "'wikidata'" },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updatedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'event_historical_multiplier',
        new TableIndex({
          name: 'IDX_ehm_canonicalName',
          columnNames: ['canonicalName'],
          isUnique: true,
        }),
      );
    }

    const events = await queryRunner.getTable('events');
    if (events && !events.columns.some((c) => c.name === 'historicalAttendance')) {
      await queryRunner.addColumn(
        'events',
        new TableColumn({ name: 'historicalAttendance', type: 'int', isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const events = await queryRunner.getTable('events');
    if (events && events.columns.some((c) => c.name === 'historicalAttendance')) {
      await queryRunner.dropColumn('events', 'historicalAttendance');
    }
    if (await queryRunner.hasTable('event_historical_multiplier')) {
      await queryRunner.dropTable('event_historical_multiplier');
    }
  }
}
