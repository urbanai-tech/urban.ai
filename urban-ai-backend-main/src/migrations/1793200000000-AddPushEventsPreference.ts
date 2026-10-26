import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Preferência de aviso (push) para a categoria "eventos", ao lado de push_pricing e weekly_report.
 * Aditiva e idempotente: default verdadeiro (quem já recebia continua recebendo); `down` remove a coluna.
 */
export class AddPushEventsPreference1793200000000 implements MigrationInterface {
  name = 'AddPushEventsPreference1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_communication_preferences'))) return;
    if (await queryRunner.hasColumn('user_communication_preferences', 'push_events')) return;

    await queryRunner.addColumn(
      'user_communication_preferences',
      new TableColumn({ name: 'push_events', type: 'boolean', default: true, isNullable: false }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_communication_preferences'))) return;
    if (await queryRunner.hasColumn('user_communication_preferences', 'push_events')) {
      await queryRunner.dropColumn('user_communication_preferences', 'push_events');
    }
  }
}
