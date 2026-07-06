import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LGPD-1 — payment.user_id passa a ON DELETE CASCADE.
 *
 * O FK era NO ACTION: excluir um usuário com pagamentos falhava por constraint,
 * ou (pior) deixava linhas de `payment` órfãs com customerId/subscriptionId
 * Stripe reais após a exclusão da conta. Com CASCADE, os pagamentos são
 * removidos junto com o titular.
 *
 * Busca o nome do FK dinamicamente (auto-gerado pelo TypeORM). Idempotente:
 * só recria se a regra atual não for CASCADE.
 */
export class PaymentUserCascadeOnDelete1783600000000 implements MigrationInterface {
  name = 'PaymentUserCascadeOnDelete1783600000000';

  private async findFk(
    queryRunner: QueryRunner,
  ): Promise<{ name: string; rule: string } | null> {
    const rows = await queryRunner.query(
      `SELECT k.CONSTRAINT_NAME AS name, r.DELETE_RULE AS rule
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       WHERE k.TABLE_SCHEMA = DATABASE()
         AND k.TABLE_NAME = 'payment'
         AND k.COLUMN_NAME = 'user_id'
       LIMIT 1`,
    );
    return rows?.[0] ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment');
    if (!table) return;

    const fk = await this.findFk(queryRunner);
    if (!fk) {
      // Sem FK ainda (base muito nova). Cria já com CASCADE.
      await queryRunner.query(
        `ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_payment_user\`
         FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE`,
      );
      return;
    }
    if (String(fk.rule).toUpperCase() === 'CASCADE') return; // já correto

    await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`${fk.name}\``);
    await queryRunner.query(
      `ALTER TABLE \`payment\` ADD CONSTRAINT \`${fk.name}\`
       FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const fk = await this.findFk(queryRunner);
    if (!fk || String(fk.rule).toUpperCase() !== 'CASCADE') return;
    await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`${fk.name}\``);
    await queryRunner.query(
      `ALTER TABLE \`payment\` ADD CONSTRAINT \`${fk.name}\`
       FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION`,
    );
  }
}
