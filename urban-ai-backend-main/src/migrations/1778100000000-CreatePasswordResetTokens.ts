import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePasswordResetTokens1778100000000 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
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
          { name: 'tokenHash', type: 'varchar', length: '64', isNullable: false },
          { name: 'expiresAt', type: 'datetime', isNullable: false },
          { name: 'usedAt', type: 'datetime', isNullable: true },
          { name: 'userAgent', type: 'varchar', length: '255', isNullable: true },
          { name: 'ip', type: 'varchar', length: '64', isNullable: true },
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

    await this.ensureIndex(
      queryRunner,
      'password_reset_tokens',
      'IDX_password_reset_tokens_hash',
      ['tokenHash'],
      true,
    );
    await this.ensureIndex(
      queryRunner,
      'password_reset_tokens',
      'IDX_password_reset_tokens_user_used',
      ['user_id', 'usedAt'],
    );
    await this.ensureForeignKey(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_reset_tokens', true);
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
    const exists = (table.indices ?? []).some((i) => i.name === indexName);
    if (!exists) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({ name: indexName, columnNames, isUnique }),
      );
    }
  }

  private async ensureForeignKey(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('password_reset_tokens');
    const userTable = await queryRunner.getTable('user');
    if (!table || !userTable) return;

    const exists = (table.foreignKeys ?? []).some((fk) =>
      fk.columnNames.includes('user_id') && fk.referencedTableName === 'user',
    );

    if (!exists) {
      await queryRunner.createForeignKey(
        'password_reset_tokens',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'user',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }
}
