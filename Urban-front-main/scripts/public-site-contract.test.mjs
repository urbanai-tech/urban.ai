import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  landing: 'src/app/(public)/landing/page.tsx',
  launch: 'src/app/(public)/lancamento/page.tsx',
  create: 'src/app/create/page.tsx',
  header: 'src/app/componentes/HeaderPublic.tsx',
  seo: 'src/app/(public)/seoContent.tsx',
  marketing: 'src/app/componentes/PublicMarketing.tsx',
  middleware: 'src/middleware.ts',
};

async function source(name) {
  return readFile(new URL(`../${files[name]}`, import.meta.url), 'utf8');
}

test('landing pública comunica produto comercial e mostra uma prévia concreta', async () => {
  const content = await source('landing');
  assert.doesNotMatch(content, /pré-lançamento|lista de espera|beta privado|acesso por convite/i);
  assert.match(content, /ProductPreview/);
  assert.match(content, /PUBLIC_SIGNUP_URL/);
});

test('staging serves the commercial landing at root without indexing', async () => {
  const content = await source('middleware');
  assert.ok(content.includes('"staging.myurbanai.com"'));
  assert.ok(content.includes('"urban-ai-frontend-staging-staging.up.railway.app"'));
  assert.match(content, /isStagingHost\(host\)[\s\S]*NextResponse\.rewrite\(new URL\("\/landing"/);
  assert.match(content, /isStagingHost\(host\)[\s\S]*withNoIndex/);
});

test('environment banner reserves space without covering public navigation', async () => {
  const [layout, marketingStyles, banner] = await Promise.all([
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/componentes/StagingBanner.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(layout, /has-environment-banner/);
  assert.match(marketingStyles, /--environment-banner-height/);
  assert.match(marketingStyles, /public-header[\s\S]*inset-block-start: var\(--environment-banner-height/);
  assert.match(banner, /whiteSpace: "nowrap"/);
});

test('public funnel uses an explicit login route on staging and production', async () => {
  const [marketing, header, create, login, middleware, authenticatedSmoke, authenticatedMobileSmoke] = await Promise.all([
    source('marketing'),
    source('header'),
    source('create'),
    readFile(new URL('../src/app/login/page.tsx', import.meta.url), 'utf8'),
    source('middleware'),
    readFile(new URL('../e2e/authenticated-smoke.spec.ts', import.meta.url), 'utf8'),
    readFile(new URL('../e2e/authenticated-mobile-smoke.spec.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(marketing, /PUBLIC_LOGIN_URL/);
  assert.match(header, /href=\{PUBLIC_LOGIN_URL\}/);
  assert.match(create, /href="\/login"/);
  assert.match(login, /export \{ default \} from "\.\.\/\(home\)\/page"/);
  assert.match(middleware, /"\/login"/);
  assert.match(authenticatedSmoke, /page\.goto\('\/login'\)/);
  assert.match(authenticatedMobileSmoke, /page\.goto\('\/login'\)/);
});

test('customer-facing authentication copy no longer presents the product as beta', async () => {
  const sources = await Promise.all([
    readFile(new URL('../src/app/(home)/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/componentes/AuthFlowShell.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/onboarding/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/waitlist/aceitar/page.tsx', import.meta.url), 'utf8'),
  ]);
  for (const content of sources) {
    assert.doesNotMatch(content, /beta privado|voltar ao pré-lançamento/i);
  }
});

test('rota de lançamento não importa nem renderiza waitlist', async () => {
  const content = await source('launch');
  assert.doesNotMatch(content, /Waitlist(Form|Signup)|lista de espera|acesso antecipado/i);
  assert.match(content, /My Urban disponível/);
});

test('cadastro respeita o modo de lançamento e mantém termos, confirmação de e-mail e analytics sem PII', async () => {
  const content = await source('create');
  assert.match(content, /usePrelaunch/);
  assert.match(content, /mode !== "registered"/);
  assert.match(content, /termsVersion: TERMS_VERSION/);
  assert.match(content, /router\.push\("\/confirm-email"\)/);
  assert.doesNotMatch(content, /confirm-email\/[`"$+]/);
  const track = content.match(/trackAnalyticsEvent\([\s\S]*?\);/)?.[0] ?? '';
  assert.doesNotMatch(track, /b(username|password|lastRegisterEmail)b|[(,{ ]email[,} ]/);
});

test('menu público comunica estado e relação com o painel móvel', async () => {
  const content = await source('header');
  assert.match(content, /aria-expanded=\{open\}/);
  assert.match(content, /aria-controls="public-mobile-menu"/);
  assert.match(content, /event\.key === "Escape"/);
});

test('guias públicos não renderizam placeholders de estudos de caso', async () => {
  const content = await source('seo');
  assert.doesNotMatch(content, /Evidencias em validação|content\.caseStudies\.map/);
  assert.match(content, /Nesta página/);
});

test('prévia de produto inclui preço, contexto e controle', async () => {
  const content = await source('marketing');
  for (const expected of ['Preço atual', 'Recomendado', 'Por que este valor?', 'Você mantém a decisão final']) {
    assert.ok(content.includes(expected), `conteúdo ausente: ${expected}`);
  }
});

test('CSS exclusivo do app fica fora do bundle global e entra em toda rota do app', async () => {
  const { readdir, stat } = await import('node:fs/promises');
  const appDir = new URL('../src/app/', import.meta.url);
  const [globals, rootLayout, publicLayout, appCss] = await Promise.all([
    readFile(new URL('globals.css', appDir), 'utf8'),
    readFile(new URL('layout.tsx', appDir), 'utf8'),
    readFile(new URL('(public)/layout.tsx', appDir), 'utf8'),
    readFile(new URL('app.css', appDir), 'utf8'),
  ]);
  // O site público não pode carregar a camada do app (render-blocking).
  assert.doesNotMatch(globals, /@import\s+["'][^"']*(host-mobile|app-flows)\.css/);
  assert.doesNotMatch(rootLayout + publicLayout, /app\.css/);
  assert.match(appCss, /host-mobile\.css/);
  assert.match(appCss, /app-flows\.css/);

  // Toda rota do app (pasta de primeiro nível com page.tsx) precisa de um
  // layout que importe app.css, senão a tela fica sem o CSS do app.
  async function hasPage(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name === 'page.tsx') return true;
      if (entry.isDirectory() && (await hasPage(new URL(`${entry.name}/`, dir)))) return true;
    }
    return false;
  }
  const missing = [];
  for (const entry of await readdir(appDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '(public)') continue;
    const dir = new URL(`${entry.name}/`, appDir);
    if (!(await hasPage(dir))) continue;
    const layoutUrl = new URL('layout.tsx', dir);
    const layout = await stat(layoutUrl).then(() => readFile(layoutUrl, 'utf8'), () => '');
    if (!/import ["']\.\.\/app\.css["']/.test(layout)) missing.push(entry.name);
  }
  assert.deepEqual(missing, []);
});

test('fontes são auto-hospedadas (o build não baixa do Google Fonts)', async () => {
  const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /next\/font\/local/);
});

test('links para o host do app nunca usam <Link> do Next (sem prefetch/RSC cross-origin para anônimos)', async () => {
  const [marketing, header, footer] = await Promise.all([source('marketing'), source('header'), readFile(new URL('../src/app/componentes/FooterPublic.tsx', import.meta.url), 'utf8')]);
  for (const [name, content] of Object.entries({ marketing, header, footer })) {
    assert.doesNotMatch(content, /<NextLink[^>]*href=\{PUBLIC_(LOGIN|SIGNUP|APP)_URL\}/, `${name}: link do app via NextLink`);
    assert.doesNotMatch(content, /<NextLink[^>]*href="\/(login|create|dashboard|onboarding)\b/, `${name}: rota exclusiva do app via NextLink`);
  }
  // URLs absolutas (host do app) caem no ramo de <a> simples.
  assert.match(marketing, /href\.startsWith\("http"\)[\s\S]{0,80}<a href=\{href\}/);
  assert.match(footer, /href\.startsWith\("http"\) \? \(\s*<a /);
});
