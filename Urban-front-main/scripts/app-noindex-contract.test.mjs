import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const appDir = new URL('../src/app/', import.meta.url);
const read = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');

function listFrom(source, name) {
  const match = source.match(new RegExp(`const ${name}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\];`));
  assert.ok(match, `lista ${name} não encontrada`);
  return [...match[1].matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]);
}

// Diretórios de src/app que NÃO são rotas do app logado: grupos públicos,
// rotas de infraestrutura (og = imagem OG/Twitter, precisa abrir no domínio público) e arquivos internos.
const NOT_APP_ROUTES = new Set(['(public)', '(home)', 'api', 'og', 'componentes', 'context', 'lib', 'service', 'types']);

async function appRouteSegments() {
  const entries = await readdir(appDir, { withFileTypes: true });
  const segments = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || NOT_APP_ROUTES.has(entry.name)) continue;
    segments.push(`/${entry.name}`);
  }
  return segments.sort();
}

test('toda rota do app em src/app é redirecionada do domínio público (e logo noindex no host do app)', async () => {
  const middleware = await read('src/middleware.ts');
  const appOnly = listFrom(middleware, 'APP_ONLY_PREFIXES');
  const missing = (await appRouteSegments()).filter((seg) => !appOnly.includes(seg));
  assert.deepEqual(missing, [], `faltam em APP_ONLY_PREFIXES: ${missing.join(', ')}`);
  // Hosts do app, preview, staging e desconhecidos nunca são indexados.
  assert.match(middleware, /isAppHost\(host\)\) \{\s*return withNoIndex/);
  assert.match(middleware, /!isPublicHost\(host\)\) \{\s*return withNoIndex/);
  assert.match(middleware, /"X-Robots-Tag", "noindex, nofollow"/);
});

test('robots.txt bloqueia todas as rotas do app no domínio público', async () => {
  const robots = await read('src/app/robots.ts');
  const disallow = listFrom(robots, 'PRIVATE_DISALLOW');
  const middleware = await read('src/middleware.ts');
  const appOnly = listFrom(middleware, 'APP_ONLY_PREFIXES');
  const missing = appOnly.filter((p) => !disallow.includes(p));
  assert.deepEqual(missing, [], `faltam em PRIVATE_DISALLOW: ${missing.join(', ')}`);
  assert.ok(disallow.includes('/api'));
});

test('sitemap lista apenas páginas públicas', async () => {
  const sitemap = await read('src/app/sitemap.ts');
  const middleware = await read('src/middleware.ts');
  const appOnly = listFrom(middleware, 'APP_ONLY_PREFIXES');
  const publicOnly = new Set(['/', ...listFrom(middleware, 'PUBLIC_ONLY_PATHS')]);
  const paths = [...sitemap.matchAll(/path:\s*"(\/[^"]*)"/g)].map((m) => m[1]);
  assert.ok(paths.length > 0);
  for (const p of paths) {
    assert.ok(publicOnly.has(p), `${p} está no sitemap mas não é rota pública`);
    assert.ok(!appOnly.some((a) => p === a || p.startsWith(`${a}/`)), `${p} é rota do app`);
  }
});
