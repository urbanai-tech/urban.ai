import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = new URL("../dist/", import.meta.url);
const assetsDir = new URL("assets/", distDir);
const assetsPath = fileURLToPath(assetsDir);
const html = await readFile(new URL("index.html", distDir), "utf8");
const files = (await readdir(assetsDir)).filter((file) => file.endsWith(".js"));

if (files.length === 0) {
  throw new Error("Bundle budget: nenhum arquivo JavaScript encontrado em dist/assets.");
}

const initialFiles = new Set(
  [...html.matchAll(/src="(?:\.\/|\/)assets\/([^"]+\.js)"/g)].map((match) => match[1]),
);

if (initialFiles.size === 0) {
  throw new Error("Bundle budget: entrypoint JavaScript não encontrado no dist/index.html.");
}

const measurements = await Promise.all(
  files.map(async (file) => {
    const bytes = await readFile(join(assetsPath, file));
    return {
      file,
      gzipKiB: gzipSync(bytes).byteLength / 1024,
      initial: initialFiles.has(file),
    };
  }),
);

const initialGzip = measurements
  .filter((item) => item.initial)
  .reduce((sum, item) => sum + item.gzipKiB, 0);
const largestAsync = Math.max(
  0,
  ...measurements.filter((item) => !item.initial).map((item) => item.gzipKiB),
);
const totalGzip = measurements.reduce((sum, item) => sum + item.gzipKiB, 0);

const limits = {
  initialGzipKiB: 80,
  largestAsyncGzipKiB: 380,
  totalGzipKiB: 430,
};

const failures = [];
if (initialGzip > limits.initialGzipKiB) {
  failures.push(`inicial ${initialGzip.toFixed(2)} KiB > ${limits.initialGzipKiB} KiB`);
}
if (largestAsync > limits.largestAsyncGzipKiB) {
  failures.push(`maior assíncrono ${largestAsync.toFixed(2)} KiB > ${limits.largestAsyncGzipKiB} KiB`);
}
if (totalGzip > limits.totalGzipKiB) {
  failures.push(`total ${totalGzip.toFixed(2)} KiB > ${limits.totalGzipKiB} KiB`);
}

console.log(
  `Bundle budget: inicial=${initialGzip.toFixed(2)} KiB, maior-assíncrono=${largestAsync.toFixed(2)} KiB, total=${totalGzip.toFixed(2)} KiB.`,
);

if (failures.length > 0) {
  throw new Error(`Bundle budget excedido: ${failures.join("; ")}`);
}
