import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule(file) {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const d = await loadModule("src/app/lib/next-suggestions-domain.ts");

test("nextWeeklyReportAt cai na próxima segunda 8h30 de São Paulo", () => {
  // Sábado 31/10/2026 12:00 SP -> segunda 02/11 08:30 SP (11:30 UTC).
  assert.equal(d.nextWeeklyReportAt(new Date("2026-10-31T15:00:00.000Z")).toISOString(), "2026-11-02T11:30:00.000Z");
  // Segunda 02/11 antes das 8h30 SP -> hoje.
  assert.equal(d.nextWeeklyReportAt(new Date("2026-11-02T10:00:00.000Z")).toISOString(), "2026-11-02T11:30:00.000Z");
  // Segunda 02/11 depois das 8h30 SP -> semana seguinte.
  assert.equal(d.nextWeeklyReportAt(new Date("2026-11-02T12:00:00.000Z")).toISOString(), "2026-11-09T11:30:00.000Z");
  // Domingo à noite em SP (já segunda em UTC) ainda aponta para segunda 8h30.
  assert.equal(d.nextWeeklyReportAt(new Date("2026-11-02T01:00:00.000Z")).toISOString(), "2026-11-02T11:30:00.000Z");
});

test("catalogWindow usa o dia de São Paulo", () => {
  // 01:00 UTC de 31/10 ainda é 30/10 em SP.
  assert.deepEqual(d.catalogWindow(new Date("2026-10-31T01:00:00.000Z"), 10), { from: "2026-10-30", to: "2026-11-09" });
});

test("pickCatalogCity pega a primeira cidade preenchida", () => {
  assert.equal(d.pickCatalogCity([null, { cidade: " " }, { cidade: "Santos" }, { cidade: "Rio" }]), "Santos");
  assert.equal(d.pickCatalogCity([]), null);
});

test("pickUpcomingCityEvents filtra, ordena, deduplica e limita", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");
  const items = [
    { id: "c", name: "C", startsAt: "2026-12-01T20:00:00Z" },
    { id: "a", name: "A", startsAt: "2026-11-05T20:00:00Z" },
    { id: "a", name: "A repetido", startsAt: "2026-11-05T20:00:00Z" },
    { id: "old", name: "Velho", startsAt: "2026-01-01T20:00:00Z" },
    { id: "bad", name: "Sem data", startsAt: "xx" },
    { id: "", name: "Sem id", startsAt: "2026-11-06T20:00:00Z" },
    { id: "b", name: "B", startsAt: "2026-11-10T20:00:00Z" },
  ];
  assert.deepEqual(d.pickUpcomingCityEvents(items, now, 2).map((e) => e.id), ["a", "b"]);
  assert.deepEqual(d.pickUpcomingCityEvents(null, now), []);
});

test("whyNoSuggestionCopy muda conforme haja eventos na cidade", () => {
  assert.match(d.whyNoSuggestionCopy({ city: "Santos", upcomingCount: 2 }), /Há eventos marcados em Santos/);
  assert.match(d.whyNoSuggestionCopy({ city: null, upcomingCount: 0 }), /Não encontramos evento futuro/);
  assert.match(d.whyNoSuggestionCopy({ city: "Santos", upcomingCount: 0 }), /diária de referência/);
});
