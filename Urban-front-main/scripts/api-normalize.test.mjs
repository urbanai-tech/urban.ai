import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule(file) {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const n = await loadModule("src/app/lib/api-normalize.ts");

test("asArray só aceita arrays", () => {
  assert.deepEqual(n.asArray([1, 2]), [1, 2]);
  for (const bad of [null, undefined, {}, "x", 3, { length: 2 }]) assert.deepEqual(n.asArray(bad), []);
});

test("asList aceita lista crua ou envelope conhecido", () => {
  assert.deepEqual(n.asList([1]), [1]);
  assert.deepEqual(n.asList({ data: [1] }), [1]);
  assert.deepEqual(n.asList({ items: [2] }), [2]);
  assert.deepEqual(n.asList({ runs: [3] }, ["runs"]), [3]);
  assert.deepEqual(n.asList({ data: "nope" }), []);
  assert.deepEqual(n.asList(null), []);
});

test("asRecord, asNumber, asNumberOrNull e asString são defensivos", () => {
  assert.deepEqual(n.asRecord(null), {});
  assert.deepEqual(n.asRecord([1]), {});
  assert.deepEqual(n.asRecord({ a: 1 }), { a: 1 });
  assert.equal(n.asNumber("12.5"), 12.5);
  assert.equal(n.asNumber("abc", 7), 7);
  assert.equal(n.asNumber(Number.NaN, 3), 3);
  assert.equal(n.asNumber(undefined), 0);
  assert.equal(n.asNumberOrNull(""), null);
  assert.equal(n.asNumberOrNull("4"), 4);
  assert.equal(n.asString(null, "x"), "x");
  assert.equal(n.asString(5), "5");
});

test("asRoiSummaryOrNull exige money, activity e dataQuality", () => {
  assert.equal(n.asRoiSummaryOrNull({}), null);
  assert.equal(n.asRoiSummaryOrNull(null), null);
  assert.equal(n.asRoiSummaryOrNull({ money: {}, activity: {} }), null);
  const ok = { money: {}, activity: {}, dataQuality: {} };
  assert.equal(n.asRoiSummaryOrNull(ok), ok);
});

test("normalizeMarketIntel preenche números e listas e lança sem objeto", () => {
  assert.throws(() => n.normalizeMarketIntel(null));
  assert.throws(() => n.normalizeMarketIntel([]));
  const empty = n.normalizeMarketIntel({}, "p1");
  assert.equal(empty.propertyId, "p1");
  assert.equal(empty.medianAdr, 0);
  assert.deepEqual(empty.daily, []);
  assert.equal(empty.adrPercentiles, null);
  const full = n.normalizeMarketIntel({
    percentile: "80",
    daily: [{ date: "2026-10-01", yourAdr: 300, medianAdr: "280" }, null, 5],
    adrPercentiles: { p25: 1, p50: 2, p75: 3 },
  });
  assert.equal(full.percentile, 80);
  assert.deepEqual(full.daily, [{ date: "2026-10-01", yourAdr: 300, medianAdr: 280 }]);
  assert.deepEqual(full.adrPercentiles, { p25: 1, p50: 2, p75: 3 });
});

test("normalizeMarketIntel: campos novos do mercado multifonte são seguros e opcionais", () => {
  // backend antigo: nenhum campo novo aparece
  const legacy = n.normalizeMarketIntel({ percentile: 50 });
  assert.equal(legacy.dataSources, undefined);
  assert.equal(legacy.trend30d, undefined);
  assert.equal(legacy.insufficiency, undefined);

  const out = n.normalizeMarketIntel({
    dataSources: [
      { id: "customers", label: "Clientes My Urban", listings: "5", latestCollectedAt: null, licenses: ["first_party", 3] },
      null,
      "x",
      { id: "licensed_dataset", listings: 8, latestCollectedAt: "2026-10-01", licenses: "nope" },
    ],
    attribution: ["Inside Airbnb", 7],
    seasonality: [{ month: 1, index: "1.2", sample: 30 }, { month: 14, index: 1, sample: 1 }, null],
    neighborhoodEventEffect: { upliftPct: "12.5", eventDays: 3, baselineDays: 9 },
    trend30d: { available: true, percentilePoints: 4, medianAdrChangePct: "x", pairedListings: 7, ownBasis: "weird" },
    insufficiency: { reasons: ["a", 1], hints: null, customers: { distinct: 2, required: 5 }, external: null },
    radius: { km: 4, min: 1, max: 5 },
    typology: { applied: { rooms: 2 }, target: { rooms: null, listingType: "entire_home", capacity: "1-2" } },
  });
  assert.deepEqual(out.dataSources, [
    { id: "customers", label: "Clientes My Urban", listings: 5, latestCollectedAt: null, licenses: ["first_party"] },
    { id: "licensed_dataset", label: "", listings: 8, latestCollectedAt: "2026-10-01", licenses: [] },
  ]);
  assert.deepEqual(out.attribution, ["Inside Airbnb"]);
  assert.deepEqual(out.seasonality, [{ month: 1, index: 1.2, sample: 30 }]);
  assert.deepEqual(out.neighborhoodEventEffect, { upliftPct: 12.5, eventDays: 3, baselineDays: 9 });
  assert.equal(out.trend30d.available, true);
  assert.equal(out.trend30d.medianAdrChangePct, null);
  assert.equal(out.trend30d.ownBasis, null);
  assert.deepEqual(out.insufficiency.reasons, ["a"]);
  assert.deepEqual(out.insufficiency.hints, []);
  assert.deepEqual(out.insufficiency.external, { distinct: 0, required: 0, qualified: false });
  assert.deepEqual(out.radius, { km: 4, min: 1, max: 5 });
  assert.deepEqual(out.typology.applied, { rooms: 2, listingType: null, capacity: null });
  assert.deepEqual(out.typology.target, { rooms: null, listingType: "entire_home", capacity: "1-2" });

  assert.equal(n.normalizeMarketIntel({ seasonality: null }).seasonality, null);
  assert.equal(n.normalizeMarketIntel({ insufficiency: null }).insufficiency, null);
});

test("normalizePricingRules descarta entradas inválidas e garante params", () => {
  assert.throws(() => n.normalizePricingRules(undefined));
  const out = n.normalizePricingRules({ rules: [null, { type: "last_minute", enabled: 1 }, "x"] }, "p9");
  assert.equal(out.propertyId, "p9");
  assert.equal(out.rules.length, 1);
  assert.equal(out.rules[0].enabled, true);
  assert.deepEqual(out.rules[0].params, {});
  assert.equal(out.updatedAt, null);
  assert.deepEqual(n.normalizePricingRules({ rules: "nope" }).rules, []);
});

test("normalizePricingPreview aceita envelopes e devolve dias seguros", () => {
  assert.deepEqual(n.normalizePricingPreview(null), { days: [] });
  const out = n.normalizePricingPreview({ days: [{ date: "d", basePrice: "100", appliedRules: null }, 3] });
  assert.deepEqual(out.days, [{ date: "d", basePrice: 100, rulesPrice: 0, appliedRules: [] }]);
});

test("normalizeRoiSummary exige blocos principais e completa o resto com defaults seguros", () => {
  assert.equal(n.normalizeRoiSummary(null), null);
  assert.equal(n.normalizeRoiSummary({}), null);
  assert.equal(n.normalizeRoiSummary({ money: {}, activity: {} }), null);
  const out = n.normalizeRoiSummary({
    money: { totalAttributedCents: "1500", roiPercent: null },
    activity: { accepted: 2 },
    dataQuality: { confidence: "weird" },
    perProperty: [null, { propertyId: 3, propertyName: "Loft", totalAttributedCents: 10 }],
    recentWins: "nope",
  });
  assert.equal(out.money.totalAttributedCents, 1500);
  assert.equal(out.money.roiPercent, null);
  assert.equal(out.activity.recommendations, 0);
  assert.equal(out.activity.accepted, 2);
  assert.equal(out.subscription.monthlyCostCents, 0);
  assert.equal(out.dataQuality.confidence, "low");
  assert.equal(out.perProperty.length, 1);
  assert.equal(out.perProperty[0].propertyId, null);
  assert.equal(out.perProperty[0].propertyName, "Loft");
  assert.deepEqual(out.recentWins, []);
});

test("normalizeAdminFunnel zera estágios ausentes e lança sem objeto", () => {
  assert.throws(() => n.normalizeAdminFunnel(undefined));
  const out = n.normalizeAdminFunnel({ stages: { signups: "12" } });
  assert.equal(out.windowDays, 30);
  assert.equal(out.stages.signups, 12);
  assert.equal(out.stages.operationModeAuto, 0);
  assert.equal(out.rates.acceptanceRatePercent, 0);
});
