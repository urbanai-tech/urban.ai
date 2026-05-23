import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableColumnOptions,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateEventDedupCandidates1781000000000 implements MigrationInterface {
  name = 'CreateEventDedupCandidates1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_dedup_candidates';

    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          this.uuidPrimaryColumn(),
          { name: 'canonicalEventId', type: 'varchar', length: '36', isNullable: false },
          { name: 'duplicateEventId', type: 'varchar', length: '36', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', default: "'pending'", isNullable: false },
          { name: 'confidenceBand', type: 'varchar', length: '16', default: "'medium'", isNullable: false },
          { name: 'score', type: 'decimal', precision: 5, scale: 4, isNullable: false },
          { name: 'reason', type: 'varchar', length: '255', isNullable: false },
          { name: 'signals', type: 'text', isNullable: true },
          { name: 'source', type: 'varchar', length: '64', isNullable: true },
          { name: 'sourceId', type: 'varchar', length: '128', isNullable: true },
          { name: 'reviewedByUserId', type: 'varchar', length: '36', isNullable: true },
          { name: 'reviewedAt', type: 'datetime', isNullable: true },
          { name: 'reviewReason', type: 'varchar', length: '255', isNullable: true },
          this.timestampColumn('createdAt'),
          this.timestampColumn('updatedAt', true),
        ],
      }),
      true,
    );

    const columns: TableColumnOptions[] = [
      { name: 'canonicalEventId', type: 'varchar', length: '36', isNullable: false },
      { name: 'duplicateEventId', type: 'varchar', length: '36', isNullable: false },
      { name: 'status', type: 'varchar', length: '16', default: "'pending'", isNullable: false },
      { name: 'confidenceBand', type: 'varchar', length: '16', default: "'medium'", isNullable: false },
      { name: 'score', type: 'decimal', precision: 5, scale: 4, isNullable: false },
      { name: 'reason', type: 'varchar', length: '255', isNullable: false },
      { name: 'signals', type: 'text', isNullable: true },
      { name: 'source', type: 'varchar', length: '64', isNullable: true },
      { name: 'sourceId', type: 'varchar', length: '128', isNullable: true },
      { name: 'reviewedByUserId', type: 'varchar', length: '36', isNullable: true },
      { name: 'reviewedAt', type: 'datetime', isNullable: true },
      { name: 'reviewReason', type: 'varchar', length: '255', isNullable: true },
      this.timestampColumn('createdAt'),
      this.timestampColumn('updatedAt', true),
    ];

    for (const column of columns) {
      await this.ensureColumn(queryRunner, tableName, column);
    }

    await this.ensureIndex(queryRunner, tableName, 'IDX_event_dedup_candidates_status_confidence', [
      'status',
      'confidenceBand',
    ]);
    await this.ensureIndex(queryRunner, tableName, 'IDX_event_dedup_candidates_canonical', [
      'canonicalEventId',
    ]);
    await this.ensureIndex(queryRunner, tableName, 'IDX_event_dedup_candidates_duplicate', [
      'duplicateEventId',
    ]);
    await this.ensureIndex(queryRunner, tableName, 'UQ_event_dedup_candidates_pair', [
      'canonicalEventId',
      'duplicateEventId',
    ], true);
    await this.ensureForeignKeys(queryRunner, tableName);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'event_dedup_candidates';
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

  private async ensureColumn(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumnOptions,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    if (!table.columns.some((existing) => existing.name === column.name)) {
      await queryRunner.addColumn(tableName, new TableColumn(column));
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
    isUnique = false,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const exists = table.indices.some(
      (index) => index.name === indexName || this.sameColumns(index.columnNames, columnNames),
    );
    if (exists) return;
    await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames, isUnique }));
  }

  private async ensureForeignKeys(queryRunner: QueryRunner, tableName: string): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table || !(await queryRunner.hasTable('events'))) return;

    const keys = [
      { column: 'canonicalEventId', name: 'FK_event_dedup_candidates_canonical' },
      { column: 'duplicateEventId', name: 'FK_event_dedup_candidates_duplicate' },
    ];
    for (const key of keys) {
      const exists = table.foreignKeys.some(
        (fk) => fk.columnNames.includes(key.column) && fk.referencedTableName === 'events',
      );
      if (exists) continue;
      await queryRunner.createForeignKey(
        tableName,
        new TableForeignKey({
          name: key.name,
          columnNames: [key.column],
          referencedTableName: 'events',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
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
