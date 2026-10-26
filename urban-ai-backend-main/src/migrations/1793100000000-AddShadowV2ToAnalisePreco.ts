import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Guarda, ao lado da sugestão v1 (`preco_sugerido`), o preço que o motor v2 calculou
 * em sombra (`PRICING_ENGINE_V2=shadow`) e a versão do motor. Até aqui o v2 só ia
 * para um log de debug, então não havia como comparar v1 x v2 x preço aplicado x
 * resultado. Aditiva (colunas nulas) e idempotente; `down` as remove.
 */
export class AddShadowV2ToAnalisePreco1793100000000 implements MigrationInterface {
  name = 'AddShadowV2ToAnalisePreco1793100000000';

  private readonly columns: TableColumn[] = [
    new TableColumn({ name: 'shadow_v2_preco', type: 'decimal', precision: 10, scale: 2, isNullable: true }),
    new TableColumn({ name: 'shadow_v2_versao', type: 'varchar', length: '32', isNullable: true }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) return;
    for (const column of this.columns) {
      if (!(await queryRunner.hasColumn('analise_preco', column.name))) {
        await queryRunner.addColumn('analise_preco', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) return;
    for (const column of [...this.columns].reverse()) {
      if (await queryRunner.hasColumn('analise_preco', column.name)) {
        await queryRunner.dropColumn('analise_preco', column.name);
      }
    }
  }
}
