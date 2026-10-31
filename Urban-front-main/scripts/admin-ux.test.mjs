import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule(relativePath) {
  const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const labels = await loadModule("src/app/admin/_lib/status-labels.ts");
const filters = await loadModule("src/app/admin/users/users-filters.ts");

test("status em inglês da API viram rótulos pt-BR", () => {
  assert.equal(labels.statusLabel("active"), "Ativo");
  assert.equal(labels.statusLabel("canceled"), "Cancelado");
  assert.equal(labels.statusLabel("past_due"), "Pagamento falhou");
  assert.equal(labels.statusLabel("trialing"), "Em teste");
  assert.equal(labels.statusLabel("not_booked"), "Não reservado");
  assert.equal(labels.statusLabel("success"), "Sucesso");
});

test("valor desconhecido vira texto legível e vazio vira travessão", () => {
  assert.equal(labels.statusLabel("some_new_state"), "Some new state");
  assert.equal(labels.statusLabel(""), "—");
  assert.equal(labels.statusLabel(null), "—");
  assert.equal(labels.statusLabel(undefined), "—");
});

test("ciclos, recorrências e papéis", () => {
  assert.equal(labels.cycleLabel("monthly"), "mensal");
  assert.equal(labels.cycleLabel("usage_based"), "por uso");
  assert.equal(labels.cycleLabel("one_time"), "único");
  assert.equal(labels.cycleLabel("custom"), "custom");
  assert.equal(labels.roleLabel("host"), "Anfitrião");
  assert.equal(labels.roleLabel("support"), "Suporte");
});

test("filtros de usuários: omite vazios, apara espaços e converte status", () => {
  assert.deepEqual(filters.filtersToQuery(filters.EMPTY_USER_FILTERS), {});
  assert.deepEqual(
    filters.filtersToQuery({
      q: "  ana@  ",
      role: "host",
      ativo: "false",
      plan: " profissional ",
      createdFrom: "2026-10-01",
      createdTo: "",
    }),
    { q: "ana@", role: "host", ativo: false, plan: "profissional", createdFrom: "2026-10-01" },
  );
  assert.equal(filters.filtersToQuery({ ...filters.EMPTY_USER_FILTERS, ativo: "true" }).ativo, true);
});

test("hasActiveFilters distingue consulta vazia de filtrada", () => {
  assert.equal(filters.hasActiveFilters({}), false);
  assert.equal(filters.hasActiveFilters({ ativo: false }), true);
});
