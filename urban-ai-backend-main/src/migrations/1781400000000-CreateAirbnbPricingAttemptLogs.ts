import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateAirbnbPricingAttemptLogs1781400000000 implements MigrationInterface {
  name = 'CreateAirbnbPricingAttemptLogs1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('airbnb_pricing_attempt_logs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'airbnb_pricing_attempt_logs',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            { name: 'listingId', type: 'varchar', length: '128', isNullable: false },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: true },
            { name: 'list_id', type: 'varchar', length: '36', isNullable: true },
            { name: 'address_id', type: 'varchar', length: '36', isNullable: true },
            { name: 'checkIn', type: 'date', isNullable: false },
            { name: 'checkOut', type: 'date', isNullable: false },
            {
              name: 'source',
              type: 'varchar',
              length: '64',
              default: "'airbnb_headless'",
              isNullable: false,
            },
            {
              name: 'status',
              type: 'varchar',
              length: '32',
              default: "'pending'",
              isNullable: false,
            },
            { name: 'reason', type: 'varchar', length: '255', isNullable: true },
            { name: 'durationMs', type: 'int', isNullable: true },
            { name: 'priceTotal', type: 'decimal', precision: 12, scale: 2, isNullable: true },
            { name: 'dailyPrice', type: 'decimal', precision: 12, scale: 2, isNullable: true },
            { name: 'currency', type: 'varchar', length: '3', default: "'BRL'", isNullable: false },
            { name: 'finalUrl', type: 'text', isNullable: true },
            { name: 'metadata', type: 'longtext', isNullable: true },
            {
              name: 'startedAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
              isNullable: false,
            },
            { name: 'finishedAt', type: 'datetime', precision: 6, isNullable: true },
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
    }

    await this.ensureIndex(queryRunner, 'IDX_airbnb_pricing_attempt_logs_listing_window', [
      'listingId',
      'checkIn',
      'checkOut',
    ]);
    await this.ensureIndex(queryRunner, 'IDX_airbnb_pricing_attempt_logs_status_startedAt', [
      'status',
      'startedAt',
    ]);
    await this.ensureIndex(queryRunner, 'IDX_airbnb_pricing_attempt_logs_status_reason_startedAt', [
      'status',
      'reason',
      'startedAt',
    ]);
    await this.ensureIndex(queryRunner, 'IDX_airbnb_pricing_attempt_logs_source_startedAt', [
      'source',
      'startedAt',
    ]);
    await this.ensureIndex(queryRunner, 'IDX_airbnb_pricing_attempt_logs_user_startedAt', [
      'user_id',
      'startedAt',
    ]);
    await this.ensureIndex(queryRunner, 'IDX_airbnb_pricing_attempt_logs_list_startedAt', [
      'list_id',
      'startedAt',
    ]);
    await this.ensureIndex(queryRunner, 'IDX_airbnb_pricing_attempt_logs_address_startedAt', [
      'address_id',
      'startedAt',
    ]);

    await this.ensureForeignKey(queryRunner, 'user_id', 'user', 'id');
    await this.ensureForeignKey(queryRunner, 'list_id', 'list', 'id');
    await this.ensureForeignKey(queryRunner, 'address_id', 'addresses', 'id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('airbnb_pricing_attempt_logs')) {
      await queryRunner.dropTable('airbnb_pricing_attempt_logs', true);
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    name: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable('airbnb_pricing_attempt_logs');
    if (!table || table.indices.some((index) => index.name === name)) return;
    await queryRunner.createIndex(
      'airbnb_pricing_attempt_logs',
      new TableIndex({ name, columnNames }),
    );
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    columnName: string,
    referencedTableName: string,
    referencedColumnName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable('airbnb_pricing_attempt_logs');
    if (!table || !(await queryRunner.hasTable(referencedTableName))) return;
    if (table.foreignKeys.some((fk) => fk.columnNames.includes(columnName))) return;

    await queryRunner.createForeignKey(
      'airbnb_pricing_attempt_logs',
      new TableForeignKey({
        columnNames: [columnName],
        referencedTableName,
        referencedColumnNames: [referencedColumnName],
        onDelete: 'SET NULL',
      }),
    );
  }
}
