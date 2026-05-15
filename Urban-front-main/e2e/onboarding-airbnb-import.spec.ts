import { expect, type Page, test } from '@playwright/test';

async function mockPlans(page: Page) {
  await page.route('**/plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'starter-e2e',
          name: 'starter',
          title: 'Starter',
          price: '97',
          priceAnnual: '970',
          period: '/mes',
          features: ['1 imovel', 'Recomendacoes por eventos'],
          isActive: true,
        },
      ]),
    });
  });
}

async function mockAuthenticatedSession(page: Page) {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-e2e',
        email: 'host.e2e@urbanai.com.br',
        role: 'USER',
      }),
    });
  });
}

test.describe('Onboarding Airbnb import', () => {
  test('busca imovel individual e habilita registro com dados mockados', async ({ page }) => {
    const resolvedUrls: string[] = [];
    const quickInfoIds: string[] = [];

    await mockAuthenticatedSession(page);
    await mockPlans(page);

    await page.route('**/propriedades/dropdown/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/connect/resolve**', async (route) => {
      resolvedUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ finalUrl: 'https://www.airbnb.com.br/rooms/12345678' }),
      });
    });

    await page.route('**/propriedades/quick-info**', async (route) => {
      quickInfoIds.push(new URL(route.request().url()).searchParams.get('propertyId') ?? '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          propertyId: '12345678',
          title: 'Loft Paulista perto do metro',
          pictureUrl: 'https://example.com/loft.jpg',
          hostId: 'host-e2e',
          hostName: 'Host E2E',
          bedrooms: 1,
          beds: 1,
          bathrooms: 1,
          guests: 2,
          rating: 4.92,
          isNewListing: false,
          reviewCount: 48,
          propertyType: 'Apartamento inteiro',
          neighborhood: 'Bela Vista',
          street: 'Rua Frei Caneca',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '01307-001',
          fullAddress: 'Rua Frei Caneca, Bela Vista, Sao Paulo-SP',
          latitude: -23.557,
          longitude: -46.658,
          amenitiesCount: 12,
          amenities: ['Wi-Fi', 'Ar-condicionado'],
        }),
      });
    });

    await page.goto('/onboarding');

    await expect(page.getByRole('heading', { name: /Bem-vindo ao Urban AI/i })).toBeVisible();
    await page.getByRole('button', { name: /Come.*configura/i }).click();

    await expect(page.getByRole('heading', { name: /Conecte seus Im/i })).toBeVisible();
    await page
      .getByPlaceholder('https://www.airbnb.com.br/rooms/12345678')
      .fill('https://www.airbnb.com.br/rooms/12345678');
    await page.getByRole('button', { name: /Buscar im/i }).click();

    await expect(page.getByRole('heading', { name: /Selecionar Im/i })).toBeVisible();
    await expect(page.getByText('Apartamento inteiro')).toBeVisible();
    await expect(page.getByText(/Rua Frei Caneca/)).toBeVisible();
    await expect(page.getByRole('link', { name: /12345678/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar 1 im/i })).toBeEnabled();

    expect(resolvedUrls[0]).toContain('url=');
    expect(quickInfoIds).toEqual(['12345678']);
  });
});
