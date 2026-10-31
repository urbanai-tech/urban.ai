import { expect, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { TOKEN, emptyReport, json, openPublicReport, property, report } from './fixtures/owner-report.fixture';

/**
 * Página PÚBLICA do relatório do proprietário (ADR 0027), com a API mockada.
 * Cobre: números reais x "Sem dado" (nunca zero inventado), link expirado/revogado/inválido,
 * ausência de cookies e de chamadas de sessão, noindex, impressão (PDF por CSS) e axe.
 */

test.describe('relatório do proprietário (página pública)', () => {
  test('mostra os números registrados, "Sem dado" onde não há, e só o relatório', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    let apiRequest: { url: string; method: string; cookie: string | undefined } | null = null;
    await openPublicReport(page, (route) => {
      apiRequest = { url: route.request().url(), method: route.request().method(), cookie: route.request().headers()['cookie'] };
      return json(route, report([property()]));
    });

    await expect(page.getByRole('heading', { level: 1, name: 'Setembro de 2026' })).toBeVisible();
    await expect(page.getByText('Maria Souza')).toBeVisible();
    await expect(page.getByTestId('owner-report-headline')).toContainText('todos os imóveis têm receita registrada');
    await expect(page.getByRole('heading', { level: 2, name: 'Studio Paulista' })).toBeVisible();
    await expect(page.getByText(/R\$\s*4\.500,00/).first()).toBeVisible();
    await expect(page.getByText('62,5%').first()).toBeVisible();
    // Comparação existe só para a receita; para a diária o texto explica a falta de dado.
    await expect(page.getByText(/\+R\$\s*1\.500,00 \(\+50%\) sobre R\$\s*3\.000,00 em agosto de 2026/).first()).toBeVisible();
    await expect(page.getByText(/Sem comparação: falta dado em agosto de 2026/).first()).toBeVisible();
    // Efeito confirmado e resultado pendente aparecem como o dado diz.
    await expect(page.getByText(/efeito confirmado R\$\s*200,00/)).toBeVisible();
    await expect(page.getByText('Resultado ainda não registrado')).toBeVisible();
    await expect(page.getByText('Você recebe este relatório porque')).toBeVisible();

    // Somente leitura, sem cookie e sem nenhuma chamada de sessão do anfitrião.
    expect(apiRequest).not.toBeNull();
    expect(apiRequest!.method).toBe('GET');
    expect(apiRequest!.url).toContain(`/owner-reports/public/${TOKEN}`);
    expect(apiRequest!.cookie).toBeUndefined();
    expect(requests.some((url) => /\/auth\/(me|refresh)/.test(url))).toBe(false);
  });

  test('sem resultado registrado o relatório diz isso e nunca mostra zero', async ({ page }) => {
    await openPublicReport(page, (route) => json(route, emptyReport()));

    await expect(page.getByTestId('owner-report-headline')).toContainText('ainda não há resultado registrado');
    await expect(page.getByText(/Sem resultado registrado nem calendário sincronizado/)).toBeVisible();
    // Receita, diária e ocupação: "Sem dado".
    expect(await page.getByText('Sem dado', { exact: true }).count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByText(/Sem calendário registrado ou sincronizado/)).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/R\$\s*0(?!\d)/);
    expect(text).not.toMatch(/\b0,0%/);
  });

  test('marca o mês em andamento como parcial', async ({ page }) => {
    const payload = report([property()]);
    payload.report.period.isPartial = true;
    await openPublicReport(page, (route) => json(route, payload));
    await expect(page.getByText('Mês em andamento')).toBeVisible();
  });

  test('link expirado, revogado e inválido têm mensagens próprias, sem dados', async ({ page }) => {
    await openPublicReport(page, (route) => json(route, { code: 'LINK_EXPIRED', message: 'Este link expirou.' }, 410));
    await expect(page.getByRole('heading', { level: 1, name: 'Link expirado' })).toBeVisible();
    await expect(page.getByText('Maria Souza')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);

    await page.unroute('**/owner-reports/public/**');
    await page.route('**/owner-reports/public/**', (route) => json(route, { code: 'LINK_REVOKED' }, 410));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Link revogado' })).toBeVisible();

    await page.unroute('**/owner-reports/public/**');
    await page.route('**/owner-reports/public/**', (route) => json(route, { message: 'Link inválido' }, 404));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible();
  });

  test('falha do servidor oferece tentar de novo e recupera', async ({ page }) => {
    let calls = 0;
    await openPublicReport(page, (route) => {
      calls += 1;
      return calls === 1 ? json(route, { message: 'erro' }, 503) : json(route, report([property()]));
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Não foi possível abrir agora' })).toBeVisible();
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Setembro de 2026' })).toBeVisible();
  });

  test('é noindex e não vaza o endereço como referrer', async ({ page }) => {
    await openPublicReport(page, (route) => json(route, report([property()])));
    await expect(page.getByRole('heading', { level: 1, name: 'Setembro de 2026' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  });

  test('versão para impressão: sem botão, só o relatório e logo da versão clara', async ({ page }) => {
    await openPublicReport(page, (route) => json(route, report([property()])));
    const printButton = page.getByRole('button', { name: /Imprimir ou salvar em PDF/ });
    await expect(printButton).toBeVisible();

    await page.emulateMedia({ media: 'print' });
    await expect(printButton).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Setembro de 2026' })).toBeVisible();
    const logos = await page.evaluate(() => ({
      light: getComputedStyle(document.querySelector('.urban-brand-logo--on-light') as Element).display,
      dark: getComputedStyle(document.querySelector('.urban-brand-logo--on-dark') as Element).display,
    }));
    expect(logos.light).not.toBe('none');
    expect(logos.dark).toBe('none');
    // Texto legível no papel: nada de texto claro sobre fundo branco.
    const color = await page.evaluate(() => getComputedStyle(document.querySelector('#owner-report-title') as Element).color);
    const [r, g, b] = color.match(/\d+/g)!.map(Number);
    expect(r + g + b).toBeLessThan(200);

    await page.emulateMedia({ media: 'screen' });
    await expect(printButton).toBeVisible();
  });

  test('sem violações críticas de acessibilidade (axe), com dado e sem dado', async ({ page }) => {
    await openPublicReport(page, (route) => json(route, report([property()])));
    await expect(page.getByRole('heading', { level: 1, name: 'Setembro de 2026' })).toBeVisible();
    await expectNoCriticalA11yViolations(page);

    await page.unroute('**/owner-reports/public/**');
    await page.route('**/owner-reports/public/**', (route) => json(route, emptyReport()));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('owner-report-headline')).toContainText('ainda não há resultado');
    await expectNoCriticalA11yViolations(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectNoCriticalA11yViolations(page);
  });

  test('no celular a página cabe na tela', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPublicReport(page, (route) => json(route, report([property()])));
    await expect(page.getByRole('heading', { level: 1, name: 'Setembro de 2026' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
