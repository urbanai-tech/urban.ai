import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadDomainModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/host-today-domain.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const domain = await loadDomainModule();

// 27/10/2026 15:00 em São Paulo (UTC-3).
const NOW = new Date("2026-10-27T18:00:00.000Z");
const at = (isoLocalSp) => new Date(`${isoLocalSp}-03:00`).toISOString();

test("spDayKey usa o dia de São Paulo, não o UTC", () => {
  // 23:30 em SP já é dia seguinte em UTC.
  assert.equal(domain.spDayKey("2026-10-28T02:30:00.000Z"), "2026-10-27");
  assert.equal(domain.spDayKey("invalida"), null);
  assert.equal(domain.spDayKey(""), null);
});

test("relativeDayLabel fala hoje, amanhã e em N dias", () => {
  assert.equal(domain.relativeDayLabel(at("2026-10-27T22:00:00"), NOW), "hoje");
  assert.equal(domain.relativeDayLabel(at("2026-10-28T09:00:00"), NOW), "amanhã");
  assert.equal(domain.relativeDayLabel(at("2026-10-31T20:00:00"), NOW), "em 4 dias");
  assert.equal(domain.relativeDayLabel(at("2026-10-26T20:00:00"), NOW), "ontem");
});

test("deltaPerNight lê formatos brasileiros e zera sem preço atual", () => {
  assert.equal(domain.deltaPerNight({ dataInicio: "", precoSugerido: "520", seuPrecoAtual: "380" }), 140);
  assert.equal(domain.deltaPerNight({ dataInicio: "", precoSugerido: "1.234,50", seuPrecoAtual: 1000 }), 234.5);
  assert.equal(domain.deltaPerNight({ dataInicio: "", precoSugerido: 400 }), 0);
});

test("sortOpportunities: data mais próxima primeiro, depois maior ganho por noite", () => {
  const items = [
    { id: "feira", dataInicio: at("2026-11-08T10:00:00"), precoSugerido: 390, seuPrecoAtual: 340 },
    { id: "jogo-pequeno", dataInicio: at("2026-10-30T16:00:00"), precoSugerido: 400, seuPrecoAtual: 380 },
    { id: "show", dataInicio: at("2026-10-30T21:00:00"), precoSugerido: 520, seuPrecoAtual: 380 },
    { id: "passado", dataInicio: at("2026-10-20T21:00:00"), dataFim: at("2026-10-20T23:00:00"), precoSugerido: 999, seuPrecoAtual: 100 },
    { id: "em-andamento", dataInicio: at("2026-10-25T10:00:00"), dataFim: at("2026-10-29T18:00:00"), precoSugerido: 300, seuPrecoAtual: 290 },
  ];
  assert.deepEqual(
    domain.sortOpportunities(items, NOW).map((item) => item.id),
    ["em-andamento", "show", "jogo-pequeno", "feira"],
  );
});

test("sortOpportunities é estável em empate e não muta a entrada", () => {
  const items = [
    { id: "a", dataInicio: at("2026-10-30T10:00:00"), precoSugerido: 400, seuPrecoAtual: 300 },
    { id: "b", dataInicio: at("2026-10-30T20:00:00"), precoSugerido: 400, seuPrecoAtual: 300 },
  ];
  const copy = [...items];
  assert.deepEqual(domain.sortOpportunities(items, NOW).map((i) => i.id), ["a", "b"]);
  assert.deepEqual(items, copy);
});

test("groupByStartDay agrupa por dia de SP em ordem crescente", () => {
  const groups = domain.groupByStartDay([
    { id: 1, dataInicio: at("2026-11-02T10:00:00") },
    { id: 2, dataInicio: at("2026-10-30T23:30:00") },
    { id: 3, dataInicio: at("2026-10-30T08:00:00") },
    { id: 4, dataInicio: "sem-data" },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.dayKey, g.items.map((i) => i.id)]),
    [["2026-10-30", [2, 3]], ["2026-11-02", [1]]],
  );
});

test("notificationBucket separa hoje, ontem, esta semana e anteriores", () => {
  assert.equal(domain.notificationBucket(at("2026-10-27T08:00:00"), NOW), "today");
  assert.equal(domain.notificationBucket(at("2026-10-26T23:59:00"), NOW), "yesterday");
  assert.equal(domain.notificationBucket(at("2026-10-21T09:00:00"), NOW), "week");
  assert.equal(domain.notificationBucket(at("2026-10-20T09:00:00"), NOW), "older");
  assert.equal(domain.notificationBucket("lixo", NOW), "older");
  // Relógio do servidor adiantado não some da lista: vai para Hoje.
  assert.equal(domain.notificationBucket(at("2026-10-28T09:00:00"), NOW), "today");
});

test("groupNotificationsByDay mantém só grupos com itens, em ordem fixa", () => {
  const groups = domain.groupNotificationsByDay(
    [
      { id: "old", createdAt: at("2026-10-01T09:00:00") },
      { id: "t1", createdAt: at("2026-10-27T10:00:00") },
      { id: "t2", createdAt: at("2026-10-27T09:00:00") },
      { id: "w", createdAt: at("2026-10-23T09:00:00") },
    ],
    NOW,
  );
  assert.deepEqual(
    groups.map((g) => [g.label, g.items.map((i) => i.id)]),
    [["Hoje", ["t1", "t2"]], ["Esta semana", ["w"]], ["Anteriores", ["old"]]],
  );
});

test("emptyPeriodCopy aponta o próximo período com sugestões", () => {
  const withNext = domain.emptyPeriodCopy({ periodLabel: "outubro", nextPeriodLabel: "dezembro", nextPeriodCount: 1 });
  assert.equal(withNext.title, "Nenhuma sugestão em outubro");
  assert.match(withNext.body, /Nenhuma sugestão nesta janela — próximos eventos em dezembro \(1 sugestão\)/);
  const none = domain.emptyPeriodCopy({ periodLabel: "outubro" });
  assert.equal(none.title, "Sem sugestões nos próximos meses");
  assert.match(none.body, /Não encontramos evento futuro/);
});
