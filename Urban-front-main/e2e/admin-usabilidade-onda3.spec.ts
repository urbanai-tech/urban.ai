import { expect, test, type Page } from '@playwright/test';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * Onda 3 / PR H (UX-19): busca e filtros em /admin/users com paginação
 * preservada, sidebar agrupada e colapsável e rótulos pt-BR. 100% mockado.
 */

const user = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `u-${n}`,
  username: `Usuario ${n}`,
  email: `usuario${n}@example.com`,
  role: 'host',
  ativo: true,
  createdAt: '2026-10-01T12:00:00.000Z',
  operationMode: 'notifications',
  pricingStrategy: 'balanced',
  ...extra,
});

async function mockUsers(page: Page, requests: URLSearchParams[]) {
  await page.route('**/admin/users?**', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    const q = params.get('q');
    const pageNumber = Number(params.get('page') ?? '1');
    const data = q === 'nada' ? [] : [user(pageNumber, { email: q ? `${q}@example.com` : `usuario${pageNumber}@example.com` })];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data,
        total: q === 'nada' ? 0 : 41,
        page: pageNumber,
        limit: 20,
        totalPages: q === 'nada' ? 1 : 3,
      }),
    });
  });
}

test.describe('Admin usabilidade (UX-19)', () => {
  test('busca e filtros chegam à API e a paginação preserva o filtro', async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
    const requests: URLSearchParams[] = [];
    await mockUsers(page, requests);

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('usuario1@example.com')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '41 usuários' })).toBeVisible();

    await page.getByLabel('Buscar', { exact: true }).fill('ana');
    await page.getByRole('search').getByLabel('Papel').selectOption('host');
    await page.getByRole('search').getByLabel('Status').selectOption('false');
    await page.getByLabel('Plano').fill('profissional');
    await page.getByLabel('Criado de').fill('2026-10-01');
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page.getByText('ana@example.com')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'com os filtros aplicados' })).toBeVisible();
    const filtered = requests.at(-1)!;
    expect(Object.fromEntries(filtered)).toMatchObject({
      page: '1',
      q: 'ana',
      role: 'host',
      ativo: 'false',
      plan: 'profissional',
      createdFrom: '2026-10-01',
    });

    await page.getByRole('button', { name: /Próxima/ }).click();
    await expect(page.getByText('Página 2 de 3')).toBeVisible();
    const paged = requests.at(-1)!;
    expect(paged.get('page')).toBe('2');
    expect(paged.get('q')).toBe('ana');
    expect(paged.get('plan')).toBe('profissional');

    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(page.getByText('Página 1 de 3')).toBeVisible();
    expect(requests.at(-1)!.has('q')).toBe(false);
  });

  test('sem resultado mostra estado vazio com atalho para limpar', async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
    await mockUsers(page, []);

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('usuario1@example.com')).toBeVisible();
    await page.getByLabel('Buscar', { exact: true }).fill('nada');
    await page.getByLabel('Buscar', { exact: true }).press('Enter');

    await expect(page.getByText('Nenhum usuário encontrado')).toBeVisible();
    // O formulário continua montado (foco/valor preservados durante a consulta).
    await expect(page.getByLabel('Buscar', { exact: true })).toHaveValue('nada');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByText('usuario1@example.com')).toBeVisible();
  });

  test('papel, modo e estratégia aparecem em pt-BR sem mudar os valores da API', async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
    await mockUsers(page, []);

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Notificações')).toBeVisible();
    await expect(page.getByText('Moderada')).toBeVisible();
    await expect(page.getByLabel('Papel do usuário').first()).toHaveValue('host');
  });

  test('sidebar agrupa as rotas em 5 seções, recolhe e mantém o item ativo visível', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installLocalAuthFixture(page, 'admin');
    await mockUsers(page, []);

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: 'Seções do admin' }).first();
    for (const title of ['Operação', 'Clientes', 'Receita', 'Dados e eventos', 'Sistema']) {
      await expect(nav.getByRole('button', { name: title })).toBeVisible();
    }
    // Todas as rotas continuam presentes (28 itens: Regiões virou aba de Cobertura de eventos).
    await expect(nav.getByRole('link')).toHaveCount(28);

    const clientes = nav.getByRole('button', { name: 'Clientes' });
    await expect(clientes).toHaveAttribute('aria-expanded', 'true');
    await clientes.click();
    await expect(clientes).toHaveAttribute('aria-expanded', 'false');
    // Recolhida, mas a rota atual segue visível e marcada.
    await expect(nav.getByRole('link', { name: 'Usuários' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Contatos' })).toHaveCount(0);

    const receita = nav.getByRole('button', { name: 'Receita' });
    await receita.click();
    await expect(nav.getByRole('link', { name: 'Financeiro' })).toHaveCount(0);
    await receita.click();
    await expect(nav.getByRole('link', { name: 'Financeiro' })).toBeVisible();
  });

  test('drawer mobile abre só com a seção da rota atual expandida', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installLocalAuthFixture(page, 'admin');
    await mockUsers(page, []);

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu de operação' });
    await expect(drawer.getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('button', { name: 'Receita' })).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer.getByRole('link', { name: 'Usuários' })).toHaveAttribute('aria-current', 'page');

    await drawer.getByRole('button', { name: 'Receita' }).click();
    await expect(drawer.getByRole('link', { name: 'Financeiro' })).toBeVisible();
  });
});
