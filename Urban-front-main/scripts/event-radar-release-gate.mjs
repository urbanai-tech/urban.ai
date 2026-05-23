import { spawn } from 'node:child_process';
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');
const specPath = 'e2e/event-radar.spec.ts';
const playwrightCli = join(appDir, 'node_modules', '@playwright', 'test', 'cli.js');
const nextBin = join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const logDir = join(appDir, 'test-results', 'event-radar-release-gate');
const nextBuildDir = resolve(appDir, '.next');
const defaultEventRoutes = ['/events', '/events/evt-gp-sp-2026', '/event-radar', '/admin/event-radar'];

const rawArgs = process.argv.slice(2);
const hasArg = (name) => rawArgs.includes(name) || rawArgs.some((arg) => arg.startsWith(`${name}=`));
const failUsage = (message) => {
  console.error(`[gate] ${message}`);
  process.exit(2);
};
const getArg = (name, fallback) => {
  const inline = rawArgs.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    const value = inline.slice(name.length + 1);
    if (!value) failUsage(`${name} exige um valor.`);
    return value;
  }

  const index = rawArgs.indexOf(name);
  if (index < 0) return fallback;

  const value = rawArgs[index + 1];
  if (!value || value.startsWith('--')) failUsage(`${name} exige um valor.`);
  return value;
};
const getIntegerArg = (name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = getArg(name, fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    failUsage(`${name} deve ser um inteiro entre ${min} e ${max}; recebido "${raw}".`);
  }
  return value;
};
const envFlag = (value) => value === '1' || value === 'true' || value === 'yes';

const modeList = hasArg('--list');
const noServer = hasArg('--no-server') || modeList;
const host = getArg('--host', process.env.E2E_HOST || '127.0.0.1');
const requestedPort = getIntegerArg('--port', process.env.E2E_PORT || '3041', { min: 1, max: 65535 });
const portIsExplicit = hasArg('--port') || Boolean(process.env.E2E_PORT);
const timeoutMs = getIntegerArg('--timeout-ms', process.env.E2E_STARTUP_TIMEOUT_MS || '180000');
const explicitBaseURL = getArg('--base-url', process.env.E2E_BASE_URL || '');
const explicitApiURL = getArg('--api-url', process.env.E2E_API_URL || process.env.NEXT_PUBLIC_API_URL || '');
const healthPath = getArg('--health-path', process.env.E2E_HEALTH_PATH || '/favicon.ico');
const requestTimeoutMs = getIntegerArg('--request-timeout-ms', process.env.E2E_REQUEST_TIMEOUT_MS || '10000');
const defaultPlaywrightOutputDir =
  process.platform === 'win32'
    ? 'C:\\tmp\\urban-ai-event-radar-playwright'
    : join(tmpdir(), 'urban-ai-event-radar-playwright');
const playwrightOutputDir = resolve(getArg('--output', process.env.E2E_OUTPUT_DIR || defaultPlaywrightOutputDir));
const playwrightTestTimeoutMs = getIntegerArg('--test-timeout-ms', process.env.E2E_TEST_TIMEOUT_MS || '30000');
const playwrightGlobalTimeoutMs = getIntegerArg(
  '--global-timeout-ms',
  process.env.E2E_GLOBAL_TIMEOUT_MS || '180000',
);
const routePreflight = !hasArg('--skip-route-preflight');
const cleanNextBeforeStart =
  !noServer && !hasArg('--keep-next-cache') && !envFlag(process.env.E2E_KEEP_NEXT_CACHE);
const baseURLForPort = (targetPort) =>
  explicitBaseURL || `http://${host}:${targetPort}`;
const activeChildren = new Set();

function trackChild(child) {
  activeChildren.add(child);
  child.once('exit', () => activeChildren.delete(child));
  child.once('error', () => activeChildren.delete(child));
  return child;
}

async function stopActiveChildren() {
  const children = [...activeChildren];
  await Promise.all(children.map((child) => stopTree(child)));
}

let stoppingForSignal = false;
function handleTermination(signal) {
  if (stoppingForSignal) process.exit(signal === 'SIGINT' ? 130 : 143);

  stoppingForSignal = true;
  console.error(`[gate] Recebido ${signal}; encerrando processos filhos do gate.`);
  stopActiveChildren().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => handleTermination(signal));
}

function assertBaseURLMatchesOwnedServer(baseURL, targetPort) {
  if (!explicitBaseURL) return;

  try {
    const parsed = new URL(baseURL);
    const urlPort = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
    const equivalentLocalhost =
      (parsed.hostname === 'localhost' && host === '127.0.0.1') ||
      (parsed.hostname === '127.0.0.1' && host === 'localhost');

    if (urlPort !== targetPort || (parsed.hostname !== host && !equivalentLocalhost)) {
      console.error(`[gate] --base-url (${baseURL}) nao aponta para o servidor local que o runner subiria em ${host}:${targetPort}.`);
      console.error('[gate] Use --no-server com --base-url para servidor existente, ou remova --base-url no modo local.');
      process.exit(2);
    }
  } catch {
    console.error(`[gate] --base-url invalido: ${baseURL}`);
    process.exit(2);
  }
}

function assertOptionalAbsoluteURL(value, label) {
  if (!value) return;

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('protocolo deve ser http ou https');
    }
  } catch (error) {
    console.error(`[gate] ${label} invalida: ${value}`);
    console.error(`[gate] Detalhe: ${error.message}`);
    process.exit(2);
  }
}

function assertNoConditionalSkips() {
  const spec = readFileSync(join(appDir, specPath), 'utf8');
  const skipPattern = /\b(test|describe)\.skip\b|\.skip\(/;
  if (skipPattern.test(spec)) {
    console.error(`[gate] ${specPath} contem skip. Remova skips antes do release.`);
    process.exit(2);
  }
}

function assertLocalTools({ requireNext }) {
  const required = requireNext ? [playwrightCli, nextBin] : [playwrightCli];
  const missing = required.filter((path) => !existsSync(path));
  if (missing.length) {
    console.error('[gate] Dependencias locais ausentes:');
    for (const path of missing) console.error(`  - ${path}`);
    process.exit(2);
  }
}

function canBindPort(targetHost, targetPort) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once('error', () => resolvePort(false));
    server.once('listening', () => {
      server.close(() => resolvePort(true));
    });
    server.listen(targetPort, targetHost);
  });
}

async function selectPort() {
  if (await canBindPort(host, requestedPort)) return requestedPort;

  if (portIsExplicit) {
    console.error(`[gate] Porta ${host}:${requestedPort} ja esta em uso.`);
    console.error('[gate] Use --port <livre>, --base-url <url> --no-server, ou feche o Next existente.');
    process.exit(3);
  }

  for (let candidate = requestedPort + 1; candidate <= requestedPort + 60; candidate += 1) {
    if (await canBindPort(host, candidate)) {
      console.warn(`[gate] Porta ${host}:${requestedPort} ocupada; usando ${host}:${candidate}.`);
      return candidate;
    }
  }

  console.error(`[gate] Nenhuma porta livre encontrada entre ${requestedPort} e ${requestedPort + 60}.`);
  process.exit(3);
}

function assertTraceWritable() {
  const tracePath = join(appDir, '.next', 'trace');
  if (!existsSync(tracePath)) return;

  try {
    const fd = openSync(tracePath, 'a');
    closeSync(fd);
  } catch (error) {
    console.error(`[gate] .next/trace nao esta gravavel: ${error.code || error.message}`);
    console.error('[gate] Feche outros processos Next nesta workspace ou rode em CI limpo.');
    process.exit(3);
  }
}

function isPathInside(parent, child) {
  const normalizedParent = resolve(parent).toLowerCase();
  const normalizedChild = resolve(child).toLowerCase();
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent}\\`) ||
    normalizedChild.startsWith(`${normalizedParent}/`)
  );
}

function assertWritableDirectory(path, label) {
  try {
    mkdirSync(path, { recursive: true });
    const probePath = join(path, `.gate-write-test-${process.pid}`);
    const fd = openSync(probePath, 'w');
    closeSync(fd);
    rmSync(probePath, { force: true });
  } catch (error) {
    console.error(`[gate] ${label} nao esta gravavel: ${error.code || error.message}`);
    process.exit(3);
  }
}

function preparePlaywrightOutputDir() {
  assertWritableDirectory(playwrightOutputDir, 'Diretorio de output Playwright');

  if (isPathInside(appDir, playwrightOutputDir)) {
    console.warn('[gate] Aviso: output Playwright dentro da workspace pode travar em pastas sincronizadas.');
    console.warn('[gate] Prefira o default fora do OneDrive ou passe --output C:\\tmp\\urban-ai-event-radar-playwright.');
  }
}

function assertSafeNextBuildDir() {
  const expected = resolve(appDir, '.next');
  if (nextBuildDir !== expected || nextBuildDir.length <= appDir.length) {
    console.error(`[gate] Caminho .next inseguro para limpeza: ${nextBuildDir}`);
    process.exit(3);
  }
}

function cleanNextBuildDir() {
  if (!existsSync(nextBuildDir)) return;

  assertSafeNextBuildDir();
  console.log(`[gate] Limpando cache/build local do Next: ${nextBuildDir}`);

  try {
    rmSync(nextBuildDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  } catch (error) {
    console.error(`[gate] Nao foi possivel limpar .next: ${error.code || error.message}`);
    console.error('[gate] Feche processos Next/Node desta workspace e rode novamente.');
    process.exit(3);
  }
}

function runNodeTool(toolPath, toolArgs, options = {}) {
  return new Promise((resolveRun) => {
    const child = trackChild(spawn(process.execPath, [toolPath, ...toolArgs], {
      cwd: appDir,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
        PLAYWRIGHT_HTML_OPEN: 'never',
        ...options.env,
      },
      stdio: options.stdio || 'inherit',
    }));

    child.on('exit', (code, signal) => resolveRun({ code: code ?? 1, signal }));
    child.on('error', (error) => {
      console.error(`[gate] Falha ao iniciar ${toolPath}: ${error.message}`);
      resolveRun({ code: 1, signal: null });
    });
  });
}

function e2eEnv(extra = {}) {
  return {
    ...extra,
    ...(explicitApiURL ? {
      E2E_API_URL: explicitApiURL,
      NEXT_PUBLIC_API_URL: explicitApiURL,
    } : {}),
  };
}

function playwrightTestArgs() {
  return [
    'test',
    specPath,
    '--workers=1',
    '--reporter=line',
    '--output',
    playwrightOutputDir,
    '--timeout',
    String(playwrightTestTimeoutMs),
    '--global-timeout',
    String(playwrightGlobalTimeoutMs),
  ];
}

function httpGet(url, timeout = requestTimeoutMs, isOkStatus = (status) => status < 500) {
  return new Promise((resolveGet) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    fetch(url, { signal: controller.signal, redirect: 'manual' })
      .then((response) => resolveGet({ ok: isOkStatus(response.status), status: response.status }))
      .catch((error) => resolveGet({ ok: false, error: error.message }))
      .finally(() => clearTimeout(timer));
  });
}

async function waitForRouteWhileProcessRuns(url, deadlineMs, child) {
  const startedAt = Date.now();
  let lastResult = { ok: false, error: 'not started' };

  while (Date.now() - startedAt < deadlineMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return {
        ...lastResult,
        processExited: true,
        code: child.exitCode,
        signal: child.signalCode,
      };
    }

    lastResult = await httpGet(url);
    if (lastResult.ok) return lastResult;
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 2500));
  }

  return lastResult;
}

async function preflightRoutes(baseURL) {
  if (!routePreflight) return { ok: true, failures: [] };

  const root = baseURL.replace(/\/$/, '');
  const failures = [];

  console.log('[gate] Preflight das rotas Event Radar.');
  for (const route of defaultEventRoutes) {
    const url = `${root}${route}`;
    const result = await httpGet(url, Math.max(requestTimeoutMs, 30000), (status) => status >= 200 && status < 400);
    const label = result.status ? `HTTP ${result.status}` : result.error;
    console.log(`[gate] ${route}: ${label}`);

    if (!result.ok) {
      failures.push({ route, ...result });
    }
  }

  return { ok: failures.length === 0, failures };
}

function tailFile(path, maxLines = 80) {
  if (!existsSync(path)) return '';

  const content = readFileSync(path, 'utf8').split(/\r?\n/);
  return content.slice(-maxLines).join('\n').trim();
}

function printNextDiagnostics(outLog, errLog) {
  const errTail = tailFile(errLog);
  const outTail = tailFile(outLog, 40);

  if (errTail) {
    console.error(`[gate] Ultimas linhas de erro do Next:\n${errTail}`);
  }

  if (outTail) {
    console.error(`[gate] Ultimas linhas de saida do Next:\n${outTail}`);
  }

  const combined = `${errTail}\n${outTail}`;
  if (/Cannot find module|ENOENT|EPERM|ENOSPC|no space left on device|vendor-chunks|webpack[/\\]cache/i.test(combined)) {
    console.error('[gate] Diagnostico: falha parece ser cache/build local do .next, lock de arquivo ou falta de espaco em disco.');
    console.error('[gate] O runner ja limpa .next por padrao ao subir servidor proprio; se persistir, feche Node/Next, libere espaco e rode de novo.');
  }
}

function stopTree(child) {
  return new Promise((resolveStop) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolveStop();

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolveStop();
    };

    child.once('exit', finish);

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('exit', finish);
      killer.on('error', finish);
      return;
    }

    try {
      child.kill('SIGTERM');
    } catch {
      finish();
      return;
    }

    setTimeout(() => {
      if (settled) return;
      try {
        child.kill('SIGKILL');
      } catch {
        // O processo pode ja ter terminado entre o timeout e o kill final.
      }
      finish();
    }, 5000);
  });
}

async function runWithDevServer() {
  const port = await selectPort();
  const baseURL = baseURLForPort(port);
  assertBaseURLMatchesOwnedServer(baseURL, port);
  assertOptionalAbsoluteURL(explicitApiURL, '--api-url/E2E_API_URL');
  preparePlaywrightOutputDir();

  assertTraceWritable();
  if (cleanNextBeforeStart) cleanNextBuildDir();
  mkdirSync(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outLog = join(logDir, `next-dev-${port}-${stamp}.out.log`);
  const errLog = join(logDir, `next-dev-${port}-${stamp}.err.log`);
  const out = createWriteStream(outLog);
  const err = createWriteStream(errLog);

  console.log(`[gate] Subindo Next dev em ${baseURL}`);
  if (explicitApiURL) console.log(`[gate] NEXT_PUBLIC_API_URL=${explicitApiURL}`);
  console.log(`[gate] Logs: ${outLog} | ${errLog}`);

  const next = trackChild(spawn(process.execPath, [nextBin, 'dev', '-p', String(port), '-H', host], {
    cwd: appDir,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      ...e2eEnv(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }));

  next.stdout.pipe(out);
  next.stderr.pipe(err);

  const route = `${baseURL.replace(/\/$/, '')}${healthPath.startsWith('/') ? healthPath : `/${healthPath}`}`;
  const ready = await waitForRouteWhileProcessRuns(route, timeoutMs, next);
  if (!ready.ok) {
    if (ready.processExited) {
      console.error(
        `[gate] Next encerrou antes de responder em ${route}. code=${ready.code ?? 'null'} signal=${ready.signal ?? 'null'}.`,
      );
    }
    console.error(`[gate] Next nao respondeu em ${route} dentro de ${timeoutMs}ms.`);
    console.error(`[gate] Ultimo resultado: ${JSON.stringify(ready)}`);
    printNextDiagnostics(outLog, errLog);
    await stopTree(next);
    process.exit(4);
  }

  console.log(`[gate] ${route} respondeu com HTTP ${ready.status}.`);

  const preflight = await preflightRoutes(baseURL);
  if (!preflight.ok) {
    console.error(`[gate] Preflight falhou: ${JSON.stringify(preflight.failures)}`);
    printNextDiagnostics(outLog, errLog);
    await stopTree(next);
    process.exit(4);
  }

  console.log('[gate] Rodando Playwright real.');
  console.log(`[gate] Artefatos Playwright em ${playwrightOutputDir}`);
  const result = await runNodeTool(playwrightCli, playwrightTestArgs(), {
    env: e2eEnv({ E2E_BASE_URL: baseURL }),
  });

  if (result.code !== 0) printNextDiagnostics(outLog, errLog);
  await stopTree(next);
  process.exit(result.code);
}

async function main() {
  assertLocalTools({ requireNext: !noServer });
  assertNoConditionalSkips();

  if (modeList) {
    const result = await runNodeTool(playwrightCli, ['test', specPath, '--list']);
    process.exit(result.code);
  }

  if (noServer) {
    const baseURL = explicitBaseURL || process.env.E2E_BASE_URL || 'http://localhost:3000';
    assertOptionalAbsoluteURL(explicitApiURL, '--api-url/E2E_API_URL');
    console.log(`[gate] Rodando Playwright contra ${baseURL} sem iniciar Next local.`);
    if (explicitApiURL) {
      console.log('[gate] API URL informada para o processo Playwright; em app remoto, NEXT_PUBLIC_API_URL ja vem do build/deploy.');
    }
    preparePlaywrightOutputDir();
    const preflight = await preflightRoutes(baseURL);
    if (!preflight.ok) {
      console.error(`[gate] Preflight falhou: ${JSON.stringify(preflight.failures)}`);
      process.exit(4);
    }

    console.log(`[gate] Artefatos Playwright em ${playwrightOutputDir}`);
    const result = await runNodeTool(playwrightCli, playwrightTestArgs(), {
      env: e2eEnv({ E2E_BASE_URL: baseURL }),
    });
    process.exit(result.code);
  }

  await runWithDevServer();
}

main().catch(async (error) => {
  console.error(`[gate] Erro inesperado: ${error.stack || error.message}`);
  await stopActiveChildren();
  process.exit(1);
});
