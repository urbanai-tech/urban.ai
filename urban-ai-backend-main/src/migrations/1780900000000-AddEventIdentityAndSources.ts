import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableColumnOptions,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddEventIdentityAndSources1780900000000 implements MigrationInterface {
  name = 'AddEventIdentityAndSources1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureEventIdentityColumns(queryRunner);
    await this.ensureEventSourcesTable(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropEventSourcesTable(queryRunner);
    await this.dropEventIdentityColumns(queryRunner);
  }

  private async ensureEventIdentityColumns(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'events';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const columns: TableColumnOptions[] = [
      { name: 'canonicalName', type: 'varchar', length: '255', isNullable: true },
      { name: 'normalizedName', type: 'varchar', length: '255', isNullable: true },
      { name: 'normalizedVenue', type: 'varchar', length: '255', isNullable: true },
      { name: 'canonicalVenueId', type: 'varchar', length: '36', isNullable: true },
      { name: 'duplicateOfEventId', type: 'varchar', length: '36', isNullable: true },
      {
        name: 'dedupStatus',
        type: 'varchar',
        length: '16',
        default: "'canonical'",
        isNullable: false,
      },
      { name: 'identityConfidence', type: 'decimal', precision: 5, scale: 4, isNullable: true },
      { name: 'sourceCount', type: 'int', default: '0', isNullable: false },
      { name: 'lastSeenAt', type: 'datetime', isNullable: true },
    ];

    for (const column of columns) {
      await this.ensureColumn(queryRunner, tableName, column);
    }
  }

  private async ensureEventSourcesTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_sources';

    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          this.uuidPrimaryColumn(),
          { name: 'eventId', type: 'varchar', length: '36', isNullable: false },
          { name: 'source', type: 'varchar', length: '64', isNullable: false },
          { name: 'sourceId', type: 'varchar', length: '128', isNullable: true },
          { name: 'rawTitle', type: 'varchar', length: '500', isNullable: true },
          { name: 'rawVenue', type: 'varchar', length: '255', isNullable: true },
          { name: 'rawAddress', type: 'text', isNullable: true },
          { name: 'rawStartDate', type: 'datetime', isNullable: true },
          { name: 'rawEndDate', type: 'datetime', isNullable: true },
          { name: 'url', type: 'text', isNullable: true },
          { name: 'canonicalUrl', type: 'varchar', length: '512', isNullable: true },
          { name: 'crawledUrl', type: 'text', isNullable: true },
          { name: 'rawPayload', type: 'text', isNullable: true },
          { name: 'confidenceScore', type: 'decimal', precision: 5, scale: 4, isNullable: true },
          { name: 'matchReason', type: 'varchar', length: '255', isNullable: true },
          this.timestampColumn('firstSeenAt'),
          this.timestampColumn('lastSeenAt'),
          { name: 'seenCount', type: 'int', default: '1', isNullable: false },
          this.timestampColumn('createdAt'),
          this.timestampColumn('updatedAt', true),
        ],
      }),
      true,
    );

    const columns: TableColumnOptions[] = [
      { name: 'eventId', type: 'varchar', length: '36', isNullable: false },
      { name: 'source', type: 'varchar', length: '64', isNullable: false },
      { name: 'sourceId', type: 'varchar', length: '128', isNullable: true },
      { name: 'rawTitle', type: 'varchar', length: '500', isNullable: true },
      { name: 'rawVenue', type: 'varchar', length: '255', isNullable: true },
      { name: 'rawAddress', type: 'text', isNullable: true },
      { name: 'rawStartDate', type: 'datetime', isNullable: true },
      { name: 'rawEndDate', type: 'datetime', isNullable: true },
      { name: 'url', type: 'text', isNullable: true },
      { name: 'canonicalUrl', type: 'varchar', length: '512', isNullable: true },
      { name: 'crawledUrl', type: 'text', isNullable: true },
      { name: 'rawPayload', type: 'text', isNullable: true },
      { name: 'confidenceScore', type: 'decimal', precision: 5, scale: 4, isNullable: true },
      { name: 'matchReason', type: 'varchar', length: '255', isNullable: true },
      this.timestampColumn('firstSeenAt'),
      this.timestampColumn('lastSeenAt'),
      { name: 'seenCount', type: 'int', default: '1', isNullable: false },
      this.timestampColumn('createdAt'),
      this.timestampColumn('updatedAt', true),
    ];

    for (const column of columns) {
      await this.ensureColumn(queryRunner, tableName, column);
    }

    await this.ensureIndex(queryRunner, tableName, 'IDX_event_sources_eventId', ['eventId']);
    await this.ensureIndex(queryRunner, tableName, 'IDX_event_sources_source', ['source']);
    await this.ensureIndex(queryRunner, tableName, 'IDX_event_sources_sourceId', ['sourceId']);
    await this.ensureIndex(queryRunner, tableName, 'IDX_event_sources_canonicalUrl', ['canonicalUrl']);
    await this.ensureIndex(queryRunner, tableName, 'IDX_event_sources_lastSeenAt', ['lastSeenAt']);
    await this.ensureSourceIdentityIndex(queryRunner);
    await this.ensureEventSourceForeignKey(queryRunner);
  }

  private async ensureSourceIdentityIndex(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_sources';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const columnNames = ['source', 'sourceId'];
    const existing = table.indices.find(
      (index) =>
        index.name === 'UQ_event_sources_source_sourceId' ||
        index.name === 'IDX_event_sources_source_sourceId' ||
        this.sameColumns(index.columnNames, columnNames),
    );
    if (existing) return;

    if (await this.hasDuplicateNonNullSourceIds(queryRunner)) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({ name: 'IDX_event_sources_source_sourceId', columnNames }),
      );
      return;
    }

    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: 'UQ_event_sources_source_sourceId',
        columnNames,
        isUnique: true,
      }),
    );
  }

  private async hasDuplicateNonNullSourceIds(queryRunner: QueryRunner): Promise<boolean> {
    const duplicates = await queryRunner.query(`
      SELECT source, sourceId
      FROM event_sources
      WHERE sourceId IS NOT NULL
      GROUP BY source, sourceId
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    return Array.isArray(duplicates) && duplicates.length > 0;
  }

  private async ensureEventSourceForeignKey(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_sources';
    const table = await queryRunner.getTable(tableName);
    if (!table || !(await queryRunner.hasTable('events'))) return;

    const exists = table.foreignKeys.some(
      (fk) => fk.columnNames.includes('eventId') && fk.referencedTableName === 'events',
    );
    if (exists) return;

    await queryRunner.createForeignKey(
      tableName,
      new TableForeignKey({
        columnNames: ['eventId'],
        referencedTableName: 'events',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  private async dropEventSourcesTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_sources';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    for (const foreignKey of [...table.foreignKeys]) {
      await queryRunner.dropForeignKey(tableName, foreignKey);
    }
    for (const index of [...table.indices]) {
      await queryRunner.dropIndex(tableName, index);
    }
    await queryRunner.dropTable(tableName, true);
  }

  private async dropEventIdentityColumns(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'events';
    const table = await queryRunner.getTable(tableName);
    if (!table) return;

    const columnNames = [
      'lastSeenAt',
      'sourceCount',
      'identityConfidence',
      'dedupStatus',
      'duplicateOfEventId',
      'canonicalVenueId',
      'normalizedVenue',
      'normalizedName',
      'canonicalName',
    ];
    const existingColumns = new Set(table.columns.map((column) => column.name));
    const toDrop = columnNames.filter((columnName) => existingColumns.has(columnName));
    if (toDrop.length > 0) {
      await queryRunner.dropColumns(tableName, toDrop);
    }
  }

  private async ensureColumn(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumnOptions,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const exists = table.columns.some((existing) => existing.name === column.name);
    if (!exists) {
      await queryRunner.addColumn(tableName, new TableColumn(column));
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const exists = table.indices.some(
      (index) => index.name === indexName || this.sameColumns(index.columnNames, columnNames),
    );
    if (exists) return;
    await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames }));
  }

  private sameColumns(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((column, index) => column === right[index]);
  }

  private uuidPrimaryColumn(): TableColumnOptions {
    return {
      name: 'id',
      type: 'varchar',
      length: '36',
      isPrimary: true,
      generationStrategy: 'uuid',
      default: '(UUID())',
    };
  }

  private timestampColumn(name: string, onUpdate = false): TableColumnOptions {
    return {
      name,
      type: 'datetime',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      onUpdate: onUpdate ? 'CURRENT_TIMESTAMP(6)' : undefined,
      isNullable: false,
    };
  }
}
