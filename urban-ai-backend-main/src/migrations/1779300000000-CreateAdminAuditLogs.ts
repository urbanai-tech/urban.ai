import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

export class CreateAdminAuditLogs1779300000000 implements MigrationInterface {
  name = 'CreateAdminAuditLogs1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('admin_audit_logs');
    if (!exists) {
      await queryRunner.createTable(
        new Table({
          name: 'admin_audit_logs',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              isGenerated: true,
            },
            { name: 'actorUserId', type: 'varchar', length: '36', isNullable: true },
            { name: 'action', type: 'varchar', length: '96' },
            { name: 'entityType', type: 'varchar', length: '64' },
            { name: 'entityId', type: 'varchar', length: '128', isNullable: true },
            { name: 'before', type: 'text', isNullable: true },
            { name: 'after', type: 'text', isNullable: true },
            { name: 'metadata', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
    }

    const table = await queryRunner.getTable('admin_audit_logs');
    const existing = new Set(table?.indices.map((idx) => idx.name) ?? []);
    if (!existing.has('IDX_admin_audit_logs_action_createdAt')) {
      await queryRunner.createIndex(
        'admin_audit_logs',
        new TableIndex({
          name: 'IDX_admin_audit_logs_action_createdAt',
          columnNames: ['action', 'createdAt'],
        }),
      );
    }
    if (!existing.has('IDX_admin_audit_logs_actor_createdAt')) {
      await queryRunner.createIndex(
        'admin_audit_logs',
        new TableIndex({
          name: 'IDX_admin_audit_logs_actor_createdAt',
          columnNames: ['actorUserId', 'createdAt'],
        }),
      );
    }
    if (!existing.has('IDX_admin_audit_logs_entity')) {
      await queryRunner.createIndex(
        'admin_audit_logs',
        new TableIndex({
          name: 'IDX_admin_audit_logs_entity',
          columnNames: ['entityType', 'entityId'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('admin_audit_logs');
    const existing = new Set(table?.indices.map((idx) => idx.name) ?? []);
    if (existing.has('IDX_admin_audit_logs_entity')) {
      await queryRunner.dropIndex('admin_audit_logs', 'IDX_admin_audit_logs_entity');
    }
    if (existing.has('IDX_admin_audit_logs_actor_createdAt')) {
      await queryRunner.dropIndex('admin_audit_logs', 'IDX_admin_audit_logs_actor_createdAt');
    }
    if (existing.has('IDX_admin_audit_logs_action_createdAt')) {
      await queryRunner.dropIndex('admin_audit_logs', 'IDX_admin_audit_logs_action_createdAt');
    }
    await queryRunner.dropTable('admin_audit_logs', true);
  }
}
