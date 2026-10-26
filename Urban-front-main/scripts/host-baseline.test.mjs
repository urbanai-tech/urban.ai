import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/hostBaseline.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const baseline = await loadModule();
const draft = (overrides = {}) => ({ ...baseline.EMPTY_HOST_BASELINE_DRAFT, ...overrides });

test("normaliza moeda brasileira e recusa zero, negativo, texto e valores absurdos", () => {
  assert.equal(baseline.parseBaselineMoney("R$ 1.234,56"), 1234.56);
  assert.equal(baseline.parseBaselineMoney("350,5"), 350.5);
  assert.equal(baseline.parseBaselineMoney("350.5"), 350.5);
  assert.equal(baseline.parseBaselineMoney("1.500"), 1500);
  assert.equal(baseline.parseBaselineMoney("0"), null);
  assert.equal(baseline.parseBaselineMoney("-20"), null);
  assert.equal(baseline.parseBaselineMoney("abc"), null);
  assert.equal(baseline.parseBaselineMoney("100001"), null);
});

test("exige a diária base e monta o payload só com o que foi preenchido", () => {
  const missing = baseline.parseHostBaselineDraft(draft());
  assert.equal(missing.ok, false);
  assert.match(missing.error, /diária base/i);

  const onlyBase = baseline.parseHostBaselineDraft(draft({ manualDailyPrice: "380" }));
  assert.deepEqual(onlyBase, { ok: true, payload: { manualDailyPrice: 380 } });

  const full = baseline.parseHostBaselineDraft(
    draft({
      manualDailyPrice: "R$ 380,50",
      minDailyPrice: "250",
      weekendDailyPrice: "450",
      quartos: "2",
      camas: "3",
      banheiros: "1,5",
      hospedes: "4",
      propertyType: "  Apartamento ",
    }),
  );
  assert.deepEqual(full, {
    ok: true,
    payload: {
      manualDailyPrice: 380.5,
      minDailyPrice: 250,
      weekendDailyPrice: 450,
      quartos: 2,
      camas: 3,
      banheiros: 1.5,
      hospedes: 4,
      propertyType: "Apartamento",
    },
  });
});

test("recusa mínima maior que a base e contagens inválidas", () => {
  const minAboveBase = baseline.parseHostBaselineDraft(draft({ manualDailyPrice: "300", minDailyPrice: "400" }));
  assert.equal(minAboveBase.ok, false);
  assert.match(minAboveBase.error, /mínima/i);

  const badRooms = baseline.parseHostBaselineDraft(draft({ manualDailyPrice: "300", quartos: "1.5" }));
  assert.equal(badRooms.ok, false);
  assert.match(badRooms.error, /Quartos/);

  const noGuests = baseline.parseHostBaselineDraft(draft({ manualDailyPrice: "300", hospedes: "0" }));
  assert.equal(noGuests.ok, false);
  assert.match(noGuests.error, /Hóspedes/);
});

test("descreve com honestidade de onde veio a diária base", () => {
  const none = baseline.describeBaselineSource({ dailyPrice: null, source: null, updatedAt: null, stale: false });
  assert.equal(none.tone, "warning");
  assert.match(none.detail, /Preencha manualmente/);

  const host = baseline.describeBaselineSource({
    dailyPrice: 380,
    source: "host_input",
    updatedAt: "2026-10-20T12:00:00.000Z",
    stale: false,
  });
  assert.equal(host.label, "Informada por você");
  assert.equal(host.tone, "success");

  const staleAirbnb = baseline.describeBaselineSource({
    dailyPrice: 500,
    source: "airbnb",
    updatedAt: "2026-08-01T12:00:00.000Z",
    stale: true,
  });
  assert.equal(staleAirbnb.label, "Leitura do Airbnb desatualizada");
  assert.equal(staleAirbnb.tone, "warning");

  const freshAirbnb = baseline.describeBaselineSource({
    dailyPrice: 500,
    source: "airbnb",
    updatedAt: "2026-10-25T12:00:00.000Z",
    stale: false,
  });
  assert.equal(freshAirbnb.label, "Lida do Airbnb");
  assert.equal(freshAirbnb.tone, "neutral");

  assert.match(baseline.describeEssentialsSource("host_input"), /informados por você/);
  assert.match(baseline.describeEssentialsSource("airbnb"), /Airbnb/);
});

test("preenche o formulário a partir do imóvel já salvo", () => {
  const result = baseline.draftFromBaseline({ manualDailyPrice: 380, minDailyPrice: null, quartos: 2, propertyType: "Casa" });
  assert.equal(result.manualDailyPrice, "380");
  assert.equal(result.minDailyPrice, "");
  assert.equal(result.quartos, "2");
  assert.equal(result.propertyType, "Casa");
});
