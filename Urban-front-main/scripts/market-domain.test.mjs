import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/properties/[id]/market/market-domain.ts"),
    "utf8",
  );
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const d = await loadModule();

test("filtros: padrão não manda tipologia; selecionados viram parâmetros tipados", () => {
  assert.deepEqual(d.filtersToInput(d.DEFAULT_FILTERS), { radiusKm: 3, rooms: null, listingType: null, capacity: null });
  assert.deepEqual(
    d.filtersToInput({ radiusKm: 5, rooms: "2", listingType: "entire_home", capacity: "3-4" }),
    { radiusKm: 5, rooms: 2, listingType: "entire_home", capacity: "3-4" },
  );
  assert.deepEqual(d.filtersToInput({ ...d.DEFAULT_FILTERS, rooms: "0" }).rooms, 0); // studio = 0 quartos, não "qualquer"
  assert.equal(d.hasTypologyFilter(d.DEFAULT_FILTERS), false);
  assert.equal(d.hasTypologyFilter({ ...d.DEFAULT_FILTERS, capacity: "1-2" }), true);
});

test("raio oferece 1 a 5 km", () => {
  assert.deepEqual([...d.RADIUS_OPTIONS], [1, 2, 3, 4, 5]);
});

test("'igual ao meu imóvel' usa a tipologia do anúncio e mantém o raio", () => {
  const target = { rooms: 2, listingType: "entire_home", capacity: "3-4" };
  assert.deepEqual(d.filtersFromTarget(target, 4), { radiusKm: 4, rooms: "2", listingType: "entire_home", capacity: "3-4" });
  assert.equal(d.filtersFromTarget({ rooms: 7, listingType: null, capacity: null }, 3).rooms, "4"); // 4 = "4 ou mais"
  assert.deepEqual(d.filtersFromTarget(undefined, 2), { radiusKm: 2, rooms: "any", listingType: "any", capacity: "any" });
  assert.equal(d.targetHasTypology(target), true);
  assert.equal(d.targetHasTypology({ rooms: null, listingType: null, capacity: null }), false);
  assert.equal(d.targetHasTypology(undefined), false);
});

test("selos de fonte mostram origem, quantidade e data de coleta", () => {
  assert.equal(d.formatCollectedDate("2026-10-01"), "01/10/2026");
  assert.equal(d.formatCollectedDate(null), "");
  const badges = d.sourceBadges([
    { id: "customers", label: "Clientes My Urban", listings: 5, latestCollectedAt: null, licenses: ["first_party"] },
    { id: "licensed_dataset", label: "Dataset licenciado", listings: 1, latestCollectedAt: "2026-10-01", licenses: ["licensed_display_aggregate"] },
    { id: "inside_airbnb", label: "", listings: 8, latestCollectedAt: "2025-06-01", licenses: ["cc_by_4"] },
  ]);
  assert.deepEqual(badges, [
    { id: "customers", label: "Clientes My Urban", detail: "5 imóveis · dados atuais" },
    { id: "licensed_dataset", label: "Dataset licenciado", detail: "1 anúncio · coleta 01/10/2026" },
    { id: "inside_airbnb", label: "Inside Airbnb", detail: "8 anúncios · coleta 01/06/2025" },
  ]);
  assert.deepEqual(d.sourceBadges(undefined), []);
});

test("origem em uma frase", () => {
  const src = (id) => ({ id, label: id, listings: 1, latestCollectedAt: null, licenses: [] });
  assert.equal(d.originPhrase([src("customers")]), "clientes");
  assert.equal(d.originPhrase([src("customers"), src("licensed_dataset")]), "clientes e dataset licenciado");
  assert.equal(
    d.originPhrase([src("customers"), src("licensed_dataset"), src("inside_airbnb")]),
    "clientes, dataset licenciado e Inside Airbnb",
  );
  assert.equal(d.originPhrase([]), "");
});

test("tendência: indisponível é dita; backend antigo cai no número legado", () => {
  const unavailable = d.trendView({
    percentileTrend30d: 0,
    trend30d: { available: false, percentilePoints: null, medianAdrChangePct: null, currentMedianAdr: null, previousMedianAdr: null, pairedListings: 2, ownBasis: null, reason: "Histórico insuficiente: só 2 anúncios." },
  });
  assert.equal(unavailable.kind, "unavailable");
  assert.equal(unavailable.label, "tendência indisponível");
  assert.match(unavailable.hint, /Histórico insuficiente/);

  const up = d.trendView({ percentileTrend30d: 4, trend30d: { available: true, percentilePoints: 4, medianAdrChangePct: 3, currentMedianAdr: 1, previousMedianAdr: 1, pairedListings: 9, ownBasis: "observed" } });
  assert.deepEqual([up.kind, up.label], ["up", "+4 pontos"]);
  const current = d.trendView({ percentileTrend30d: -6, trend30d: { available: true, percentilePoints: -6, medianAdrChangePct: 8, currentMedianAdr: 1, previousMedianAdr: 1, pairedListings: 9, ownBasis: "current" } });
  assert.equal(current.kind, "down");
  assert.match(current.hint, /só o mercado se moveu/);

  assert.equal(d.trendView({ percentileTrend30d: 0 }).kind, "flat"); // sem o campo novo: legado
  assert.equal(d.trendView({ percentileTrend30d: 7 }).label, "+7 pontos");
});

test("ocupação: indisponível não vira 0%; estimativa é rotulada", () => {
  const unavailable = d.occupancyView({ medianOccupancy: 0, yourOccupancy: 0, occupancyAvailable: false });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.value, "Indisponível");

  const observed = d.occupancyView({ medianOccupancy: 0.72, yourOccupancy: 0.6, occupancyAvailable: true });
  assert.deepEqual([observed.value, observed.sub], ["72%", "Sua ocupação 60%"]);

  const proxy = d.occupancyView({ medianOccupancy: 0.6, yourOccupancy: 0.5, occupancyAvailable: true, occupancyIsProxy: true, yourOccupancyAvailable: false });
  assert.match(proxy.sub, /^Estimativa pelos dias disponíveis/);
  assert.match(proxy.sub, /sem registro/);

  // backend antigo (sem occupancyAvailable): comporta-se como antes
  assert.equal(d.occupancyView({ medianOccupancy: 0.5, yourOccupancy: 0.4 }).value, "50%");
});

test("sazonalidade vira barras relativas ao maior índice", () => {
  assert.deepEqual(d.seasonalityBars(null), []);
  assert.deepEqual(d.seasonalityBars([{ month: 3, index: 0, sample: 10 }]), []);
  const bars = d.seasonalityBars([
    { month: 1, index: 1.2, sample: 30 },
    { month: 6, index: 0.6, sample: 30 },
    { month: 13, index: 1, sample: 30 },
  ]);
  assert.equal(bars.length, 2);
  assert.deepEqual([bars[0].label, bars[0].heightPct, bars[0].delta], ["Jan", 100, "+20% vs. média"]);
  assert.deepEqual([bars[1].label, bars[1].heightPct, bars[1].delta], ["Jun", 50, "-40% vs. média"]);
});

test("efeito dos eventos", () => {
  assert.equal(d.eventEffectView(null), null);
  const view = d.eventEffectView({ upliftPct: 18.4, eventDays: 3, baselineDays: 12 });
  assert.equal(view.value, "+18,4%");
  assert.match(view.sub, /3 dias com evento/);
  assert.match(view.sub, /12 dias sem/);
  assert.match(d.eventEffectView({ upliftPct: -2, eventDays: 1, baselineDays: 9 }).sub, /1 dia com evento/);
});

test("amostra insuficiente explica o que falta e o que dá para mudar", () => {
  const info = {
    reasons: ["Clientes My Urban: 2 anfitriões distintos na região (mínimo 5).", "Fontes externas: 3 anúncios distintos (mínimo 8)."],
    hints: ["Aumente o raio de busca (até 5 km)."],
    customers: { distinct: 2, required: 5, qualified: false },
    external: { distinct: 3, required: 8, qualified: false },
  };
  const view = d.insufficiencyView({ insufficiency: info, minGroupSize: 5, minExternalListings: 8 }, { ...d.DEFAULT_FILTERS, radiusKm: 2 });
  assert.equal(view.title, "Ainda não há amostra suficiente aqui");
  assert.match(view.body, /5 anfitriões distintos/);
  assert.match(view.body, /8 anúncios distintos/);
  assert.match(view.body, /até 2 km/);
  assert.deepEqual(view.reasons, info.reasons);
  assert.equal(view.widenTo, 3);
  assert.equal(view.canClearTypology, false);

  const maxed = d.insufficiencyView({ insufficiency: null, minGroupSize: 5 }, { radiusKm: 5, rooms: "2", listingType: "any", capacity: "any" });
  assert.equal(maxed.widenTo, null);
  assert.equal(maxed.canClearTypology, true);
  assert.match(maxed.reasons[0], /pelo menos 5 anfitriões ou 8 anúncios/); // sem detalhes do backend: texto genérico
  assert.ok(maxed.hints.some((hint) => /Afrouxe a tipologia/.test(hint)));
  assert.ok(!maxed.hints.some((hint) => /raio/.test(hint)));
});
