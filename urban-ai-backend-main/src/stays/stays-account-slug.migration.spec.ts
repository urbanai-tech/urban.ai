import { StaysAccountSlugAndFailureCounter1792800000000 } from '../migrations/1792800000000-StaysAccountSlugAndFailureCounter';

/**
 * Migration em memória (o drill com MySQL real está em
 * scripts/test-stays-migrations.cjs). Simula colunas e linhas de stays_accounts.
 */
function fakeRunner(initial: { columns: string[]; rows: Array<Record<string, any>> }) {
  const columns = new Set(initial.columns);
  const rows = initial.rows.map((row) => ({ ...row }));
  const ddl: string[] = [];
  const runner: any = {
    hasTable: jest.fn(async () => true),
    hasColumn: jest.fn(async (_table: string, column: string) => columns.has(column)),
    addColumn: jest.fn(async (_table: string, column: any) => {
      ddl.push(`add:${column.name}`);
      columns.add(column.name);
      for (const row of rows) row[column.name] = column.default ?? null;
    }),
    dropColumn: jest.fn(async (_table: string, column: string) => {
      ddl.push(`drop:${column}`);
      columns.delete(column);
      for (const row of rows) delete row[column];
    }),
    query: jest.fn(async (sql: string, params: any[] = []) => {
      if (sql.startsWith('SELECT id, apiBaseUrl')) {
        return rows.filter((row) => row.apiBaseUrl).map((row) => ({
          id: row.id, apiBaseUrl: row.apiBaseUrl,
          ...(sql.includes('apiAccountSlug') ? { apiAccountSlug: row.apiAccountSlug ?? null } : {}),
        }));
      }
      if (sql.startsWith('UPDATE stays_accounts SET apiAccountSlug')) {
        const row = rows.find((candidate) => candidate.id === params[1]);
        if (row) row.apiAccountSlug = params[0];
        return;
      }
      if (sql.startsWith("UPDATE stays_accounts SET apiBaseUrl = CONCAT")) {
        for (const row of rows) {
          if (row.apiAccountSlug && !row.apiBaseUrl) row.apiBaseUrl = `https://${row.apiAccountSlug}.stays.net`;
        }
        return;
      }
      throw new Error(`unexpected SQL ${sql}`);
    }),
  };
  return { runner, columns, rows, ddl };
}

describe('StaysAccountSlugAndFailureCounter1792800000000', () => {
  const migration = new StaysAccountSlugAndFailureCounter1792800000000();

  it('adds slug and failure counter on a fresh schema (no legacy URL column)', async () => {
    const { runner, columns, rows } = fakeRunner({ columns: ['id'], rows: [{ id: 'a' }] });
    await migration.up(runner);
    expect([...columns]).toEqual(['id', 'apiAccountSlug', 'consecutiveFailures']);
    expect(rows[0]).toMatchObject({ apiAccountSlug: null, consecutiveFailures: 0 });
  });

  it('converts legacy https://<slug>.stays.net URLs to slug, idempotently, keeping the legacy column', async () => {
    const { runner, rows, columns } = fakeRunner({
      columns: ['id', 'apiBaseUrl'],
      rows: [
        { id: 'a', apiBaseUrl: 'https://acme.stays.net' },
        { id: 'b', apiBaseUrl: 'https://beta.stays.net/external/v1/' },
        { id: 'c', apiBaseUrl: null },
      ],
    });
    await migration.up(runner);
    await migration.up(runner);
    expect(rows.map((row) => row.apiAccountSlug)).toEqual(['acme', 'beta', null]);
    expect(columns.has('apiBaseUrl')).toBe(true);
    const updates = runner.query.mock.calls.filter(([sql]: [string]) => sql.startsWith('UPDATE stays_accounts SET apiAccountSlug'));
    expect(updates).toHaveLength(2); // segunda execução não reescreve
  });

  it.each([
    'https://custom.example',
    'https://acme.stays.net.attacker.example',
    'https://acme.stays.net:8443',
    'http://acme.stays.net',
    'https://acme.stays.net/other',
    'garbage',
  ])('refuses ambiguous value %j BEFORE touching the schema', async (apiBaseUrl) => {
    const { runner, ddl, rows } = fakeRunner({
      columns: ['id', 'apiBaseUrl'],
      rows: [{ id: 'ok', apiBaseUrl: 'https://acme.stays.net' }, { id: 'bad', apiBaseUrl }],
    });
    await expect(migration.up(runner)).rejects.toThrow(/Refusing to convert 1 Stays account URL\(s\).*bad/);
    expect(ddl).toEqual([]);
    expect(rows[0].apiAccountSlug).toBeUndefined();
  });

  it('refuses when a stored slug conflicts with the legacy URL', async () => {
    const { runner } = fakeRunner({
      columns: ['id', 'apiBaseUrl', 'apiAccountSlug'],
      rows: [{ id: 'a', apiBaseUrl: 'https://acme.stays.net', apiAccountSlug: 'other' }],
    });
    await expect(migration.up(runner)).rejects.toThrow('Refusing');
  });

  it('down restores the legacy URL from the slug and removes the new columns (round trip)', async () => {
    const { runner, rows, columns } = fakeRunner({
      columns: ['id', 'apiBaseUrl'],
      rows: [{ id: 'a', apiBaseUrl: 'https://acme.stays.net' }],
    });
    await migration.up(runner);
    rows[0].apiBaseUrl = null; // ex.: limpo depois da conversão
    await migration.down(runner);
    expect(columns.has('apiAccountSlug')).toBe(false);
    expect(columns.has('consecutiveFailures')).toBe(false);
    expect(rows[0].apiBaseUrl).toBe('https://acme.stays.net');
    await migration.down(runner); // idempotente
    await migration.up(runner);
    expect(rows[0].apiAccountSlug).toBe('acme');
  });

  it('is a no-op without the table', async () => {
    const { runner } = fakeRunner({ columns: [], rows: [] });
    runner.hasTable.mockResolvedValue(false);
    await migration.up(runner);
    await migration.down(runner);
    expect(runner.addColumn).not.toHaveBeenCalled();
  });
});
