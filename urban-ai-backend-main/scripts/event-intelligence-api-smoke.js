#!/usr/bin/env node

const DEFAULT_LIMIT = 5;

function parseArgs(argv) {
  const args = {
    execute: false,
    eventId: process.env.EVENT_ID || null,
    from: process.env.EVENTS_FROM || null,
    to: process.env.EVENTS_TO || null,
    city: process.env.EVENTS_CITY || null,
    source: process.env.EVENTS_SOURCE || null,
    category: process.env.EVENTS_CATEGORY || null,
    scope: process.env.EVENTS_SCOPE || 'in',
    limit: Number(process.env.EVENTS_LIMIT || DEFAULT_LIMIT),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') args.execute = true;
    else if (arg === '--dry-run') args.execute = false;
    else if (arg === '--event-id' && argv[i + 1]) args.eventId = argv[++i];
    else if (arg === '--from' && argv[i + 1]) args.from = argv[++i];
    else if (arg === '--to' && argv[i + 1]) args.to = argv[++i];
    else if (arg === '--city' && argv[i + 1]) args.city = argv[++i];
    else if (arg === '--source' && argv[i + 1]) args.source = argv[++i];
    else if (arg === '--category' && argv[i + 1]) args.category = argv[++i];
    else if (arg === '--scope' && argv[i + 1]) args.scope = argv[++i];
    else if (arg === '--limit' && argv[i + 1]) args.limit = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = DEFAULT_LIMIT;
  return args;
}

function usage() {
  console.log(`Urban AI Event Intelligence API smoke

Uso:
  node scripts/event-intelligence-api-smoke.js [--dry-run]
  node scripts/event-intelligence-api-smoke.js --execute --event-id <uuid>

Env obrigatorias:
  URBAN_API_BASE_URL ou API_BASE_URL
  ADMIN_BEARER_TOKEN

Filtros opcionais:
  EVENT_ID, EVENTS_FROM, EVENTS_TO, EVENTS_CITY, EVENTS_SOURCE, EVENTS_CATEGORY,
  EVENTS_SCOPE, EVENTS_LIMIT

Notas:
  --dry-run e o padrao: valida endpoints GET e documenta o POST que seria usado.
  --execute chama POST /admin/events/:eventId/recompute-intelligence e persiste snapshots.
`);
}

function requiredEnv(name, alternatives = []) {
  const keys = [name, ...alternatives];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Env obrigatoria ausente: ${keys.join(' ou ')}`);
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function compactQuery(input) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

async function requestJson(baseUrl, path, token, options = {}) {
  const url = joinUrl(baseUrl, path);
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText;
    throw new Error(`${options.method || 'GET'} ${path} falhou: ${response.status} ${message}`);
  }

  return { status: response.status, data };
}

function listItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.events)) return payload.events;
  return [];
}

function pickEventId(args, catalog) {
  if (args.eventId) return args.eventId;
  const item = listItems(catalog)[0];
  return (
    item?.event?.id ||
    item?.id ||
    item?.eventId ||
    item?.intelligence?.eventId ||
    null
  );
}

function summarizeCatalog(catalog) {
  const items = listItems(catalog);
  return {
    contractVersion: catalog?.contractVersion ?? null,
    generatedAt: catalog?.generatedAt ?? null,
    count: items.length,
    meta: catalog?.meta ?? null,
    firstEventId: pickEventId({}, catalog),
  };
}

function summarizeDetail(detail) {
  return {
    contractVersion: detail?.contractVersion ?? null,
    generatedAt: detail?.generatedAt ?? null,
    eventId: detail?.event?.id ?? detail?.eventId ?? null,
    confidence: detail?.intelligence?.confidence ?? null,
    eventDemandScore: detail?.intelligence?.eventDemandScore ?? null,
    dataQualityFlags: detail?.intelligence?.dataQualityFlags ?? [],
  };
}

function summarizeImpact(impact) {
  const items = listItems(impact);
  return {
    contractVersion: impact?.contractVersion ?? null,
    generatedAt: impact?.generatedAt ?? null,
    count: items.length,
    stubs: impact?.stubs ?? [],
    firstPropertyId: items[0]?.propertyId ?? null,
    firstRecommendedAction: items[0]?.recommendedAction ?? null,
  };
}

function summarizeRecompute(recompute) {
  return {
    jobRunId: recompute?.jobRunId ?? null,
    runtime: recompute?.runtime ?? null,
    writes: recompute?.writes ?? recompute?.stats ?? null,
    analysesRead: recompute?.analysesRead ?? null,
    skippedAnalyses: recompute?.skippedAnalyses ?? null,
    failures: recompute?.failures ?? [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = requiredEnv('URBAN_API_BASE_URL', ['API_BASE_URL']);
  const token = requiredEnv('ADMIN_BEARER_TOKEN');
  const query = compactQuery({
    from: args.from,
    to: args.to,
    city: args.city,
    source: args.source,
    category: args.category,
    scope: args.scope,
    limit: args.limit,
  });

  const catalogPath = `/admin/events/intelligence${query ? `?${query}` : ''}`;
  const catalog = await requestJson(baseUrl, catalogPath, token);
  const eventId = pickEventId(args, catalog.data);

  if (!eventId) {
    throw new Error('Nenhum eventId encontrado. Informe --event-id ou ajuste filtros/seed de staging.');
  }

  const detail = await requestJson(baseUrl, `/admin/events/${encodeURIComponent(eventId)}/intelligence`, token);
  const impact = await requestJson(baseUrl, `/admin/events/${encodeURIComponent(eventId)}/property-impact`, token);

  const report = {
    ok: true,
    mode: args.execute ? 'execute' : 'dry-run',
    baseUrl,
    generatedAt: new Date().toISOString(),
    catalog: summarizeCatalog(catalog.data),
    selectedEventId: eventId,
    detail: summarizeDetail(detail.data),
    propertyImpact: summarizeImpact(impact.data),
    recompute: null,
    nextCommand: `node scripts/event-intelligence-api-smoke.js --execute --event-id ${eventId}`,
  };

  if (args.execute) {
    const recompute = await requestJson(
      baseUrl,
      `/admin/events/${encodeURIComponent(eventId)}/recompute-intelligence`,
      token,
      { method: 'POST' },
    );
    report.recompute = summarizeRecompute(recompute.data);
  } else {
    report.recompute = {
      skipped: true,
      reason: 'dry-run padrao nao chama POST porque o recompute persiste snapshots.',
      endpoint: `POST /admin/events/${eventId}/recompute-intelligence`,
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
