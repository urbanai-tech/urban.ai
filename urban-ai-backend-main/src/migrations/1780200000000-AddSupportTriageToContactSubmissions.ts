import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddSupportTriageToContactSubmissions1780200000000 implements MigrationInterface {
  name = 'AddSupportTriageToContactSubmissions1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('contact_submissions');
    if (!table) return;

    const columns = [
      new TableColumn({
        name: 'category',
        type: 'varchar',
        length: '32',
        default: "'support'",
      }),
      new TableColumn({
        name: 'severity',
        type: 'varchar',
        length: '8',
        default: "'P2'",
      }),
      new TableColumn({
        name: 'dueAt',
        type: 'datetime',
        isNullable: true,
      }),
      new TableColumn({
        name: 'resolvedAt',
        type: 'datetime',
        isNullable: true,
      }),
      new TableColumn({
        name: 'assignedOwner',
        type: 'varchar',
        length: '160',
        isNullable: true,
      }),
    ].filter((column) => !table.findColumnByName(column.name));

    if (columns.length > 0) {
      await queryRunner.addColumns('contact_submissions', columns);
    }

    const refreshed = await queryRunner.getTable('contact_submissions');
    const indices = new Set(refreshed?.indices.map((idx) => idx.name) ?? []);

    if (!indices.has('IDX_contact_submissions_category_status')) {
      await queryRunner.createIndex(
        'contact_submissions',
        new TableIndex({
          name: 'IDX_contact_submissions_category_status',
          columnNames: ['category', 'status'],
        }),
      );
    }

    if (!indices.has('IDX_contact_submissions_severity_dueAt')) {
      await queryRunner.createIndex(
        'contact_submissions',
        new TableIndex({
          name: 'IDX_contact_submissions_severity_dueAt',
          columnNames: ['severity', 'dueAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('contact_submissions');
    if (!table) return;

    const indices = new Set(table.indices.map((idx) => idx.name));
    if (indices.has('IDX_contact_submissions_severity_dueAt')) {
      await queryRunner.dropIndex('contact_submissions', 'IDX_contact_submissions_severity_dueAt');
    }
    if (indices.has('IDX_contact_submissions_category_status')) {
      await queryRunner.dropIndex('contact_submissions', 'IDX_contact_submissions_category_status');
    }

    const columnNames = ['assignedOwner', 'resolvedAt', 'dueAt', 'severity', 'category'].filter(
      (name) => table.findColumnByName(name),
    );
    if (columnNames.length > 0) {
      await queryRunner.dropColumns('contact_submissions', columnNames);
    }
  }
}
