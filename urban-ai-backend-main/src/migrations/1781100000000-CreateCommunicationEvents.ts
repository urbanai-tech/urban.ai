import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCommunicationEvents1781100000000 implements MigrationInterface {
  name = 'CreateCommunicationEvents1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('communication_events'))) {
      await queryRunner.createTable(
        new Table({
          name: 'communication_events',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: true },
            { name: 'channel', type: 'varchar', length: '24', isNullable: false },
            { name: 'status', type: 'varchar', length: '24', isNullable: false },
            { name: 'kind', type: 'varchar', length: '96', isNullable: true },
            { name: 'template_name', type: 'varchar', length: '120', isNullable: true },
            { name: 'recipient_email', type: 'varchar', length: '254', isNullable: true },
            { name: 'recipient_device_id', type: 'varchar', length: '64', isNullable: true },
            { name: 'subject', type: 'varchar', length: '220', isNullable: true },
            { name: 'title', type: 'varchar', length: '220', isNullable: true },
            { name: 'provider', type: 'varchar', length: '64', isNullable: true },
            { name: 'provider_message_id', type: 'varchar', length: '160', isNullable: true },
            { name: 'failure_reason', type: 'text', isNullable: true },
            { name: 'metadata_json', type: 'text', isNullable: true },
            { name: 'correlation_id', type: 'varchar', length: '120', isNullable: true },
            { name: 'createdAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
          ],
        }),
        true,
      );
    }

    await this.ensureIndex(queryRunner, 'IDX_communication_events_created', ['createdAt']);
    await this.ensureIndex(queryRunner, 'IDX_communication_events_channel_status', ['channel', 'status', 'createdAt']);
    await this.ensureIndex(queryRunner, 'IDX_communication_events_user_created', ['user_id', 'createdAt']);
    await this.ensureIndex(queryRunner, 'IDX_communication_events_kind_created', ['kind', 'createdAt']);
    await this.ensureForeignKey(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('communication_events')) {
      await queryRunner.dropTable('communication_events', true);
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    name: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable('communication_events');
    if (!table) return;
    if (!table.indices.some((index) => index.name === name)) {
      await queryRunner.createIndex(
        'communication_events',
        new TableIndex({ name, columnNames }),
      );
    }
  }

  private async ensureForeignKey(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('communication_events');
    if (!table || !(await queryRunner.hasTable('user'))) return;
    if (table.foreignKeys.some((fk) => fk.columnNames.includes('user_id'))) return;
    await queryRunner.createForeignKey(
      'communication_events',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }
}
