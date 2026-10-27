import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const SRC = resolve(process.cwd(), "src");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const files = walk(SRC).map((file) => ({
  file: relative(process.cwd(), file).replaceAll("\\", "/"),
  source: readFileSync(file, "utf8"),
}));

// Fase 2 da migração de sessão: o JWT só existe em cookies httpOnly.
test("nenhum código do front grava token de sessão em localStorage/sessionStorage", () => {
  const offenders = files.filter(({ source }) =>
    /(?:local|session)Storage\s*\.\s*setItem\(\s*["'`][^"'`]*(?:access|refresh|auth|jwt|session)[^"'`]*token/i.test(source),
  );
  assert.deepEqual(offenders.map((o) => o.file), []);
});

test("nenhum código do front lê a chave legada accessToken do storage ou monta Authorization", () => {
  const offenders = files.filter(
    ({ file, source }) =>
      !file.endsWith("lib/legacy-session-cleanup.ts") &&
      (/(?:local|session)Storage\s*\.\s*getItem\(\s*["'`](?:accessToken|refreshToken)/.test(source) ||
        /(?:local|session)Storage\s*\.\s*removeItem\(\s*["'`](?:accessToken|refreshToken)/.test(source) ||
        /Authorization["']?\s*:\s*[`"']Bearer/i.test(source)),
  );
  assert.deepEqual(offenders.map((o) => o.file), []);
});

test("a instância axios envia cookies (withCredentials) e não injeta cabeçalho de token", () => {
  const client = files.find((f) => f.file.endsWith("service/api/client.ts")).source;
  assert.match(client, /withCredentials:\s*true/);
  assert.doesNotMatch(client, /headers\.Authorization|interceptors\.request/);
});

test("login e cadastro não leem accessToken da resposta", () => {
  for (const page of ["src/app/(home)/page.tsx", "src/app/create/page.tsx"]) {
    const source = files.find((f) => f.file === page).source;
    assert.doesNotMatch(source, /accessToken/, page);
  }
});

async function loadCleanup() {
  const source = readFileSync(resolve(SRC, "app/lib/legacy-session-cleanup.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

test("a limpeza remove o token legado do localStorage e tolera storage bloqueado", async () => {
  const { purgeLegacyAuthStorage } = await loadCleanup();
  const store = new Map([
    ["accessToken", "jwt-antigo"],
    ["refreshToken", "x"],
    ["urban-ai-theme", "dark"],
  ]);
  purgeLegacyAuthStorage({ removeItem: (k) => void store.delete(k) });
  assert.equal(store.has("accessToken"), false);
  assert.equal(store.has("refreshToken"), false);
  assert.equal(store.get("urban-ai-theme"), "dark");

  assert.doesNotThrow(() =>
    purgeLegacyAuthStorage({
      removeItem() {
        throw new Error("blocked");
      },
    }),
  );
  assert.doesNotThrow(() => purgeLegacyAuthStorage(null));
});

test("Providers executa a limpeza no carregamento", () => {
  const providers = files.find((f) => f.file === "src/app/providers.tsx").source;
  assert.match(providers, /purgeLegacyAuthStorage\(\)/);
});
