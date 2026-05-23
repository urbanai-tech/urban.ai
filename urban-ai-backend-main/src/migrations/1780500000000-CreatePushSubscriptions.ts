import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePushSubscriptions1780500000000 implements MigrationInterface {
  name = 'CreatePushSubscriptions1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('push_subscriptions'))) {
      await queryRunner.createTable(
        new Table({
          name: 'push_subscriptions',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'deviceId', type: 'varchar', length: '64', isNullable: false },
            { name: 'deviceSecretHash', type: 'varchar', length: '64', isNullable: false },
            { name: 'endpointHash', type: 'varchar', length: '64', isNullable: false },
            { name: 'endpoint', type: 'varchar', length: '2048', isNullable: false },
            { name: 'p256dh', type: 'varchar', length: '255', isNullable: false },
            { name: 'auth', type: 'varchar', length: '255', isNullable: false },
            { name: 'userAgent', type: 'text', isNullable: true },
            { name: 'platform', type: 'varchar', length: '64', isNullable: true },
            { name: 'active', type: 'boolean', default: true, isNullable: false },
            { name: 'failedAttempts', type: 'int', default: 0, isNullable: false },
            { name: 'lastPushAttemptAt', type: 'datetime', isNullable: true },
            { name: 'lastPushSuccessAt', type: 'datetime', isNullable: true },
            { name: 'lastPushFailureAt', type: 'datetime', isNullable: true },
            { name: 'failureReason', type: 'varchar', length: '255', isNullable: true },
            { name: 'createdAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
            { name: 'updatedAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)', isNullable: false },
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('push_deliveries'))) {
      await queryRunner.createTable(
        new Table({
          name: 'push_deliveries',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'subscription_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'payloadJson', type: 'text', isNullable: false },
            { name: 'pushedAt', type: 'datetime', isNullable: true },
            { name: 'deliveredAt', type: 'datetime', isNullable: true },
            { name: 'failedAt', type: 'datetime', isNullable: true },
            { name: 'failureReason', type: 'varchar', length: '255', isNullable: true },
            { name: 'createdAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
          ],
        }),
        true,
      );
    }

    await this.ensureIndex(queryRunner, 'push_subscriptions', 'IDX_push_subscriptions_device', ['deviceId'], true);
    await this.ensureIndex(queryRunner, 'push_subscriptions', 'IDX_push_subscriptions_endpoint_hash', ['endpointHash'], true);
    await this.ensureIndex(queryRunner, 'push_subscriptions', 'IDX_push_subscriptions_user_active', ['user_id', 'active']);
    await this.ensureIndex(queryRunner, 'push_deliveries', 'IDX_push_deliveries_subscription_pending', ['subscription_id', 'deliveredAt']);
    await this.ensureIndex(queryRunner, 'push_deliveries', 'IDX_push_deliveries_user_created', ['user_id', 'createdAt']);
    await this.ensureForeignKeys(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('push_deliveries')) {
      await queryRunner.dropTable('push_deliveries', true);
    }
    if (await queryRunner.hasTable('push_subscriptions')) {
      await queryRunner.dropTable('push_subscriptions', true);
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    name: string,
    columnNames: string[],
    isUnique = false,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const exists = (table.indices ?? []).some((index) => index.name === name);
    if (!exists) {
      await queryRunner.createIndex(tableName, new TableIndex({ name, columnNames, isUnique }));
    }
  }

  private async ensureForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const subscriptionsTable = await queryRunner.getTable('push_subscriptions');
    const deliveriesTable = await queryRunner.getTable('push_deliveries');
    if (!subscriptionsTable || !deliveriesTable) return;
    const hasUserTable = await queryRunner.hasTable('user');

    if (hasUserTable && !subscriptionsTable.foreignKeys.some((fk) => fk.columnNames.includes('user_id'))) {
      await queryRunner.createForeignKey(
        'push_subscriptions',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'user',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (!deliveriesTable.foreignKeys.some((fk) => fk.columnNames.includes('subscription_id'))) {
      await queryRunner.createForeignKey(
        'push_deliveries',
        new TableForeignKey({
          columnNames: ['subscription_id'],
          referencedTableName: 'push_subscriptions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (hasUserTable && !deliveriesTable.foreignKeys.some((fk) => fk.columnNames.includes('user_id'))) {
      await queryRunner.createForeignKey(
        'push_deliveries',
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
