import { EventIdentityService } from './event-identity.service';

describe('EventIdentityService', () => {
  let service: EventIdentityService;

  beforeEach(() => {
    service = new EventIdentityService();
  });

  it('normaliza texto removendo acentos, pontuacao, ruido comum e espacos extras', () => {
    expect(service.normalizeText('  INGRESSOS OFICIAL: The Town Sao Paulo 2026!!!  ')).toBe(
      'the town sao paulo 2026',
    );
    expect(service.normalizeText('Programação Sympla - São João')).toBe('sao joao');
    expect(service.normalizeText('Show')).toBe('');
    expect(service.normalizeText('Show Metallica')).toBe('show metallica');
  });

  it('canonicaliza URLs removendo hash, UTMs e parâmetros de tracking', () => {
    const a = service.canonicalizeUrl(
      'HTTPS://Sympla.com.br/evento/the-town/?utm_source=news&gclid=abc&id=42#tickets',
    );
    const b = service.canonicalizeUrl('https://sympla.com.br/evento/the-town?id=42');

    expect(a).toBe('https://sympla.com.br/evento/the-town?id=42');
    expect(a).toBe(b);
  });

  it('aplica aliases conhecidos de venues de SP', () => {
    expect(service.normalizeVenue('Arena Palmeiras')).toBe('allianz parque');
    expect(service.normalizeVenue('Palestra Itália')).toBe('allianz parque');
    expect(service.normalizeVenue('SP Expo')).toBe('sao paulo expo');
    expect(service.normalizeVenue('Centro de Exposições Norte')).toBe('expo center norte');
    expect(service.normalizeVenue('Sambódromo do Anhembi')).toBe('anhembi');
    expect(service.normalizeVenue('Cícero Pompeu de Toledo')).toBe('morumbi');
    expect(service.normalizeVenue('Itaquera')).toBe('neo quimica arena');
  });

  it('gera fingerprint com nome, data e venue normalizados', () => {
    const fingerprint = service.buildFingerprint({
      nome: 'Ingressos Oficial: Palmeiras x Santos',
      dataInicio: '2026-05-10T16:00:00Z',
      venueName: 'Arena Palmeiras',
      latitude: -23.52751,
      longitude: -46.67834,
    });

    expect(fingerprint).toEqual(
      expect.objectContaining({
        normalizedName: 'palmeiras x santos',
        dateKey: '2026-05-10',
        normalizedVenue: 'allianz parque',
        geoBucket: '-23.528,-46.678',
        locationKey: 'venue:allianz parque',
      }),
    );
    expect(fingerprint.key).toBe('palmeiras x santos|2026-05-10|venue:allianz parque');
  });

  it('calcula similaridade por conjunto de tokens sem dependencia externa', () => {
    expect(
      service.tokenSetSimilarity(
        'Ingressos Oficial Primavera Sound Sao Paulo',
        'Primavera Sound Sao Paulo 2026',
      ),
    ).toBeGreaterThan(0.85);
    expect(service.tokenSetSimilarity('festival de jazz', 'festival de rock')).toBeLessThan(0.7);
  });

  it('trata source + sourceId como match exato por helper e score', () => {
    const input = { nome: 'Nome mudou', dataInicio: '2026-05-10', source: 'sympla-api', sourceId: 'EVT-42' };
    const existing = {
      nome: 'Nome antigo',
      dataInicio: '2026-05-11',
      source: 'SYmpla API',
      sourceId: 'evt-42',
    };

    expect(service.hasSameSourceIdentity(input, existing)).toBe(true);
    expect(service.scoreCandidate(input, existing)).toEqual(
      expect.objectContaining({ score: 1, reason: 'exact_source_id' }),
    );
  });

  it('trata canonicalUrl como match exato por helper e score', () => {
    const input = {
      nome: 'Festival X',
      dataInicio: '2026-05-10',
      url: 'https://eventbrite.com/e/festival-x?utm_campaign=a&ref=home',
    };
    const existing = {
      nome: 'Festival X - Comprar ingressos',
      dataInicio: '2026-05-10',
      crawledUrl: 'https://eventbrite.com/e/festival-x/',
    };

    expect(service.hasSameCanonicalUrl(input, existing)).toBe(true);
    expect(service.scoreCandidate(input, existing)).toEqual(
      expect.objectContaining({ score: 0.99, reason: 'exact_canonical_url' }),
    );
  });

  it('pontua alto nomes levemente diferentes no mesmo dia e venue equivalente', () => {
    const score = service.scoreCandidate(
      {
        nome: 'Ingressos Oficial: Palmeiras x Santos',
        dataInicio: '2026-05-10T16:00:00Z',
        venueName: 'Arena Palmeiras',
      },
      {
        nome: 'Palmeiras x Santos',
        dataInicio: '2026-05-10T19:00:00-03:00',
        venueName: 'Allianz Parque',
      },
    );

    expect(score.score).toBeGreaterThanOrEqual(0.86);
    expect(score.reason).toBe('likely_duplicate');
    expect(score.signals.nameScore).toBe(1);
    expect(score.signals.venueScore).toBe(1);
  });

  it('usa geo score para coordenadas proximas', () => {
    expect(
      service.geoScore(
        { latitude: -23.52751, longitude: -46.67831 },
        { latitude: -23.52759, longitude: -46.67839 },
      ),
    ).toBe(1);
    expect(
      service.geoScore(
        { latitude: -23.5275, longitude: -46.6783 },
        { latitude: -22.9122, longitude: -43.2302 },
      ),
    ).toBe(0);
  });

  it('não pontua alto eventos parecidos mas diferentes no mesmo venue e data', () => {
    const score = service.scoreCandidate(
      {
        nome: 'Festival de Jazz',
        dataInicio: '2026-08-20',
        venueName: 'Allianz Parque',
      },
      {
        nome: 'Festival de Rock',
        dataInicio: '2026-08-20',
        venueName: 'Arena Palmeiras',
      },
    );

    expect(score.score).toBeLessThan(0.8);
    expect(score.reason).not.toBe('likely_duplicate');
  });
});
