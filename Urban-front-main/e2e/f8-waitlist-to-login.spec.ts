import { test, expect } from '@playwright/test';

test.describe('F8 Happy Path: Waitlist -> Convite -> Magic Link -> Login', () => {
  // Ignora o teste se o ambiente não for propício para isso (ex: CI real pode não querer mockar tudo)
  
  test('Fluxo completo F8 simulado via API Mocks', async ({ page, baseURL }) => {
    // 1. Acesso à landing page e interceptação da criação na Waitlist
    await page.route('**/waitlist', async (route) => {
      if (route.request().method() === 'POST') {
        // Simula o backend retornando sucesso na entrada da waitlist
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            position: 42,
            referralCode: 'abc123xy',
            aheadOfYou: 41,
            totalSignups: 42,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/lancamento');
    
    // Verifica elementos da landing
    await expect(page.locator('text=ESGOTAR RÁPIDO')).toBeVisible();
    
    // Preenche a Waitlist
    const emailInput = page.locator('input[type="email"][id="waitlist-email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('teste.e2e@urbanai.com.br');
    
    // Clica no botão de submit do form
    const submitBtn = page.locator('button[type="submit"]:has-text("Quero acesso antecipado")');
    await submitBtn.click();
    
    // Validar a tela de sucesso ("Você é o número 42")
    await expect(page.locator('text=Você está na lista!')).toBeVisible();
    await expect(page.locator('text=42')).toBeVisible(); // position
    
    // 2. Simula o clique no Magic Link enviado por e-mail (admin convidou)
    // Interceptamos a validação do token
    await page.route('**/waitlist/invite?token=MOCK_TOKEN_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: 'teste.e2e@urbanai.com.br',
          name: 'Teste E2E',
          position: 42,
        }),
      });
    });

    // Interceptamos o registro real do usuário que ocorre ao criar a senha
    await page.route('**/auth/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'registered',
          user: { id: 'user-mock-123', email: 'teste.e2e@urbanai.com.br' }
        }),
      });
    });

    // Interceptamos o login em seguida (que ocorre automaticamente ou via redirect)
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'mocked.jwt.token'
        }),
      });
    });

    // Interceptamos o check de /auth/me para o Dashboard não dar kick
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'user-mock-123',
          email: 'teste.e2e@urbanai.com.br',
          role: 'host'
        }),
      });
    });
    
    // Intercepta dados do dashboard para evitar erro
    await page.route('**/propriedade/dropdown', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Acessa a página de aceite do magic link
    await page.goto('/waitlist/aceitar?token=MOCK_TOKEN_123');

    // Verifica que a página de ativar a conta carregou e preencheu o email
    await expect(page.locator('input[type="email"]')).toHaveValue('teste.e2e@urbanai.com.br');
    
    // Preenche senha e confirmação
    await page.locator('input[name="password"]').fill('UrbanE2E@123');
    await page.locator('input[name="confirmPassword"]').fill('UrbanE2E@123');
    
    // Submete a criação da conta
    await page.locator('button[type="submit"]:has-text("Ativar minha conta")').click();

    // 3. Verifica o redirecionamento para o dashboard
    // O sistema de auth do front (NextAuth ou JWT context) deve fazer push para /dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Calendário')).toBeVisible();
  });
});
