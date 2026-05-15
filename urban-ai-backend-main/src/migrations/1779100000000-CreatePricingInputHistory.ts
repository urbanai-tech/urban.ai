import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePricingInputHistory1779100000000 implements MigrationInterface {
  name = 'CreatePricingInputHistory1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('pricing_input_history')) return;

    await queryRunner.createTable(
      new Table({
        name: 'pricing_input_history',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'list_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'address_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'previousManualDailyPrice', type: 'float', isNullable: true },
          { name: 'newManualDailyPrice', type: 'float', isNullable: true },
          { name: 'previousAverageMonthlyRevenue', type: 'float', isNullable: true },
          { name: 'newAverageMonthlyRevenue', type: 'float', isNullable: true },
          { name: 'source', type: 'varchar', length: '32', default: "'manual'" },
          { name: 'changedByUserId', type: 'varchar', length: '64', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'pricing_input_history',
      new TableIndex({
        name: 'IDX_pricing_input_history_list_created',
        columnNames: ['list_id', 'created_at'],
      }),
    );
    await queryRunner.createIndex(
      'pricing_input_history',
      new TableIndex({
        name: 'IDX_pricing_input_history_address_created',
        columnNames: ['address_id', 'created_at'],
      }),
    );
    await queryRunner.createIndex(
      'pricing_input_history',
      new TableIndex({
        name: 'IDX_pricing_input_history_user_created',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await this.createForeignKeyIfReferencedTableExists(queryRunner, {
      name: 'FK_pricing_input_history_list',
      columnNames: ['list_id'],
      referencedTableName: 'list',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.createForeignKeyIfReferencedTableExists(queryRunner, {
      name: 'FK_pricing_input_history_address',
      columnNames: ['address_id'],
      referencedTableName: 'addresses',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.createForeignKeyIfReferencedTableExists(queryRunner, {
      name: 'FK_pricing_input_history_user',
      columnNames: ['user_id'],
      referencedTableName: 'user',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });

    if (await queryRunner.hasTable('list')) {
      const addressJoin = (await queryRunner.hasTable('addresses'))
        ? `
        LEFT JOIN (
          SELECT list_id, MIN(id) AS address_id
          FROM addresses
          GROUP BY list_id
        ) addr ON addr.list_id = l.id
        `
        : 'LEFT JOIN (SELECT NULL AS list_id, NULL AS address_id) addr ON 1 = 0';

      await queryRunner.query(`
        INSERT INTO pricing_input_history (
          id,
          list_id,
          address_id,
          user_id,
          previousManualDailyPrice,
          newManualDailyPrice,
          previousAverageMonthlyRevenue,
          newAverageMonthlyRevenue,
          source,
          changedByUserId,
          created_at
        )
        SELECT
          UUID(),
          l.id,
          addr.address_id,
          l.user_id,
          NULL,
          l.manualDailyPrice,
          NULL,
          l.averageMonthlyRevenue,
          'manual_backfill',
          l.user_id,
          COALESCE(l.pricingInputsUpdatedAt, CURRENT_TIMESTAMP)
        FROM \`list\` l
        ${addressJoin}
        WHERE l.user_id IS NOT NULL
          AND (l.manualDailyPrice IS NOT NULL OR l.averageMonthlyRevenue IS NOT NULL)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('pricing_input_history'))) return;
    await queryRunner.dropTable('pricing_input_history', true);
  }

  private async createForeignKeyIfReferencedTableExists(
    queryRunner: QueryRunner,
    foreignKey: {
      name: string;
      columnNames: string[];
      referencedTableName: string;
      referencedColumnNames: string[];
      onDelete: 'CASCADE' | 'SET NULL';
    },
  ): Promise<void> {
    if (!(await queryRunner.hasTable(foreignKey.referencedTableName))) return;
    const table = await queryRunner.getTable('pricing_input_history');
    if (table?.foreignKeys.some((fk) => fk.name === foreignKey.name)) return;
    await queryRunner.createForeignKey('pricing_input_history', new TableForeignKey(foreignKey));
  }
}
