import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadModule(relativePath) {
  const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputText).toString("base64")}`);
}

const install = await loadModule("src/app/service/pwaInstall.ts");
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-26T12:00:00Z");

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1",
  iphoneOld: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",
  iphone164: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
  ipadOs: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  desktopChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  desktopFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
};

const seasoned = { ...install.EMPTY_INSTALL_STATE, visitDays: ["2026-10-20", "2026-10-25"] };
const base = {
  platform: "android-chromium",
  standalone: false,
  hasDeferredPrompt: true,
  routeEligible: true,
  state: seasoned,
  now: NOW,
};

test("detectInstallPlatform separa iOS Safari, iOS com outro navegador, Android e desktop", () => {
  assert.equal(install.detectInstallPlatform({ userAgent: UA.iphoneSafari }), "ios-safari");
  assert.equal(install.detectInstallPlatform({ userAgent: UA.iphoneChrome }), "ios-other-browser");
  assert.equal(
    install.detectInstallPlatform({ userAgent: UA.ipadOs, platform: "MacIntel", maxTouchPoints: 5 }),
    "ios-safari",
  );
  assert.equal(install.detectInstallPlatform({ userAgent: UA.ipadOs, platform: "MacIntel", maxTouchPoints: 0 }), "other");
  assert.equal(install.detectInstallPlatform({ userAgent: UA.androidChrome }), "android-chromium");
  assert.equal(install.detectInstallPlatform({ userAgent: UA.desktopChrome }), "desktop-chromium");
  assert.equal(install.detectInstallPlatform({ userAgent: UA.desktopFirefox }), "other");
});

test("já instalado (standalone ou appinstalled) nunca mostra convite", () => {
  assert.deepEqual(install.decideInstallPrompt({ ...base, standalone: true }), { kind: "hidden", reason: "standalone" });
  const installed = install.recordInstalled(seasoned);
  assert.deepEqual(install.decideInstallPrompt({ ...base, state: installed }), { kind: "hidden", reason: "installed" });
});

test("só convida depois de 2 dias distintos de uso e em rotas do produto", () => {
  const fresh = install.EMPTY_INSTALL_STATE;
  assert.equal(install.decideInstallPrompt({ ...base, state: fresh }).reason, "not-enough-visits");
  const oneDay = install.recordVisit(fresh, NOW);
  assert.equal(install.recordVisit(oneDay, NOW + 60_000), oneDay, "mesmo dia não conta duas vezes");
  assert.equal(install.decideInstallPrompt({ ...base, state: oneDay }).reason, "not-enough-visits");
  const twoDays = install.recordVisit(oneDay, NOW + DAY);
  assert.equal(install.decideInstallPrompt({ ...base, state: twoDays, now: NOW + DAY }).kind, "native-prompt");
  assert.equal(install.decideInstallPrompt({ ...base, routeEligible: false }).reason, "route");
});

test("Android/desktop esperam o beforeinstallprompt; iOS Safari mostra instruções sem ele", () => {
  assert.deepEqual(install.decideInstallPrompt({ ...base, hasDeferredPrompt: false }), { kind: "hidden", reason: "waiting-prompt" });
  assert.deepEqual(install.decideInstallPrompt({ ...base, platform: "desktop-chromium" }), { kind: "native-prompt" });
  assert.deepEqual(
    install.decideInstallPrompt({ ...base, platform: "ios-safari", hasDeferredPrompt: false }),
    { kind: "ios-instructions" },
  );
  assert.equal(install.decideInstallPrompt({ ...base, platform: "ios-other-browser" }).reason, "unsupported");
  assert.equal(install.decideInstallPrompt({ ...base, platform: "other" }).reason, "unsupported");
});

test("dispensar respeita pausas crescentes (14, 45, 120 dias) e encerra na 4ª vez", () => {
  let state = seasoned;
  const expectedGaps = [14, 45, 120];
  let clock = NOW;
  for (const gap of expectedGaps) {
    state = install.recordDismissal(state, clock);
    assert.equal(install.decideInstallPrompt({ ...base, state, now: clock + 1000 }).reason, "cooldown");
    assert.equal(install.decideInstallPrompt({ ...base, state, now: clock + gap * DAY - 1 }).reason, "cooldown");
    clock += gap * DAY;
    assert.equal(install.decideInstallPrompt({ ...base, state, now: clock }).kind, "native-prompt");
  }
  state = install.recordDismissal(state, clock);
  assert.equal(state.dismissCount, install.MAX_DISMISSALS);
  assert.equal(install.nextEligibleAt(state), null);
  assert.equal(install.decideInstallPrompt({ ...base, state, now: clock + 1000 * DAY }).reason, "dismissed-forever");
});

test("estado salvo tolera lixo e limita o histórico de dias", () => {
  assert.deepEqual(install.parseInstallState(null), install.EMPTY_INSTALL_STATE);
  assert.deepEqual(install.parseInstallState("{quebrado"), install.EMPTY_INSTALL_STATE);
  const parsed = install.parseInstallState(
    JSON.stringify({ dismissCount: -3, dismissedAt: "x", visitDays: ["2026-10-01", 5, "lixo"], installed: "sim" }),
  );
  assert.deepEqual(parsed, { dismissCount: 0, dismissedAt: null, visitDays: ["2026-10-01"], installed: false });
  let state = install.EMPTY_INSTALL_STATE;
  for (let i = 0; i < 30; i += 1) state = install.recordVisit(state, NOW + i * DAY);
  assert.equal(state.visitDays.length, 14);
  assert.deepEqual(install.parseInstallState(install.serializeInstallState(state)), state);
});

test("rotas amigáveis excluem login, checkout, onboarding e páginas públicas", () => {
  for (const ok of ["/dashboard", "/properties", "/properties/123", "/notificacao", "/painel"]) {
    assert.equal(install.isInstallFriendlyRoute(ok), true, ok);
  }
  for (const no of ["/", "/login", "/plans", "/onboarding", "/create", "/precos", "/dashboardx", null, undefined]) {
    assert.equal(install.isInstallFriendlyRoute(no), false, String(no));
  }
});

test("push no iOS exige app instalado e iOS 16.4+; Android/desktop dependem da Push API", () => {
  const eligibility = (platform, standalone, userAgent, pushApiAvailable) =>
    install.getPushEligibility({ platform, standalone, userAgent, pushApiAvailable });
  assert.equal(eligibility("ios-safari", false, UA.iphoneSafari, false), "needs-install");
  assert.equal(eligibility("ios-safari", true, UA.iphoneSafari, true), "ready");
  assert.equal(eligibility("ios-safari", true, UA.iphoneSafari, false), "unsupported");
  assert.equal(eligibility("ios-safari", false, UA.iphoneOld, false), "ios-too-old");
  assert.equal(eligibility("ios-safari", true, UA.iphone164, true), "ready");
  assert.equal(eligibility("ios-other-browser", false, UA.iphoneChrome, false), "needs-install");
  assert.equal(eligibility("android-chromium", false, UA.androidChrome, true), "ready");
  assert.equal(eligibility("desktop-chromium", false, UA.desktopChrome, true), "ready");
  assert.equal(eligibility("other", false, UA.desktopFirefox, false), "unsupported");
});

test("parseIosVersion lê major/minor do user agent", () => {
  assert.deepEqual(install.parseIosVersion(UA.iphone164), { major: 16, minor: 4 });
  assert.equal(install.parseIosVersion(UA.androidChrome), null);
});
