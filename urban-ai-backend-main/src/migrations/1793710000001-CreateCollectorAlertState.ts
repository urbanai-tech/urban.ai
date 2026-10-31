import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Estado persistido dos alertas de fonte de eventos (realerta do zero-yield e "nunca entregou").
 * Aditiva: só cria `collector_alert_state`; `down` a remove.
 */
export class CreateCollectorAlertState1793710000001 implements MigrationInterface {
  name = 'CreateCollectorAlertState1793710000001';

  private readonly table = 'collector_alert_state';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(this.table)) return;
    await queryRunner.createTable(
      new Table({
        name: this.table,
        columns: [
          { name: 'source', type: 'varchar', length: '64', isPrimary: true, isNullable: false },
          { name: 'kind', type: 'varchar', length: '24', isPrimary: true, isNullable: false },
          { name: 'firstExpectedAt', type: 'datetime', precision: 6, isNullable: true },
          { name: 'lastAlertAt', type: 'datetime', precision: 6, isNullable: true },
          { name: 'updatedAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(this.table)) {
      await queryRunner.dropTable(this.table, true);
    }
  }
}
