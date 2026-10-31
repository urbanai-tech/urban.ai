import { EventIdentityService } from '../evento/event-identity.service';
import { EventReferenceCurationService, CurationBudget } from './event-reference-curation.service';
import { FakeRepo } from './fake-repo.testkit';

const KEYS = ['GEMINI_API_KEY', 'TAVILY_API_KEY', 'SERPAPI_KEY', 'FIRECRAWL_API_KEY', 'ANTHROPIC_API_KEY'];
const TUNING = [
  'EVENT_REFERENCE_MAX_LLM_CALLS',
  'EVENT_REFERENCE_MAX_SEARCH_CALLS',
  'EVENT_REFERENCE_MAX_VENUES_PER_RUN',
  'EVENT_REFERENCE_VENUES_FILE',
];
const NOW = new Date('2026-11-01T12:00:00.000Z');
const identity = new EventIdentityService();

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of [...KEYS, ...TUNING]) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function build(opts: { events?: any[]; eventSources?: any[] } = {}) {
  const refRepo = new FakeRepo<any>();
  const voteRepo = new FakeRepo<any>();
  const cacheRepo = new FakeRepo<any>();
  const eventRepo = new FakeRepo<any>();
  const eventSourceRepo = new FakeRepo<any>();
  eventRepo.rows = opts.events ?? [];
  eventSourceRepo.rows = opts.eventSources ?? [];
  const sources = {
    searchTavily: jest.fn(),
    searchSerpApi: jest.fn(),
    scrapeFirecrawl: jest.fn(),
  };
  const llm = {
    extractEvents: jest.fn(),
    judge: jest.fn(),
    judgeModel: 'claude-sonnet-5-5',
  };
  const service = new EventReferenceCurationService(
    refRepo as any,
    voteRepo as any,
    cacheRepo as any,
    eventRepo as any,
    eventSourceRepo as any,
    identity,
    sources as any,
    llm as any,
  );
  // Um venue só, para os testes ficarem legíveis.
  return { service, refRepo, voteRepo, cacheRepo, sources, llm };
}

const dbEvent = (id: string, source: string, over: Record<string, any> = {}) => ({
  id,
  nome: 'Palmeiras x Corinthians',
  dataInicio: new Date('2026-11-10T22:00:00.000Z'),
  venueName: 'Allianz Parque',
  normalizedVenue: 'allianz parque',
  source,
  outOfScope: false,
  dedupStatus: 'canonical',
  ...over,
});

const doc = (url: string) => ({ url, title: `Página ${url}`, content: 'texto' });
const candidate = (dateKey = '2026-11-10') => ({
  name: 'Palmeiras x Corinthians',
  dateKey,
  time: '20:00',
  venue: 'Allianz Parque',
  category: 'esporte',
});

describe('curadoria — sem chaves', () => {
  it('não chama provedor algum: o banco vira candidato na fila humana, com aviso', async () => {
    const { service, refRepo, sources, llm } = build({
      events: [dbEvent('e1', 'sympla'), dbEvent('e2', 'eventbrite')],
    });
    const result = await service.run(NOW);

    expect(sources.searchTavily).not.toHaveBeenCalled();
    expect(llm.extractEvents).not.toHaveBeenCalled();
    expect(refRepo.rows).toHaveLength(1);
    expect(refRepo.rows[0]).toMatchObject({ status: 'candidato', origin: 'curadoria', venueKey: 'allianz-parque' });
    expect(refRepo.rows[0].decisionNote).toMatch(/falta uma fonte externa/);
    expect(result.approvedAuto).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/Sem chaves/);
    expect(result.warnings.join(' ')).toMatch(/juiz independente/);
  });

  it('reexecutar não duplica referência nem votos', async () => {
    const { service, refRepo, voteRepo } = build({ events: [dbEvent('e1', 'sympla'), dbEvent('e2', 'eventbrite')] });
    await service.run(NOW);
    await service.run(NOW);
    expect(refRepo.rows).toHaveLength(1);
    expect(voteRepo.rows).toHaveLength(2);
  });

  it('eventos duplicados ou fora do escopo não votam', async () => {
    const { service, refRepo } = build({
      events: [dbEvent('e1', 'sympla', { dedupStatus: 'duplicate' }), dbEvent('e2', 'x', { outOfScope: true })],
    });
    await service.run(NOW);
    expect(refRepo.rows).toHaveLength(0);
  });
});

describe('curadoria — com fontes externas', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'g';
    process.env.TAVILY_API_KEY = 't';
    process.env.SERPAPI_KEY = 's';
  });

  it('aprova sozinha com 2 validadores independentes (busca + Google Events) e guarda evidências', async () => {
    const { service, refRepo, voteRepo, sources, llm } = build();
    sources.searchTavily.mockResolvedValue([doc('https://www.sympla.com.br/evento/1')]);
    sources.searchSerpApi.mockResolvedValue([{ ...doc('https://www.google.com/search?q=x'), validatorKeyOverride: 'web:google-events' }]);
    llm.extractEvents.mockResolvedValue([candidate()]);

    const result = await service.run(NOW);

    expect(refRepo.rows).toHaveLength(1);
    expect(refRepo.rows[0]).toMatchObject({ status: 'aprovado', approvedBy: 'auto-consenso', votesSupport: 2 });
    expect(refRepo.rows[0].evidenceUrls).toEqual(
      expect.arrayContaining(['https://www.sympla.com.br/evento/1', 'https://www.google.com/search?q=x']),
    );
    expect(voteRepo.rows.map((v) => v.validatorKey).sort()).toEqual(['web:google-events', 'web:sympla.com.br']);
    expect(result.approvedAuto).toBe(1);
    expect(result.calls.search).toBeGreaterThan(0);
  });

  it('páginas do mesmo site contam como um validador só', async () => {
    const { service, refRepo, sources, llm } = build();
    sources.searchTavily.mockResolvedValue([doc('https://www.sympla.com.br/a'), doc('https://sympla.com.br/b')]);
    sources.searchSerpApi.mockResolvedValue([]);
    llm.extractEvents.mockResolvedValue([candidate()]);
    await service.run(NOW);
    expect(refRepo.rows[0].status).toBe('candidato');
    expect(refRepo.rows[0].votesSupport).toBe(1);
  });

  it('data divergente entre fontes vira conflito nas duas referências', async () => {
    const { service, refRepo, sources, llm } = build();
    sources.searchTavily.mockResolvedValue([{ ...doc('https://www.sympla.com.br/a'), content: 'fonte A' }]);
    sources.searchSerpApi.mockResolvedValue([
      { ...doc('https://www.google.com/x'), content: 'fonte B', validatorKeyOverride: 'web:google-events' },
    ]);
    llm.extractEvents.mockImplementation(async (text: string) => [candidate(text === 'fonte A' ? '2026-11-10' : '2026-11-11')]);

    const result = await service.run(NOW);

    expect(refRepo.rows).toHaveLength(2);
    expect(refRepo.rows.map((r) => r.status)).toEqual(['conflito', 'conflito']);
    expect(refRepo.rows[0].conflictReason).toMatch(/divergência de data/);
    expect(result.conflicts).toBe(2);
  });

  it('descarta candidato de outro venue citado no texto', async () => {
    const { service, refRepo, sources, llm } = build();
    sources.searchTavily.mockResolvedValue([doc('https://www.sympla.com.br/a')]);
    sources.searchSerpApi.mockResolvedValue([]);
    llm.extractEvents.mockResolvedValue([{ ...candidate(), venue: 'Estádio do Maracanã' }]);
    await service.run(NOW);
    expect(refRepo.rows).toHaveLength(0);
  });

  it('cache por URL/dia: a segunda execução não gasta busca nem LLM', async () => {
    process.env.EVENT_REFERENCE_MAX_SEARCH_CALLS = '100';
    const { service, sources, llm, refRepo } = build();
    sources.searchTavily.mockResolvedValue([doc('https://www.sympla.com.br/a')]);
    sources.searchSerpApi.mockResolvedValue([]);
    llm.extractEvents.mockResolvedValue([candidate()]);
    await service.run(NOW);
    const searchCalls = sources.searchTavily.mock.calls.length;
    const llmCalls = llm.extractEvents.mock.calls.length;
    const second = await service.run(NOW);
    expect(sources.searchTavily.mock.calls.length).toBe(searchCalls);
    expect(llm.extractEvents.mock.calls.length).toBe(llmCalls);
    expect(second.calls.cacheHits).toBeGreaterThan(0);
    expect(refRepo.rows).toHaveLength(1);
  });

  it('respeita o teto de chamadas ao LLM e avisa', async () => {
    process.env.EVENT_REFERENCE_MAX_LLM_CALLS = '1';
    const { service, sources, llm } = build();
    sources.searchTavily.mockResolvedValue([doc('https://a.com/1'), doc('https://b.com/2'), doc('https://c.com/3')]);
    sources.searchSerpApi.mockResolvedValue([]);
    llm.extractEvents.mockResolvedValue([]);
    const result = await service.run(NOW);
    expect(llm.extractEvents).toHaveBeenCalledTimes(1);
    expect(result.budgetExhausted).toContain('llm');
    expect(result.warnings.join(' ')).toMatch(/Teto de chamadas/);
  });

  it('respeita o teto de buscas', async () => {
    process.env.EVENT_REFERENCE_MAX_SEARCH_CALLS = '2';
    const { service, sources, llm } = build();
    sources.searchTavily.mockResolvedValue([]);
    sources.searchSerpApi.mockResolvedValue([]);
    llm.extractEvents.mockResolvedValue([]);
    const result = await service.run(NOW);
    expect(sources.searchTavily.mock.calls.length + sources.searchSerpApi.mock.calls.length).toBe(2);
    expect(result.budgetExhausted).toContain('search');
  });

  it('não sobrescreve decisão humana nem referência rejeitada', async () => {
    const { service, refRepo, sources, llm } = build();
    sources.searchTavily.mockResolvedValue([doc('https://www.sympla.com.br/a')]);
    sources.searchSerpApi.mockResolvedValue([{ ...doc('https://www.google.com/x'), validatorKeyOverride: 'web:google-events' }]);
    llm.extractEvents.mockResolvedValue([candidate()]);
    const fingerprint = (await import('./event-reference-normalize')).referenceFingerprint(identity, {
      name: 'Palmeiras x Corinthians',
      dateKey: '2026-11-10',
      venue: 'Allianz Parque',
    });
    refRepo.rows.push({
      id: 'humano',
      name: 'Palmeiras x Corinthians',
      venueKey: 'allianz-parque',
      venueName: 'Allianz Parque',
      dateKey: '2026-11-10',
      fingerprint,
      status: 'rejeitado',
      approvedBy: 'user-1',
      evidenceUrls: [],
    });
    await service.run(NOW);
    expect(refRepo.rows).toHaveLength(1);
    expect(refRepo.rows[0].status).toBe('rejeitado');
    expect(refRepo.rows[0].approvedBy).toBe('user-1');
  });
});

describe('curadoria — juiz independente (Anthropic)', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'g';
    process.env.TAVILY_API_KEY = 't';
    process.env.SERPAPI_KEY = 's';
    process.env.ANTHROPIC_API_KEY = 'a';
  });

  function wire(verdict: 'confirm' | 'reject' | 'unsure') {
    const ctx = build();
    ctx.sources.searchTavily.mockResolvedValue([doc('https://www.sympla.com.br/a')]);
    ctx.sources.searchSerpApi.mockResolvedValue([{ ...doc('https://www.google.com/x'), validatorKeyOverride: 'web:google-events' }]);
    ctx.llm.extractEvents.mockResolvedValue([candidate()]);
    ctx.llm.judge.mockResolvedValue({ verdict, reason: 'motivo' });
    return ctx;
  }

  it('juiz que confirma mantém a aprovação e fica registrado como voto', async () => {
    const { service, refRepo, voteRepo, llm } = wire('confirm');
    await service.run(NOW);
    expect(llm.judge).toHaveBeenCalledTimes(1);
    expect(refRepo.rows[0].status).toBe('aprovado');
    expect(voteRepo.rows.find((v) => v.validatorKind === 'judge')).toMatchObject({ verdict: 'confirm', extractor: 'anthropic' });
  });

  it('juiz que rejeita manda para a fila humana como conflito', async () => {
    const { service, refRepo } = wire('reject');
    await service.run(NOW);
    expect(refRepo.rows[0].status).toBe('conflito');
    expect(refRepo.rows[0].conflictReason).toMatch(/juiz/);
    expect(refRepo.rows[0].votesAgainst).toBe(1);
  });

  it('o juiz só é chamado para o que já teria consenso, e respeita o teto', async () => {
    const { service, llm, sources } = wire('confirm');
    sources.searchSerpApi.mockResolvedValue([]); // só 1 fonte: sem consenso, sem juiz
    await service.run(NOW);
    expect(llm.judge).not.toHaveBeenCalled();
  });
});

describe('CurationBudget', () => {
  it('conta, nega ao estourar e lembra o que estourou', () => {
    const budget = new CurationBudget({ search: 1, scrape: 0, llm: 2, judge: 1 });
    expect(budget.take('search')).toBe(true);
    expect(budget.take('search')).toBe(false);
    expect(budget.take('scrape')).toBe(false);
    expect([...budget.exhausted].sort()).toEqual(['scrape', 'search']);
  });
});

describe('rotação de venues', () => {
  it('com teto de venues por execução, cobre todos em dias seguidos', () => {
    const { service } = build();
    const venues = Array.from({ length: 6 }, (_, i) => ({ key: `v${i}` })) as any[];
    const cfg = { maxVenuesPerRun: 2 } as any;
    const seen = new Set<string>();
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      service.rotateVenues(venues, cfg, day).forEach((v) => seen.add(v.key));
    }
    expect(seen.size).toBe(6);
    expect(service.rotateVenues(venues, { maxVenuesPerRun: 0 } as any, '2026-11-01')).toHaveLength(6);
  });
});
