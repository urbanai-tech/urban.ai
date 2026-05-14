import { MigrationInterface, QueryRunner, TableColumn, TableColumnOptions } from 'typeorm';

export class AddAlphaFeedbackToAnalisePreco1779200000000 implements MigrationInterface {
  name = 'AddAlphaFeedbackToAnalisePreco1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(queryRunner, 'reserva_status', new TableColumn({
      name: 'reserva_status',
      type: 'varchar',
      length: '24',
      isNullable: true,
    }));
    await this.addColumnIfMissing(queryRunner, 'receita_real', new TableColumn({
      name: 'receita_real',
      type: 'decimal',
      precision: 10,
      scale: 2,
      isNullable: true,
    }));
    await this.addColumnIfMissing(queryRunner, 'noites_reservadas', new TableColumn({
      name: 'noites_reservadas',
      type: 'int',
      isNullable: true,
    }));
    await this.addColumnIfMissing(queryRunner, 'resultado_registrado_em', new TableColumn({
      name: 'resultado_registrado_em',
      type: 'timestamp',
      isNullable: true,
    }));
    await this.addColumnIfMissing(queryRunner, 'feedback_observacao', new TableColumn({
      name: 'feedback_observacao',
      type: 'text',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'feedback_observacao',
      'resultado_registrado_em',
      'noites_reservadas',
      'receita_real',
      'reserva_status',
    ]) {
      if (await queryRunner.hasColumn('analise_preco', column)) {
        await queryRunner.dropColumn('analise_preco', column);
      }
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    name: string,
    column: TableColumnOptions,
  ): Promise<void> {
    if (await queryRunner.hasColumn('analise_preco', name)) return;
    await queryRunner.addColumn('analise_preco', new TableColumn(column));
  }
}
