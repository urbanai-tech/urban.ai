import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStaysConsentAuditFields1780000000000 implements MigrationInterface {
  name = 'AddStaysConsentAuditFields1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('stays_accounts');
    if (!table) return;

    const columns = [
      new TableColumn({ name: 'consentAcceptedAt', type: 'datetime', isNullable: true }),
      new TableColumn({ name: 'consentVersion', type: 'varchar', length: '64', isNullable: true }),
      new TableColumn({ name: 'consentIp', type: 'varchar', length: '64', isNullable: true }),
      new TableColumn({ name: 'consentUserAgent', type: 'varchar', length: '255', isNullable: true }),
    ].filter((column) => !table.findColumnByName(column.name));

    if (columns.length > 0) {
      await queryRunner.addColumns('stays_accounts', columns);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('stays_accounts');
    if (!table) return;

    const columnNames = ['consentUserAgent', 'consentIp', 'consentVersion', 'consentAcceptedAt'].filter(
      (name) => table.findColumnByName(name),
    );

    if (columnNames.length > 0) {
      await queryRunner.dropColumns('stays_accounts', columnNames);
    }
  }
}
