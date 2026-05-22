import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateHostPanelPersistence1779700000000 implements MigrationInterface {
  name = 'CreateHostPanelPersistence1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('pricing_rule_configs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'pricing_rule_configs',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            { name: 'address_id', type: 'varchar', length: '36', isNullable: false, isUnique: true },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'rules', type: 'text', isNullable: false },
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
        true,
      );

      await this.ensureIndex(queryRunner, 'pricing_rule_configs', 'IDX_pricing_rule_configs_user_updatedAt', [
        'user_id',
        'updatedAt',
      ]);
      await this.ensureForeignKey(queryRunner, 'pricing_rule_configs', {
        columnNames: ['address_id'],
        referencedTableName: 'addresses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
      await this.ensureForeignKey(queryRunner, 'pricing_rule_configs', {
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
    }

    if (!(await queryRunner.hasTable('ask_urban_messages'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ask_urban_messages',
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
            { name: 'conversationId', type: 'varchar', length: '64', isNullable: false },
            { name: 'role', type: 'varchar', length: '16', isNullable: false },
            { name: 'content', type: 'text', isNullable: false },
            { name: 'citations', type: 'text', isNullable: true },
            { name: 'feedback', type: 'varchar', length: '8', isNullable: true },
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

      await this.ensureIndex(queryRunner, 'ask_urban_messages', 'IDX_ask_urban_messages_user_createdAt', [
        'user_id',
        'createdAt',
      ]);
      await this.ensureIndex(queryRunner, 'ask_urban_messages', 'IDX_ask_urban_messages_conversationId', [
        'conversationId',
      ]);
      await this.ensureForeignKey(queryRunner, 'ask_urban_messages', {
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['ask_urban_messages', 'pricing_rule_configs']) {
      const table = await queryRunner.getTable(tableName);
      if (!table) continue;
      for (const fk of [...table.foreignKeys]) await queryRunner.dropForeignKey(tableName, fk);
      for (const idx of [...table.indices]) await queryRunner.dropIndex(tableName, idx);
      await queryRunner.dropTable(tableName, true);
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
  ) {
    const table = await queryRunner.getTable(tableName);
    if (table?.indices.some((idx) => idx.name === indexName)) return;
    await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames }));
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
    if (!(await queryRunner.hasTable(input.referencedTableName))) return;
    const table = await queryRunner.getTable(tableName);
    const exists = table?.foreignKeys.some(
      (fk) =>
        fk.columnNames.join(',') === input.columnNames.join(',') &&
        fk.referencedTableName === input.referencedTableName,
    );
    if (exists) return;
    await queryRunner.createForeignKey(tableName, new TableForeignKey(input));
  }
}
