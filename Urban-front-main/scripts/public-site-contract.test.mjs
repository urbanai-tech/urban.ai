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
  assert.match(content, /staging\.myurbanai\.com/);
  assert.match(content, /urban-ai-frontend-staging-staging\.up\.railway\.app/);
  assert.match(content, /isStagingHost\(host\)[\s\S]*NextResponse\.rewrite\(new URL\("\/landing"/);
  assert.match(content, /isStagingHost\(host\)[\s\S]*withNoIndex/);
});

test('rota de lançamento não importa nem renderiza waitlist', async () => {
  const content = await source('launch');
  assert.doesNotMatch(content, /Waitlist(Form|Signup)|lista de espera|acesso antecipado/i);
  assert.match(content, /Urban AI disponível/);
});

test('cadastro real não é substituído pelo modo de pré-lançamento', async () => {
  const content = await source('create');
  assert.doesNotMatch(content, /usePrelaunch|WaitlistSignup|AuthFlowShell/);
  assert.match(content, /mode !== "registered"/);
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
