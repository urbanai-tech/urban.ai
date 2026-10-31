import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/admin/market-sources/market-sources-domain.ts"),
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

const source = (patch) => ({
  id: "licensed_dataset",
  label: "Dataset licenciado",
  enabled: true,
  listings: 100,
  lastCollectedAt: "2026-10-01",
  stale: false,
  ...patch,
});

test("selo da fonte: desligada diz o motivo; sem dados, desatualizada e atualizada são distintas", () => {
  const off = d.sourceStatusMeta(source({ id: "own_scraping", enabled: false, reason: "aguardando parecer jurídico", listings: 0 }));
  assert.deepEqual([off.badge, off.label], ["neutral", "Desligada"]);
  assert.match(off.detail, /aguardando parecer jurídico/);

  assert.equal(d.sourceStatusMeta(source({ listings: 0 })).label, "Sem dados");
  const stale = d.sourceStatusMeta(source({ stale: true, lastCollectedAt: "2025-01-10" }));
  assert.deepEqual([stale.badge, stale.label], ["warn", "Desatualizada"]);
  assert.match(stale.detail, /10\/01\/2025/);
  assert.deepEqual([d.sourceStatusMeta(source()).badge, d.sourceStatusMeta(source()).label], ["success", "Atualizada"]);

  assert.equal(d.sourceStatusMeta(source({ id: "customers", listings: 7 })).label, "Ativa");
  assert.equal(d.sourceStatusMeta(source({ id: "customers", listings: 0 })).label, "Sem imóveis");
});

test("cobertura contra a meta de 80%", () => {
  const cov = (ratio, extra = {}) => ({ activeProperties: 50, sampled: 10, withSufficientCompSet: Math.round(ratio * 10), ratio, target: 0.8, contributions: {}, cachedAt: "x", ...extra });
  assert.deepEqual([d.coverageMeta(cov(0.9)).badge, d.coverageMeta(cov(0.9)).pctText], ["success", "90%"]);
  assert.equal(d.coverageMeta(cov(0.6)).badge, "warn");
  assert.equal(d.coverageMeta(cov(0.2)).badge, "error");
  const none = d.coverageMeta(cov(null, { sampled: 0 }));
  assert.deepEqual([none.pctText, none.label], ["—", "Sem amostra"]);
  assert.match(d.coverageMeta(cov(0.9)).summary, /9 de 10 imóveis avaliados/);
});

test("dicas: sem fonte externa, desatualizada, cobertura baixa e coleta própria desligada", () => {
  const report = {
    generatedAt: "x",
    config: { minHosts: 5, minExternalListings: 8, externalMaxAgeDays: 548, scrapingEnabled: false },
    sources: [
      source({ id: "customers", label: "Clientes", listings: 5, lastCollectedAt: null }),
      source({ listings: 0, lastCollectedAt: null }),
      source({ id: "inside_airbnb", label: "Inside Airbnb", listings: 0, lastCollectedAt: null }),
      source({ id: "own_scraping", label: "Coleta própria", enabled: false, reason: "aguardando parecer jurídico", listings: 0 }),
    ],
    neighborhoods: [],
    recentImports: [],
    coverage: { activeProperties: 5, sampled: 5, withSufficientCompSet: 0, ratio: 0, target: 0.8, contributions: {}, cachedAt: "x" },
  };
  const hints = d.marketHints(report);
  assert.ok(hints.some((h) => /Nenhuma fonte externa tem dados/.test(h)));
  assert.ok(hints.some((h) => /Cobertura em 0%/.test(h)));
  assert.ok(hints.some((h) => /Coleta própria desligada \(aguardando parecer jurídico\)/.test(h)));

  const healthy = {
    ...report,
    sources: [source({ id: "customers", listings: 9, lastCollectedAt: null }), source(), source({ id: "own_scraping", enabled: true, listings: 0 })],
    coverage: { ...report.coverage, ratio: 0.9, withSufficientCompSet: 5 },
  };
  assert.deepEqual(d.marketHints(healthy), []);
  const stale = { ...healthy, sources: [source({ stale: true, lastCollectedAt: "2025-01-01" }), source({ id: "customers" })] };
  assert.ok(d.marketHints(stale).some((h) => /desatualizado/.test(h)));
});

test("upload: licença é obrigatória e sem padrão", () => {
  assert.equal(d.EMPTY_UPLOAD_FORM.license, "");
  const file = { name: "dados.csv", size: 1000 };
  const ok = { ...d.EMPTY_UPLOAD_FORM, file, datasetLabel: "airroi", collectedAt: "2026-10-01", license: "licensed_internal_only" };
  assert.deepEqual(d.validateUpload(ok, "2026-10-31"), {});
  assert.match(d.validateUpload({ ...ok, license: "" }, "2026-10-31").license, /licença contratada/);
  assert.match(d.validateUpload({ ...ok, license: "first_party" }, "2026-10-31").license, /licença/); // não se escolhe
  assert.equal(d.hasUploadErrors({}), false);
  assert.equal(d.hasUploadErrors({ file: "x" }), true);
});

test("upload: valida arquivo, rótulo, cidade, data e mapeamento antes de enviar", () => {
  const base = { ...d.EMPTY_UPLOAD_FORM, file: { name: "a.csv", size: 10 }, datasetLabel: "airroi", collectedAt: "2026-10-01", license: "cc_by_4" };
  const v = (patch) => d.validateUpload({ ...base, ...patch }, "2026-10-31");
  assert.match(v({ file: null }).file, /Escolha um arquivo/);
  assert.match(v({ file: { name: "a.parquet", size: 10 } }).file, /\.csv/);
  assert.match(v({ file: { name: "a.csv", size: d.UPLOAD_MAX_BYTES + 1 } }).file, /25 MB/);
  assert.match(v({ file: { name: "a.csv", size: 0 } }).file, /vazio/);
  assert.match(v({ datasetLabel: "Meu Fornecedor" }).datasetLabel, /minúsculas/);
  assert.match(v({ city: "São Paulo" }).city, /slug/);
  assert.match(v({ collectedAt: "" }).collectedAt, /data de coleta/);
  assert.match(v({ collectedAt: "2027-01-01" }).collectedAt, /futuro/);
  assert.match(v({ mapping: "{nao json" }).mapping, /JSON válido/);
  assert.match(v({ mapping: '{"hack":"x"}' }).mapping, /desconhecido/);
  assert.match(v({ mapping: '{"adr":5}' }).mapping, /texto/);
  assert.match(v({ mapping: "[1]" }).mapping, /objeto/);
  assert.deepEqual(v({ mapping: '{"adr":"preco","adrUnit":"cents"}' }), {});
});

test("rótulos de licença e data", () => {
  assert.equal(d.licenseLabel("cc_by_4"), "CC BY 4.0");
  assert.equal(d.licenseLabel("licensed_internal_only"), "Pago · uso interno");
  assert.equal(d.licenseLabel("outra"), "outra");
  assert.equal(d.formatDay("2026-10-01"), "01/10/2026");
  assert.equal(d.formatDay(null), "—");
  assert.equal(d.sourceShortLabel("customers"), "Clientes");
  assert.equal(d.sourceShortLabel("own_scraping"), "Coleta própria");
});
