import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona campos de tracking de drip de onboarding ao `user`.
 *
 *  - `onboardingDripLastDay`: ultimo dia D{N} enviado (1, 3, 7) — null se nunca.
 *  - `onboardingDripLastSentAt`: timestamp pra observability.
 *
 * Gap H9 do roadmap (`docs/roadmap-implementacao-gaps-produto-2026-05-14.md`):
 * "Onboarding e-mails D1/D3/D7 — Usuario beta recebe orientacao depois do
 * cadastro." Templates ja existem em `email/templates.ts`. Falta agendamento
 * e tracking de idempotencia — esta migration prepara o terreno.
 */
export class AddOnboardingDripFields1780100000000 implements MigrationInterface {
  name = 'AddOnboardingDripFields1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasLastDay = await this.columnExists(queryRunner, 'user', 'onboardingDripLastDay');
    if (!hasLastDay) {
      await queryRunner.query(
        `ALTER TABLE \`user\`
         ADD COLUMN \`onboardingDripLastDay\` INT NULL DEFAULT NULL`,
      );
    }

    const hasLastSent = await this.columnExists(queryRunner, 'user', 'onboardingDripLastSentAt');
    if (!hasLastSent) {
      await queryRunner.query(
        `ALTER TABLE \`user\`
         ADD COLUMN \`onboardingDripLastSentAt\` TIMESTAMP NULL DEFAULT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLastSent = await this.columnExists(queryRunner, 'user', 'onboardingDripLastSentAt');
    if (hasLastSent) {
      await queryRunner.query(
        `ALTER TABLE \`user\` DROP COLUMN \`onboardingDripLastSentAt\``,
      );
    }
    const hasLastDay = await this.columnExists(queryRunner, 'user', 'onboardingDripLastDay');
    if (hasLastDay) {
      await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`onboardingDripLastDay\``);
    }
  }

  private async columnExists(
    runner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const result = await runner.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return Number(result?.[0]?.c ?? 0) > 0;
  }
}
