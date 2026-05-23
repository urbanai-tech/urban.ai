import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePricingRecommendationDigests1781200000000 implements MigrationInterface {
  name = 'CreatePricingRecommendationDigests1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('pricing_recommendation_digests'))) {
      await queryRunner.createTable(
        new Table({
          name: 'pricing_recommendation_digests',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
            { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
            { name: 'recipient_email', type: 'varchar', length: '254', isNullable: false },
            { name: 'recipient_name', type: 'varchar', length: '160', isNullable: true },
            { name: 'wants_email', type: 'boolean', default: false, isNullable: false },
            { name: 'wants_push', type: 'boolean', default: false, isNullable: false },
            { name: 'items_json', type: 'longtext', isNullable: false },
            { name: 'item_count', type: 'int', default: 0, isNullable: false },
            { name: 'status', type: 'varchar', length: '24', default: "'pending'", isNullable: false },
            { name: 'scheduled_for', type: 'datetime', precision: 6, isNullable: false },
            { name: 'locked_at', type: 'datetime', precision: 6, isNullable: true },
            { name: 'sent_at', type: 'datetime', precision: 6, isNullable: true },
            { name: 'failure_reason', type: 'text', isNullable: true },
            { name: 'createdAt', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', isNullable: false },
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
    }

    await this.ensureIndex(queryRunner, 'IDX_pricing_digest_status_scheduled', ['status', 'scheduled_for']);
    await this.ensureIndex(queryRunner, 'IDX_pricing_digest_user_status', ['user_id', 'status']);
    await this.ensureIndex(queryRunner, 'IDX_pricing_digest_created', ['createdAt']);
    await this.ensureForeignKey(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('pricing_recommendation_digests')) {
      await queryRunner.dropTable('pricing_recommendation_digests', true);
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    name: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable('pricing_recommendation_digests');
    if (!table || table.indices.some((index) => index.name === name)) return;
    await queryRunner.createIndex(
      'pricing_recommendation_digests',
      new TableIndex({ name, columnNames }),
    );
  }

  private async ensureForeignKey(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('pricing_recommendation_digests');
    if (!table || !(await queryRunner.hasTable('user'))) return;
    if (table.foreignKeys.some((fk) => fk.columnNames.includes('user_id'))) return;
    await queryRunner.createForeignKey(
      'pricing_recommendation_digests',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }
}
