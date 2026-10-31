import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

// portfolio-csv.ts importa csv-safe.ts: junta os dois fontes num módulo só para o teste.
async function loadModule() {
  const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
  const csvSafe = read("src/app/lib/csv-safe.ts");
  const portfolio = read("src/app/lib/portfolio-csv.ts").replace(/^import .*csv-safe.*$/m, "");
  const result = ts.transpileModule(`${csvSafe}\n${portfolio}`, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const { buildPortfolioCsv, portfolioCsvFileName, PORTFOLIO_CSV_HEADERS } = await loadModule();

const body = (csv) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

test("cabeçalho fixo, BOM e fim de linha CRLF", () => {
  const { csv, rows } = buildPortfolioCsv([]);
  assert.equal(rows, 0);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(body(csv)[0], PORTFOLIO_CSV_HEADERS.map((h) => `"${h}"`).join(","));
  assert.ok(csv.endsWith("\r\n"));
});

test("uma linha por imóvel e dia, com diferença sugerido-atual", () => {
  const { csv, rows } = buildPortfolioCsv([
    {
      name: "Studio Paulista",
      days: [
        { date: "2026-11-10", atual: 200, sugestao: 260, base: 190, evento: { nome: "Show X", impacto: "alta" } },
        { date: "2026-11-11", atual: 200, sugestao: null, base: null, evento: null },
      ],
    },
  ]);
  assert.equal(rows, 2);
  const lines = body(csv);
  assert.equal(lines[1], '"Studio Paulista","2026-11-10","200","260","190","60","Show X","alta"');
  // Sem sugestão: células vazias, nunca 0.
  assert.equal(lines[2], '"Studio Paulista","2026-11-11","200","","","","",""');
});

test("nome do imóvel e do evento (texto livre) não viram fórmula na planilha", () => {
  const { csv } = buildPortfolioCsv([
    {
      name: '=HYPERLINK("http://x")',
      days: [{ date: "2026-11-10", atual: 1, sugestao: 2, evento: { nome: "+cmd|' /C calc'!A0", impacto: "media" } }],
    },
  ]);
  const line = body(csv)[1];
  assert.ok(line.startsWith(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(line.includes(`"'+cmd|' /C calc'!A0"`));
});

test("aspas e vírgulas no texto não quebram as colunas", () => {
  const { csv } = buildPortfolioCsv([{ name: 'Casa "Azul", Pinheiros', days: [{ date: "2026-11-10", atual: 1, sugestao: 1 }] }]);
  assert.ok(body(csv)[1].startsWith('"Casa ""Azul"", Pinheiros","2026-11-10"'));
});

test("valores não numéricos viram célula vazia", () => {
  const { csv } = buildPortfolioCsv([{ name: "A", days: [{ date: "2026-11-10", atual: Number.NaN, sugestao: undefined }] }]);
  assert.equal(body(csv)[1], '"A","2026-11-10","","","","","",""');
});

test("nome do arquivo só tem dígitos e hífen no período", () => {
  assert.equal(portfolioCsvFileName("2026-11-01", "2026-12-30"), "portfolio-2026-11-01_2026-12-30.csv");
  assert.equal(portfolioCsvFileName("../../x", "a b"), "portfolio-_.csv");
});
