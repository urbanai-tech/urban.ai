import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LGPD-1: payment.user_id must cascade when a user is deleted.
 *
 * This migration is idempotent and retry-safe for databases that were left
 * between DROP FK and ADD FK by a failed previous run.
 */
export class PaymentUserCascadeOnDelete1783600000000 implements MigrationInterface {
  name = 'PaymentUserCascadeOnDelete1783600000000';

  private readonly fallbackFkName = 'FK_payment_user';

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

  private async findUserIdIndex(
    queryRunner: QueryRunner,
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT INDEX_NAME AS name
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'payment'
         AND COLUMN_NAME = 'user_id'
         AND SEQ_IN_INDEX = 1
       ORDER BY CASE WHEN INDEX_NAME LIKE 'FK\\_%' THEN 0 ELSE 1 END, INDEX_NAME
       LIMIT 1`,
    );
    return rows?.[0]?.name ?? null;
  }

  private async countPaymentOrphans(queryRunner: QueryRunner): Promise<number> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS orphanCount
       FROM \`payment\` p
       LEFT JOIN \`user\` u ON p.\`user_id\` = u.\`id\`
       WHERE p.\`user_id\` IS NOT NULL AND u.\`id\` IS NULL`,
    );
    return Number(rows?.[0]?.orphanCount ?? 0);
  }

  private async assertNoPaymentOrphans(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const orphanCount = await this.countPaymentOrphans(queryRunner);
    if (orphanCount > 0) {
      throw new Error(
        `Cannot add payment.user_id foreign key while ${orphanCount} orphan payment rows exist.`,
      );
    }
  }

  private async runOnlineForeignKeyAlter(
    queryRunner: QueryRunner,
    alterStatement: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      'SELECT @@SESSION.foreign_key_checks AS foreignKeyChecks',
    );
    const previousForeignKeyChecks = Number(rows?.[0]?.foreignKeyChecks ?? 1);

    if (previousForeignKeyChecks !== 0) {
      await queryRunner.query('SET SESSION foreign_key_checks = 0');
    }

    try {
      await queryRunner.query(alterStatement);
    } finally {
      if (previousForeignKeyChecks !== 0) {
        await queryRunner.query('SET SESSION foreign_key_checks = 1');
      }
    }
  }

  private escapeIdentifier(identifier: string): string {
    return identifier.replace(/`/g, '``');
  }

  private cascadeConstraint(name: string): string {
    return `ADD CONSTRAINT \`${this.escapeIdentifier(name)}\`
       FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`;
  }

  private noActionConstraint(name: string): string {
    return `ADD CONSTRAINT \`${this.escapeIdentifier(name)}\`
       FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment');
    if (!table) return;

    const fk = await this.findFk(queryRunner);
    if (!fk) {
      const indexName = await this.findUserIdIndex(queryRunner);
      const constraintName = indexName || this.fallbackFkName;
      await this.assertNoPaymentOrphans(queryRunner);
      await this.runOnlineForeignKeyAlter(
        queryRunner,
        `ALTER TABLE \`payment\`
         ${this.cascadeConstraint(constraintName)},
         ALGORITHM=INPLACE,
         LOCK=SHARED`,
      );
      return;
    }
    if (String(fk.rule).toUpperCase() === 'CASCADE') return;

    await this.assertNoPaymentOrphans(queryRunner);
    await this.runOnlineForeignKeyAlter(
      queryRunner,
      `ALTER TABLE \`payment\`
       DROP FOREIGN KEY \`${this.escapeIdentifier(fk.name)}\`,
       ${this.cascadeConstraint(fk.name)},
       ALGORITHM=INPLACE,
       LOCK=SHARED`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const fk = await this.findFk(queryRunner);
    if (!fk || String(fk.rule).toUpperCase() !== 'CASCADE') return;

    await this.runOnlineForeignKeyAlter(
      queryRunner,
      `ALTER TABLE \`payment\`
       DROP FOREIGN KEY \`${this.escapeIdentifier(fk.name)}\`,
       ${this.noActionConstraint(fk.name)},
       ALGORITHM=INPLACE,
       LOCK=SHARED`,
    );
  }
}
