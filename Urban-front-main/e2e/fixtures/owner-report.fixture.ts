import type { Page, Route } from '@playwright/test';
import { acceptCookieConsent } from '../test-helpers';

/**
 * Fixtures e mocks de API do relatório do proprietário (ADR 0027), compartilhados pelos specs
 * `owner-report-public` e `property-owners`.
 */

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const TOKEN = 'tokenDeTeste0123456789abcdefghijklmnopqrs.assinaturaDeTeste12';


export function property(overrides: Record<string, unknown> = {}) {
  return {
    ref: 1,
    title: 'Studio Paulista',
    location: 'Bela Vista, São Paulo',
    occupancy: { pct: 62.5, occupiedNights: 15, knownDays: 30, source: 'stays', note: null },
    revenue: 4500,
    revenueSource: 'calendar',
    averageDailyRate: 300,
    adrSource: 'calendar',
    recommendations: { generated: 8, accepted: 3, applied: 2 },
    events: {
      total: 2,
      items: [
        { name: 'Show no Allianz Parque', dateLabel: '12/09', relevance: 90, suggestedPrice: 420, liftPercent: 40 },
        { name: 'Feira de tecnologia', dateLabel: '20/09', relevance: 60, suggestedPrice: null, liftPercent: null },
      ],
    },
    applied: {
      total: 2,
      items: [
        {
          eventName: 'Show no Allianz Parque',
          dateLabel: '12/09',
          suggestedPrice: 420,
          startingPrice: 300,
          appliedPrice: 400,
          outcome: { status: 'booked', revenue: 800, nights: 2, confirmedExtra: 200 },
        },
        {
          eventName: 'Feira de tecnologia',
          dateLabel: '20/09',
          suggestedPrice: 350,
          startingPrice: 300,
          appliedPrice: 350,
          outcome: { status: 'pending', revenue: null, nights: null, confirmedExtra: null },
        },
      ],
    },
    pendingOutcomes: 1,
    comparison: {
      revenue: { current: 4500, previous: 3000, delta: 1500, deltaPct: 50 },
      averageDailyRate: null,
      occupancyPct: null,
    },
    hasData: true,
    dataMessage: null,
    ...overrides,
  };
}

export function report(properties: unknown[], summary: Record<string, unknown> = {}) {
  return {
    report: {
      version: 1,
      period: { key: '2026-09', label: 'setembro de 2026', startKey: '2026-09-01', endKeyExclusive: '2026-10-01', isPartial: false },
      previousPeriod: { key: '2026-08', label: 'agosto de 2026' },
      generatedAt: '2026-10-01T12:00:00.000Z',
      owner: { name: 'Maria Souza' },
      preparedBy: 'Ana Host',
      summary: {
        propertyCount: properties.length,
        propertiesWithRevenue: 1,
        propertiesWithOccupancy: 1,
        totalRevenue: 4500,
        averageDailyRate: 300,
        occupancyPct: 62.5,
        recommendationsApplied: 2,
        confirmedExtra: 200,
        pendingOutcomes: 1,
        dataStatus: 'complete',
        headline: 'Em setembro de 2026, todos os imóveis têm receita registrada.',
        comparison: {
          comparableProperties: 1,
          revenue: { current: 4500, previous: 3000, delta: 1500, deltaPct: 50 },
          occupancyPct: null,
        },
        ...summary,
      },
      properties,
      notes: ['Receita, diária média e ocupação só aparecem quando foram registradas ou sincronizadas. Nada é estimado.'],
    },
    meta: {
      period: '2026-09',
      generatedAt: '2026-10-01T12:00:00.000Z',
      expiresAt: '2026-10-31T12:00:00.000Z',
      notice: 'Você recebe este relatório porque o responsável pelos seus imóveis informou o seu e-mail.',
    },
  };
}

export const emptyReport = () =>
  report(
    [
      property({
        occupancy: { pct: null, occupiedNights: null, knownDays: 0, source: null, note: 'Sem calendário registrado ou sincronizado neste mês.' },
        revenue: null,
        revenueSource: null,
        averageDailyRate: null,
        adrSource: null,
        events: { total: 0, items: [] },
        applied: { total: 0, items: [] },
        recommendations: { generated: 0, accepted: 0, applied: 0 },
        pendingOutcomes: 0,
        comparison: { revenue: null, averageDailyRate: null, occupancyPct: null },
        hasData: false,
        dataMessage: 'Sem resultado registrado nem calendário sincronizado neste mês: não há número para mostrar.',
      }),
    ],
    {
      propertiesWithRevenue: 0,
      propertiesWithOccupancy: 0,
      totalRevenue: null,
      averageDailyRate: null,
      occupancyPct: null,
      recommendationsApplied: 0,
      confirmedExtra: null,
      pendingOutcomes: 0,
      dataStatus: 'none',
      headline: 'Em setembro de 2026 ainda não há resultado registrado nem calendário sincronizado para estes imóveis.',
      comparison: { comparableProperties: 0, revenue: null, occupancyPct: null },
    },
  );

export async function openPublicReport(page: Page, handler: (route: Route) => unknown) {
  await acceptCookieConsent(page);
  await page.route('**/owner-reports/public/**', handler);
  await page.goto(`/relatorio/${TOKEN}`, { waitUntil: 'domcontentloaded' });
}

export const CONSENT = {
  version: 'owner-share-2026-10-v1',
  text: 'Declaro que tenho base legal para compartilhar com este proprietário os dados de desempenho dos imóveis vinculados.',
};

export const user = {
  id: 'user-owners',
  userId: 'user-owners',
  username: 'Ana Host',
  email: 'ana.host@urbanai.com.br',
  role: 'USER',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const properties = [
  {
    id: 'addr-1',
    propertyName: 'Studio Paulista',
    userId: 'user-owners',
    analisado: 'completed',
    image_url: 'https://example.com/a.jpg',
    latitude: -23.56,
    longitude: -46.65,
    id_do_anuncio: '111',
    nome: 'Studio Paulista',
  },
  {
    id: 'addr-2',
    propertyName: 'Loft Pinheiros',
    userId: 'user-owners',
    analisado: 'completed',
    image_url: 'https://example.com/b.jpg',
    latitude: -23.56,
    longitude: -46.69,
    id_do_anuncio: '222',
    nome: 'Loft Pinheiros',
  },
];

export const OWNER = {
  id: 'owner-1',
  name: 'Maria Souza',
  email: 'maria@example.com',
  monthlyReportEnabled: true,
  unsubscribed: false,
  consent: { version: CONSENT.version, acceptedAt: '2026-10-20T15:00:00.000Z' },
  properties: [{ id: 'addr-1', title: 'Studio Paulista', location: 'Bela Vista, São Paulo' }],
  lastReport: null,
};

export const PREVIEW = {
  version: 1,
  period: { key: '2026-10', label: 'outubro de 2026', startKey: '2026-10-01', endKeyExclusive: '2026-11-01', isPartial: true },
  previousPeriod: { key: '2026-09', label: 'setembro de 2026' },
  generatedAt: '2026-10-31T12:00:00.000Z',
  owner: { name: 'Maria Souza' },
  preparedBy: 'Ana Host',
  summary: {
    propertyCount: 1,
    propertiesWithRevenue: 0,
    propertiesWithOccupancy: 0,
    totalRevenue: null,
    averageDailyRate: null,
    occupancyPct: null,
    recommendationsApplied: 0,
    confirmedExtra: null,
    pendingOutcomes: 0,
    dataStatus: 'none',
    headline: 'Em outubro de 2026 ainda não há resultado registrado nem calendário sincronizado para estes imóveis.',
    comparison: { comparableProperties: 0, revenue: null, occupancyPct: null },
  },
  properties: [
    {
      ref: 1,
      title: 'Studio Paulista',
      location: 'Bela Vista, São Paulo',
      occupancy: { pct: null, occupiedNights: null, knownDays: 0, source: null, note: 'Sem calendário registrado ou sincronizado neste mês.' },
      revenue: null,
      revenueSource: null,
      averageDailyRate: null,
      adrSource: null,
      recommendations: { generated: 0, accepted: 0, applied: 0 },
      events: { total: 0, items: [] },
      applied: { total: 0, items: [] },
      pendingOutcomes: 0,
      comparison: { revenue: null, averageDailyRate: null, occupancyPct: null },
      hasData: false,
      dataMessage: 'Sem resultado registrado nem calendário sincronizado neste mês: não há número para mostrar.',
    },
  ],
  notes: ['Nada é estimado.'],
};

export type Calls = {
  created: Array<Record<string, unknown>>;
  updated: Array<{ id: string; body: Record<string, unknown> }>;
  links: string[];
  revokedAll: number;
  revokedOne: string[];
  sends: string[];
  deleted: string[];
};

export async function mockApp(page: Page, options: { owners?: unknown[]; createStatus?: number } = {}) {
  await acceptCookieConsent(page);
  const calls: Calls = { created: [], updated: [], links: [], revokedAll: 0, revokedOne: [], sends: [], deleted: [] };
  let owners = (options.owners as typeof OWNER[]) ?? [];

  await page.route('**/auth/me', (route) => json(route, user));
  await page.route('**/auth/profile**', (route) => json(route, user));
  await page.route('**/payments/getSubscription', (route) => json(route, { id: 'sub_e2e', status: 'active', plan: 'alpha' }));
  await page.route('**/payments/listings-quota', (route) => json(route, { contratados: 2, ativos: 2, podeAdicionar: true }));
  await page.route('**/ask/usage', (route) =>
    json(route, { used: 0, quota: 20, hardCap: 30, canUse: true, plan: 'profissional', reason: null }),
  );
  await page.route('**/propriedades/dropdown/list', (route) => json(route, properties));
  await page.route('**/property-owners/consent', (route) => json(route, CONSENT));

  await page.route('**/property-owners', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      calls.created.push(body);
      if (options.createStatus && options.createStatus !== 201) {
        return json(route, { statusCode: options.createStatus, message: 'Imóvel não encontrado' }, options.createStatus);
      }
      const created = {
        ...OWNER,
        id: 'owner-new',
        name: body.name,
        email: body.email,
        monthlyReportEnabled: body.monthlyReportEnabled,
        properties: body.propertyIds.map((id: string) => ({ id, title: properties.find((p) => p.id === id)?.propertyName, location: null })),
      };
      owners = [created];
      return json(route, created, 201);
    }
    return json(route, owners);
  });
  await page.route('**/property-owners/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const id = path.split('/')[2];
    if (path.endsWith('/consent')) return route.fallback();
    if (request.method() === 'PATCH') {
      calls.updated.push({ id, body: request.postDataJSON() });
      owners = owners.map((owner) => (owner.id === id ? { ...owner, ...request.postDataJSON() } : owner));
      return json(route, owners.find((owner) => owner.id === id));
    }
    if (request.method() === 'DELETE') {
      calls.deleted.push(id);
      owners = owners.filter((owner) => owner.id !== id);
      return json(route, { ok: true });
    }
    return route.fallback();
  });
  await page.route('**/property-owners/*/reports', (route) =>
    json(route, [
      {
        period: '2026-09',
        generatedAt: '2026-10-01T12:00:00.000Z',
        emailStatus: 'sent',
        emailSentAt: '2026-10-01T12:00:00.000Z',
        links: [
          {
            id: 'link-1',
            origin: 'email',
            state: 'valid',
            expiresAt: '2026-11-30T12:00:00.000Z',
            revokedAt: null,
            viewCount: 2,
            firstViewedAt: '2026-10-02T12:00:00.000Z',
            lastViewedAt: '2026-10-03T12:00:00.000Z',
            createdAt: '2026-10-01T12:00:00.000Z',
          },
          {
            id: 'link-2',
            origin: 'host',
            state: 'revoked',
            expiresAt: '2026-11-30T12:00:00.000Z',
            revokedAt: '2026-10-05T12:00:00.000Z',
            viewCount: 0,
            firstViewedAt: null,
            lastViewedAt: null,
            createdAt: '2026-10-04T12:00:00.000Z',
          },
        ],
      },
    ]),
  );
  await page.route('**/property-owners/*/reports/*/preview', (route) => json(route, PREVIEW));
  await page.route('**/property-owners/*/reports/*/links', (route) => {
    calls.links.push(route.request().url());
    return json(
      route,
      { url: 'https://app.myurbanai.com/relatorio/TOKENxyz.ASSINATURA', expiresAt: '2026-11-30T12:00:00.000Z', period: '2026-09' },
      201,
    );
  });
  await page.route('**/property-owners/*/reports/*/send', (route) => {
    calls.sends.push(route.request().url());
    return json(route, { code: 'OWNER_REPORT_EMAIL_DISABLED', message: 'O envio por e-mail ao proprietário ainda não está ativo neste ambiente.' }, 503);
  });
  await page.route('**/property-owners/*/links/revoke-all', (route) => {
    calls.revokedAll += 1;
    return json(route, { revoked: 2 });
  });
  await page.route('**/property-owners/*/links/*/revoke', (route) => {
    calls.revokedOne.push(route.request().url());
    return json(route, { ok: true });
  });
  return calls;
}
