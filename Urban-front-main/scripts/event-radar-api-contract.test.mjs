import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const adminSource = readFileSync(
  resolve(process.cwd(), "src/app/service/api/admin.ts"),
  "utf8",
);
const radarSource = readFileSync(
  resolve(process.cwd(), "src/app/service/api/event-radar.ts"),
  "utf8",
);

test("admin preserva a fachada pública do Event Radar", () => {
  assert.match(adminSource, /export \* from ["']\.\/event-radar["'];/);
  assert.doesNotMatch(adminSource, /function fetchAdminEventRadar\b/);
  assert.doesNotMatch(adminSource, /interface AdminEventRadarEvent\b/);
});

test("módulo dedicado mantém todos os exports consumidos", () => {
  const expectedExports = [
    "AdminEventsAnalytics",
    "EventListItem",
    "EventsListResponse",
    "AdminEventRadarEvent",
    "AdminEventRadarResponse",
    "AdminEventRadarHeatmapResponse",
    "AdminEventRadarBlindSpotsResponse",
    "AdminEventRadarDetail",
    "fetchAdminEvents",
    "fetchAdminEventsList",
    "fetchAdminEventRadar",
    "fetchAdminEventRadarHeatmap",
    "fetchAdminEventRadarBlindSpots",
    "fetchAdminEventRadarDetail",
    "recomputeAdminEventIntelligence",
  ];

  for (const symbol of expectedExports) {
    assert.match(
      radarSource,
      new RegExp(`export\\s+(?:async\\s+)?(?:interface|type|const|function)\\s+${symbol}\\b`),
      `${symbol} deve continuar exportado`,
    );
  }
});

test("contrato HTTP preserva verbos e URLs do radar", () => {
  const contracts = [
    /api\.get<AdminEventsAnalytics>\(['"]\/admin\/events\/analytics['"]\)/,
    /\.get<EventsListResponse>\(['"]\/admin\/events\/list['"],\s*\{/,
    /api\.get<AdminEventRadarResponse>\(['"]\/admin\/events\/intelligence['"],\s*\{/,
    /api\.get<AdminEventRadarHeatmapResponse>\(['"]\/admin\/events\/heatmap['"],\s*\{/,
    /api\.get<AdminEventRadarBlindSpotsResponse>\(['"]\/admin\/events\/blind-spots['"],\s*\{/,
    /api\.get<AdminEventRadarDetail>\(`\/admin\/events\/\$\{eventId\}\/intelligence`\)/,
    /\.get<AdminEventRadarPropertyImpact\[]>\(`\/admin\/events\/\$\{eventId\}\/property-impact`\)/,
    /\.post<\{ ok: boolean; jobRunId\?: string \| null \}>\(\s*`\/admin\/events\/\$\{eventId\}\/recompute-intelligence`/,
  ];

  for (const contract of contracts) {
    assert.match(radarSource, contract);
  }
});

test("parâmetros e defaults do client permanecem compatíveis", () => {
  assert.match(radarSource, /params:\s*filters/);
  assert.match(radarSource, /params:\s*\{ \.\.\.params, metric \}/);
  assert.match(radarSource, /page:\s*params\.page \?\? 1/);
  assert.match(radarSource, /limit:\s*params\.limit \?\? 50/);
  assert.match(radarSource, /scope:\s*params\.scope \?\? ['"]in['"]/);
  assert.match(radarSource, /upcoming:\s*params\.upcoming \? ['"]true['"] : undefined/);
});

test("fallback continua restrito aos erros contratuais previstos", () => {
  assert.match(radarSource, /if \(!enableContractFallback\) return false/);
  assert.match(radarSource, /status === 404 \|\| status === 501/);
  assert.match(radarSource, /message === ['"]Network Error['"] \|\| code === ['"]ERR_NETWORK['"]/);
});
