import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  SHARED_GZIP_BUDGET_BYTES,
  checkBundleBudget,
  measureFiles,
} from "./bundle-budget.mjs";

test("measureFiles contabiliza somente chunks JavaScript únicos", () => {
  const directory = mkdtempSync(join(tmpdir(), "urban-bundle-budget-"));
  try {
    mkdirSync(join(directory, "static", "chunks"), { recursive: true });
    writeFileSync(join(directory, "static", "chunks", "a.js"), "const value = 1;".repeat(20));
    writeFileSync(join(directory, "styles.css"), "body{}" );

    const metric = measureFiles(directory, [
      "static/chunks/a.js",
      "static/chunks/a.js",
      "styles.css",
    ]);

    assert.equal(metric.files, 1);
    assert.equal(metric.rawBytes, Buffer.byteLength("const value = 1;".repeat(20)));
    assert.ok(metric.gzipBytes > 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("checkBundleBudget aplica o limite de 180 KiB sem arredondamento", () => {
  assert.equal(
    checkBundleBudget({ shared: { gzipBytes: SHARED_GZIP_BUDGET_BYTES } }).passed,
    true,
  );
  assert.equal(
    checkBundleBudget({ shared: { gzipBytes: SHARED_GZIP_BUDGET_BYTES + 1 } }).passed,
    false,
  );
});
