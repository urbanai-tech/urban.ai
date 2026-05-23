import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUserCommunicationPreferences1781300000000 implements MigrationInterface {
  name = 'CreateUserCommunicationPreferences1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_communication_preferences'))) {
      await queryRunner.createTable(
        new Table({
          name: 'user_communication_preferences',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false, isUnique: true },
            { name: 'email_pricing', type: 'boolean', default: true, isNullable: false },
            { name: 'push_pricing', type: 'boolean', default: true, isNullable: false },
            { name: 'weekly_report', type: 'boolean', default: true, isNullable: false },
            { name: 'marketing', type: 'boolean', default: false, isNullable: false },
            { name: 'stays_alerts', type: 'boolean', default: true, isNullable: false },
            { name: 'billing_alerts', type: 'boolean', default: true, isNullable: false },
            { name: 'createdAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
            { name: 'updatedAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)', isNullable: false },
          ],
        }),
        true,
      );
    }

    await this.ensureIndex(queryRunner, 'IDX_user_communication_preferences_user', ['user_id']);
    await this.ensureForeignKey(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_communication_preferences')) {
      await queryRunner.dropTable('user_communication_preferences', true);
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    name: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable('user_communication_preferences');
    if (!table) return;
    if (!table.indices.some((index) => index.name === name)) {
      await queryRunner.createIndex(
        'user_communication_preferences',
        new TableIndex({ name, columnNames }),
      );
    }
  }

  private async ensureForeignKey(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_communication_preferences');
    if (!table || !(await queryRunner.hasTable('user'))) return;
    if (table.foreignKeys.some((fk) => fk.columnNames.includes('user_id'))) return;

    await queryRunner.createForeignKey(
      'user_communication_preferences',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }
}
