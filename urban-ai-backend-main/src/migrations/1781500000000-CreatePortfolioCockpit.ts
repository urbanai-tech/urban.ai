import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePortfolioCockpit1781500000000 implements MigrationInterface {
  name = 'CreatePortfolioCockpit1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('portfolio_property_settings'))) {
      await queryRunner.createTable(
        new Table({
          name: 'portfolio_property_settings',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            { name: 'address_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'strategy', type: 'varchar', length: '24', default: "'balanced'", isNullable: false },
            { name: 'metadata', type: 'text', isNullable: true },
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
      await this.ensureIndex(queryRunner, 'portfolio_property_settings', 'UQ_portfolio_property_settings_address', [
        'address_id',
      ], true);
      await this.ensureIndex(queryRunner, 'portfolio_property_settings', 'IDX_portfolio_property_settings_user_updatedAt', [
        'user_id',
        'updatedAt',
      ]);
      await this.ensureForeignKey(queryRunner, 'portfolio_property_settings', {
        columnNames: ['address_id'],
        referencedTableName: 'addresses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
      await this.ensureForeignKey(queryRunner, 'portfolio_property_settings', {
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
    }

    if (!(await queryRunner.hasTable('portfolio_action_runs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'portfolio_action_runs',
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
            { name: 'action', type: 'varchar', length: '64', isNullable: false },
            { name: 'status', type: 'varchar', length: '24', default: "'running'", isNullable: false },
            { name: 'selectedPropertyIds', type: 'text', isNullable: true },
            { name: 'targetDates', type: 'text', isNullable: true },
            { name: 'payload', type: 'text', isNullable: true },
            { name: 'summary', type: 'text', isNullable: true },
            { name: 'completedAt', type: 'datetime', precision: 6, isNullable: true },
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
      await this.ensureIndex(queryRunner, 'portfolio_action_runs', 'IDX_portfolio_action_runs_user_createdAt', [
        'user_id',
        'createdAt',
      ]);
      await this.ensureIndex(queryRunner, 'portfolio_action_runs', 'IDX_portfolio_action_runs_action_createdAt', [
        'action',
        'createdAt',
      ]);
      await this.ensureIndex(queryRunner, 'portfolio_action_runs', 'IDX_portfolio_action_runs_status_createdAt', [
        'status',
        'createdAt',
      ]);
      await this.ensureForeignKey(queryRunner, 'portfolio_action_runs', {
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
    }

    if (!(await queryRunner.hasTable('portfolio_action_items'))) {
      await queryRunner.createTable(
        new Table({
          name: 'portfolio_action_items',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            { name: 'run_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'address_id', type: 'varchar', length: '36', isNullable: true },
            { name: 'property_id', type: 'varchar', length: '36', isNullable: true },
            { name: 'targetDate', type: 'date', isNullable: true },
            { name: 'action', type: 'varchar', length: '64', isNullable: false },
            { name: 'status', type: 'varchar', length: '24', isNullable: false },
            { name: 'before', type: 'text', isNullable: true },
            { name: 'after', type: 'text', isNullable: true },
            { name: 'metadata', type: 'text', isNullable: true },
            { name: 'estimatedLift', type: 'decimal', precision: 10, scale: 2, isNullable: true },
            { name: 'errorMessage', type: 'text', isNullable: true },
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
      await this.ensureIndex(queryRunner, 'portfolio_action_items', 'IDX_portfolio_action_items_run_status', [
        'run_id',
        'status',
      ]);
      await this.ensureIndex(queryRunner, 'portfolio_action_items', 'IDX_portfolio_action_items_user_createdAt', [
        'user_id',
        'createdAt',
      ]);
      await this.ensureIndex(queryRunner, 'portfolio_action_items', 'IDX_portfolio_action_items_address_targetDate', [
        'address_id',
        'targetDate',
      ]);
      await this.ensureIndex(queryRunner, 'portfolio_action_items', 'IDX_portfolio_action_items_action_createdAt', [
        'action',
        'createdAt',
      ]);
      await this.ensureForeignKey(queryRunner, 'portfolio_action_items', {
        columnNames: ['run_id'],
        referencedTableName: 'portfolio_action_runs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
      await this.ensureForeignKey(queryRunner, 'portfolio_action_items', {
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
      await this.ensureForeignKey(queryRunner, 'portfolio_action_items', {
        columnNames: ['address_id'],
        referencedTableName: 'addresses',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      });
    }

    if (!(await queryRunner.hasTable('portfolio_daily_price_overrides'))) {
      await queryRunner.createTable(
        new Table({
          name: 'portfolio_daily_price_overrides',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            { name: 'address_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'action_run_id', type: 'varchar', length: '36', isNullable: true },
            { name: 'targetDate', type: 'date', isNullable: false },
            { name: 'price', type: 'decimal', precision: 10, scale: 2, isNullable: false },
            { name: 'source', type: 'varchar', length: '48', default: "'portfolio_manual'", isNullable: false },
            { name: 'metadata', type: 'text', isNullable: true },
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
      await this.ensureIndex(queryRunner, 'portfolio_daily_price_overrides', 'UQ_portfolio_daily_price_overrides_address_targetDate', [
        'address_id',
        'targetDate',
      ], true);
      await this.ensureIndex(queryRunner, 'portfolio_daily_price_overrides', 'IDX_portfolio_daily_price_overrides_user_targetDate', [
        'user_id',
        'targetDate',
      ]);
      await this.ensureIndex(queryRunner, 'portfolio_daily_price_overrides', 'IDX_portfolio_daily_price_overrides_action_run', [
        'action_run_id',
      ]);
      await this.ensureForeignKey(queryRunner, 'portfolio_daily_price_overrides', {
        columnNames: ['address_id'],
        referencedTableName: 'addresses',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
      await this.ensureForeignKey(queryRunner, 'portfolio_daily_price_overrides', {
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
      await this.ensureForeignKey(queryRunner, 'portfolio_daily_price_overrides', {
        columnNames: ['action_run_id'],
        referencedTableName: 'portfolio_action_runs',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of [
      'portfolio_daily_price_overrides',
      'portfolio_action_items',
      'portfolio_action_runs',
      'portfolio_property_settings',
    ]) {
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
    isUnique = false,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (table?.indices.some((idx) => idx.name === indexName)) return;
    await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames, isUnique }));
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
