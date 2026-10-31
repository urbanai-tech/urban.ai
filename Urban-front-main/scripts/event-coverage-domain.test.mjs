import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/admin/event-coverage/coverage-domain.ts"),
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

const domain = await loadModule();

test("status mapeia para selos e rótulos", () => {
  assert.equal(domain.statusMeta("ok").badge, "success");
  assert.equal(domain.statusMeta("at_risk").badge, "warn");
  assert.equal(domain.statusMeta("insufficient").badge, "error");
  assert.equal(domain.statusMeta("qualquer-coisa").badge, "error");
});

test("saúde de fonte mapeia para selos", () => {
  assert.equal(domain.sourceHealthMeta("healthy").badge, "success");
  assert.equal(domain.sourceHealthMeta("stale").badge, "warn");
  assert.equal(domain.sourceHealthMeta("zero_yield").badge, "error");
  assert.equal(domain.sourceHealthMeta("unmonitored").badge, "neutral");
});

test("formatação de último ingest e percentuais", () => {
  assert.equal(domain.formatSinceIngest(null), "sem registro");
  assert.equal(domain.formatSinceIngest(0.4), "agora");
  assert.equal(domain.formatSinceIngest(5.4), "há 5 h");
  assert.equal(domain.formatSinceIngest(72), "há 3 d");
  assert.equal(domain.formatPct(null), "—");
  assert.equal(domain.formatPct(91.7), "91,7%");
});

test("progresso é limitado a 0-100 e tolera meta inválida", () => {
  assert.equal(domain.progressPct(50, 100), 50);
  assert.equal(domain.progressPct(250, 100), 100);
  assert.equal(domain.progressPct(5, 0), 0);
});

test("rótulo do dia não desloca fuso", () => {
  assert.equal(domain.shortDay("2026-10-26"), "26/10");
});

test("histograma: altura proporcional, dias vazios sem altura e largura total preservada", () => {
  const bars = domain.histogramBars(
    [
      { date: "2026-10-26", count: 10 },
      { date: "2026-10-27", count: 5 },
      { date: "2026-10-28", count: 0 },
    ],
    300,
    100,
    0,
  );
  assert.equal(bars.length, 3);
  assert.equal(bars[0].height, 100);
  assert.equal(bars[0].y, 0);
  assert.equal(bars[1].height, 50);
  assert.equal(bars[2].height, 0);
  assert.equal(bars[2].x + bars[2].width, 300);
  assert.deepEqual(domain.histogramBars([]), []);
  // com todos zero não divide por zero
  assert.equal(domain.histogramBars([{ date: "2026-10-26", count: 0 }])[0].height, 0);
});

test("dicas: fonte parada aponta para coletores + runbook zero-yield", () => {
  const hints = domain.buildHints([
    { code: "source_zero_yield", severity: "warning", source: "api-football", message: "x" },
    { code: "source_stale", severity: "warning", source: "sp-cultura", message: "y" },
  ]);
  assert.equal(hints.length, 2);
  assert.notEqual(hints[0].key, hints[1].key);
  for (const h of hints) {
    assert.equal(h.href, "/admin/collectors-health");
    assert.equal(h.runbook, "docs/runbooks/coletores-zero-yield.md");
  }
  assert.ok(hints[0].title.includes("api-football"));
});

test("dicas: abaixo da meta oferece o import CSV existente; geocoding e duplicatas têm destino", () => {
  const byCode = Object.fromEntries(
    domain
      .buildHints([
        { code: "below_target", severity: "critical", message: "" },
        { code: "low_geocoding", severity: "warning", message: "" },
        { code: "dedup_pending", severity: "info", message: "" },
        { code: "desconhecido", severity: "info", message: "" },
      ])
      .map((h) => [h.key, h]),
  );
  assert.equal(byCode.below_target.href, "/admin/events/import");
  assert.equal(byCode.below_target.runbook, "docs/runbooks/eventos-fallback-manual.md");
  assert.equal(byCode.low_geocoding.runbook, "docs/runbooks/backfill-geocoder.md");
  assert.equal(byCode.dedup_pending.href, "/admin/events/dedup");
  assert.equal(Object.keys(byCode).length, 3);
});

test("página e navegação: rota registrada no AdminShell e página consome o endpoint", () => {
  const shell = readFileSync(resolve(process.cwd(), "src/app/admin/_components/AdminShell.tsx"), "utf8");
  assert.match(shell, /href: "\/admin\/event-coverage"/);
  const api = readFileSync(resolve(process.cwd(), "src/app/service/api/event-coverage.ts"), "utf8");
  assert.match(api, /\/admin\/event-coverage/);
  assert.match(api, /\/admin\/event-coverage\/changes/);
  assert.match(api, /\/admin\/event-coverage\/lead-time/);
});

test("admin unificado: /admin/coverage vira redirect e a navegação tem uma entrada só", () => {
  const redirectPage = readFileSync(resolve(process.cwd(), "src/app/admin/coverage/page.tsx"), "utf8");
  assert.match(redirectPage, /redirect\("\/admin\/event-coverage\?tab=regioes"\)/);
  const shell = readFileSync(resolve(process.cwd(), "src/app/admin/_components/AdminShell.tsx"), "utf8");
  assert.doesNotMatch(shell, /href: "\/admin\/coverage"/);
});

test("abas: tab desconhecida ou ausente cai em Cobertura; as 4 abas existem na ordem do produto", () => {
  assert.deepEqual(
    domain.COVERAGE_TABS.map((t) => t.id),
    ["cobertura", "qualidade", "regioes", "mudancas"],
  );
  assert.equal(domain.parseCoverageTab("regioes"), "regioes");
  assert.equal(domain.parseCoverageTab("mudancas"), "mudancas");
  assert.equal(domain.parseCoverageTab("nada"), "cobertura");
  assert.equal(domain.parseCoverageTab(null), "cobertura");
  assert.equal(domain.parseCoverageTab(undefined), "cobertura");
});

test("fonte configurada que nunca entregou: selo de erro e dica para os coletores", () => {
  assert.equal(domain.sourceHealthMeta("never_delivered").badge, "error");
  assert.equal(domain.sourceHealthMeta("never_delivered").label, "Nunca entregou");
  const hints = domain.buildHints([
    { code: "source_never_delivered", severity: "warning", message: "x", source: "anhembi" },
  ]);
  assert.equal(hints.length, 1);
  assert.equal(hints[0].key, "source_never_delivered:anhembi");
  assert.equal(hints[0].href, "/admin/collectors-health");
  assert.equal(hints[0].runbook, "docs/runbooks/coletores-zero-yield.md");
});

test("tipos de mudança: rótulos e selos", () => {
  assert.equal(domain.changeTypeMeta("rescheduled").label, "Remarcado");
  assert.equal(domain.changeTypeMeta("cancelled").badge, "error");
  assert.equal(domain.changeTypeMeta("possibly_cancelled").label, "Possivelmente cancelado");
  assert.equal(domain.changeTypeMeta("first_seen").badge, "success");
  assert.equal(domain.changeTypeMeta("desconhecido").label, "desconhecido");
});

test("descrição de mudança usa o relógio de São Paulo", () => {
  // 22:00Z = 19:00 em SP
  assert.equal(domain.formatSpDateTime("2026-11-20T22:00:00.000Z"), "20/11 19:00");
  assert.equal(domain.formatSpDateTime(null), "—");
  assert.equal(domain.formatSpDateTime("lixo"), "—");
  assert.equal(
    domain.describeChange({
      changeType: "rescheduled",
      oldValue: "2026-11-20T22:00:00.000Z",
      newValue: "2026-12-05T22:00:00.000Z",
    }),
    "20/11 19:00 → 05/12 19:00",
  );
  assert.equal(
    domain.describeChange({ changeType: "venue_changed", oldValue: "a", newValue: "b" }),
    "a → b",
  );
  assert.match(
    domain.describeChange({ changeType: "possibly_cancelled", oldValue: "2026-10-20T15:00:00.000Z", newValue: null }),
    /20\/10 12:00/,
  );
});

test("lead time: formatação e veredito contra a meta de 21 dias", () => {
  assert.equal(domain.formatDays(21.46), "21,5 d");
  assert.equal(domain.formatDays(7), "7 d");
  assert.equal(domain.formatDays(null), "—");
  assert.equal(domain.leadTimeVerdict(25, 21).badge, "success");
  assert.equal(domain.leadTimeVerdict(14, 21).badge, "warn");
  assert.equal(domain.leadTimeVerdict(5, 21).badge, "error");
  assert.equal(domain.leadTimeVerdict(null, 21).label, "Sem dados");
  assert.equal(domain.sizeLabel("large"), "Grande (10 mil+)");
  assert.equal(domain.sizeLabel("unknown"), "Sem porte informado");
});

test("barras empilhadas: dias sem mudança ficam sem segmento; alturas proporcionais ao maior dia", () => {
  const series = [
    { date: "2026-10-29", firstSeen: 5, rescheduled: 0, cancelled: 0, possiblyCancelled: 0 },
    { date: "2026-10-30", firstSeen: 0, rescheduled: 2, cancelled: 1, possiblyCancelled: 0 },
    { date: "2026-10-31", firstSeen: 0, rescheduled: 1, cancelled: 0, possiblyCancelled: 0 },
  ];
  const bars = domain.changeStackBars(series, 300, 90, 0);
  assert.equal(bars.length, 3);
  assert.equal(bars[0].segments.length, 0);
  assert.equal(bars[1].total, 3);
  assert.deepEqual(
    bars[1].segments.map((s) => [s.key, s.height]),
    [
      ["rescheduled", 60],
      ["cancelled", 30],
    ],
  );
  // empilhado de baixo para cima: o segmento de cima termina no topo da barra
  assert.equal(bars[1].segments[1].y, 0);
  assert.equal(bars[2].segments[0].height, 30);
  assert.deepEqual(domain.changeStackBars([]), []);
  assert.deepEqual(domain.seriesTotals(series), { firstSeen: 5, rescheduled: 3, cancelled: 1, possiblyCancelled: 0 });
});
