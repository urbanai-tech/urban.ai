const { chromium } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const APP_URL = process.env.E2E_BASE_URL || 'https://app.myurbanai.com';
const API_URL = process.env.E2E_API_URL || 'https://urbanai-production-85fd.up.railway.app';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const MODE = process.env.E2E_AUDIT_MODE || 'all';

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputDir = path.resolve(__dirname, '..', '..', 'docs', 'e2e-reports', stamp);

const adminRoutes = [
  { path: '/admin', feature: 'Admin home', weight: 2 },
  { path: '/admin/dashboard', feature: 'Executive dashboard', weight: 3, api: ['/admin/dashboard-summary'] },
  { path: '/admin/users', feature: 'Users and roles', weight: 3, api: ['/admin/users'] },
  { path: '/admin/alpha', feature: 'Alpha ops', weight: 3, api: ['/admin/alpha/dashboard', '/admin/alpha/recommendations'] },
  { path: '/admin/roi', feature: 'Admin ROI', weight: 3, api: ['/admin/roi'] },
  { path: '/admin/audit-logs', feature: 'Audit logs', weight: 2, api: ['/admin/audit-logs'] },
  { path: '/admin/contacts', feature: 'Contact inbox', weight: 2, api: ['/admin/contact-submissions'] },
  { path: '/admin/waitlist', feature: 'Waitlist ops', weight: 2, api: ['/admin/waitlist', '/admin/waitlist/stats'] },
  { path: '/admin/events', feature: 'Events inventory', weight: 3, api: ['/admin/events/analytics', '/admin/events/list'] },
  { path: '/admin/events/new', feature: 'Manual event creation', weight: 2 },
  { path: '/admin/events/import', feature: 'Event CSV import', weight: 2 },
  { path: '/admin/collectors-health', feature: 'Collectors health', weight: 3, api: ['/admin/events/collectors-health'] },
  { path: '/admin/jobs', feature: 'Admin jobs', weight: 3, api: ['/admin/jobs/runs'] },
  { path: '/admin/coverage', feature: 'Coverage regions', weight: 2, api: ['/admin/coverage', '/admin/coverage/stats'] },
  { path: '/admin/finance', feature: 'Finance', weight: 2, api: ['/admin/finance/overview', '/admin/finance/costs'] },
  { path: '/admin/pricing-config', feature: 'Pricing config', weight: 2, api: ['/admin/plans-config', '/admin/stripe/sync-check'] },
  { path: '/admin/stays', feature: 'Stays admin health', weight: 2, api: ['/admin/stays/health'] },
  { path: '/admin/funnel', feature: 'Product funnel', weight: 2, api: ['/admin/funnel'] },
  { path: '/admin/quality', feature: 'Pricing quality', weight: 3, api: ['/admin/pricing/quality', '/admin/occupancy/coverage'] },
];

const hostRoutes = [
  { path: '/', feature: 'Login entry', weight: 2 },
  { path: '/post-login', feature: 'Post-login router', weight: 2 },
  { path: '/dashboard', feature: 'Host dashboard', weight: 4, api: ['/propriedades/dropdown/list'] },
  { path: '/onboarding', feature: 'Onboarding', weight: 3 },
  { path: '/onboarding/payment/price', feature: 'Onboarding pricing step', weight: 2 },
  { path: '/plans', feature: 'Plan selection', weight: 2, api: ['/payments/getSubscription'] },
  { path: '/plans/v2', feature: 'Plan selection alias', weight: 1 },
  { path: '/my-plan', feature: 'My plan', weight: 3, api: ['/payments/getSubscription'] },
  { path: '/my-roi', feature: 'Host ROI', weight: 4, api: ['/roi/me'] },
  { path: '/settings/integrations', feature: 'Stays integrations', weight: 3, api: ['/stays/listings'] },
  { path: '/event-log', feature: 'Event log', weight: 1 },
];

const visualErrorPatterns = [
  /Application error/i,
  /Unhandled Runtime Error/i,
  /Internal Server Error/i,
  /\b404\b/i,
  /\b500\b/i,
  /Acesso negado/i,
  /Forbidden/i,
  /Network Error/i,
  /Erro ao carregar/i,
  /Erro ao buscar/i,
  /Faça login novamente/i,
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function apiLogin(request) {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD before running the audit.');
  }
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email: EMAIL, password: sha256(PASSWORD) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok() || !body.accessToken) {
    throw new Error(`Login failed with status ${response.status()}`);
  }
  return body.accessToken;
}

async function probeApi(request, token, endpoint) {
  const started = Date.now();
  const response = await request.get(`${API_URL}${endpoint}`, {
    headers: { authorization: `Bearer ${token}` },
    timeout: 30000,
  }).catch((error) => ({ error }));

  if (response.error) {
    return {
      endpoint,
      ok: false,
      status: null,
      durationMs: Date.now() - started,
      issue: response.error.message,
    };
  }

  let bodySummary = null;
  const contentType = response.headers()['content-type'] || '';
  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null);
    if (Array.isArray(json)) bodySummary = `array(${json.length})`;
    else if (json && typeof json === 'object') bodySummary = `object(${Object.keys(json).slice(0, 8).join(',')})`;
  }

  return {
    endpoint,
    ok: response.status() < 400,
    status: response.status(),
    durationMs: Date.now() - started,
    bodySummary,
    issue: response.status() >= 400 ? `HTTP ${response.status()}` : null,
  };
}

async function loginViaUi(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('urban-ai-consent-v1', JSON.stringify({
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: new Date().toISOString(),
      version: 1,
    }));
  });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function auditRoute(page, route) {
  const consoleErrors = [];
  const pageErrors = [];

  const onConsole = (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleErrors.push(`${message.type()}: ${message.text().slice(0, 500)}`);
    }
  };
  const onPageError = (error) => pageErrors.push(error.message.slice(0, 500));

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const started = Date.now();
  let response = null;
  let bodyText = '';
  let title = '';
  let issue = null;

  try {
    response = await page.goto(`${APP_URL}${route.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(1500);
    title = await page.title().catch(() => '');
    bodyText = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 4000);
  } catch (error) {
    issue = error.message;
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  const matchedError = visualErrorPatterns.find((pattern) => pattern.test(bodyText));
  const status = response ? response.status() : null;
  const finalUrl = page.url();
  const redirectedToLogin = route.path !== '/' && /app\.myurbanai\.com\/?$/.test(finalUrl);

  const problems = [];
  if (issue) problems.push(issue);
  if (status && status >= 400) problems.push(`HTTP ${status}`);
  if (matchedError) problems.push(`Visible error pattern: ${matchedError}`);
  if (redirectedToLogin) problems.push('Redirected to login/home while authenticated');
  for (const err of pageErrors) problems.push(`Page error: ${err}`);
  for (const err of consoleErrors.slice(0, 5)) problems.push(`Console: ${err}`);

  return {
    path: route.path,
    feature: route.feature,
    weight: route.weight,
    status,
    finalUrl,
    title,
    durationMs: Date.now() - started,
    ok: problems.length === 0,
    problems,
  };
}

function score(results) {
  const total = results.reduce((sum, item) => sum + item.weight, 0);
  const passed = results.filter((item) => item.ok).reduce((sum, item) => sum + item.weight, 0);
  return total ? Math.round((passed / total) * 100) : 0;
}

function classifyGap(problem) {
  if (/HTTP 5|Internal Server Error|Application error|Page error/i.test(problem)) return 'P0';
  if (/HTTP 4|Forbidden|Acesso negado|Redirected/i.test(problem)) return 'P1';
  if (/Console|Network Error|Erro ao carregar|Erro ao buscar/i.test(problem)) return 'P2';
  return 'P2';
}

function moduleSummary(name, routes, apiResults) {
  const failedRoutes = routes.filter((item) => !item.ok);
  const failedApis = apiResults.filter((item) => !item.ok);
  const routeScore = score(routes);
  const apiScore = apiResults.length
    ? Math.round((apiResults.filter((item) => item.ok).length / apiResults.length) * 100)
    : 100;
  const combined = Math.round((routeScore * 0.65) + (apiScore * 0.35));
  return { name, routeScore, apiScore, combined, failedRoutes, failedApis };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Relatorio E2E Produto - ${report.generatedAt}`);
  lines.push('');
  lines.push(`Base app: ${APP_URL}`);
  lines.push(`Base API: ${API_URL}`);
  lines.push(`Usuario testado: ${EMAIL}`);
  lines.push('');
  lines.push('## Resumo executivo');
  lines.push('');
  lines.push('| Modulo | Entrega funcional estimada | Rotas UI | APIs | Problemas criticos |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const summary of report.summaries) {
    const critical = [
      ...summary.failedRoutes.flatMap((item) => item.problems),
      ...summary.failedApis.map((item) => item.issue),
    ].filter((problem) => classifyGap(problem || '') === 'P0').length;
    lines.push(`| ${summary.name} | ${summary.combined}% | ${summary.routeScore}% | ${summary.apiScore}% | ${critical} |`);
  }
  lines.push('');

  for (const summary of report.summaries) {
    lines.push(`## ${summary.name}`);
    lines.push('');
    lines.push(`Entrega funcional estimada: **${summary.combined}%**`);
    lines.push('');
    lines.push('### Problemas encontrados');
    lines.push('');
    const problems = [];
    for (const route of summary.failedRoutes) {
      for (const problem of route.problems) {
        problems.push({ scope: route.path, priority: classifyGap(problem), problem });
      }
    }
    for (const api of summary.failedApis) {
      problems.push({ scope: api.endpoint, priority: classifyGap(api.issue || ''), problem: api.issue || `HTTP ${api.status}` });
    }
    if (!problems.length) {
      lines.push('- Nenhum problema bloqueante detectado nesta passada.');
    } else {
      for (const item of problems) {
        lines.push(`- **${item.priority}** \`${item.scope}\`: ${item.problem}`);
      }
    }
    lines.push('');
    lines.push('### Melhorias potenciais');
    lines.push('');
    lines.push('- Transformar esta auditoria em job CI/staging antes de cada deploy.');
    lines.push('- Separar smoke read-only de fluxos mutantes com massa de teste e rollback.');
    lines.push('- Criar seletores `data-testid` nas telas principais para testes menos frageis.');
    lines.push('- Adicionar medicao de tempo de carregamento por tela e alertas para rotas lentas.');
    lines.push('');
    lines.push('### Rotas UI');
    lines.push('');
    lines.push('| Rota | Feature | Status | Resultado | Problemas |');
    lines.push('|---|---|---:|---|---|');
    for (const route of summary.routes) {
      lines.push(`| \`${route.path}\` | ${route.feature} | ${route.status ?? '-'} | ${route.ok ? 'OK' : 'FALHA'} | ${route.problems.join('<br>') || '-'} |`);
    }
    lines.push('');
    lines.push('### APIs lidas');
    lines.push('');
    lines.push('| Endpoint | Status | Resultado | Resumo |');
    lines.push('|---|---:|---|---|');
    for (const api of summary.apis) {
      lines.push(`| \`${api.endpoint}\` | ${api.status ?? '-'} | ${api.ok ? 'OK' : 'FALHA'} | ${api.bodySummary || api.issue || '-'} |`);
    }
    lines.push('');
  }

  lines.push('## Observacoes de escopo');
  lines.push('');
  lines.push('- Esta passada evita acoes destrutivas: deletar usuario, alterar plano, apagar custo, importar CSV real ou disparar push Stays.');
  lines.push('- Fluxos mutantes devem rodar em staging ou com fixtures isoladas antes de virar gate de producao.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: APP_URL });
  const page = await context.newPage();
  const request = context.request;

  const token = await apiLogin(request);
  await loginViaUi(page);

  const adminRouteResults = [];
  const hostRouteResults = [];
  const adminApiResults = [];
  const hostApiResults = [];

  if (MODE === 'all' || MODE === 'admin') {
    for (const route of adminRoutes) {
      adminRouteResults.push(await auditRoute(page, route));
      for (const endpoint of route.api || []) {
        adminApiResults.push(await probeApi(request, token, endpoint));
      }
    }
  }

  if (MODE === 'all' || MODE === 'host') {
    for (const route of hostRoutes) {
      hostRouteResults.push(await auditRoute(page, route));
      for (const endpoint of route.api || []) {
        hostApiResults.push(await probeApi(request, token, endpoint));
      }
    }
  }

  await browser.close();

  const summaries = [];
  if (adminRouteResults.length) {
    summaries.push({
      ...moduleSummary('Admin', adminRouteResults, adminApiResults),
      routes: adminRouteResults,
      apis: adminApiResults,
    });
  }
  if (hostRouteResults.length) {
    summaries.push({
      ...moduleSummary('Anfitriao', hostRouteResults, hostApiResults),
      routes: hostRouteResults,
      apis: hostApiResults,
    });
  }

  const report = {
    generatedAt: now.toISOString(),
    appUrl: APP_URL,
    apiUrl: API_URL,
    email: EMAIL,
    summaries,
  };

  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outputDir, 'report.md'), renderMarkdown(report));
  console.log(JSON.stringify({ ok: true, outputDir, summaries: summaries.map(({ name, combined, routeScore, apiScore }) => ({ name, combined, routeScore, apiScore })) }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
});
