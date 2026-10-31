import { EventIdentityService } from '../evento/event-identity.service';
import { DEFAULT_REFERENCE_VENUES, loadReferenceVenues, readEventReferenceConfig } from './event-reference.config';
import {
  buildVenueResolver,
  classifyEvent,
  computePrecisionRows,
  computeRecallRows,
  deterministicSample,
  mergeSnapshotRows,
  pct,
  type MetricsReference,
  type PrecisionEvent,
  type PrecisionReference,
} from './event-coverage-metrics';
import { buildPublicCoverage, emptyPublicCoverage, type PublicSnapshotRow } from './event-coverage-public';

const identity = new EventIdentityService();

const mref = (over: Partial<MetricsReference>): MetricsReference => ({
  status: 'aprovado',
  dateKey: '2026-10-20',
  category: 'esporte',
  size: 'grande',
  venueKey: 'allianz-parque',
  venueName: 'Allianz Parque',
  matched: true,
  ...over,
});

describe('computeRecallRows', () => {
  const window = { fromDateKey: '2026-10-01', toDateKey: '2026-10-30' };
  const refs: MetricsReference[] = [
    mref({}),
    mref({ matched: false }),
    mref({ size: 'medio', category: 'show', venueKey: 'audio', venueName: 'Audio' }),
    mref({ status: 'candidato', matched: false }), // não conta
    mref({ status: 'rejeitado', matched: false }), // não conta
    mref({ dateKey: '2026-11-15', matched: false }), // fora da janela
  ];
  const rows = computeRecallRows(refs, 'past30', window);
  const get = (dimension: string, value: string) => rows.find((r) => r.dimension === dimension && r.dimensionValue === value);

  it('conta só aprovadas dentro da janela', () => {
    expect(get('total', 'all')).toMatchObject({ referenceTotal: 3, referenceMatched: 2, recallPct: 66.67 });
  });

  it('abre por porte, categoria e venue', () => {
    expect(get('size', 'grande')).toMatchObject({ referenceTotal: 2, referenceMatched: 1, recallPct: 50 });
    expect(get('size', 'medio')).toMatchObject({ referenceTotal: 1, recallPct: 100 });
    expect(get('category', 'esporte')?.referenceTotal).toBe(2);
    expect(get('venue', 'audio')?.recallPct).toBe(100);
  });

  it('sem aprovadas, sem linhas (recall indefinido, não zero)', () => {
    expect(computeRecallRows([], 'past30', window)).toEqual([]);
    expect(pct(0, 0)).toBeNull();
  });
});

describe('precisão da amostra do banco', () => {
  const approved: PrecisionReference = {
    name: 'Palmeiras x Corinthians',
    dateKey: '2026-11-10',
    normalizedVenue: identity.normalizeVenue('Allianz Parque'),
    status: 'aprovado',
    externalSupport: 2,
  };
  const ev = (id: string, nome: string, over: Partial<PrecisionEvent> = {}): PrecisionEvent => ({
    id,
    nome,
    dataInicio: new Date('2026-11-10T22:00:00.000Z'),
    venueName: 'Allianz Parque',
    ...over,
  });

  it('classifica confirmado, refutado e não verificado', () => {
    const refs: PrecisionReference[] = [
      approved,
      { ...approved, name: 'Show Cancelado', status: 'rejeitado' },
      { ...approved, name: 'Festival Candidato', status: 'candidato', externalSupport: 1 },
      { ...approved, name: 'Outro Candidato Fraco', status: 'candidato', externalSupport: 0 },
    ];
    expect(classifyEvent(ev('1', 'Palmeiras x Corinthians'), refs, identity)).toBe('confirmed');
    expect(classifyEvent(ev('2', 'Show Cancelado'), refs, identity)).toBe('refuted');
    expect(classifyEvent(ev('3', 'Festival Candidato'), refs, identity)).toBe('confirmed');
    expect(classifyEvent(ev('4', 'Outro Candidato Fraco'), refs, identity)).toBe('unverified');
    expect(classifyEvent(ev('5', 'Evento Desconhecido Qualquer'), refs, identity)).toBe('unverified');
  });

  it('agrega a precisão por total e dimensões', () => {
    const allianz = DEFAULT_REFERENCE_VENUES.find((v) => v.key === 'allianz-parque')!;
    const rows = computePrecisionRows([
      { event: ev('1', 'a', { categoria: 'Esporte' }), venue: allianz, cls: 'confirmed' },
      { event: ev('2', 'b', { categoria: 'Esporte' }), venue: allianz, cls: 'confirmed' },
      { event: ev('3', 'c', { categoria: 'show' }), venue: allianz, cls: 'refuted' },
      { event: ev('4', 'd', { categoria: 'show' }), venue: allianz, cls: 'unverified' },
    ]);
    const total = rows.find((r) => r.dimension === 'total');
    expect(total).toMatchObject({ sample: 4, confirmed: 2, refuted: 1, precisionPct: 50 });
    expect(rows.find((r) => r.dimension === 'category' && r.dimensionValue === 'esporte')?.precisionPct).toBe(100);
    expect(rows.find((r) => r.dimension === 'size' && r.dimensionValue === 'grande')?.sample).toBe(4);
  });

  it('resolve o venue da lista por nome/alias ou geo; ignora o que está fora da lista', () => {
    const resolve = buildVenueResolver(DEFAULT_REFERENCE_VENUES, identity);
    expect(resolve(ev('x', 'a', { venueName: 'Arena Palmeiras' }))?.key).toBe('allianz-parque');
    expect(resolve(ev('x', 'a', { venueName: 'Rua sem nome', latitude: -23.6009, longitude: -46.7196 }))?.key).toBe('morumbis');
    expect(resolve(ev('x', 'a', { venueName: 'Bar do Zé' }))).toBeNull();
  });

  it('a amostra é determinística e respeita o teto', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}` }));
    const a = deterministicSample(items, 10);
    const b = deterministicSample([...items].reverse(), 10);
    expect(a).toHaveLength(10);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(deterministicSample(items, 100)).toHaveLength(50);
  });
});

describe('mergeSnapshotRows', () => {
  it('põe a precisão nas linhas next90 e preserva dimensões sem referência futura', () => {
    const rows = mergeSnapshotRows(
      [{ scope: 'past30', dimension: 'total', dimensionValue: 'all', referenceTotal: 4, referenceMatched: 3, recallPct: 75 }],
      [{ scope: 'next90', dimension: 'total', dimensionValue: 'all', referenceTotal: 2, referenceMatched: 1, recallPct: 50 }],
      [
        { dimension: 'total', dimensionValue: 'all', sample: 10, confirmed: 9, refuted: 0, precisionPct: 90 },
        { dimension: 'venue', dimensionValue: 'audio', sample: 2, confirmed: 1, refuted: 0, precisionPct: 50 },
      ],
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ scope: 'past30', precisionPct: null });
    expect(rows[1]).toMatchObject({ scope: 'next90', recallPct: 50, precisionPct: 90 });
    expect(rows[2]).toMatchObject({ scope: 'next90', dimensionValue: 'audio', referenceTotal: 0, precisionSample: 2 });
  });
});

describe('configuração', () => {
  it('liga a curadoria sozinha só com Gemini + um provedor; flag explícita vence', () => {
    expect(readEventReferenceConfig({}).curationEnabled).toBe(false);
    expect(readEventReferenceConfig({ GEMINI_API_KEY: 'g' }).curationEnabled).toBe(false);
    expect(readEventReferenceConfig({ GEMINI_API_KEY: 'g', TAVILY_API_KEY: 't' }).curationEnabled).toBe(true);
    expect(readEventReferenceConfig({ GEMINI_API_KEY: 'g', TAVILY_API_KEY: 't', EVENT_REFERENCE_CURATION_ENABLED: 'false' }).curationEnabled).toBe(false);
    expect(readEventReferenceConfig({ EVENT_REFERENCE_CURATION_ENABLED: 'true' }).curationEnabled).toBe(true);
  });

  it('usa defaults seguros, aceita zero nos tetos e impõe mínimo de 2 validadores', () => {
    const cfg = readEventReferenceConfig({ EVENT_REFERENCE_MAX_LLM_CALLS: '0', EVENT_REFERENCE_MIN_AGREE: '1' });
    expect(cfg.maxLlmCalls).toBe(0);
    expect(cfg.minAgree).toBe(2);
    expect(cfg.maxSearchCalls).toBe(30);
    expect(cfg.recallFloorPct).toBe(70);
    expect(readEventReferenceConfig({ EVENT_COVERAGE_RECALL_FLOOR_PCT: '0' }).recallFloorPct).toBe(0);
  });

  it('a lista de venues vem da semente ou do arquivo configurado, com fallback', () => {
    expect(loadReferenceVenues({}).source).toBe('seed');
    expect(DEFAULT_REFERENCE_VENUES.map((v) => v.key)).toEqual(
      expect.arrayContaining(['allianz-parque', 'morumbis', 'neo-quimica-arena', 'interlagos', 'distrito-anhembi', 'sao-paulo-expo', 'expo-center-norte', 'transamerica-expo', 'ibirapuera', 'pacaembu', 'bienal']),
    );
    const fromFile = loadReferenceVenues(
      { EVENT_REFERENCE_VENUES_FILE: 'x.json' },
      () => JSON.stringify([{ key: 'meu-venue', name: 'Meu Venue', size: 'grande', officialUrl: 'https://exemplo.com/agenda' }, { key: 'X', name: '' }]),
    );
    expect(fromFile.source).toBe('file');
    expect(fromFile.venues).toHaveLength(1);
    const broken = loadReferenceVenues({ EVENT_REFERENCE_VENUES_FILE: 'x.json' }, () => {
      throw new Error('ENOENT');
    });
    expect(broken.source).toBe('seed');
    expect(broken.warning).toBeTruthy();
  });
});

describe('resumo público', () => {
  const row = (over: Partial<PublicSnapshotRow>): PublicSnapshotRow => ({
    snapshotDate: '2026-12-01',
    scope: 'past30',
    dimension: 'total',
    dimensionValue: 'all',
    referenceTotal: 0,
    referenceMatched: 0,
    recallPct: null,
    ...over,
  });
  const rows: PublicSnapshotRow[] = [
    row({ referenceTotal: 40, referenceMatched: 36, recallPct: 90 }),
    row({ scope: 'next90', referenceTotal: 30 }),
    row({ dimension: 'size', dimensionValue: 'grande', referenceTotal: 25, referenceMatched: 23, recallPct: 92 }),
    row({ dimension: 'venue', dimensionValue: 'allianz-parque', referenceTotal: 5 }),
    row({ dimension: 'venue', dimensionValue: 'audio', referenceTotal: 3 }),
    row({ scope: 'next90', dimension: 'venue', dimensionValue: 'audio', referenceTotal: 2 }),
  ];

  it('sem medição, devolve o estado vazio honesto', () => {
    const s = buildPublicCoverage({ latestRows: [], firstDate: null, minSample: 10 });
    expect(s).toEqual(emptyPublicCoverage());
    expect(s.recallLargeEventsPct).toBeNull();
  });

  it('antes de 4 semanas não publica o número, mas mostra os agregados', () => {
    const s = buildPublicCoverage({ latestRows: rows, firstDate: '2026-11-20', minSample: 10 });
    expect(s.status).toBe('measuring');
    expect(s.recallLargeEventsPct).toBeNull();
    expect(s.daysMeasured).toBe(12);
    expect(s.eventsTracked).toBe(70);
    expect(s.venuesCovered).toBe(2);
    expect(s.message).toMatch(/Estamos medindo/);
  });

  it('com 4 semanas e amostra suficiente, publica o recall dos grandes eventos', () => {
    const s = buildPublicCoverage({ latestRows: rows, firstDate: '2026-11-03', minSample: 10 });
    expect(s.status).toBe('measured');
    expect(s.recallLargeEventsPct).toBe(92);
    expect(s.measuredAt).toBe('2026-12-01');
  });

  it('com 4 semanas mas amostra pequena de grandes eventos, continua medindo', () => {
    const s = buildPublicCoverage({ latestRows: rows, firstDate: '2026-11-03', minSample: 30 });
    expect(s.status).toBe('measuring');
    expect(s.message).toMatch(/25 de 30/);
  });

  it('não vaza nada além de agregados', () => {
    const s = buildPublicCoverage({ latestRows: rows, firstDate: '2026-11-03', minSample: 10 });
    expect(Object.keys(s).sort()).toEqual(
      ['daysMeasured', 'eventsTracked', 'largeEventsSample', 'measuredAt', 'measuringSince', 'message', 'minWeeks', 'recallLargeEventsPct', 'status', 'venuesCovered'].sort(),
    );
  });
});
