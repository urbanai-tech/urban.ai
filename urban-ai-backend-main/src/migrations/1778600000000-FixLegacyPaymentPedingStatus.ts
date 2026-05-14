import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixLegacyPaymentPedingStatus1778600000000 implements MigrationInterface {
  name = 'FixLegacyPaymentPedingStatus1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE payment SET status = 'pending' WHERE status = 'peding'");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1');
  }
}
