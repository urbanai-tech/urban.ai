#!/usr/bin/env node

const http = require('node:http');

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SLO_PROBE_BASE_URL,
    path: '/health/live',
    requests: 20,
    concurrency: 4,
    timeoutMs: 5000,
    maxP95Ms: 1000,
    minAvailability: 99.7,
    selfTest: false,
  };

  const valueFlags = new Map([
    ['--base-url', 'baseUrl'],
    ['--path', 'path'],
    ['--requests', 'requests'],
    ['--concurrency', 'concurrency'],
    ['--timeout-ms', 'timeoutMs'],
    ['--max-p95-ms', 'maxP95Ms'],
    ['--min-availability', 'minAvailability'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    const key = valueFlags.get(arg);
    if (!key) throw new Error(`Argumento desconhecido: ${arg}`);
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`Valor ausente para ${arg}`);
    index += 1;
    options[key] = key === 'baseUrl' || key === 'path' ? value : Number(value);
  }

  for (const key of ['requests', 'concurrency', 'timeoutMs', 'maxP95Ms', 'minAvailability']) {
    if (!Number.isFinite(options[key]) || options[key] <= 0) {
      throw new Error(`${key} deve ser um número positivo.`);
    }
  }
  options.requests = Math.floor(options.requests);
  options.concurrency = Math.min(Math.floor(options.concurrency), options.requests);
  return options;
}

function buildTarget(baseUrl, path) {
  if (!baseUrl) throw new Error('Defina --base-url ou SLO_PROBE_BASE_URL.');
  const target = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Somente HTTP(S) é permitido.');
  if (target.username || target.password) throw new Error('Credenciais na URL não são permitidas.');
  return target;
}

async function probeOnce(target, timeoutMs, token) {
  const startedAt = performance.now();
  try {
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(target, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      error: null,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'UnknownError';
    return {
      ok: false,
      status: null,
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      error: name,
    };
  }
}

async function runProbe(options) {
  const target = buildTarget(options.baseUrl, options.path);
  const token = process.env.HEALTH_READINESS_TOKEN || process.env.ENTERPRISE_GATE_HEALTH_TOKEN;
  const results = new Array(options.requests);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < options.requests) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await probeOnce(target, options.timeoutMs, token);
    }
  }
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));

  const successful = results.filter((result) => result.ok);
  const latencies = successful.map((result) => result.latencyMs);
  const availabilityPercent = (successful.length / results.length) * 100;
  const statusCounts = {};
  const errorCounts = {};
  for (const result of results) {
    const statusKey = result.status === null ? 'network' : String(result.status);
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    if (result.error) errorCounts[result.error] = (errorCounts[result.error] || 0) + 1;
  }

  const report = {
    measuredAt: new Date().toISOString(),
    target: `${target.origin}${target.pathname}`,
    samples: results.length,
    successful: successful.length,
    availabilityPercent: Math.round(availabilityPercent * 1000) / 1000,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? Math.max(...latencies) : null,
    },
    statusCounts,
    errorCounts,
    thresholds: {
      minAvailability: options.minAvailability,
      maxP95Ms: options.maxP95Ms,
    },
  };

  const passed =
    report.availabilityPercent >= options.minAvailability &&
    report.latencyMs.p95 !== null &&
    report.latencyMs.p95 <= options.maxP95Ms;
  return { report, passed };
}

async function selfTest() {
  let requestCount = 0;
  const server = http.createServer((request, response) => {
    requestCount += 1;
    if (request.url !== '/health/live') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"status":"ok"}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const { report, passed } = await runProbe({
      baseUrl: `http://127.0.0.1:${address.port}`,
      path: '/health/live',
      requests: 12,
      concurrency: 3,
      timeoutMs: 1000,
      maxP95Ms: 500,
      minAvailability: 100,
    });
    if (!passed || report.successful !== 12 || requestCount !== 12 || report.latencyMs.p95 === null) {
      throw new Error(`Self-test falhou: ${JSON.stringify(report)}`);
    }
    console.log('SLO probe self-test passed: 12/12 requests and percentile report validated.');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    await selfTest();
    return;
  }
  const { report, passed } = await runProbe(options);
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
