import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnalisePrecoApplicationFields1778500000000 implements MigrationInterface {
  name = 'AddAnalisePrecoApplicationFields1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) {
      return;
    }

    await this.addColumnIfMissing(
      queryRunner,
      'preco_aplicado',
      'decimal(10,2) NULL',
    );
    await this.addColumnIfMissing(queryRunner, 'aplicado_em', 'timestamp NULL');
    await this.addColumnIfMissing(
      queryRunner,
      'origem_aplicacao',
      'varchar(32) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) {
      return;
    }

    await this.dropColumnIfExists(queryRunner, 'origem_aplicacao');
    await this.dropColumnIfExists(queryRunner, 'aplicado_em');
    await this.dropColumnIfExists(queryRunner, 'preco_aplicado');
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    columnName: string,
    definition: string,
  ): Promise<void> {
    if (!(await queryRunner.hasColumn('analise_preco', columnName))) {
      await queryRunner.query(
        `ALTER TABLE \`analise_preco\` ADD \`${columnName}\` ${definition}`,
      );
    }
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    columnName: string,
  ): Promise<void> {
    if (await queryRunner.hasColumn('analise_preco', columnName)) {
      await queryRunner.query(
        `ALTER TABLE \`analise_preco\` DROP COLUMN \`${columnName}\``,
      );
    }
  }
}
