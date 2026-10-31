import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * ADR 0026 — lista de referência de eventos, votos dos validadores, série de recall/precisão
 * e cache da curadoria. Aditiva: só cria 4 tabelas novas (nada existente muda); `down` as
 * remove na ordem inversa das dependências.
 */
export class CreateEventReferenceAndCoverage1793700000000 implements MigrationInterface {
  name = 'CreateEventReferenceAndCoverage1793700000000';

  private idColumn() {
    return {
      name: 'id',
      type: 'varchar',
      length: '36',
      isPrimary: true,
      generationStrategy: 'uuid' as const,
    };
  }

  private createdAtColumn() {
    return {
      name: 'createdAt',
      type: 'datetime',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    };
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('event_reference'))) {
      await queryRunner.createTable(
        new Table({
          name: 'event_reference',
          columns: [
            this.idColumn(),
            { name: 'name', type: 'varchar', length: '255', isNullable: false },
            { name: 'normalizedName', type: 'varchar', length: '255', isNullable: false },
            { name: 'venueKey', type: 'varchar', length: '64', isNullable: true },
            { name: 'venueName', type: 'varchar', length: '160', isNullable: false },
            { name: 'normalizedVenue', type: 'varchar', length: '255', isNullable: false },
            { name: 'startsAt', type: 'datetime', isNullable: false },
            { name: 'dateKey', type: 'varchar', length: '10', isNullable: false },
            { name: 'city', type: 'varchar', length: '80', default: "'São Paulo'", isNullable: false },
            { name: 'category', type: 'varchar', length: '64', isNullable: true },
            { name: 'size', type: 'varchar', length: '16', default: "'medio'", isNullable: false },
            { name: 'status', type: 'varchar', length: '16', default: "'candidato'", isNullable: false },
            { name: 'origin', type: 'varchar', length: '16', default: "'curadoria'", isNullable: false },
            { name: 'fingerprint', type: 'varchar', length: '64', isNullable: false },
            { name: 'evidenceUrls', type: 'text', isNullable: true },
            { name: 'votesSupport', type: 'int', default: 0, isNullable: false },
            { name: 'votesAgainst', type: 'int', default: 0, isNullable: false },
            { name: 'approvedBy', type: 'varchar', length: '64', isNullable: true },
            { name: 'approvedAt', type: 'datetime', isNullable: true },
            { name: 'decisionNote', type: 'varchar', length: '500', isNullable: true },
            { name: 'conflictReason', type: 'varchar', length: '255', isNullable: true },
            { name: 'matchedEventId', type: 'varchar', length: '36', isNullable: true },
            { name: 'matchScore', type: 'decimal', precision: 5, scale: 4, isNullable: true },
            { name: 'matchedAt', type: 'datetime', isNullable: true },
            { name: 'lastMatchCheckAt', type: 'datetime', isNullable: true },
            this.createdAtColumn(),
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
        true,
      );
    }
    await this.ensureIndexes(queryRunner, 'event_reference', [
      new TableIndex({ name: 'UQ_event_reference_fingerprint', columnNames: ['fingerprint'], isUnique: true }),
      new TableIndex({ name: 'IDX_event_reference_status', columnNames: ['status'] }),
      new TableIndex({ name: 'IDX_event_reference_date', columnNames: ['dateKey'] }),
      new TableIndex({ name: 'IDX_event_reference_venue_date', columnNames: ['venueKey', 'dateKey'] }),
    ]);

    if (!(await queryRunner.hasTable('event_reference_votes'))) {
      await queryRunner.createTable(
        new Table({
          name: 'event_reference_votes',
          columns: [
            this.idColumn(),
            { name: 'referenceId', type: 'varchar', length: '36', isNullable: false },
            { name: 'validatorKey', type: 'varchar', length: '160', isNullable: false },
            { name: 'validatorKind', type: 'varchar', length: '16', isNullable: false },
            { name: 'verdict', type: 'varchar', length: '16', isNullable: false },
            { name: 'sourceUrl', type: 'text', isNullable: true },
            { name: 'extractor', type: 'varchar', length: '16', default: "'none'", isNullable: false },
            { name: 'observedName', type: 'varchar', length: '255', isNullable: true },
            { name: 'observedDate', type: 'varchar', length: '10', isNullable: true },
            { name: 'observedVenue', type: 'varchar', length: '160', isNullable: true },
            { name: 'snippet', type: 'varchar', length: '500', isNullable: true },
            this.createdAtColumn(),
          ],
        }),
        true,
      );
    }
    await this.ensureIndexes(queryRunner, 'event_reference_votes', [
      new TableIndex({
        name: 'UQ_event_reference_votes_ref_validator',
        columnNames: ['referenceId', 'validatorKey'],
        isUnique: true,
      }),
      new TableIndex({ name: 'IDX_event_reference_votes_ref', columnNames: ['referenceId'] }),
    ]);
    const votes = await queryRunner.getTable('event_reference_votes');
    if (votes && !votes.foreignKeys.some((fk) => fk.columnNames.includes('referenceId'))) {
      await queryRunner.createForeignKey(
        'event_reference_votes',
        new TableForeignKey({
          name: 'FK_09dcf4ecdbeb78de186ccdb9e99',
          columnNames: ['referenceId'],
          referencedTableName: 'event_reference',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (!(await queryRunner.hasTable('event_coverage_snapshots'))) {
      await queryRunner.createTable(
        new Table({
          name: 'event_coverage_snapshots',
          columns: [
            this.idColumn(),
            { name: 'snapshotDate', type: 'varchar', length: '10', isNullable: false },
            { name: 'scope', type: 'varchar', length: '12', isNullable: false },
            { name: 'dimension', type: 'varchar', length: '12', isNullable: false },
            { name: 'dimensionValue', type: 'varchar', length: '120', default: "'all'", isNullable: false },
            { name: 'referenceTotal', type: 'int', default: 0, isNullable: false },
            { name: 'referenceMatched', type: 'int', default: 0, isNullable: false },
            { name: 'recallPct', type: 'decimal', precision: 5, scale: 2, isNullable: true },
            { name: 'precisionSample', type: 'int', isNullable: true },
            { name: 'precisionConfirmed', type: 'int', isNullable: true },
            { name: 'precisionRefuted', type: 'int', isNullable: true },
            { name: 'precisionPct', type: 'decimal', precision: 5, scale: 2, isNullable: true },
            this.createdAtColumn(),
          ],
        }),
        true,
      );
    }
    await this.ensureIndexes(queryRunner, 'event_coverage_snapshots', [
      new TableIndex({
        name: 'UQ_event_coverage_snapshots_key',
        columnNames: ['snapshotDate', 'scope', 'dimension', 'dimensionValue'],
        isUnique: true,
      }),
      new TableIndex({ name: 'IDX_event_coverage_snapshots_date', columnNames: ['snapshotDate'] }),
    ]);

    if (!(await queryRunner.hasTable('event_reference_fetch_cache'))) {
      await queryRunner.createTable(
        new Table({
          name: 'event_reference_fetch_cache',
          columns: [
            this.idColumn(),
            { name: 'cacheKey', type: 'varchar', length: '64', isNullable: false },
            { name: 'day', type: 'varchar', length: '10', isNullable: false },
            { name: 'provider', type: 'varchar', length: '16', isNullable: false },
            { name: 'payload', type: 'text', isNullable: false },
            this.createdAtColumn(),
          ],
        }),
        true,
      );
    }
    await this.ensureIndexes(queryRunner, 'event_reference_fetch_cache', [
      new TableIndex({ name: 'UQ_event_reference_fetch_cache_key', columnNames: ['cacheKey'], isUnique: true }),
      new TableIndex({ name: 'IDX_event_reference_fetch_cache_day', columnNames: ['day'] }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'event_reference_fetch_cache',
      'event_coverage_snapshots',
      'event_reference_votes',
      'event_reference',
    ]) {
      if (await queryRunner.hasTable(table)) await queryRunner.dropTable(table, true);
    }
  }

  private async ensureIndexes(queryRunner: QueryRunner, tableName: string, indices: TableIndex[]): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    for (const index of indices) {
      if (!table?.indices.some((existing) => existing.name === index.name)) {
        await queryRunner.createIndex(tableName, index);
      }
    }
  }
}
