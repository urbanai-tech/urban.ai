import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Gate de contraste das superfícies de vidro (glass) do app do anfitrião.
 *
 * Lê `tokens.json`, resolve os tokens semânticos de cada tema e calcula o
 * contraste WCAG 2.x do texto que fica SOBRE o vidro. Como o vidro é
 * translúcido, o fundo efetivo depende do que rola por baixo; o gate usa o
 * pior caso entre um conjunto de "fundos possíveis" (canvas, superfícies,
 * accent e os extremos preto/branco de fotos de imóveis). O blur só ajuda,
 * então o cálculo sem blur é conservador.
 *
 * Trocar a marca = trocar tokens. Se a troca quebrar AA, este gate falha.
 *   node scripts/design-glass-contrast.mjs          -> imprime a tabela
 *   node scripts/design-glass-contrast.mjs --check  -> sai 1 se algo < mínimo
 */

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const tokensPath = join(scriptDir, "..", "src", "app", "componentes", "ui", "tokens.json");

const referencePattern = /^\{([a-z0-9.-]+)\}$/i;

function getPath(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

export function resolveSemantic(tokens, theme, path) {
  let value = getPath(tokens.semantic[theme], path);
  const seen = new Set();
  while (typeof value === "string" && referencePattern.test(value)) {
    const ref = referencePattern.exec(value)[1];
    if (seen.has(ref)) throw new Error(`referencia circular: ${ref}`);
    seen.add(ref);
    value = ref.startsWith("semantic.")
      ? getPath(tokens.semantic[theme], ref.slice("semantic.".length))
      : getPath(tokens.primitives, ref);
  }
  if (typeof value !== "string") throw new Error(`token desconhecido: ${theme}.${path}`);
  return value;
}

export function parseColor(input) {
  const value = input.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
    return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16)).concat(1);
  }
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgba) {
    const parts = rgba[1].split(",").map((part) => Number.parseFloat(part));
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  throw new Error(`cor nao suportada: ${input}`);
}

/** Compõe `top` (pode ter alpha) sobre `bottom` (opaco). */
export function composite(top, bottom) {
  const alpha = top[3];
  return [0, 1, 2].map((i) => top[i] * alpha + bottom[i] * (1 - alpha)).concat(1);
}

function luminance([r, g, b]) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PHOTO_EXTREMES = { "foto-branca": "#FFFFFF", "foto-preta": "#000000" };

/** Cores dos fundos oficiais: claro usa Backgrounds_05 (mint->teal->deep), escuro usa Backgrounds_04 (preto + brilho teal). */
const BRAND_IMAGE_EXTREMES_BY_THEME = { light: {
  "fundo-preto": "#000000",
  "fundo-deep": "#103134",
  "fundo-teal": "#2A928A",
  "fundo-mint": "#C7E2CE",
}, dark: { "fundo-preto": "#000000", "fundo-deep": "#103134", "fundo-teal": "#2A928A" } };

/**
 * Pares avaliados. `layers` são camadas aplicadas, em ordem, sobre cada
 * fundo possível; `text` é a cor do primeiro plano. Pares sem glass são
 * opacos (o fundo possível não interfere).
 */
export const pairs = [
  { id: "tabbar-label-active", text: "app.glass-text", layers: ["app.glass-premium-bar-bg", "app.tab-indicator"], min: 4.5, note: "rotulo 11px da aba ativa" },
  { id: "tabbar-icon-active", text: "app.tab-active", layers: ["app.glass-premium-bar-bg", "app.tab-indicator"], min: 3, note: "icone da aba ativa (UI 3:1)" },
  { id: "tabbar-label", text: "app.glass-premium-bar-text-muted", layers: ["app.glass-premium-bar-bg"], min: 4.5, note: "rotulo 11px das abas inativas" },
  { id: "topbar-title", text: "app.glass-text", layers: ["app.glass-premium-bar-bg"], min: 4.5, note: "titulo compacto da top bar" },
  { id: "glass-icon", text: "app.glass-premium-bar-text-muted", layers: ["app.glass-premium-bar-bg"], min: 3, note: "icones/controles no vidro (UI 3:1)" },
  { id: "sheet-body", text: "app.text", layers: ["app.sheet-bg"], min: 4.5, note: "texto no bottom sheet (solido)" },
  { id: "sheet-muted", text: "app.text-muted", layers: ["app.sheet-bg"], min: 4.5, note: "texto secundario no sheet" },
  // Vidro do bottom sheet (translucido so com backdrop-filter e sem reduced-transparency).
  { id: "sheet-glass-body", text: "app.text", layers: ["app.glass-premium-sheet-bg"], min: 4.5, note: "texto no bottom sheet de vidro" },
  { id: "sheet-glass-muted", text: "app.text-muted", layers: ["app.glass-premium-sheet-bg"], min: 4.5, note: "texto secundario no sheet de vidro" },
  { id: "card-muted", text: "app.text-muted", layers: ["app.surface"], min: 4.5, note: "texto secundario em cards" },
  { id: "primary-button", text: "app.accent-contrast", layers: ["app.accent"], min: 4.5, note: "texto do botao primario" },
  { id: "price-suggested", text: "app.highlight", layers: ["app.surface"], min: 3, note: "preco sugerido (texto grande, >=24px)" },
  { id: "accent-small-text", text: "app.accent", layers: ["app.surface"], min: 4.5, note: "links/rotulos pequenos em accent" },
  { id: "accent-soft-chip", text: "app.accent", layers: ["app.surface", "app.accent-soft"], min: 4.5, note: "chip de delta (accent sobre accent-soft)" },
  { id: "band-title", text: "app.text", layers: ["app.brand-band-scrim"], min: 4.5, note: "titulo sobre a faixa com fundo da marca" },
  { id: "band-muted", text: "app.text-muted", layers: ["app.brand-band-scrim"], min: 4.5, note: "texto secundario sobre a faixa da marca" },
  { id: "body-on-canvas", text: "app.text-muted", layers: ["app.bg"], min: 4.5, note: "texto secundario no canvas" },
];

export function evaluate(tokens) {
  const rows = [];
  for (const theme of ["light", "dark"]) {
    const backdrops = {
      canvas: resolveSemantic(tokens, theme, "app.bg"),
      surface: resolveSemantic(tokens, theme, "app.surface"),
      "surface-muted": resolveSemantic(tokens, theme, "app.surface-muted"),
      accent: resolveSemantic(tokens, theme, "app.accent"),
      ...PHOTO_EXTREMES,
    };
    for (const pair of pairs) {
      const text = parseColor(resolveSemantic(tokens, theme, pair.text));
      const isGlass = pair.layers.some((layer) => layer === "app.glass-bg" || layer.startsWith("app.glass-premium-"));
      const isBand = pair.layers.includes("app.brand-band-scrim");
      const candidates = isBand ? BRAND_IMAGE_EXTREMES_BY_THEME[theme] : isGlass ? backdrops : { solido: "#000000" };
      let worst = { ratio: Infinity, backdrop: "" };
      for (const [backdropName, backdropValue] of Object.entries(candidates)) {
        let color = parseColor(backdropValue);
        for (const layer of pair.layers) {
          color = composite(parseColor(resolveSemantic(tokens, theme, layer)), color);
        }
        const ratio = contrast(composite(text, color), color);
        if (ratio < worst.ratio) worst = { ratio, backdrop: backdropName };
      }
      rows.push({
        theme,
        id: pair.id,
        note: pair.note,
        min: pair.min,
        ratio: worst.ratio,
        backdrop: worst.backdrop,
        pass: worst.ratio >= pair.min,
      });
    }
  }
  return rows;
}

function runCli() {
  const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
  const rows = evaluate(tokens);
  for (const row of rows) {
    const status = row.pass ? "OK  " : "FAIL";
    console.log(
      `[design:contrast] ${status} ${row.theme.padEnd(5)} ${row.id.padEnd(20)} ${row.ratio.toFixed(2).padStart(5)}:1 (min ${row.min}) pior fundo=${row.backdrop} - ${row.note}`,
    );
  }
  const failures = rows.filter((row) => !row.pass);
  if (process.argv.includes("--check") && failures.length) {
    console.error(`[design:contrast] ${failures.length} par(es) abaixo do minimo WCAG AA.`);
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) runCli();
