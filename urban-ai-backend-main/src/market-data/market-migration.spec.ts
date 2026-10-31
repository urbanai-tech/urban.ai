import { MarketMultiSourceLayer1793730000000 } from '../migrations/1793730000000-MarketMultiSourceLayer';

/** QueryRunner em memória: só o que a migration usa (tabelas, colunas, índices, UPDATEs). */
function fakeRunner() {
  const tables = new Map<string, { columns: Set<string>; indices: Set<string> }>();
  tables.set('external_listing', {
    columns: new Set(['id', 'externalId', 'source', 'city', 'snapshotDate', 'priceCents']),
    indices: new Set(['UQ_external_listing_source_ext']),
  });
  const queries: string[] = [];
  const runner: any = {
    queries,
    tables,
    hasTable: jest.fn(async (name: string) => tables.has(name)),
    hasColumn: jest.fn(async (table: string, column: string) => Boolean(tables.get(table)?.columns.has(column))),
    addColumn: jest.fn(async (table: string, column: any) => tables.get(table)?.columns.add(column.name)),
    dropColumn: jest.fn(async (table: string, column: string) => tables.get(table)?.columns.delete(column)),
    getTable: jest.fn(async (name: string) => {
      const t = tables.get(name);
      return t ? { indices: Array.from(t.indices).map((n) => ({ name: n })) } : undefined;
    }),
    createIndex: jest.fn(async (table: string, index: any) => tables.get(table)?.indices.add(index.name)),
    dropIndex: jest.fn(async (table: string, name: string) => tables.get(table)?.indices.delete(name)),
    createTable: jest.fn(async (table: any) => {
      tables.set(table.name, { columns: new Set(table.columns.map((c: any) => c.name)), indices: new Set() });
    }),
    dropTable: jest.fn(async (name: string) => tables.delete(name)),
    query: jest.fn(async (sql: string) => queries.push(sql)),
  };
  return runner;
}

describe('MarketMultiSourceLayer1793730000000', () => {
  const migration = new MarketMultiSourceLayer1793730000000();

  it('o timestamp e o nome seguem a faixa reservada da frente de mercado', () => {
    expect(migration.name).toBe('MarketMultiSourceLayer1793730000000');
  });

  it('up adiciona as colunas de origem/licença, cria as duas tabelas e marca o Inside Airbnb existente como CC BY', async () => {
    const runner = fakeRunner();
    await migration.up(runner);

    const external = runner.tables.get('external_listing');
    for (const column of ['neighborhood', 'listingType', 'occupancyRate', 'airbnbListingId', 'collectedAt', 'license', 'ingestBatchId']) {
      expect(external.columns.has(column)).toBe(true);
    }
    expect(external.indices.has('IDX_external_listing_source_collected')).toBe(true);
    expect(runner.tables.has('market_listing_observation')).toBe(true);
    expect(runner.tables.has('market_ingest_log')).toBe(true);
    expect(runner.tables.get('market_listing_observation').indices).toEqual(
      new Set(['UQ_market_obs_listing_date', 'IDX_market_obs_date']),
    );
    // dado legado: Inside Airbnb vira cc_by_4; o resto fica unknown (nunca entra no mercado)
    expect(runner.queries.join('\n')).toMatch(/SET `license` = 'cc_by_4'.*WHERE `source` = 'inside-airbnb'/);
    expect(runner.queries.join('\n')).toMatch(/SET `license` = 'unknown' WHERE `license` IS NULL/);
  });

  it('é idempotente: rodar duas vezes não duplica coluna, índice nem tabela', async () => {
    const runner = fakeRunner();
    await migration.up(runner);
    const addColumnCalls = runner.addColumn.mock.calls.length;
    const createTableCalls = runner.createTable.mock.calls.length;
    await migration.up(runner);
    expect(runner.addColumn.mock.calls.length).toBe(addColumnCalls);
    expect(runner.createTable.mock.calls.length).toBe(createTableCalls);
  });

  it('down é reversível: remove tabelas, índice e colunas e deixa o external_listing como estava', async () => {
    const runner = fakeRunner();
    await migration.up(runner);
    await migration.down(runner);

    expect(runner.tables.has('market_listing_observation')).toBe(false);
    expect(runner.tables.has('market_ingest_log')).toBe(false);
    const external = runner.tables.get('external_listing');
    expect(Array.from(external.columns).sort()).toEqual(['city', 'externalId', 'id', 'priceCents', 'snapshotDate', 'source']);
    expect(Array.from(external.indices)).toEqual(['UQ_external_listing_source_ext']);
    await expect(migration.down(runner)).resolves.toBeUndefined(); // down repetido também é seguro
  });

  it('sem a tabela external_listing, ainda cria as tabelas novas e não falha', async () => {
    const runner = fakeRunner();
    runner.tables.delete('external_listing');
    await expect(migration.up(runner)).resolves.toBeUndefined();
    expect(runner.tables.has('market_ingest_log')).toBe(true);
  });
});
