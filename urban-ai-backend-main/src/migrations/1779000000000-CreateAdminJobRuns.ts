import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAdminJobRuns1779000000000 implements MigrationInterface {
  name = 'CreateAdminJobRuns1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_job_runs',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          { name: 'name', type: 'varchar', length: '64', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', default: "'running'", isNullable: false },
          { name: 'triggeredByUserId', type: 'varchar', length: '36', isNullable: true },
          {
            name: 'startedAt',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
          { name: 'finishedAt', type: 'datetime', precision: 6, isNullable: true },
          { name: 'durationMs', type: 'int', isNullable: true },
          { name: 'result', type: 'longtext', isNullable: true },
          { name: 'errorMessage', type: 'text', isNullable: true },
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

    const table = await queryRunner.getTable('admin_job_runs');
    const existing = new Set((table?.indices ?? []).map((i) => i.name));

    if (!existing.has('IDX_admin_job_runs_name_startedAt')) {
      await queryRunner.createIndex(
        'admin_job_runs',
        new TableIndex({
          name: 'IDX_admin_job_runs_name_startedAt',
          columnNames: ['name', 'startedAt'],
        }),
      );
    }

    if (!existing.has('IDX_admin_job_runs_status_startedAt')) {
      await queryRunner.createIndex(
        'admin_job_runs',
        new TableIndex({
          name: 'IDX_admin_job_runs_status_startedAt',
          columnNames: ['status', 'startedAt'],
        }),
      );
    }

    if (!existing.has('IDX_admin_job_runs_triggeredBy_startedAt')) {
      await queryRunner.createIndex(
        'admin_job_runs',
        new TableIndex({
          name: 'IDX_admin_job_runs_triggeredBy_startedAt',
          columnNames: ['triggeredByUserId', 'startedAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('admin_job_runs');
    if (!table) return;
    const existing = new Set((table.indices ?? []).map((i) => i.name));
    if (existing.has('IDX_admin_job_runs_triggeredBy_startedAt')) {
      await queryRunner.dropIndex('admin_job_runs', 'IDX_admin_job_runs_triggeredBy_startedAt');
    }
    if (existing.has('IDX_admin_job_runs_status_startedAt')) {
      await queryRunner.dropIndex('admin_job_runs', 'IDX_admin_job_runs_status_startedAt');
    }
    if (existing.has('IDX_admin_job_runs_name_startedAt')) {
      await queryRunner.dropIndex('admin_job_runs', 'IDX_admin_job_runs_name_startedAt');
    }
    await queryRunner.dropTable('admin_job_runs', true);
  }
}
