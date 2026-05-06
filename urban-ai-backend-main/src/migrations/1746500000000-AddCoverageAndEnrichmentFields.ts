import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

/**
 * F6.2 Plus — escala geográfica.
 *
 * Adiciona:
 *  1. Tabela `coverage_regions` (admin-controlled)
 *  2. Colunas em `event`:
 *     - outOfScope (boolean, indexed) — fora da cobertura
 *     - enrichmentAttempts (int) — contador de tentativas Gemini
 *     - enrichmentLastAttemptAt (datetime, indexed)
 *     - enrichmentLastError (varchar 500)
 *
 * Idempotente: checa existência antes de criar tudo. Em ambientes com
 * `synchronize: true`, roda no-op.
 */
export class AddCoverageAndEnrichmentFields1746500000000 implements MigrationInterface {
  name = 'AddCoverageAndEnrichmentFields1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============== coverage_regions ==============
    await queryRunner.createTable(
      new Table({
        name: 'coverage_regions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          { name: 'name', type: 'varchar', length: '128', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            default: "'active'",
            isNullable: false,
          },
          { name: 'centerLat', type: 'decimal', precision: 10, scale: 8, isNullable: true },
          { name: 'centerLng', type: 'decimal', precision: 11, scale: 8, isNullable: true },
          { name: 'radiusKm', type: 'int', isNullable: true },
          { name: 'minLat', type: 'decimal', precision: 10, scale: 8, isNullable: true },
          { name: 'maxLat', type: 'decimal', precision: 10, scale: 8, isNullable: true },
          { name: 'minLng', type: 'decimal', precision: 11, scale: 8, isNullable: true },
          { name: 'maxLng', type: 'decimal', precision: 11, scale: 8, isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
        ],
      }),
      true, // ifNotExists
    );

    const cov = await queryRunner.getTable('coverage_regions');
    const covIdx = new Set((cov?.indices ?? []).map((i) => i.name));
    if (!covIdx.has('IDX_coverage_regions_status')) {
      await queryRunner.createIndex(
        'coverage_regions',
        new TableIndex({ name: 'IDX_coverage_regions_status', columnNames: ['status'] }),
      );
    }

    // ============== events new columns ==============
    const events = await queryRunner.getTable('events');
    if (!events) return; // synchronize ainda criando

    const existingCols = new Set(events.columns.map((c) => c.name));
    const newCols: TableColumn[] = [];

    if (!existingCols.has('outOfScope')) {
      newCols.push(
        new TableColumn({
          name: 'outOfScope',
          type: 'boolean',
          default: false,
          isNullable: false,
        }),
      );
    }
    if (!existingCols.has('enrichmentAttempts')) {
      newCols.push(
        new TableColumn({
          name: 'enrichmentAttempts',
          type: 'int',
          default: 0,
          isNullable: false,
        }),
      );
    }
    if (!existingCols.has('enrichmentLastAttemptAt')) {
      newCols.push(
        new TableColumn({
          name: 'enrichmentLastAttemptAt',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }
    if (!existingCols.has('enrichmentLastError')) {
      newCols.push(
        new TableColumn({
          name: 'enrichmentLastError',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    if (newCols.length > 0) {
      await queryRunner.addColumns('events', newCols);
    }

    // ============== events new indexes ==============
    const eventsAfter = await queryRunner.getTable('events');
    const evtIdx = new Set((eventsAfter?.indices ?? []).map((i) => i.name));

    if (!evtIdx.has('IDX_events_outOfScope')) {
      await queryRunner.createIndex(
        'events',
        new TableIndex({ name: 'IDX_events_outOfScope', columnNames: ['outOfScope'] }),
      );
    }
    if (!evtIdx.has('IDX_events_enrichmentLastAttemptAt')) {
      await queryRunner.createIndex(
        'events',
        new TableIndex({
          name: 'IDX_events_enrichmentLastAttemptAt',
          columnNames: ['enrichmentLastAttemptAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const events = await queryRunner.getTable('events');
    if (events) {
      const evtIdx = new Set((events.indices ?? []).map((i) => i.name));
      for (const idxName of [
        'IDX_events_enrichmentLastAttemptAt',
        'IDX_events_outOfScope',
      ]) {
        if (evtIdx.has(idxName)) {
          await queryRunner.dropIndex('events', idxName);
        }
      }
      const existingCols = new Set(events.columns.map((c) => c.name));
      const toDrop = [
        'enrichmentLastError',
        'enrichmentLastAttemptAt',
        'enrichmentAttempts',
        'outOfScope',
      ].filter((c) => existingCols.has(c));
      if (toDrop.length > 0) {
        await queryRunner.dropColumns('events', toDrop);
      }
    }

    await queryRunner.dropTable('coverage_regions', true);
  }
}
