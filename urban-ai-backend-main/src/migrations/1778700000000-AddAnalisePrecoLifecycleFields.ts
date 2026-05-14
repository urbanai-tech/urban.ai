import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnalisePrecoLifecycleFields1778700000000 implements MigrationInterface {
  name = 'AddAnalisePrecoLifecycleFields1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) {
      return;
    }

    await this.addColumnIfMissing(queryRunner, 'status', "varchar(24) NOT NULL DEFAULT 'suggested'");
    await this.addColumnIfMissing(queryRunner, 'aceito_em', 'timestamp NULL');
    await this.addColumnIfMissing(queryRunner, 'rejeitado_em', 'timestamp NULL');
    await this.addColumnIfMissing(queryRunner, 'expirado_em', 'timestamp NULL');

    await queryRunner.query(`
      UPDATE \`analise_preco\`
      SET \`status\` = CASE
        WHEN \`preco_aplicado\` IS NOT NULL AND \`origem_aplicacao\` LIKE 'stays%' THEN 'applied_stays'
        WHEN \`preco_aplicado\` IS NOT NULL THEN 'applied_manual'
        WHEN \`aceito\` = 1 THEN 'accepted'
        ELSE 'suggested'
      END
    `);
    await queryRunner.query(`
      UPDATE \`analise_preco\`
      SET \`aceito_em\` = COALESCE(\`aceito_em\`, \`aplicado_em\`, \`criado_em\`)
      WHERE \`aceito\` = 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) {
      return;
    }

    await this.dropColumnIfExists(queryRunner, 'expirado_em');
    await this.dropColumnIfExists(queryRunner, 'rejeitado_em');
    await this.dropColumnIfExists(queryRunner, 'aceito_em');
    await this.dropColumnIfExists(queryRunner, 'status');
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
