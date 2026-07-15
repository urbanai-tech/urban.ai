import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadDomainModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/admin/event-radar/event-radar-domain.ts"),
    "utf8",
  );
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.deepEqual(errors, []);

  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const domain = await loadDomainModule();

const baseCell = {
  cellId: "sp-center",
  city: "São Paulo",
  state: "SP",
  label: "Centro",
  centerLat: -23.55,
  centerLng: -46.63,
  eventDemandScore: 80,
  revenuePotentialCents: 500_000,
  eventsCount: 4,
  affectedPropertiesCount: 20,
  coverageScore: 70,
  averageConfidence: 75,
};

test("normaliza regiões com acentos, caixa e espaços", () => {
  assert.equal(domain.normalizeRegion("  São José  "), "sao jose");
  assert.equal(domain.sameRegion("sao paulo", "sp", "São Paulo", "SP"), true);
  assert.equal(domain.sameRegion("São Paulo", null, "São Paulo", "SP"), true);
  assert.equal(domain.sameRegion("Campinas", "SP", "São Paulo", "SP"), false);
});

test("projeta células geográficas dentro da área segura", () => {
  const bounds = domain.getAdminCellBounds([
    baseCell,
    { ...baseCell, centerLat: -22.9, centerLng: -43.2 },
  ]);

  assert.equal(bounds.minLat, -23.75);
  assert.equal(bounds.maxLat, -22.9);
  assert.equal(domain.projectAdminCell(bounds.minLng, bounds.minLng, bounds.maxLng), 14);
  assert.equal(domain.projectAdminCell(bounds.maxLng, bounds.minLng, bounds.maxLng), 86);
  assert.equal(domain.projectAdminCell(Number.NaN, 0, 1), 50);
});

test("classifica focos operacionais sem perder prioridades", () => {
  assert.deepEqual(
    domain.heatmapFocusTags(
      { ...baseCell, coverageScore: 40 },
      80,
      100,
      2,
      1,
      600_000,
    ),
    ["hotspots", "coverage_gaps", "missing_geo", "revenue"],
  );

  assert.deepEqual(
    domain.heatmapOperationalAction(baseCell, 2, 3, 600_000),
    { label: "Corrigir geo", detail: "2 eventos sem lat/lng", kind: "error" },
  );
  assert.equal(
    domain.heatmapOperationalAction({ ...baseCell, coverageScore: 35 }, 0, 3, 600_000).label,
    "Abrir cobertura",
  );
});

test("calcula métricas do heatmap conforme o contrato", () => {
  assert.equal(domain.heatmapValue(baseCell, "demand"), 80);
  assert.equal(domain.heatmapValue(baseCell, "revenue"), 500_000);
  assert.equal(domain.heatmapValue(baseCell, "coverage"), 30);
  assert.equal(domain.heatmapValue(baseCell, "blind_spots"), 30);
  assert.equal(domain.metricLabel("properties"), "Imóveis");
});

test("prioriza score, receita, impacto e data nesta ordem", () => {
  const events = [
    { id: "late", demandScore: 80, revenuePotentialCents: 100, affectedPropertiesCount: 2, startsAt: "2026-08-03T00:00:00Z" },
    { id: "revenue", demandScore: 80, revenuePotentialCents: 300, affectedPropertiesCount: 1, startsAt: "2026-08-02T00:00:00Z" },
    { id: "impact", demandScore: 80, revenuePotentialCents: 100, affectedPropertiesCount: 5, startsAt: "2026-08-04T00:00:00Z" },
    { id: "score", demandScore: 90, revenuePotentialCents: 0, affectedPropertiesCount: 0, startsAt: "2026-08-05T00:00:00Z" },
  ];

  assert.deepEqual(domain.prioritizeEvents(events).map((event) => event.id), [
    "score",
    "revenue",
    "impact",
    "late",
  ]);
  assert.deepEqual(events.map((event) => event.id), ["late", "revenue", "impact", "score"]);
});

test("remove valores vazios e duplicados preservando ordem", () => {
  assert.deepEqual(domain.uniqueList(["geo", "", "pricing", "geo"]), ["geo", "pricing"]);
});
