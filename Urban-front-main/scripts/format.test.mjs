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

const f = await loadModule("src/app/lib/format.ts");
const titles = await loadModule("src/app/lib/pageTitle.ts");

// Intl usa espaço sem quebra entre "R$" e o número; normaliza para comparar.
const plain = (s) => s.replace(/ /g, " ");

test("moeda BRL com vírgula decimal e ponto de milhar", () => {
  assert.equal(plain(f.brl(310)), "R$ 310,00");
  assert.equal(plain(f.brl(1234.5)), "R$ 1.234,50");
  assert.equal(plain(f.brlWhole(310.4)), "R$ 310");
  assert.equal(plain(f.brlAuto(450)), "R$ 450");
  assert.equal(plain(f.brlAuto(450.5)), "R$ 450,50");
  assert.equal(plain(f.brlFromCents(31000)), "R$ 310,00");
});

test("moeda compacta usa 'mil' e 'mi', sem casa decimal zerada", () => {
  assert.equal(plain(f.brlCompact(310)), "R$ 310");
  assert.equal(plain(f.brlCompact(1200)), "R$ 1,2 mil");
  assert.equal(plain(f.brlCompact(2000)), "R$ 2 mil");
  assert.equal(plain(f.brlCompact(1_500_000)), "R$ 1,5 mi");
});

test("percentual com vírgula, sem espaço antes do %", () => {
  assert.equal(f.pct(12.46), "12,5%");
  assert.equal(f.pct(0, 0), "0%");
  assert.equal(f.pctSigned(122.6), "+122,6%");
  assert.equal(f.pctSigned(-3.04), "-3,0%");
});

test("zero e -0 nunca levam sinal", () => {
  assert.equal(f.pctSigned(0), "0,0%");
  assert.equal(f.pctSigned(-0), "0,0%");
  assert.equal(f.pctSigned(0.004), "0,0%");
  assert.equal(f.pctSigned(-0.004), "0,0%");
});

test("número, distância e multiplicador", () => {
  assert.equal(f.decimal(4.8, 2), "4,80");
  assert.equal(f.integer(1234.4), "1.234");
  assert.equal(f.km(1.84), "1,8 km");
  assert.equal(f.kmFromMeters(1840), "1,8 km");
  assert.equal(f.multiple(2.46), "2,5x");
});

test("valores ausentes ou não finitos devolvem o fallback", () => {
  for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(f.brl(bad), "—");
    assert.equal(f.pct(bad), "—");
    assert.equal(f.km(bad), "—");
    assert.equal(f.decimal(bad), "—");
  }
  assert.equal(f.brl(null, "-"), "-");
  assert.equal(f.dateSP(null), "—");
  assert.equal(f.dateSP("lixo"), "—");
});

test("datas no fuso de São Paulo; YYYY-MM-DD é dia de calendário", () => {
  assert.equal(f.dateSP("2026-10-30"), "30/10/2026");
  assert.equal(f.dateShortSP("2026-12-25"), "25/12");
  // 2026-10-31T01:30Z ainda é 30/10 em São Paulo (UTC-3).
  assert.equal(f.dateSP("2026-10-31T01:30:00Z"), "30/10/2026");
  assert.equal(f.dateTimeSP("2026-10-31T01:30:00Z"), "30/10/2026 22:30");
  assert.match(f.dateMonthSP("2026-10-30"), /^30 de out/);
});

test("título de página segue o padrão único com separador '·'", () => {
  assert.equal(titles.appTitle("Calendário"), "Calendário · My Urban");
  assert.equal(titles.adminTitle("Usuários"), "Usuários · Admin · My Urban");
  assert.equal(titles.adminTitle(), "Admin · My Urban");
  assert.deepEqual(titles.appMetadata("Hoje"), { title: "Hoje · My Urban" });
});
