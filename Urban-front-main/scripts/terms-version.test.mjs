import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const MONTHS = {
  janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

const termsSource = readFileSync(resolve(process.cwd(), "src/app/lib/terms.ts"), "utf8");
const version = termsSource.match(/TERMS_VERSION\s*=\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];

test("TERMS_VERSION do front está definido em formato ISO", () => {
  assert.ok(version, "TERMS_VERSION não encontrado em src/app/lib/terms.ts");
});

test("TERMS_VERSION bate com TERMS_UPDATED_AT do legalContent.ts", () => {
  const legal = readFileSync(resolve(process.cwd(), "src/app/(public)/legalContent.ts"), "utf8");
  const match = legal.match(/TERMS_UPDATED_AT\s*=\s*'(\d{1,2}) de (\p{L}+) de (\d{4})'/u);
  assert.ok(match, "TERMS_UPDATED_AT não encontrado");
  const [, day, month, year] = match;
  assert.equal(`${year}-${MONTHS[month.toLowerCase()]}-${day.padStart(2, "0")}`, version);
});

test("TERMS_VERSION bate com o backend quando o monorepo está completo", (t) => {
  const backend = resolve(process.cwd(), "../urban-ai-backend-main/src/auth/terms.constants.ts");
  if (!existsSync(backend)) return t.skip("backend não presente neste checkout");
  const backendVersion = readFileSync(backend, "utf8").match(/TERMS_VERSION\s*=\s*'(\d{4}-\d{2}-\d{2})'/)?.[1];
  assert.equal(backendVersion, version);
});

test("cadastro envia termsAccepted + termsVersion e exige o checkbox", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/create/page.tsx"), "utf8");
  assert.match(page, /termsAccepted: true/);
  assert.match(page, /termsVersion: TERMS_VERSION/);
  assert.match(page, /acceptedTerms/);
  assert.match(page, /marketingUrl\("\/termos"\)/);
  assert.match(page, /marketingUrl\("\/privacidade"\)/);
});
