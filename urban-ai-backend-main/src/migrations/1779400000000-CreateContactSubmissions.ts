import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateContactSubmissions1779400000000 implements MigrationInterface {
  name = 'CreateContactSubmissions1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('contact_submissions');
    if (!exists) {
      await queryRunner.createTable(
        new Table({
          name: 'contact_submissions',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              isGenerated: true,
            },
            { name: 'name', type: 'varchar', length: '160' },
            { name: 'email', type: 'varchar', length: '254' },
            { name: 'subject', type: 'varchar', length: '220' },
            { name: 'message', type: 'text' },
            { name: 'source', type: 'varchar', length: '80', default: "'public-contact'" },
            { name: 'status', type: 'varchar', length: '32', default: "'new'" },
            { name: 'notes', type: 'text', isNullable: true },
            { name: 'ipAddress', type: 'varchar', length: '80', isNullable: true },
            { name: 'userAgent', type: 'text', isNullable: true },
            {
              name: 'createdAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
            },
            {
              name: 'updatedAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
              onUpdate: 'CURRENT_TIMESTAMP(6)',
            },
          ],
        }),
        true,
      );
    }

    const table = await queryRunner.getTable('contact_submissions');
    const existing = new Set(table?.indices.map((idx) => idx.name) ?? []);

    if (!existing.has('IDX_contact_submissions_status_createdAt')) {
      await queryRunner.createIndex(
        'contact_submissions',
        new TableIndex({
          name: 'IDX_contact_submissions_status_createdAt',
          columnNames: ['status', 'createdAt'],
        }),
      );
    }

    if (!existing.has('IDX_contact_submissions_email')) {
      await queryRunner.createIndex(
        'contact_submissions',
        new TableIndex({
          name: 'IDX_contact_submissions_email',
          columnNames: ['email'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('contact_submissions');
    if (!table) return;

    const existing = new Set(table.indices.map((idx) => idx.name));
    if (existing.has('IDX_contact_submissions_email')) {
      await queryRunner.dropIndex('contact_submissions', 'IDX_contact_submissions_email');
    }
    if (existing.has('IDX_contact_submissions_status_createdAt')) {
      await queryRunner.dropIndex(
        'contact_submissions',
        'IDX_contact_submissions_status_createdAt',
      );
    }

    await queryRunner.dropTable('contact_submissions', true);
  }
}
