import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..");

export const defaultPaths = {
  tokens: join(projectRoot, "src", "app", "componentes", "ui", "tokens.json"),
  css: join(projectRoot, "src", "app", "componentes", "ui", "design-tokens.css"),
};

const REGION_NAMES = ["themes", "app-aliases", "admin-aliases"];
const referencePattern = /^\{([a-z0-9.-]+)\}$/i;

function sortedEntries(value) {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

function getPath(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

function resolvePrimitive(tokens, reference, seen = new Set()) {
  const match = referencePattern.exec(reference);
  if (!match) return reference;
  const path = match[1];
  if (path.startsWith("semantic.")) {
    const semanticPath = path.slice("semantic.".length);
    for (const themeName of ["light", "dark"]) {
      const semanticValue = getPath(tokens.semantic?.[themeName], semanticPath);
      if (typeof semanticValue !== "string") {
        throw new Error(`Referencia semantica desconhecida em ${themeName}: {${path}}`);
      }
    }
    return `var(--theme-${path.slice("semantic.".length).replaceAll(".", "-")})`;
  }
  if (seen.has(path)) throw new Error(`Referencia circular em {${path}}`);
  const resolved = getPath(tokens.primitives, path);
  if (typeof resolved !== "string") throw new Error(`Referencia desconhecida: {${path}}`);
  return resolvePrimitive(tokens, resolved, new Set([...seen, path]));
}

function assertTokenMap(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new Error(`${label} deve ser um objeto nao vazio`);
  }
  for (const [key, tokenValue] of Object.entries(value)) {
    if (typeof tokenValue !== "string" || tokenValue.length === 0) {
      throw new Error(`${label}.${key} deve ser uma string nao vazia`);
    }
  }
}

export function validateTokens(tokens) {
  if (!tokens || typeof tokens !== "object") throw new Error("tokens.json deve conter um objeto");
  if (!Number.isInteger(tokens.version) || tokens.version < 1) throw new Error("version deve ser inteiro >= 1");
  if (!tokens.primitives || typeof tokens.primitives !== "object") throw new Error("primitives ausente");
  for (const themeName of ["light", "dark"]) {
    const theme = tokens.semantic?.[themeName];
    if (!theme) throw new Error(`semantic.${themeName} ausente`);
    for (const surface of ["page", "public", "app", "admin"]) {
      assertTokenMap(theme[surface], `semantic.${themeName}.${surface}`);
      for (const value of Object.values(theme[surface])) resolvePrimitive(tokens, value);
    }
  }
  for (const component of ["app", "admin"]) {
    const aliases = tokens.componentAliases?.[component];
    assertTokenMap(aliases, `componentAliases.${component}`);
    for (const value of Object.values(aliases)) resolvePrimitive(tokens, value);
  }
  for (const requiredBreakpoint of ["mobile-max", "tablet-max", "desktop-min"]) {
    const value = tokens.primitives?.breakpoint?.[requiredBreakpoint];
    if (!/^\d+px$/.test(value ?? "")) throw new Error(`breakpoint.${requiredBreakpoint} invalido`);
  }
  return tokens;
}

function renderTheme(tokens, themeName) {
  const selector = themeName === "light"
    ? ':root,\n:root[data-theme="light"]'
    : ':root[data-theme="dark"]';
  const lines = [`${selector} {`];
  for (const [surface, surfaceTokens] of sortedEntries(tokens.semantic[themeName])) {
    lines.push(`  /* ${surface} */`);
    for (const [name, value] of sortedEntries(surfaceTokens)) {
      lines.push(`  --theme-${surface}-${name}: ${resolvePrimitive(tokens, value)};`);
    }
    lines.push("");
  }
  if (lines.at(-1) === "") lines.pop();
  lines.push("}");
  return lines.join("\n");
}

function renderAliases(tokens, component) {
  return sortedEntries(tokens.componentAliases[component])
    .map(([name, value]) => `  --${component}-${name}: ${resolvePrimitive(tokens, value)};`)
    .join("\n");
}

export function renderRegions(rawTokens) {
  const tokens = validateTokens(rawTokens);
  return {
    themes: `${renderTheme(tokens, "light")}\n\n${renderTheme(tokens, "dark")}`,
    "app-aliases": renderAliases(tokens, "app"),
    "admin-aliases": renderAliases(tokens, "admin"),
  };
}

function markers(name) {
  return {
    start: `/* design-tokens:generated ${name}:start */`,
    end: `/* design-tokens:generated ${name}:end */`,
  };
}

export function applyGeneratedRegions(css, regions) {
  let output = css;
  for (const name of REGION_NAMES) {
    const marker = markers(name);
    const startIndex = output.indexOf(marker.start);
    const endIndex = output.indexOf(marker.end);
    if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
      throw new Error(`Marcadores da regiao ${name} ausentes ou invalidos em design-tokens.css`);
    }
    const before = output.slice(0, startIndex + marker.start.length);
    const after = output.slice(endIndex);
    output = `${before}\n${regions[name]}\n${after}`;
  }
  output = output.replaceAll("\r\n", "\n");
  assertNoManagedDeclarationsOutsideRegions(output);
  return output;
}

function assertNoManagedDeclarationsOutsideRegions(css) {
  let unmanaged = css;
  for (const name of REGION_NAMES) {
    const marker = markers(name);
    const pattern = new RegExp(
      `${escapeRegExp(marker.start)}[\\s\\S]*?${escapeRegExp(marker.end)}`,
      "g",
    );
    unmanaged = unmanaged.replace(pattern, `${marker.start}\n${marker.end}`);
  }
  const declarations = unmanaged.match(/--(?:theme|app|admin)-[a-z0-9-]+\s*:/gi) ?? [];
  if (declarations.length > 0) {
    throw new Error(
      `Variaveis gerenciadas fora das regioes geradas: ${declarations.map((item) => item.trim()).join(", ")}`,
    );
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function generateCss({ tokensPath = defaultPaths.tokens, cssPath = defaultPaths.css } = {}) {
  const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
  const css = readFileSync(cssPath, "utf8");
  return applyGeneratedRegions(css, renderRegions(tokens));
}

export function checkForDrift({ tokensPath = defaultPaths.tokens, cssPath = defaultPaths.css } = {}) {
  const current = readFileSync(cssPath, "utf8").replaceAll("\r\n", "\n");
  const generated = generateCss({ tokensPath, cssPath });
  return { current, generated, matches: current === generated };
}

function runCli() {
  const check = process.argv.includes("--check");
  try {
    const result = checkForDrift();
    if (check) {
      if (!result.matches) {
        console.error("[design:tokens] Drift detectado. Rode npm run design:tokens:generate e versione o CSS.");
        process.exitCode = 1;
        return;
      }
      console.log("[design:tokens] OK: tokens.json e design-tokens.css estao sincronizados.");
      return;
    }
    writeFileSync(defaultPaths.css, result.generated, "utf8");
    console.log("[design:tokens] design-tokens.css gerado deterministicamente.");
  } catch (error) {
    console.error(`[design:tokens] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runCli();
