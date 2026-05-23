import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnalisePrecoVerificationFields1780700000000 implements MigrationInterface {
  name = 'AddAnalisePrecoVerificationFields1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) {
      return;
    }

    await this.addColumnIfMissing(queryRunner, 'verification_status', 'varchar(24) NULL');
    await this.addColumnIfMissing(queryRunner, 'verification_checked_at', 'timestamp NULL');
    await this.addColumnIfMissing(queryRunner, 'verified_applied_at', 'timestamp NULL');
    await this.addColumnIfMissing(queryRunner, 'observed_price', 'decimal(10,2) NULL');
    await this.addColumnIfMissing(queryRunner, 'verification_source', 'varchar(48) NULL');
    await this.addColumnIfMissing(queryRunner, 'verification_error', 'text NULL');

    await queryRunner.query(`
      UPDATE \`analise_preco\`
      SET \`verification_status\` = CASE
        WHEN \`aceito\` = 1 THEN 'pending'
        ELSE 'not_required'
      END
      WHERE \`verification_status\` IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('analise_preco'))) {
      return;
    }

    await this.dropColumnIfExists(queryRunner, 'verification_error');
    await this.dropColumnIfExists(queryRunner, 'verification_source');
    await this.dropColumnIfExists(queryRunner, 'observed_price');
    await this.dropColumnIfExists(queryRunner, 'verified_applied_at');
    await this.dropColumnIfExists(queryRunner, 'verification_checked_at');
    await this.dropColumnIfExists(queryRunner, 'verification_status');
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
