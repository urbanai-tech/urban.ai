import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadDomainModule() {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/dashboard/components/aplicar-preco-domain.ts"),
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

test("parseBrlInput entende formatos brasileiros e ponto decimal", () => {
  assert.equal(domain.parseBrlInput("450"), 450);
  assert.equal(domain.parseBrlInput("450,50"), 450.5);
  assert.equal(domain.parseBrlInput("R$ 1.350,00"), 1350);
  assert.equal(domain.parseBrlInput("450.5"), 450.5);
  assert.ok(Number.isNaN(domain.parseBrlInput("")));
  assert.ok(Number.isNaN(domain.parseBrlInput("abc")));
  assert.ok(Number.isNaN(domain.parseBrlInput(null)));
});

test("formatPlainPrice gera o valor que se cola no Airbnb", () => {
  assert.equal(domain.formatPlainPrice(450), "450");
  assert.equal(domain.formatPlainPrice(450.5), "450,50");
  assert.equal(domain.formatPlainPrice(Number.NaN), "");
});

test("o dia do evento é o dia de calendário de São Paulo, não o dia UTC", () => {
  // Jogo às 21:30 BRT = 00:30Z do dia seguinte: o dia correto é 9, não 10.
  assert.equal(domain.saoPauloDayKey("2026-06-10T00:30:00.000Z"), "2026-06-09");
  assert.equal(domain.saoPauloDayKey("2026-06-09T13:00:00.000Z"), "2026-06-09");
  assert.equal(domain.saoPauloDayKey("invalido"), null);
  assert.equal(domain.saoPauloDayKey(null), null);
  assert.match(domain.formatSaoPauloDay("2026-06-10T00:30:00.000Z"), /9/);
});

test("checkAppliedPrice aceita ajustes e rejeita erros de digitação", () => {
  const refs = [171, 150]; // sugerido, atual: faixa 30 a 855
  assert.deepEqual(domain.checkAppliedPrice("171", refs), { ok: true, value: 171 });
  assert.deepEqual(domain.checkAppliedPrice("160,5", refs), { ok: true, value: 160.5 });
  assert.deepEqual(domain.checkAppliedPrice("30", refs), { ok: true, value: 30 });
  assert.deepEqual(domain.checkAppliedPrice("855", refs), { ok: true, value: 855 });

  for (const bad of ["", "0", "-5", "abc", "29,99", "855,01", "4500"]) {
    const result = domain.checkAppliedPrice(bad, refs);
    assert.equal(result.ok, false, `deveria rejeitar ${bad}`);
    assert.ok(result.message.length > 0);
  }
});

test("checkAppliedPrice sem referência válida só aplica o teto absoluto", () => {
  assert.equal(domain.checkAppliedPrice("12000", [null, undefined, 0]).ok, true);
  assert.equal(domain.checkAppliedPrice("100000000", []).ok, false);
});

test("o passo a passo não promete aplicação automática", () => {
  const text = domain.AIRBNB_STEPS.join(" ").toLowerCase();
  assert.ok(domain.AIRBNB_STEPS.length >= 3);
  assert.ok(!text.includes("automatic"));
  assert.ok(text.includes("airbnb"));
});
