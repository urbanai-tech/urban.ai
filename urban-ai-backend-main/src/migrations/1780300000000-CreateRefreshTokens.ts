import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableColumnOptions,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateRefreshTokens1780300000000 implements MigrationInterface {
  name = 'CreateRefreshTokens1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          { name: 'userId', type: 'varchar', length: '36', isNullable: false },
          { name: 'tokenHash', type: 'varchar', length: '64', isNullable: false },
          { name: 'expiresAt', type: 'datetime', isNullable: false },
          {
            name: 'createdAt',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
          { name: 'revokedAt', type: 'datetime', isNullable: true },
          { name: 'userAgent', type: 'varchar', length: '255', isNullable: true },
          { name: 'ip', type: 'varchar', length: '64', isNullable: true },
        ],
      }),
      true,
    );

    await this.ensureColumn(queryRunner, 'refresh_tokens', {
      name: 'userId',
      type: 'varchar',
      length: '36',
      isNullable: false,
    });
    await this.ensureColumn(queryRunner, 'refresh_tokens', {
      name: 'tokenHash',
      type: 'varchar',
      length: '64',
      isNullable: false,
    });
    await this.ensureColumn(queryRunner, 'refresh_tokens', {
      name: 'expiresAt',
      type: 'datetime',
      isNullable: false,
    });
    await this.ensureColumn(queryRunner, 'refresh_tokens', {
      name: 'createdAt',
      type: 'datetime',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    });
    await this.ensureColumn(queryRunner, 'refresh_tokens', {
      name: 'revokedAt',
      type: 'datetime',
      isNullable: true,
    });
    await this.ensureColumn(queryRunner, 'refresh_tokens', {
      name: 'userAgent',
      type: 'varchar',
      length: '255',
      isNullable: true,
    });
    await this.ensureColumn(queryRunner, 'refresh_tokens', {
      name: 'ip',
      type: 'varchar',
      length: '64',
      isNullable: true,
    });

    await this.ensureIndex(
      queryRunner,
      'refresh_tokens',
      'IDX_refresh_tokens_hash',
      ['tokenHash'],
      true,
    );
    await this.ensureIndex(
      queryRunner,
      'refresh_tokens',
      'IDX_refresh_tokens_user_revoked',
      ['userId', 'revokedAt'],
    );
    await this.ensureForeignKey(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refresh_tokens', true);
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
    isUnique = false,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const exists = (table.indices ?? []).some(
      (index) =>
        index.name === indexName ||
        (index.columnNames.length === columnNames.length &&
          index.columnNames.every((column, indexPosition) => column === columnNames[indexPosition])),
    );
    if (!exists) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({ name: indexName, columnNames, isUnique }),
      );
    }
  }

  private async ensureForeignKey(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('refresh_tokens');
    const userTable = await queryRunner.getTable('user');
    if (!table || !userTable) return;

    const exists = (table.foreignKeys ?? []).some(
      (fk) => fk.columnNames.includes('userId') && fk.referencedTableName === 'user',
    );

    if (!exists) {
      await queryRunner.createForeignKey(
        'refresh_tokens',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedTableName: 'user',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }
}
