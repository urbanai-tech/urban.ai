import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Cria tabela `waitlist` (entity Waitlist — F8.2 pré-lançamento).
 *
 * Idempotente: ifNotExists na tabela e checagem de existência dos índices,
 * então rodar com tabela já criada (synchronize:true) é seguro.
 */
export class CreateWaitlist1745900000000 implements MigrationInterface {
  name = 'CreateWaitlist1745900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'waitlist',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          {
            name: 'position',
            type: 'int',
            isUnique: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'email', type: 'varchar', length: '255', isNullable: false },
          { name: 'name', type: 'varchar', length: '128', isNullable: true },
          { name: 'phone', type: 'varchar', length: '32', isNullable: true },
          {
            name: 'source',
            type: 'varchar',
            length: '64',
            default: "'unknown'",
            isNullable: false,
          },
          { name: 'referralCode', type: 'varchar', length: '16', isNullable: false },
          { name: 'referredBy', type: 'varchar', length: '16', isNullable: true },
          { name: 'referralsCount', type: 'int', default: 0, isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            default: "'pending'",
            isNullable: false,
          },
          { name: 'invitedAt', type: 'datetime', isNullable: true },
          { name: 'convertedAt', type: 'datetime', isNullable: true },
          { name: 'inviteToken', type: 'varchar', length: '64', isNullable: true },
          { name: 'inviteTokenExpiresAt', type: 'datetime', isNullable: true },
          { name: 'signupIp', type: 'varchar', length: '45', isNullable: true },
          { name: 'userAgent', type: 'varchar', length: '255', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    const table = await queryRunner.getTable('waitlist');
    const existing = new Set((table?.indices ?? []).map((i) => i.name));

    if (!existing.has('IDX_waitlist_email_unique')) {
      await queryRunner.createIndex(
        'waitlist',
        new TableIndex({
          name: 'IDX_waitlist_email_unique',
          columnNames: ['email'],
          isUnique: true,
        }),
      );
    }

    if (!existing.has('IDX_waitlist_referralCode_unique')) {
      await queryRunner.createIndex(
        'waitlist',
        new TableIndex({
          name: 'IDX_waitlist_referralCode_unique',
          columnNames: ['referralCode'],
          isUnique: true,
        }),
      );
    }

    if (!existing.has('IDX_waitlist_source')) {
      await queryRunner.createIndex(
        'waitlist',
        new TableIndex({
          name: 'IDX_waitlist_source',
          columnNames: ['source'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('waitlist', true);
  }
}
