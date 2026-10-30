import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

function loadModule(path) {
  const source = readFileSync(resolve(process.cwd(), path), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

const csp = await loadModule("src/app/lib/csp.ts");
const report = await loadModule("src/app/lib/csp-report.ts");

function directive(policy, name) {
  return policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
}

test("report-only por padrão; só CSP_ENFORCE=true/1 liga o header bloqueante", () => {
  const nonce = csp.generateNonce();
  for (const value of [undefined, null, "", "false", "0", "no", "yes"]) {
    assert.equal(csp.resolveCsp({ nonce, enforce: value }).headerName, "Content-Security-Policy-Report-Only", String(value));
  }
  for (const value of ["true", "TRUE", " true ", "1"]) {
    assert.equal(csp.resolveCsp({ nonce, enforce: value }).headerName, "Content-Security-Policy", value);
  }
});

test("nonce é base64 de 128 bits, único por requisição e vai no script-src com strict-dynamic", () => {
  const nonces = new Set(Array.from({ length: 200 }, () => csp.generateNonce()));
  assert.equal(nonces.size, 200);
  for (const nonce of nonces) {
    assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
  }
  const [a, b] = [...nonces];
  const policyA = csp.buildContentSecurityPolicy({ nonce: a });
  const policyB = csp.buildContentSecurityPolicy({ nonce: b });
  assert.notEqual(policyA, policyB);
  const scriptSrc = directive(policyA, "script-src");
  assert.ok(scriptSrc.includes(`'nonce-${a}'`));
  assert.ok(scriptSrc.includes("'strict-dynamic'"));
  assert.ok(!scriptSrc.includes("'unsafe-eval'"), "unsafe-eval só em dev");
  assert.ok(directive(csp.buildContentSecurityPolicy({ nonce: a, isDev: true }), "script-src").includes("'unsafe-eval'"));
  assert.throws(() => csp.buildContentSecurityPolicy({ nonce: "x' 'unsafe-inline" }));
});

test("política mantém as origens exigidas e o endpoint de relatórios", () => {
  const policy = csp.buildContentSecurityPolicy({ nonce: csp.generateNonce() });
  const scriptSrc = directive(policy, "script-src");
  for (const origin of [
    "https://js.stripe.com",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
    "https://challenges.cloudflare.com",
  ]) {
    assert.ok(scriptSrc.includes(origin), `script-src sem ${origin}`);
  }
  const frameSrc = directive(policy, "frame-src");
  for (const origin of ["https://js.stripe.com", "https://hooks.stripe.com", "https://www.google.com", "https://challenges.cloudflare.com"]) {
    assert.ok(frameSrc.includes(origin), `frame-src sem ${origin}`);
  }
  assert.equal(directive(policy, "connect-src"), "connect-src 'self' https: wss:");
  // Origem da API (NEXT_PUBLIC_API_URL) entra explícita: cobre a API http do E2E local.
  const withApi = csp.buildContentSecurityPolicy({ nonce: csp.generateNonce(), apiUrl: "http://127.0.0.1:3001/v1" });
  assert.equal(directive(withApi, "connect-src"), "connect-src 'self' http://127.0.0.1:3001 https: wss:");
  for (const bad of ["", "not a url", "javascript:alert(1)", undefined]) {
    assert.equal(csp.originOf(bad), null, String(bad));
  }
  assert.equal(directive(policy, "img-src"), "img-src 'self' data: blob: https:");
  assert.equal(directive(policy, "style-src"), "style-src 'self' 'unsafe-inline'");
  assert.equal(directive(policy, "object-src"), "object-src 'none'");
  assert.equal(directive(policy, "base-uri"), "base-uri 'self'");
  assert.equal(directive(policy, "frame-ancestors"), "frame-ancestors 'self'");
  assert.ok(directive(policy, "form-action").includes("https://*.stripe.com"));
  assert.equal(directive(policy, "report-uri"), "report-uri /api/csp-report");
  assert.equal(directive(policy, "report-to"), "report-to csp-endpoint");
  assert.equal(csp.reportingEndpointsHeader(), 'csp-endpoint="/api/csp-report"');
});

test("middleware gera nonce por requisição, repassa x-nonce e não usa CSP estática", () => {
  const middleware = read("src/middleware.ts");
  assert.match(middleware, /generateNonce\(\)/);
  assert.match(middleware, /enforce: process\.env\.CSP_ENFORCE/);
  assert.match(middleware, /apiUrl: process\.env\.NEXT_PUBLIC_API_URL/);
  assert.match(middleware, /requestHeaders\.set\(NONCE_HEADER, nonce\)/);
  assert.match(middleware, /requestHeaders\.delete\(CSP_ENFORCE_HEADER\)/);
  assert.match(middleware, /response\.headers\.set\(csp\.headerName, csp\.value\)/);
  assert.match(middleware, /"Reporting-Endpoints"/);
  // /api fica fora do matcher: o endpoint de relatórios não passa por roteamento/auth.
  assert.match(middleware, /matcher: \["\/\(\(\?!_next\/static\|_next\/image\|favicon\.ico\|api\)\.\*\)"\]/);
  assert.doesNotMatch(read("next.config.ts"), /key: .Content-Security-Policy/);
  assert.match(read(".env.example"), /^CSP_ENFORCE=false\s*$/m);
});

test("scripts inline recebem o nonce (tema, GA4, Meta Pixel, JSON-LD)", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /\(await headers\(\)\)\.get\(NONCE_HEADER\)/);
  assert.match(layout, /<ThemeScript nonce=\{nonce\} \/>/);
  assert.match(layout, /<RootShell nonce=\{nonce\}>/);
  assert.match(read("src/app/componentes/theme/ThemeScript.tsx"), /nonce=\{nonce\}/);
  assert.match(read("src/app/lib/seo.tsx"), /nonce=\{nonce\}/);
  const analytics = read("src/app/componentes/Analytics.tsx");
  const scripts = analytics.match(/<Script[\s\S]*?>/g) ?? [];
  assert.ok(scripts.length >= 3);
  for (const tag of scripts) assert.match(tag, /nonce=\{nonce\}/, tag);
});

function reportRequest(body, contentType = "application/csp-report", extraHeaders = {}) {
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType, ...extraHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("endpoint aceita report-uri e Reporting API, devolve 204 e remove query string", async () => {
  report.resetCspReportLimiter();
  const lines = [];
  const legacy = await report.handleCspReport(
    reportRequest({
      "csp-report": {
        "document-uri": "https://myurbanai.com/reset-password/tok123?email=ana@exemplo.com#x",
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js?session=abc",
        "script-sample": "alert('ana@exemplo.com')",
        "line-number": 12,
        disposition: "report",
      },
    }),
    (line) => lines.push(line),
  );
  assert.equal(legacy.status, 204);

  const modern = await report.handleCspReport(
    reportRequest(
      [
        {
          type: "csp-violation",
          url: "https://myurbanai.com/precos?utm_source=x",
          body: {
            documentURL: "https://myurbanai.com/precos?utm_source=x",
            effectiveDirective: "script-src-elem",
            blockedURL: "inline",
            sample: "secret",
            disposition: "enforce",
          },
        },
        { type: "deprecation", body: {} },
      ],
      "application/reports+json",
    ),
    (line) => lines.push(line),
  );
  assert.equal(modern.status, 204);

  assert.equal(lines.length, 2);
  const joined = lines.join("\n");
  assert.ok(lines.every((line) => line.startsWith("[csp-report] ")));
  assert.doesNotMatch(joined, /\?|#|ana@|tok123|session=|script-sample|secret|alert/);
  const first = JSON.parse(lines[0].slice("[csp-report] ".length));
  assert.deepEqual(first, {
    directive: "script-src-elem",
    blocked: "https://evil.example/x.js",
    document: "https://myurbanai.com/reset-password/[redacted]",
    line: 12,
    disposition: "report",
  });
  assert.equal(JSON.parse(lines[1].slice("[csp-report] ".length)).blocked, "inline");
});

test("endpoint rejeita corpo grande, tipo errado e JSON inválido", async () => {
  const big = JSON.stringify({ "csp-report": { "effective-directive": "x".repeat(report.CSP_REPORT_MAX_BYTES) } });
  // Sem content-length confiável (stream): o teto é aplicado na leitura.
  assert.equal((await report.handleCspReport(reportRequest(big), () => {})).status, 413);
  assert.equal(
    (await report.handleCspReport(reportRequest("{}", "application/csp-report", { "content-length": "999999" }), () => {})).status,
    413,
  );
  assert.equal((await report.handleCspReport(reportRequest("{}", "text/plain"), () => {})).status, 415);
  assert.equal((await report.handleCspReport(reportRequest("{nope"), () => {})).status, 400);
});

test("endpoint limita o volume de log por janela", async () => {
  report.resetCspReportLimiter();
  const lines = [];
  const body = { "csp-report": { "effective-directive": "img-src", "blocked-uri": "https://x.example/a.png" } };
  for (let i = 0; i < report.CSP_REPORT_LOG_LIMIT + 15; i += 1) {
    const res = await report.handleCspReport(reportRequest(body), (line) => lines.push(line), () => 1_000);
    assert.equal(res.status, 204);
  }
  assert.equal(lines.length, report.CSP_REPORT_LOG_LIMIT);
  await report.handleCspReport(reportRequest(body), (line) => lines.push(line), () => 1_000 + report.CSP_REPORT_WINDOW_MS);
  assert.equal(lines.length, report.CSP_REPORT_LOG_LIMIT + 1);
});

test("rota /api/csp-report delega ao handler e não exige sessão", () => {
  const route = read("src/app/api/csp-report/route.ts");
  assert.match(route, /export function POST\(request: Request\)/);
  assert.match(route, /handleCspReport\(request\)/);
  assert.doesNotMatch(route, /getServerSession|getToken|auth\(/);
});
