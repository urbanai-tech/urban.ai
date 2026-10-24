import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule() {
  const source = readFileSync(resolve(process.cwd(), "src/app/lib/privacy-scrub.ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  );
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const scrub = await loadModule();

test("scrubPath redige token do reset de senha e e-mail do confirm-email", () => {
  assert.equal(scrub.scrubPath("/reset-password/abc123"), "/reset-password/[redacted]");
  assert.equal(
    scrub.scrubPath("/reset-password/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig_nature-1"),
    "/reset-password/[redacted]",
  );
  assert.equal(
    scrub.scrubPath("/confirm-email/ana%40exemplo.com"),
    "/confirm-email/[redacted]",
  );
  assert.equal(scrub.scrubPath("/confirm-email/ana@exemplo.com"), "/confirm-email/[redacted]");
});

test("scrubPath preserva rotas normais e ids numericos", () => {
  assert.equal(scrub.scrubPath("/precos"), "/precos");
  assert.equal(scrub.scrubPath("/precificacao-por-eventos-sao-paulo"), "/precificacao-por-eventos-sao-paulo");
  assert.equal(scrub.scrubPath("/properties/1606677209576351969"), "/properties/1606677209576351969");
  assert.equal(scrub.scrubPath("/"), "/");
});

test("scrubPath redige segmentos opacos (UUID/token longo) em qualquer rota", () => {
  assert.equal(
    scrub.scrubPath("/x/3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
    "/x/[redacted]",
  );
  assert.equal(scrub.scrubPath("/x/a1b2c3d4e5f6a7b8c9d0e1f2a3b4"), "/x/[redacted]");
});

test("scrubQuery redige token/e-mail/code e mantem utm/ref", () => {
  const out = scrub.scrubQuery("?token=abc&email=a%40b.com&code=123&utm_source=ig&ref=ABCD1234&x=ok");
  const params = new URLSearchParams(out);
  assert.equal(params.get("token"), "[redacted]");
  assert.equal(params.get("email"), "[redacted]");
  assert.equal(params.get("code"), "[redacted]");
  assert.equal(params.get("utm_source"), "ig");
  assert.equal(params.get("ref"), "ABCD1234");
  assert.equal(params.get("x"), "ok");
  assert.equal(scrub.scrubQuery(""), "");
});

test("scrubQuery redige valores que parecem e-mail mesmo com chave inocente", () => {
  const params = new URLSearchParams(scrub.scrubQuery("?foo=ana@exemplo.com"));
  assert.equal(params.get("foo"), "[redacted]");
});

test("scrubUrl limpa path, query e remove o fragmento", () => {
  assert.equal(
    scrub.scrubUrl("https://app.myurbanai.com/reset-password/tok123?utm_source=email#access_token=zzz"),
    "https://app.myurbanai.com/reset-password/[redacted]?utm_source=email",
  );
  assert.equal(
    scrub.scrubUrl("https://app.myurbanai.com/confirm-email/ana%40x.com"),
    "https://app.myurbanai.com/confirm-email/[redacted]",
  );
  assert.equal(scrub.scrubUrl("https://myurbanai.com/precos"), "https://myurbanai.com/precos");
});

test("scrubSentryEvent limpa request.url, breadcrumbs, transaction, headers e usuario", () => {
  const event = {
    transaction: "/reset-password/tok123",
    message: "falha em /confirm-email/ana@exemplo.com com token=segredo",
    request: {
      url: "https://app.myurbanai.com/reset-password/tok123?email=a%40b.com",
      query_string: "token=abc&utm_source=x",
      headers: { Cookie: "sid=1", Referer: "https://app.myurbanai.com/confirm-email/ana%40x.com" },
      cookies: { sid: "1" },
    },
    user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4" },
    breadcrumbs: [
      { category: "navigation", data: { from: "/confirm-email/ana%40x.com", to: "/reset-password/tok123" } },
      { category: "fetch", data: { url: "https://api.x.com/email/update-password?token=abc" } },
    ],
  };

  const out = scrub.scrubSentryEvent(event);
  const serialized = JSON.stringify(out);

  assert.equal(out.transaction, "/reset-password/[redacted]");
  assert.ok(!serialized.includes("tok123"));
  assert.ok(!serialized.includes("ana@exemplo.com"));
  assert.ok(!serialized.includes("ana%40x.com"));
  assert.ok(!serialized.includes("segredo"));
  assert.ok(!serialized.includes("a@b.com"));
  assert.ok(!serialized.includes("1.2.3.4"));
  assert.equal(out.request.headers.Cookie, "[redacted]");
  assert.equal(out.request.cookies, undefined);
  assert.equal(out.user.id, "u1");
  assert.ok(serialized.includes("utm_source=x"));
  // nao muta o original
  assert.equal(event.transaction, "/reset-password/tok123");
});

test("isAnalyticsAllowedPath so permite rotas publicas de marketing", () => {
  for (const ok of ["/", "/landing", "/precos", "/lancamento/", "/PRECOS"]) {
    assert.equal(scrub.isAnalyticsAllowedPath(ok), true, ok);
  }
  for (const no of [
    "/reset-password/tok",
    "/confirm-email/a@b.com",
    "/login",
    "/create",
    "/dashboard",
    "/admin/waitlist",
    "/waitlist/aceitar",
    "/precos/../login",
    "",
    null,
    undefined,
  ]) {
    assert.equal(scrub.isAnalyticsAllowedPath(no), false, String(no));
  }
});

test("allowlist de analytics esta em paridade com PUBLIC_ONLY_PATHS do middleware", () => {
  const middleware = readFileSync(resolve(process.cwd(), "src/middleware.ts"), "utf8");
  const block = /const PUBLIC_ONLY_PATHS = \[([\s\S]*?)\];/.exec(middleware)?.[1] ?? "";
  const publicOnly = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(publicOnly.length > 5);
  const expected = new Set(["/", ...publicOnly]);
  assert.deepEqual(new Set(scrub.ANALYTICS_PUBLIC_PATHS), expected);
});

test("toda pagina do grupo (public) esta na allowlist (evita drift silencioso)", () => {
  const dir = resolve(process.cwd(), "src/app/(public)");
  const routes = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(dir, entry.name, "page.tsx")))
    .map((entry) => `/${entry.name}`);
  assert.ok(routes.length > 5);
  for (const route of routes) {
    assert.equal(scrub.isAnalyticsAllowedPath(route), true, route);
  }
});
