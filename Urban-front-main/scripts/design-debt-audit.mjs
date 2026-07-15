import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(scriptDir, "..");
export const baselinePath = join(scriptDir, "design-debt-baseline.json");
export const canonicalBreakpointPx = new Set([767, 1180, 1181]);

const rawColorAllowlist = new Set([
  "src/app/componentes/ui/design-tokens.css",
  "src/app/componentes/ui/styles.ts",
]);

function normalizePath(path) {
  return path.split(sep).join("/");
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, acc);
    else if (/\.(css|js|jsx|ts|tsx)$/.test(entry.name)) acc.push(fullPath);
  }
  return acc;
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

export function scanTextDebt(text, relativePath) {
  const source = stripComments(text);
  const rawColors = rawColorAllowlist.has(relativePath)
    ? 0
    : countMatches(source, /(?:#[\da-fA-F]{3,8}\b|rgba?\(\s*[^)]*\))/g);
  const inlineStyles = /\.(tsx|jsx)$/.test(relativePath)
    ? countMatches(source, /\bstyle\s*=\s*\{\{/g)
    : 0;
  let nonCanonicalBreakpoints = 0;
  for (const query of source.matchAll(/(?:@media[^\{]+|matchMedia\s*\(\s*["'`][^"'`]+["'`])/g)) {
    for (const width of query[0].matchAll(/(?:min|max)-width\s*:\s*(\d+)px/g)) {
      if (!canonicalBreakpointPx.has(Number(width[1]))) nonCanonicalBreakpoints += 1;
    }
  }
  return { rawColors, inlineStyles, nonCanonicalBreakpoints };
}

export function scanDesignDebt(root = projectRoot) {
  const src = join(root, "src");
  const metrics = {
    rawColors: { total: 0, files: {} },
    inlineStyles: { total: 0, files: {} },
    nonCanonicalBreakpoints: { total: 0, files: {} },
  };
  for (const file of walk(src)) {
    const rel = normalizePath(relative(root, file));
    const counts = scanTextDebt(readFileSync(file, "utf8"), rel);
    for (const metric of Object.keys(metrics)) {
      const count = counts[metric];
      if (!count) continue;
      metrics[metric].files[rel] = count;
      metrics[metric].total += count;
    }
  }
  return metrics;
}

export function compareDebtToBaseline(current, baseline) {
  const regressions = [];
  for (const metric of Object.keys(current)) {
    const currentMetric = current[metric];
    const baselineMetric = baseline.metrics?.[metric] ?? { total: 0, files: {} };
    const files = new Set([
      ...Object.keys(currentMetric.files),
      ...Object.keys(baselineMetric.files ?? {}),
    ]);
    for (const file of files) {
      const actual = currentMetric.files[file] ?? 0;
      const allowed = baselineMetric.files?.[file] ?? 0;
      if (actual > allowed) regressions.push({ metric, file, actual, allowed });
    }
  }
  return regressions;
}

export function validateBaselineReduction(current, baseline, reason) {
  const normalizedReason = reason?.trim() ?? "";
  if (normalizedReason.length < 20) {
    throw new Error("Baseline reduction requires an explicit reason with at least 20 characters.");
  }
  const fileRegressions = compareDebtToBaseline(current, baseline);
  if (fileRegressions.length) {
    const first = fileRegressions[0];
    throw new Error(
      `Baseline cannot move or increase debt: ${first.metric} ${first.file} ${first.allowed} -> ${first.actual}`,
    );
  }
  const increased = [];
  let decreased = false;
  for (const metric of Object.keys(current)) {
    const actual = current[metric].total;
    const previous = baseline.metrics?.[metric]?.total ?? 0;
    if (actual > previous) increased.push(`${metric}: ${previous} -> ${actual}`);
    if (actual < previous) decreased = true;
  }
  if (increased.length) throw new Error(`Baseline cannot increase: ${increased.join(", ")}`);
  if (!decreased) throw new Error("Baseline update must reduce at least one measured metric.");
  return normalizedReason;
}

export function runDesignDebtAudit({ root = projectRoot, baseline = baselinePath } = {}) {
  if (!existsSync(baseline)) throw new Error(`Missing design debt baseline: ${baseline}`);
  const current = scanDesignDebt(root);
  const saved = JSON.parse(readFileSync(baseline, "utf8"));
  const regressions = compareDebtToBaseline(current, saved);
  if (regressions.length) {
    const details = regressions
      .slice(0, 40)
      .map(({ metric, file, actual, allowed }) => `- ${metric} ${file}: ${actual} > ${allowed}`)
      .join("\n");
    throw new Error(`Design debt regression detected (${regressions.length} file metric(s)):\n${details}`);
  }
  return current;
}

function totals(metrics) {
  return Object.fromEntries(Object.entries(metrics).map(([name, value]) => [name, value.total]));
}

function updateBaseline(reason) {
  const current = scanDesignDebt();
  const saved = JSON.parse(readFileSync(baselinePath, "utf8"));
  const normalizedReason = validateBaselineReduction(current, saved, reason);
  const next = {
    ...saved,
    revision: Number(saved.revision ?? 0) + 1,
    updatedAt: new Date().toISOString(),
    metrics: current,
    reductions: [
      ...(saved.reductions ?? []),
      {
        at: new Date().toISOString(),
        reason: normalizedReason,
        from: totals(saved.metrics),
        to: totals(current),
      },
    ],
  };
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  return current;
}

function printSummary(metrics, prefix = "[design:debt]") {
  console.log(
    `${prefix} raw colors=${metrics.rawColors.total}, inline styles=${metrics.inlineStyles.total}, non-canonical breakpoints=${metrics.nonCanonicalBreakpoints.total}`,
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--print-json")) {
      console.log(JSON.stringify(scanDesignDebt(), null, 2));
    } else if (process.argv.includes("--update-baseline")) {
      const reasonIndex = process.argv.indexOf("--reason");
      const reason = reasonIndex >= 0 ? process.argv[reasonIndex + 1] : process.env.DESIGN_DEBT_REASON;
      printSummary(updateBaseline(reason), "[design:debt:update]");
    } else {
      printSummary(runDesignDebtAudit());
      console.log("[design:debt] OK: no measured debt increased beyond the versioned baseline.");
    }
  } catch (error) {
    console.error(`[design:debt] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
