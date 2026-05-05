import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * F6.2 Plus — adiciona colunas de procedência e dedup à tabela `events`.
 *
 * Idempotente: checa existência de cada coluna/índice antes de criar.
 * Roda seguro em ambientes que ainda estão com `synchronize: true` e já
 * receberam essas colunas pelo TypeORM auto-sync.
 *
 * Colunas:
 *  - source            varchar(64) — 'api-football' / 'sympla-api' / 'firecrawl-<site>' / etc.
 *  - sourceId          varchar(128) — ID externo na fonte (fixture_id, etc.)
 *  - dedupHash         varchar(64) UNIQUE — sha256(nome|date|geo) para dedup
 *  - venueCapacity     int — capacidade física do local
 *  - venueType         varchar(64) — stadium / convention_center / theater / etc.
 *  - expectedAttendance int — público esperado deste evento específico
 *  - crawledUrl        text — URL original
 *
 * Índices:
 *  - UNIQUE em dedupHash (gerado pelo @Column({ unique: true }), mas reforçado aqui)
 *  - source
 *  - venueType
 */
export class AddEventCoverageFields1746000000000 implements MigrationInterface {
  name = 'AddEventCoverageFields1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('events');
    if (!table) {
      // Tabela ainda não existe (synchronize off + base muito vazia). Pula
      // — quando a tabela for criada pelo TypeORM, já virá com as colunas
      // novas porque a entity está atualizada.
      return;
    }

    const existingColumns = new Set(table.columns.map((c) => c.name));

    const newColumns: TableColumn[] = [];
    if (!existingColumns.has('source')) {
      newColumns.push(new TableColumn({
        name: 'source',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }));
    }
    if (!existingColumns.has('sourceId')) {
      newColumns.push(new TableColumn({
        name: 'sourceId',
        type: 'varchar',
        length: '128',
        isNullable: true,
      }));
    }
    if (!existingColumns.has('dedupHash')) {
      newColumns.push(new TableColumn({
        name: 'dedupHash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }));
    }
    if (!existingColumns.has('venueCapacity')) {
      newColumns.push(new TableColumn({
        name: 'venueCapacity',
        type: 'int',
        isNullable: true,
      }));
    }
    if (!existingColumns.has('venueType')) {
      newColumns.push(new TableColumn({
        name: 'venueType',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }));
    }
    if (!existingColumns.has('expectedAttendance')) {
      newColumns.push(new TableColumn({
        name: 'expectedAttendance',
        type: 'int',
        isNullable: true,
      }));
    }
    if (!existingColumns.has('crawledUrl')) {
      newColumns.push(new TableColumn({
        name: 'crawledUrl',
        type: 'text',
        isNullable: true,
      }));
    }

    if (newColumns.length > 0) {
      await queryRunner.addColumns('events', newColumns);
    }

    // Re-fetch após eventual addColumns
    const tableAfter = await queryRunner.getTable('events');
    const indexNames = new Set((tableAfter?.indices ?? []).map((i) => i.name));

    if (!indexNames.has('UQ_events_dedupHash')) {
      // Antes de criar UNIQUE, garantir que não há duplicatas existentes.
      // Em base nova, dedupHash está NULL em todas as linhas, e MySQL
      // permite múltiplos NULL em UNIQUE (NULL não é igual a NULL).
      await queryRunner.createIndex(
        'events',
        new TableIndex({
          name: 'UQ_events_dedupHash',
          columnNames: ['dedupHash'],
          isUnique: true,
        }),
      );
    }

    if (!indexNames.has('IDX_events_source')) {
      await queryRunner.createIndex(
        'events',
        new TableIndex({
          name: 'IDX_events_source',
          columnNames: ['source'],
        }),
      );
    }

    if (!indexNames.has('IDX_events_venueType')) {
      await queryRunner.createIndex(
        'events',
        new TableIndex({
          name: 'IDX_events_venueType',
          columnNames: ['venueType'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('events');
    if (!table) return;

    const indexNames = new Set((table.indices ?? []).map((i) => i.name));
    for (const idxName of [
      'IDX_events_venueType',
      'IDX_events_source',
      'UQ_events_dedupHash',
    ]) {
      if (indexNames.has(idxName)) {
        await queryRunner.dropIndex('events', idxName);
      }
    }

    const existingColumns = new Set(table.columns.map((c) => c.name));
    const colsToDrop = [
      'crawledUrl',
      'expectedAttendance',
      'venueType',
      'venueCapacity',
      'dedupHash',
      'sourceId',
      'source',
    ].filter((c) => existingColumns.has(c));

    if (colsToDrop.length > 0) {
      await queryRunner.dropColumns('events', colsToDrop);
    }
  }
}
