import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

export const SHARED_GZIP_BUDGET_BYTES = 180 * 1024;
export const TRACKED_ROUTES = [
  "/(home)/page",
  "/create/page",
  "/onboarding/page",
  "/properties/page",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function measureFiles(buildDir, files) {
  const uniqueJavaScript = [...new Set(files.filter((file) => file.endsWith(".js")))];
  let rawBytes = 0;
  let gzipBytes = 0;

  for (const file of uniqueJavaScript) {
    const absolutePath = resolve(buildDir, file);
    if (!existsSync(absolutePath)) {
      throw new Error(`Chunk ausente: ${file}`);
    }
    const contents = readFileSync(absolutePath);
    rawBytes += contents.byteLength;
    gzipBytes += gzipSync(contents, { level: 9 }).byteLength;
  }

  return { files: uniqueJavaScript.length, rawBytes, gzipBytes };
}

export function createBundleReport(projectDir = process.cwd()) {
  const buildDir = resolve(projectDir, ".next");
  const buildManifestPath = resolve(buildDir, "build-manifest.json");
  const appManifestPath = resolve(buildDir, "app-build-manifest.json");

  if (!existsSync(buildManifestPath) || !existsSync(appManifestPath)) {
    throw new Error("Manifestos de build não encontrados. Execute `npm run build` primeiro.");
  }

  const buildManifest = readJson(buildManifestPath);
  const appManifest = readJson(appManifestPath);
  const sharedFiles = buildManifest.rootMainFiles ?? [];

  const routes = {};
  for (const route of TRACKED_ROUTES) {
    const files = appManifest.pages?.[route];
    if (files) routes[route] = measureFiles(buildDir, files);
  }

  return {
    shared: measureFiles(buildDir, sharedFiles),
    routes,
  };
}

export function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export function checkBundleBudget(report) {
  return {
    passed: report.shared.gzipBytes <= SHARED_GZIP_BUDGET_BYTES,
    actualBytes: report.shared.gzipBytes,
    budgetBytes: SHARED_GZIP_BUDGET_BYTES,
  };
}

function printReport(report) {
  const budget = checkBundleBudget(report);
  console.log(
    `Shared JS: ${formatKiB(report.shared.rawBytes)} raw / ${formatKiB(report.shared.gzipBytes)} gzip ` +
      `(budget ${formatKiB(budget.budgetBytes)})`,
  );
  for (const [route, metric] of Object.entries(report.routes)) {
    console.log(
      `${route}: ${formatKiB(metric.rawBytes)} raw / ${formatKiB(metric.gzipBytes)} gzip`,
    );
  }
  return budget;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  try {
    const report = createBundleReport();
    const budget = printReport(report);
    if (process.argv.includes("--check") && !budget.passed) {
      console.error(
        `Bundle budget excedido: ${formatKiB(budget.actualBytes)} > ${formatKiB(budget.budgetBytes)}.`,
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
