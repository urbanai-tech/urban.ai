import assert from "node:assert/strict";
import test from "node:test";
import {
  compareDebtToBaseline,
  scanTextDebt,
  validateBaselineReduction,
} from "./design-debt-audit.mjs";

function metric(total, files = {}) {
  return { total, files };
}

const baseline = {
  metrics: {
    rawColors: metric(2, { "src/a.tsx": 2 }),
    inlineStyles: metric(1, { "src/a.tsx": 1 }),
    nonCanonicalBreakpoints: metric(1, { "src/a.tsx": 1 }),
  },
};

test("scanner separa cores, inline styles e breakpoints não canônicos", () => {
  const debt = scanTextDebt(
    'const x = <div style={{ color: "#fff", background: "rgba(0,0,0,.2)" }} />;\n' +
      '@media (max-width: 767px) {}\n@media (max-width: 820px) {}',
    "src/a.tsx",
  );
  assert.deepEqual(debt, { rawColors: 2, inlineStyles: 1, nonCanonicalBreakpoints: 1 });
});

test("self-test prova que qualquer aumento por arquivo falha o gate", () => {
  const current = {
    rawColors: metric(3, { "src/a.tsx": 3 }),
    inlineStyles: metric(1, { "src/a.tsx": 1 }),
    nonCanonicalBreakpoints: metric(1, { "src/a.tsx": 1 }),
  };
  assert.deepEqual(compareDebtToBaseline(current, baseline), [
    { metric: "rawColors", file: "src/a.tsx", actual: 3, allowed: 2 },
  ]);
});

test("arquivo novo nasce com orçamento zero e não pode esconder regressão no total", () => {
  const current = {
    rawColors: metric(2, { "src/a.tsx": 1, "src/new.tsx": 1 }),
    inlineStyles: metric(1, { "src/a.tsx": 1 }),
    nonCanonicalBreakpoints: metric(1, { "src/a.tsx": 1 }),
  };
  assert.equal(compareDebtToBaseline(current, baseline)[0].file, "src/new.tsx");
});

test("baseline só pode cair com justificativa explícita", () => {
  const reduced = {
    rawColors: metric(1, { "src/a.tsx": 1 }),
    inlineStyles: metric(1, { "src/a.tsx": 1 }),
    nonCanonicalBreakpoints: metric(1, { "src/a.tsx": 1 }),
  };
  assert.throws(() => validateBaselineReduction(reduced, baseline, "curto"), /explicit reason/);
  assert.equal(
    validateBaselineReduction(reduced, baseline, "Migrated one raw color to the canonical token."),
    "Migrated one raw color to the canonical token.",
  );
  assert.throws(
    () => validateBaselineReduction(baseline.metrics, baseline, "No debt changed in this explicit update."),
    /must reduce/,
  );
});

test("atualização de baseline nunca aceita aumento em outra categoria", () => {
  const mixed = {
    rawColors: metric(1, { "src/a.tsx": 1 }),
    inlineStyles: metric(2, { "src/a.tsx": 2 }),
    nonCanonicalBreakpoints: metric(1, { "src/a.tsx": 1 }),
  };
  assert.throws(
    () => validateBaselineReduction(mixed, baseline, "Reduced colors but introduced inline style debt."),
    /cannot move or increase debt/,
  );
});

test("redução total não pode mover dívida para arquivo novo", () => {
  const moved = {
    rawColors: metric(1, { "src/new.tsx": 1 }),
    inlineStyles: metric(1, { "src/a.tsx": 1 }),
    nonCanonicalBreakpoints: metric(1, { "src/a.tsx": 1 }),
  };
  assert.throws(
    () => validateBaselineReduction(moved, baseline, "Reduced total but attempted to move debt to a new file."),
    /cannot move or increase debt/,
  );
});
