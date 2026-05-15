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

async function mockAirbnbIndividualImport(page: Page) {
  await page.route('**/propriedades/dropdown/list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/connect/resolve**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ finalUrl: 'https://www.airbnb.com.br/rooms/12345678' }),
    });
  });

  await page.route('**/propriedades/quick-info**', async (route) => {
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
}

test.describe('Onboarding Airbnb import', () => {
  test('busca imovel individual e habilita registro com dados mockados', async ({ page }) => {
    const resolvedUrls: string[] = [];
    const quickInfoIds: string[] = [];

    await mockAuthenticatedSession(page);
    await mockPlans(page);
    await mockAirbnbIndividualImport(page);
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

  test('registra imovel importado e salva configuracao inicial do motor', async ({ page }) => {
    const registerPayloads: unknown[] = [];
    const addressPayloads: unknown[] = [];
    const processPayloads: unknown[] = [];
    const profileUpdates: Array<Record<string, unknown>> = [];

    await mockAuthenticatedSession(page);
    await mockPlans(page);
    await mockAirbnbIndividualImport(page);

    await page.route('**/connect/register', async (route) => {
      registerPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'list-registered-e2e',
            titulo: 'Loft Paulista perto do metro',
            id_do_anuncio: '12345678',
            pictureUrl: 'https://example.com/loft.jpg',
            ativo: true,
          },
        ]),
      });
    });

    await page.route('**/connect/addresses', async (route) => {
      addressPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'address-e2e' }]),
      });
    });

    await page.route('**/processos', async (route) => {
      processPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'queued' }),
      });
    });

    await page.route('**/auth/profile/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'user-e2e', profile: {} }),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/auth/profile', async (route) => {
      if (route.request().method() === 'PUT') {
        profileUpdates.push(route.request().postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'user-e2e', profile: {}, ...profileUpdates.at(-1) }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-e2e', profile: {} }),
      });
    });

    await page.goto('/onboarding');

    await page.getByRole('button', { name: /Come.*configura/i }).click();
    await page
      .getByPlaceholder('https://www.airbnb.com.br/rooms/12345678')
      .fill('https://www.airbnb.com.br/rooms/12345678');
    await page.getByRole('button', { name: /Buscar im/i }).click();
    await page.getByRole('button', { name: /Registrar 1 im/i }).click();

    await expect(page.getByRole('heading', { name: /Calibrar o Motor/i })).toBeVisible();
    expect(registerPayloads[0]).toEqual([
      {
        id: 0,
        titulo: 'Loft Paulista perto do metro',
        id_do_anuncio: '12345678',
        ativo: true,
        pictureUrl: 'https://example.com/loft.jpg',
      },
    ]);
    expect(addressPayloads[0]).toEqual([
      {
        cep: '00000-000',
        numero: 'S/N',
        logradouro: 'A definir',
        bairro: 'A definir',
        cidade: 'A definir',
        estado: 'A ',
        list: { id: '12345678' },
      },
    ]);
    expect(processPayloads[0]).toEqual({ listIds: [{ id: 'list-registered-e2e' }] });

    await page.getByRole('button', { name: /Salvar e continuar/i }).click();

    await expect(page.getByRole('heading', { name: /Tudo configurado/i })).toBeVisible();
    expect(profileUpdates[0]).toMatchObject({
      pricingStrategy: 'balanced',
      operationMode: 'notifications',
      percentualInicial: -10,
      percentualFinal: 20,
    });
  });
});
