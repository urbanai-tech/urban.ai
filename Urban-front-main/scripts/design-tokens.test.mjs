import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyGeneratedRegions,
  checkForDrift,
  defaultPaths,
  renderRegions,
  validateTokens,
} from "./design-tokens.mjs";

const tokens = JSON.parse(readFileSync(defaultPaths.tokens, "utf8"));

test("tokens possuem temas, aliases e breakpoints canonicos validos", () => {
  assert.equal(validateTokens(tokens), tokens);
  assert.equal(tokens.primitives.breakpoint["mobile-max"], "767px");
  assert.equal(tokens.primitives.breakpoint["tablet-max"], "1180px");
  assert.equal(tokens.primitives.breakpoint["desktop-min"], "1181px");
});

test("renderizacao resolve primitivos e preserva aliases CSS publicos", () => {
  const regions = renderRegions(tokens);
  assert.match(regions.themes, /--theme-app-bg: #FAFAFB;/);
  assert.match(regions.themes, /--theme-admin-accent: #E8500A;/);
  assert.match(regions["app-aliases"], /--app-bg: var\(--theme-app-bg\);/);
  assert.match(regions["admin-aliases"], /--admin-text: var\(--theme-admin-text\);/);
});

test("aliases invalidos e declaracoes manuais de tokens falham cedo", () => {
  const invalidTokens = structuredClone(tokens);
  invalidTokens.componentAliases.app.bg = "{semantic.app.inexistente}";
  assert.throws(() => renderRegions(invalidTokens), /Referencia semantica desconhecida/);

  const css = `${readFileSync(defaultPaths.css, "utf8")}\n.manual { --app-token-fora-do-gerador: red; }\n`;
  assert.throws(
    () => applyGeneratedRegions(css, renderRegions(tokens)),
    /Variaveis gerenciadas fora das regioes geradas/,
  );
});

test("geracao e deterministica e o artefato versionado nao tem drift", () => {
  const css = readFileSync(defaultPaths.css, "utf8");
  const regions = renderRegions(tokens);
  const once = applyGeneratedRegions(css, regions);
  const twice = applyGeneratedRegions(once, regions);
  assert.equal(twice, once);
  assert.equal(checkForDrift().matches, true);
});
