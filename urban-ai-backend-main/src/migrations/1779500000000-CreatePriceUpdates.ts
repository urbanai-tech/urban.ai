import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePriceUpdates1779500000000 implements MigrationInterface {
  name = 'CreatePriceUpdates1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'price_updates',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'stays_listing_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'analise_preco_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'targetDate', type: 'date', isNullable: false },
          { name: 'previousPriceCents', type: 'int', isNullable: false },
          { name: 'newPriceCents', type: 'int', isNullable: false },
          { name: 'currency', type: 'varchar', length: '3', default: "'BRL'", isNullable: false },
          { name: 'origin', type: 'varchar', length: '32', isNullable: false },
          { name: 'status', type: 'varchar', length: '32', default: "'pending'", isNullable: false },
          { name: 'errorMessage', type: 'varchar', length: '255', isNullable: true },
          { name: 'ip', type: 'varchar', length: '64', isNullable: true },
          { name: 'userAgent', type: 'varchar', length: '255', isNullable: true },
          { name: 'rollback_of_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'idempotencyKey', type: 'varchar', length: '128', isNullable: false, isUnique: true },
          {
            name: 'createdAt',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await this.ensureIndex(queryRunner, 'price_updates', 'IDX_price_updates_listing_targetDate', [
      'stays_listing_id',
      'targetDate',
    ]);
    await this.ensureIndex(queryRunner, 'price_updates', 'IDX_price_updates_user_createdAt', [
      'user_id',
      'createdAt',
    ]);
    await this.ensureIndex(queryRunner, 'price_updates', 'IDX_price_updates_analise', [
      'analise_preco_id',
    ]);
    await this.ensureIndex(queryRunner, 'price_updates', 'IDX_price_updates_status_createdAt', [
      'status',
      'createdAt',
    ]);

    await this.ensureForeignKey(queryRunner, 'price_updates', {
      columnNames: ['user_id'],
      referencedTableName: 'user',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'price_updates', {
      columnNames: ['stays_listing_id'],
      referencedTableName: 'stays_listings',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'price_updates', {
      columnNames: ['analise_preco_id'],
      referencedTableName: 'analise_preco',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'price_updates', {
      columnNames: ['rollback_of_id'],
      referencedTableName: 'price_updates',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('price_updates');
    if (!table) return;

    for (const fk of [...table.foreignKeys]) {
      await queryRunner.dropForeignKey('price_updates', fk);
    }

    const existing = new Set(table.indices.map((idx) => idx.name));
    for (const name of [
      'IDX_price_updates_status_createdAt',
      'IDX_price_updates_analise',
      'IDX_price_updates_user_createdAt',
      'IDX_price_updates_listing_targetDate',
    ]) {
      if (existing.has(name)) {
        await queryRunner.dropIndex('price_updates', name);
      }
    }

    await queryRunner.dropTable('price_updates', true);
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
  ) {
    const table = await queryRunner.getTable(tableName);
    const existing = new Set(table?.indices.map((idx) => idx.name) ?? []);
    if (existing.has(indexName)) return;

    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: indexName,
        columnNames,
      }),
    );
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    input: {
      columnNames: string[];
      referencedTableName: string;
      referencedColumnNames: string[];
      onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    },
  ) {
    const table = await queryRunner.getTable(tableName);
    const exists = table?.foreignKeys.some(
      (fk) =>
        fk.columnNames.join(',') === input.columnNames.join(',') &&
        fk.referencedTableName === input.referencedTableName,
    );
    if (exists) return;

    await queryRunner.createForeignKey(
      tableName,
      new TableForeignKey(input),
    );
  }
}
