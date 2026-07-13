import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * PERF-3 — índices compostos para as queries mais frequentes de `events`.
 *
 * As queries de radar/pricing filtram por data + escopo, por geo + data e por
 * cidade/estado + escopo. Hoje só existem índices de 2 colunas
 * (`cidade,estado`, `latitude,longitude`, `dataInicio,dataFim`), que não cobrem
 * bem o predicado `outOfScope`/data usado em `admin.service` e `host-panels`.
 *
 * Idempotente: checa existência de cada índice antes de criar. Seguro em
 * ambientes que rodaram com `synchronize: true`.
 */
export class AddEventQueryIndexes1781600000000 implements MigrationInterface {
  name = 'AddEventQueryIndexes1781600000000';

  private static readonly INDEXES: { name: string; columnNames: string[] }[] = [
    { name: 'IDX_events_dataInicio_outOfScope', columnNames: ['dataInicio', 'outOfScope'] },
    { name: 'IDX_events_geo_dataInicio', columnNames: ['latitude', 'longitude', 'dataInicio'] },
    { name: 'IDX_events_cidade_estado_outOfScope', columnNames: ['cidade', 'estado', 'outOfScope'] },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('events');
    if (!table) {
      // Tabela ainda não existe (base muito vazia). Pula — quando for criada
      // pelo TypeORM, os índices da entity já vêm juntos.
      return;
    }

    const columnNames = new Set(table.columns.map((c) => c.name));
    const indexNames = new Set((table.indices ?? []).map((i) => i.name));

    for (const idx of AddEventQueryIndexes1781600000000.INDEXES) {
      const columnsExist = idx.columnNames.every((c) => columnNames.has(c));
      if (columnsExist && !indexNames.has(idx.name)) {
        await queryRunner.createIndex(
          'events',
          new TableIndex({ name: idx.name, columnNames: idx.columnNames }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('events');
    if (!table) return;

    const indexNames = new Set((table.indices ?? []).map((i) => i.name));
    for (const idx of AddEventQueryIndexes1781600000000.INDEXES) {
      if (indexNames.has(idx.name)) {
        await queryRunner.dropIndex('events', idx.name);
      }
    }
  }
}
