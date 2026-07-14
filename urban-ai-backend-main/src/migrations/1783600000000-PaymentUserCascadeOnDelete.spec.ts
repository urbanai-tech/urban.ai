import { PaymentUserCascadeOnDelete1783600000000 } from './1783600000000-PaymentUserCascadeOnDelete';

type QueryResponse = Array<Record<string, unknown>>;

function createQueryRunner(
  responses: QueryResponse[] = [],
  table: unknown = { name: 'payment' },
) {
  const queuedResponses = [...responses];

  return {
    getTable: jest.fn().mockResolvedValue(table),
    query: jest
      .fn()
      .mockImplementation(async () => queuedResponses.shift() ?? []),
  } as any;
}

function alterQueries(queryRunner: any) {
  return queryRunner.query.mock.calls
    .map(([sql]: [string]) => sql)
    .filter((sql: string) => sql.includes('ALTER TABLE'));
}

function queries(queryRunner: any) {
  return queryRunner.query.mock.calls.map(([sql]: [string]) => sql);
}

describe('PaymentUserCascadeOnDelete1783600000000', () => {
  it('skips when payment table does not exist', async () => {
    const migration = new PaymentUserCascadeOnDelete1783600000000();
    const queryRunner = createQueryRunner([], null);

    await migration.up(queryRunner);

    expect(queryRunner.getTable).toHaveBeenCalledWith('payment');
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('does nothing when the foreign key is already cascade', async () => {
    const migration = new PaymentUserCascadeOnDelete1783600000000();
    const queryRunner = createQueryRunner([
      [{ name: 'FK_payment_user', rule: 'CASCADE' }],
    ]);

    await migration.up(queryRunner);

    expect(alterQueries(queryRunner)).toEqual([]);
  });

  it('reuses a preserved user_id index when retrying after a partial failure', async () => {
    const migration = new PaymentUserCascadeOnDelete1783600000000();
    const queryRunner = createQueryRunner([
      [],
      [{ name: 'FK_c66c60a17b56ec882fcd8ec770b' }],
      [{ orphanCount: 0 }],
      [{ foreignKeyChecks: 1 }],
      [],
      [],
      [],
    ]);

    await migration.up(queryRunner);

    expect(alterQueries(queryRunner)).toEqual([
      expect.stringContaining(
        'ADD CONSTRAINT `FK_c66c60a17b56ec882fcd8ec770b`',
      ),
    ]);
    expect(alterQueries(queryRunner)[0]).toContain('ALGORITHM=INPLACE');
    expect(alterQueries(queryRunner)[0]).toContain('LOCK=SHARED');
    expect(queries(queryRunner)).toContain(
      'SET SESSION foreign_key_checks = 0',
    );
    expect(queries(queryRunner)).toContain(
      'SET SESSION foreign_key_checks = 1',
    );
  });

  it('uses one alter statement when replacing a legacy no-action foreign key', async () => {
    const migration = new PaymentUserCascadeOnDelete1783600000000();
    const queryRunner = createQueryRunner([
      [{ name: 'FK_payment_user', rule: 'NO ACTION' }],
      [{ orphanCount: 0 }],
      [{ foreignKeyChecks: 1 }],
      [],
      [],
      [],
    ]);

    await migration.up(queryRunner);

    const alters = alterQueries(queryRunner);
    expect(alters).toHaveLength(1);
    expect(alters[0]).toContain('DROP FOREIGN KEY `FK_payment_user`');
    expect(alters[0]).toContain('ADD CONSTRAINT `FK_payment_user`');
    expect(alters[0]).toContain('ON DELETE CASCADE ON UPDATE NO ACTION');
    expect(alters[0]).toContain('ALGORITHM=INPLACE');
    expect(alters[0]).toContain('LOCK=SHARED');
  });

  it('fails before disabling checks when retry data contains orphan payment rows', async () => {
    const migration = new PaymentUserCascadeOnDelete1783600000000();
    const queryRunner = createQueryRunner([
      [],
      [{ name: 'FK_c66c60a17b56ec882fcd8ec770b' }],
      [{ orphanCount: 2 }],
    ]);

    await expect(migration.up(queryRunner)).rejects.toThrow(
      'Cannot add payment.user_id foreign key while 2 orphan payment rows exist.',
    );

    expect(alterQueries(queryRunner)).toEqual([]);
    expect(queries(queryRunner)).not.toContain(
      'SET SESSION foreign_key_checks = 0',
    );
  });

  it('uses one alter statement when reverting cascade to no action', async () => {
    const migration = new PaymentUserCascadeOnDelete1783600000000();
    const queryRunner = createQueryRunner([
      [{ name: 'FK_payment_user', rule: 'CASCADE' }],
      [{ foreignKeyChecks: 1 }],
      [],
      [],
      [],
    ]);

    await migration.down(queryRunner);

    const alters = alterQueries(queryRunner);
    expect(alters).toHaveLength(1);
    expect(alters[0]).toContain('DROP FOREIGN KEY `FK_payment_user`');
    expect(alters[0]).toContain('ADD CONSTRAINT `FK_payment_user`');
    expect(alters[0]).toContain('ON DELETE NO ACTION ON UPDATE NO ACTION');
    expect(alters[0]).toContain('ALGORITHM=INPLACE');
    expect(alters[0]).toContain('LOCK=SHARED');
  });
});
