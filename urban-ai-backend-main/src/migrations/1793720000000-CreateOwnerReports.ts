import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Relatório mensal para o proprietário (ADR 0027). Aditiva: cria `property_owners`,
 * `property_owner_properties`, `owner_reports`, `owner_report_links` e a coluna
 * `owner_reports` em `user_communication_preferences` (padrão ligado). Nada existente muda.
 * `down` remove tudo na ordem inversa.
 */
export class CreateOwnerReports1793720000000 implements MigrationInterface {
  name = 'CreateOwnerReports1793720000000';

  private readonly uuidColumn = {
    name: 'id',
    type: 'varchar',
    length: '36',
    isPrimary: true,
    generationStrategy: 'uuid' as const,
    default: '(UUID())',
  };

  private readonly createdAt = {
    name: 'created_at',
    type: 'datetime',
    precision: 6,
    default: 'CURRENT_TIMESTAMP(6)',
    isNullable: false,
  };

  private readonly updatedAt = {
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
    isNullable: false,
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createPropertyOwners(queryRunner);
    await this.createPropertyOwnerProperties(queryRunner);
    await this.createOwnerReports(queryRunner);
    await this.createOwnerReportLinks(queryRunner);
    await this.addOwnerReportsPreference(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('user_communication_preferences', 'owner_reports')) {
      await queryRunner.dropColumn('user_communication_preferences', 'owner_reports');
    }
    for (const table of ['owner_report_links', 'owner_reports', 'property_owner_properties', 'property_owners']) {
      if (await queryRunner.hasTable(table)) {
        await queryRunner.dropTable(table, true);
      }
    }
  }

  private async createPropertyOwners(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('property_owners'))) {
      await queryRunner.createTable(
        new Table({
          name: 'property_owners',
          columns: [
            this.uuidColumn,
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'name', type: 'varchar', length: '160', isNullable: false },
            { name: 'email', type: 'varchar', length: '254', isNullable: false },
            { name: 'monthly_report_enabled', type: 'boolean', default: true, isNullable: false },
            { name: 'consent_version', type: 'varchar', length: '48', isNullable: false },
            { name: 'consent_accepted_at', type: 'datetime', precision: 6, isNullable: false },
            { name: 'consent_ip', type: 'varchar', length: '64', isNullable: true },
            { name: 'unsubscribed_at', type: 'datetime', precision: 6, isNullable: true },
            { name: 'unsubscribe_ref', type: 'varchar', length: '32', isNullable: false },
            this.createdAt,
            this.updatedAt,
          ],
        }),
        true,
      );
    }
    await this.ensureIndex(queryRunner, 'property_owners', 'UQ_property_owners_user_email', ['user_id', 'email'], true);
    await this.ensureIndex(queryRunner, 'property_owners', 'UQ_property_owners_unsubscribe_ref', ['unsubscribe_ref'], true);
    await this.ensureForeignKey(queryRunner, 'property_owners', 'user_id', 'user');
  }

  private async createPropertyOwnerProperties(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('property_owner_properties'))) {
      await queryRunner.createTable(
        new Table({
          name: 'property_owner_properties',
          columns: [
            this.uuidColumn,
            { name: 'owner_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'address_id', type: 'varchar', length: '36', isNullable: false },
            this.createdAt,
          ],
        }),
        true,
      );
    }
    await this.ensureIndex(queryRunner, 'property_owner_properties', 'UQ_property_owner_properties_address', ['address_id'], true);
    await this.ensureIndex(queryRunner, 'property_owner_properties', 'IDX_property_owner_properties_owner', ['owner_id']);
    await this.ensureForeignKey(queryRunner, 'property_owner_properties', 'owner_id', 'property_owners');
    await this.ensureForeignKey(queryRunner, 'property_owner_properties', 'address_id', 'addresses');
  }

  private async createOwnerReports(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('owner_reports'))) {
      await queryRunner.createTable(
        new Table({
          name: 'owner_reports',
          columns: [
            this.uuidColumn,
            { name: 'owner_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'period', type: 'varchar', length: '7', isNullable: false },
            { name: 'payload_json', type: 'longtext', isNullable: false },
            { name: 'payload_version', type: 'int', default: 1, isNullable: false },
            { name: 'generated_at', type: 'datetime', precision: 6, isNullable: false },
            { name: 'email_status', type: 'varchar', length: '16', default: "'pending'", isNullable: false },
            { name: 'email_attempts', type: 'int', default: 0, isNullable: false },
            { name: 'email_sent_at', type: 'datetime', precision: 6, isNullable: true },
            { name: 'email_failure_reason', type: 'varchar', length: '255', isNullable: true },
            this.createdAt,
            this.updatedAt,
          ],
        }),
        true,
      );
    }
    await this.ensureIndex(queryRunner, 'owner_reports', 'UQ_owner_reports_owner_period', ['owner_id', 'period'], true);
    await this.ensureIndex(queryRunner, 'owner_reports', 'IDX_owner_reports_period', ['period']);
    await this.ensureForeignKey(queryRunner, 'owner_reports', 'owner_id', 'property_owners');
  }

  private async createOwnerReportLinks(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('owner_report_links'))) {
      await queryRunner.createTable(
        new Table({
          name: 'owner_report_links',
          columns: [
            this.uuidColumn,
            { name: 'report_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'token_hash', type: 'varchar', length: '64', isNullable: false },
            { name: 'origin', type: 'varchar', length: '8', default: "'host'", isNullable: false },
            { name: 'expires_at', type: 'datetime', precision: 6, isNullable: false },
            { name: 'revoked_at', type: 'datetime', precision: 6, isNullable: true },
            { name: 'view_count', type: 'int', default: 0, isNullable: false },
            { name: 'first_viewed_at', type: 'datetime', precision: 6, isNullable: true },
            { name: 'last_viewed_at', type: 'datetime', precision: 6, isNullable: true },
            this.createdAt,
          ],
        }),
        true,
      );
    }
    await this.ensureIndex(queryRunner, 'owner_report_links', 'UQ_owner_report_links_token_hash', ['token_hash'], true);
    await this.ensureIndex(queryRunner, 'owner_report_links', 'IDX_owner_report_links_report', ['report_id']);
    await this.ensureIndex(queryRunner, 'owner_report_links', 'IDX_owner_report_links_expires', ['expires_at']);
    await this.ensureForeignKey(queryRunner, 'owner_report_links', 'report_id', 'owner_reports');
  }

  private async addOwnerReportsPreference(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_communication_preferences'))) return;
    if (await queryRunner.hasColumn('user_communication_preferences', 'owner_reports')) return;
    await queryRunner.addColumn(
      'user_communication_preferences',
      new TableColumn({ name: 'owner_reports', type: 'boolean', default: true, isNullable: false }),
    );
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    name: string,
    columnNames: string[],
    isUnique = false,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table || table.indices.some((index) => index.name === name)) return;
    await queryRunner.createIndex(tableName, new TableIndex({ name, columnNames, isUnique }));
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    column: string,
    referenced: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table || !(await queryRunner.hasTable(referenced))) return;
    if (table.foreignKeys.some((fk) => fk.columnNames.includes(column))) return;
    await queryRunner.createForeignKey(
      tableName,
      new TableForeignKey({
        columnNames: [column],
        referencedTableName: referenced,
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }
}
