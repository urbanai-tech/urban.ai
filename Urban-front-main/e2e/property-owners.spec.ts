import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { acceptCookieConsent, gotoHydrated } from './test-helpers';
import { CONSENT, OWNER, json, mockApp, properties, user } from './fixtures/owner-report.fixture';

/**
 * Cadastro de proprietários e relatório mensal no app do anfitrião (ADR 0027), API mockada.
 * Cobre: cadastro com declaração de base legal obrigatória, vínculo de imóveis, pré-visualização,
 * copiar link (token só na resposta), revogar, enviar por e-mail com confirmação, remover,
 * erros da API, axe e o export CSV do portfólio.
 */

test.describe('proprietários e relatório mensal (anfitrião)', () => {
  test('cadastro exige a declaração de base legal e envia versão e imóveis escolhidos', async ({ page }) => {
    const calls = await mockApp(page);
    await gotoHydrated(page, '/proprietarios');

    await expect(page.getByRole('heading', { name: 'Ninguém recebe o relatório ainda' })).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar proprietário' }).click();

    const form = page.getByRole('form', { name: 'Novo proprietário' });
    await expect(form.getByTestId('owner-consent-text')).toContainText('base legal');
    await form.getByLabel('Nome', { exact: true }).fill('Maria Souza');
    await form.getByLabel('E-mail', { exact: true }).fill('Maria@Example.com');
    await form.getByLabel('Studio Paulista').check();

    // Sem a declaração marcada nada é enviado.
    await form.getByRole('button', { name: 'Cadastrar proprietário' }).click();
    await expect(form.getByRole('alert')).toContainText('Confirme a declaração de base legal');
    expect(calls.created).toHaveLength(0);

    await form.getByLabel(/Declaro que sim/).check();
    await form.getByRole('button', { name: 'Cadastrar proprietário' }).click();

    await expect.poll(() => calls.created[0]).toEqual({
      name: 'Maria Souza',
      email: 'maria@example.com',
      propertyIds: ['addr-1'],
      monthlyReportEnabled: true,
      consentAccepted: true,
      consentVersion: CONSENT.version,
    });
    await expect(page.getByRole('heading', { level: 2, name: 'Maria Souza' })).toBeVisible();
    await expect(page.getByText('Envio mensal ligado')).toBeVisible();
  });

  test('valida nome, e-mail e imóvel antes de enviar', async ({ page }) => {
    const calls = await mockApp(page);
    await gotoHydrated(page, '/proprietarios');
    await page.getByRole('button', { name: 'Adicionar proprietário' }).click();
    const form = page.getByRole('form', { name: 'Novo proprietário' });

    await form.getByRole('button', { name: 'Cadastrar proprietário' }).click();
    await expect(form.getByRole('alert')).toContainText('Informe o nome');
    await form.getByLabel('Nome', { exact: true }).fill('Maria');
    await form.getByLabel('E-mail', { exact: true }).fill('sem-arroba');
    await form.getByRole('button', { name: 'Cadastrar proprietário' }).click();
    await expect(form.getByRole('alert')).toContainText('e-mail válido');
    await form.getByLabel('E-mail', { exact: true }).fill('maria@example.com');
    await form.getByRole('button', { name: 'Cadastrar proprietário' }).click();
    await expect(form.getByRole('alert')).toContainText('ao menos um imóvel');
    expect(calls.created).toHaveLength(0);
  });

  test('imóvel de outra conta (404 da API) aparece como erro e nada é cadastrado', async ({ page }) => {
    const calls = await mockApp(page, { createStatus: 404 });
    await gotoHydrated(page, '/proprietarios');
    await page.getByRole('button', { name: 'Adicionar proprietário' }).click();
    const form = page.getByRole('form', { name: 'Novo proprietário' });
    await form.getByLabel('Nome', { exact: true }).fill('Maria Souza');
    await form.getByLabel('E-mail', { exact: true }).fill('maria@example.com');
    await form.getByLabel('Loft Pinheiros').check();
    await form.getByLabel(/Declaro que sim/).check();
    await form.getByRole('button', { name: 'Cadastrar proprietário' }).click();
    await expect(form.getByRole('alert')).toContainText(/não encontramos|Imóvel não encontrado/i);
    expect(calls.created).toHaveLength(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Maria Souza' })).toHaveCount(0);
  });

  test('pré-visualiza o relatório dizendo "Sem dado" quando não há resultado registrado', async ({ page }) => {
    await mockApp(page, { owners: [OWNER] });
    await gotoHydrated(page, '/proprietarios');

    await page.getByRole('button', { name: 'Pré-visualizar' }).click();
    const preview = page.getByRole('region', { name: /Pré-visualização do relatório/ });
    await expect(preview.getByTestId('owner-report-headline')).toContainText('ainda não há resultado registrado');
    expect(await preview.getByText('Sem dado', { exact: true }).count()).toBeGreaterThanOrEqual(3);
    await expect(preview).not.toContainText(/R\$\s*0(?!\d)/);
    await preview.getByRole('button', { name: 'Fechar' }).click();
    await expect(preview).toHaveCount(0);
  });

  test('copiar link emite um link novo, mostra onde copiar e o histórico permite revogar', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const calls = await mockApp(page, { owners: [OWNER] });
    await gotoHydrated(page, '/proprietarios');

    await page.getByRole('button', { name: 'Copiar link' }).click();
    const box = page.getByRole('status').filter({ hasText: 'Link do relatório de' });
    await expect(box.getByRole('textbox')).toHaveValue('https://app.myurbanai.com/relatorio/TOKENxyz.ASSINATURA');
    expect(calls.links[0]).toContain('/property-owners/owner-1/reports/');

    await page.getByRole('button', { name: 'Ver histórico e links' }).click();
    const history = page.getByRole('list', { name: /Histórico de relatórios de Maria Souza/ });
    await expect(history).toContainText('Enviado');
    await expect(history).toContainText('aberto 2x');
    await expect(history.getByText('Revogado')).toBeVisible();
    await history.getByRole('button', { name: 'Revogar' }).click();
    await expect.poll(() => calls.revokedOne.length).toBe(1);
    expect(calls.revokedOne[0]).toContain('/property-owners/owner-1/links/link-1/revoke');
  });

  test('revogar todos os links e remover o proprietário pedem confirmação', async ({ page }) => {
    const calls = await mockApp(page, { owners: [OWNER] });
    await gotoHydrated(page, '/proprietarios');

    await page.getByRole('button', { name: 'Revogar todos os links' }).first().click();
    let dialog = page.getByRole('dialog', { name: 'Revogar todos os links?' });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    expect(calls.revokedAll).toBe(0);
    await page.getByRole('button', { name: 'Revogar todos os links' }).first().click();
    dialog = page.getByRole('dialog', { name: 'Revogar todos os links?' });
    await dialog.getByRole('button', { name: 'Revogar links' }).click();
    await expect.poll(() => calls.revokedAll).toBe(1);

    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    dialog = page.getByRole('dialog', { name: /Remover Maria Souza/ });
    await dialog.getByRole('button', { name: 'Remover proprietário' }).click();
    await expect.poll(() => calls.deleted).toEqual(['owner-1']);
    await expect(page.getByRole('heading', { name: 'Ninguém recebe o relatório ainda' })).toBeVisible();
  });

  test('enviar por e-mail confirma antes e mostra o aviso quando o envio está desligado', async ({ page }) => {
    const calls = await mockApp(page, { owners: [OWNER] });
    await gotoHydrated(page, '/proprietarios');

    await page.getByRole('button', { name: 'Enviar por e-mail' }).click();
    const dialog = page.getByRole('dialog', { name: 'Enviar o relatório por e-mail?' });
    await expect(dialog).toContainText('maria@example.com');
    await dialog.getByRole('button', { name: 'Enviar agora' }).click();
    await expect.poll(() => calls.sends.length).toBe(1);
    await expect(page.getByRole('alert').filter({ hasText: 'ainda não está ativo neste ambiente' })).toBeVisible();
  });

  test('proprietário que se descadastrou não pode receber envio do anfitrião', async ({ page }) => {
    await mockApp(page, { owners: [{ ...OWNER, unsubscribed: true, monthlyReportEnabled: false }] });
    await gotoHydrated(page, '/proprietarios');
    await expect(page.getByText('Descadastrado pelo proprietário')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar por e-mail' })).toBeDisabled();
  });

  test('editar sem trocar o e-mail não pede nova declaração; trocar o e-mail pede', async ({ page }) => {
    const calls = await mockApp(page, { owners: [OWNER] });
    await gotoHydrated(page, '/proprietarios');
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    const form = page.getByRole('form', { name: 'Editar proprietário' });
    await expect(form.getByTestId('owner-consent-text')).toHaveCount(0);
    await form.getByLabel('Nome', { exact: true }).fill('Maria S. Souza');
    await form.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect.poll(() => calls.updated[0]?.body).toMatchObject({ name: 'Maria S. Souza', email: 'maria@example.com' });
    expect(calls.updated[0].body).not.toHaveProperty('consentAccepted');

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    const again = page.getByRole('form', { name: 'Editar proprietário' });
    await again.getByLabel('E-mail', { exact: true }).fill('novo@example.com');
    await expect(again.getByTestId('owner-consent-text')).toBeVisible();
    await again.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(again.getByRole('alert')).toContainText('Confirme a declaração');
    expect(calls.updated).toHaveLength(1);
  });

  test('sem violações críticas de acessibilidade (axe): lista, formulário e pré-visualização', async ({ page }) => {
    await mockApp(page, { owners: [OWNER] });
    await gotoHydrated(page, '/proprietarios');
    await expect(page.getByRole('heading', { level: 2, name: 'Maria Souza' })).toBeVisible();
    await expectNoCriticalA11yViolations(page, 'main');

    await page.getByRole('button', { name: 'Pré-visualizar' }).click();
    await expect(page.getByTestId('owner-report-headline')).toBeVisible();
    await page.getByRole('button', { name: 'Ver histórico e links' }).click();
    await expectNoCriticalA11yViolations(page, 'main');

    await page.getByRole('button', { name: 'Adicionar proprietário' }).click();
    await expect(page.getByRole('form', { name: 'Novo proprietário' })).toBeVisible();
    await expectNoCriticalA11yViolations(page, 'main');
  });
});

test.describe('export CSV do portfólio', () => {
  test('baixa o calendário carregado, com texto livre neutralizado contra fórmula de planilha', async ({ page }) => {
    await acceptCookieConsent(page);
    await page.route('**/auth/me', (route) => json(route, user));
    await page.route('**/auth/profile**', (route) => json(route, user));
    await page.route('**/payments/getSubscription', (route) => json(route, { id: 'sub_e2e', status: 'active', plan: 'alpha' }));
    await page.route('**/payments/listings-quota', (route) => json(route, { contratados: 2, ativos: 2, podeAdicionar: true }));
    await page.route('**/ask/usage', (route) =>
      json(route, { used: 0, quota: 20, hardCap: 30, canUse: true, plan: 'profissional', reason: null }),
    );
    await page.route('**/propriedades/dropdown/list', (route) => json(route, properties));
    await page.route('**/portfolio/calendar**', (route) =>
      json(route, {
        properties: [
          {
            propertyId: 'addr-1',
            name: '=HYPERLINK("http://x")',
            thumbnail: null,
            days: [
              { date: '2026-11-10', sugestao: 260, atual: 200, base: 190, evento: { id: 'e1', nome: 'Show X', impacto: 'alta' } },
              { date: '2026-11-11', sugestao: null, atual: 200, evento: null },
            ],
          },
        ],
        opportunities: [],
        actionRuns: [],
      }),
    );
    await page.route('**/portfolio/opportunities**', (route) => json(route, { opportunities: [], summary: null }));
    await page.route('**/portfolio/action-runs**', (route) => json(route, []));

    await gotoHydrated(page, '/portfolio');
    const exportButton = page.getByRole('button', { name: 'Exportar CSV' });
    await expect(exportButton).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    expect(download.suggestedFilename()).toMatch(/^portfolio-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);

    const content = readFileSync((await download.path()) as string, 'utf8').replace(/^﻿/, '');
    const lines = content.trimEnd().split('\r\n');
    expect(lines[0]).toBe('"imovel","data","preco_atual","preco_sugerido","preco_base","diferenca_sugerido_atual","evento","impacto_evento"');
    expect(lines[1]).toBe(`"'=HYPERLINK(""http://x"")","2026-11-10","200","260","190","60","Show X","alta"`);
    expect(lines[2]).toBe(`"'=HYPERLINK(""http://x"")","2026-11-11","200","","","","",""`);
  });
});
