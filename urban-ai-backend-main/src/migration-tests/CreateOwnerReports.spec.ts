import { Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { CreateOwnerReports1793720000000 } from '../migrations/1793720000000-CreateOwnerReports';

/**
 * Verifica a migration do relatório do proprietário contra um QueryRunner em memória (sem MySQL):
 * cria as 4 tabelas com índices únicos e FKs em cascata, é idempotente e o `down` desfaz tudo.
 * O dry-run contra MySQL real roda no job `backend-migrations` do CI.
 */
function makeRunner(initialTables: string[] = ['user', 'addresses', 'user_communication_preferences']) {
  const tables = new Map<string, { table: Table; indices: TableIndex[]; fks: TableForeignKey[] }>();
  for (const name of initialTables) {
    tables.set(name, { table: new Table({ name, columns: [] }), indices: [], fks: [] });
  }
  const columnAdds: Array<{ table: string; column: string }> = [];
  const columnDrops: string[] = [];
  const runner = {
    hasTable: jest.fn(async (name: string) => tables.has(name)),
    hasColumn: jest.fn(async (table: string, column: string) => {
      if (column === 'owner_reports' && columnAdds.some((c) => c.column === column) && !columnDrops.includes(column)) return true;
      return false;
    }),
    createTable: jest.fn(async (table: Table) => {
      tables.set(table.name, { table, indices: [], fks: [] });
    }),
    dropTable: jest.fn(async (name: string) => {
      tables.delete(name);
    }),
    getTable: jest.fn(async (name: string) => {
      const entry = tables.get(name);
      if (!entry) return undefined;
      return { name, indices: entry.indices, foreignKeys: entry.fks } as unknown as Table;
    }),
    createIndex: jest.fn(async (name: string, index: TableIndex) => {
      tables.get(name)!.indices.push(index);
    }),
    createForeignKey: jest.fn(async (name: string, fk: TableForeignKey) => {
      tables.get(name)!.fks.push(fk);
    }),
    addColumn: jest.fn(async (table: string, column: TableColumn) => {
      columnAdds.push({ table, column: column.name });
    }),
    dropColumn: jest.fn(async (_table: string, column: string) => {
      columnDrops.push(column);
    }),
  };
  return { runner: runner as any, tables, columnAdds, columnDrops };
}

describe('CreateOwnerReports1793720000000', () => {
  it('cria as quatro tabelas, os índices únicos e as FKs em cascata', async () => {
    const { runner, tables, columnAdds } = makeRunner();
    await new CreateOwnerReports1793720000000().up(runner);

    for (const name of ['property_owners', 'property_owner_properties', 'owner_reports', 'owner_report_links']) {
      expect(tables.has(name)).toBe(true);
    }
    const unique = (name: string) => tables.get(name)!.indices.filter((i) => i.isUnique).map((i) => i.name).sort();
    expect(unique('property_owners')).toEqual(['UQ_property_owners_unsubscribe_ref', 'UQ_property_owners_user_email']);
    expect(unique('property_owner_properties')).toEqual(['UQ_property_owner_properties_address']);
    expect(unique('owner_reports')).toEqual(['UQ_owner_reports_owner_period']);
    expect(unique('owner_report_links')).toEqual(['UQ_owner_report_links_token_hash']);

    const fk = (name: string) => tables.get(name)!.fks.map((f) => `${f.columnNames[0]}->${f.referencedTableName}:${f.onDelete}`).sort();
    expect(fk('property_owners')).toEqual(['user_id->user:CASCADE']);
    expect(fk('property_owner_properties')).toEqual(['address_id->addresses:CASCADE', 'owner_id->property_owners:CASCADE']);
    expect(fk('owner_reports')).toEqual(['owner_id->property_owners:CASCADE']);
    expect(fk('owner_report_links')).toEqual(['report_id->owner_reports:CASCADE']);

    // O link nunca guarda o token: só o hash.
    const linkColumns = tables.get('owner_report_links')!.table.columns.map((c) => c.name);
    expect(linkColumns).toContain('token_hash');
    expect(linkColumns).not.toContain('token');
    expect(columnAdds).toEqual([{ table: 'user_communication_preferences', column: 'owner_reports' }]);
  });

  it('é idempotente: rodar de novo não recria tabela, índice, FK nem coluna', async () => {
    const { runner, columnAdds } = makeRunner();
    const migration = new CreateOwnerReports1793720000000();
    await migration.up(runner);
    const createTableCalls = runner.createTable.mock.calls.length;
    const createIndexCalls = runner.createIndex.mock.calls.length;
    const fkCalls = runner.createForeignKey.mock.calls.length;
    await migration.up(runner);
    expect(runner.createTable.mock.calls.length).toBe(createTableCalls);
    expect(runner.createIndex.mock.calls.length).toBe(createIndexCalls);
    expect(runner.createForeignKey.mock.calls.length).toBe(fkCalls);
    expect(columnAdds).toHaveLength(1);
  });

  it('down remove tudo na ordem inversa (links, relatórios, vínculos, proprietários) e a coluna', async () => {
    const { runner, tables, columnDrops } = makeRunner();
    const migration = new CreateOwnerReports1793720000000();
    await migration.up(runner);
    await migration.down(runner);
    expect(runner.dropTable.mock.calls.map(([name]: [string]) => name)).toEqual([
      'owner_report_links',
      'owner_reports',
      'property_owner_properties',
      'property_owners',
    ]);
    expect([...tables.keys()].sort()).toEqual(['addresses', 'user', 'user_communication_preferences']);
    expect(columnDrops).toEqual(['owner_reports']);
  });

  it('down em banco sem as tabelas não falha', async () => {
    const { runner } = makeRunner();
    await expect(new CreateOwnerReports1793720000000().down(runner)).resolves.toBeUndefined();
  });

  it('o timestamp é o da frente REL (1793720000000+) e único', () => {
    expect(new CreateOwnerReports1793720000000().name).toBe('CreateOwnerReports1793720000000');
  });
});
