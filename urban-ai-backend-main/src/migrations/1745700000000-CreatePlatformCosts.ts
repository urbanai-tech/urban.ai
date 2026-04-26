import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Cria a tabela `platform_costs` (entity PlatformCost — admin/finance).
 *
 * Mantida idempotente: usa `ifNotExists` na tabela e checa duplicidade dos
 * índices, então rodar `migration:run` com a tabela já existente (criada por
 * `synchronize: true` em ambientes que ainda não migraram) é seguro.
 *
 * Quando o cutover de DB_SYNCHRONIZE=true → false acontecer (Railway prod),
 * essa migration garante que a tabela existe antes do AdminFinanceService
 * tentar usá-la.
 */
export class CreatePlatformCosts1745700000000 implements MigrationInterface {
  name = 'CreatePlatformCosts1745700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'platform_costs',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          { name: 'name', type: 'varchar', length: '128', isNullable: false },
          { name: 'category', type: 'varchar', length: '32', isNullable: false },
          {
            name: 'recurrence',
            type: 'varchar',
            length: '16',
            default: "'monthly'",
            isNullable: false,
          },
          { name: 'monthlyCostCents', type: 'int', default: 0, isNullable: false },
          {
            name: 'percentOfRevenue',
            type: 'decimal',
            precision: 6,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'BRL'",
            isNullable: false,
          },
          { name: 'description', type: 'varchar', length: '255', isNullable: true },
          { name: 'scalesWithListings', type: 'boolean', default: false, isNullable: false },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'active', type: 'boolean', default: true, isNullable: false },
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
      true, // ifNotExists
    );

    const table = await queryRunner.getTable('platform_costs');
    const existingIdxNames = new Set((table?.indices ?? []).map((i) => i.name));

    if (!existingIdxNames.has('IDX_platform_costs_category_active')) {
      await queryRunner.createIndex(
        'platform_costs',
        new TableIndex({
          name: 'IDX_platform_costs_category_active',
          columnNames: ['category', 'active'],
        }),
      );
    }

    if (!existingIdxNames.has('IDX_platform_costs_recurrence')) {
      await queryRunner.createIndex(
        'platform_costs',
        new TableIndex({
          name: 'IDX_platform_costs_recurrence',
          columnNames: ['recurrence'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop índices só se existirem; depois a tabela.
    const table = await queryRunner.getTable('platform_costs');
    if (table) {
      const existing = new Set((table.indices ?? []).map((i) => i.name));
      if (existing.has('IDX_platform_costs_recurrence')) {
        await queryRunner.dropIndex('platform_costs', 'IDX_platform_costs_recurrence');
      }
      if (existing.has('IDX_platform_costs_category_active')) {
        await queryRunner.dropIndex('platform_costs', 'IDX_platform_costs_category_active');
      }
      await queryRunner.dropTable('platform_costs', true);
    }
  }
}
