/**
 * Gerador DETERMINÍSTICO de mercado sintético para backtest offline do motor
 * de pricing (semente fixa, sem I/O, sem dado real versionado — é código).
 *
 * AVISO DE HONESTIDADE: isto NÃO prova valor do motor. O "preço realizado" é
 * produzido por um modelo que nós escrevemos; um motor que compartilhe as
 * mesmas hipóteses vai parecer bom por construção. Para reduzir (não eliminar)
 * a circularidade, o gerador usa efeitos DIFERENTES dos defaults do v2:
 * fatores de dia da semana próprios, efeito de evento contínuo com decaimento
 * por distância, viés do anfitrião no preço base e ruído/alucinação no score
 * do LLM. Serve para: (a) detectar regressão, (b) mostrar a FORMA da
 * distribuição de multiplicadores (o v1 nunca reduz), (c) dar um número
 * reprodutível para comparar versões. Validação de verdade = shadow em
 * produção + outcomes reais (`pricing-outcome-learning.service.ts`).
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  // Box-Muller
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface SyntheticProperty {
  id: string;
  lat: number;
  lng: number;
  neighborhood: string;
  metroDistance: number;
  amenitiesCount: number;
  /** ADR "justo" (latente; o motor nunca vê). */
  fairAdr: number;
  /** Preço base que o anfitrião configurou (fairAdr × viés). */
  basePrice: number;
}

export interface SyntheticEvent {
  id: string;
  name: string;
  lat: number;
  lng: number;
  dateKey: string;
  /** Público real (observável quando há bilheteria/venue). */
  attendance: number;
  /** Se o público é observável (venueCapacity/expectedAttendance preenchidos). */
  attendanceObservable: boolean;
  /** Score do "LLM" (ruidoso; às vezes inflado — alucinação/injeção). */
  relevancia: number;
  inflatedByLlm: boolean;
  /** Raio real de influência (latente; o motor nunca vê). */
  trueRadiusKm: number;
  /** Raio estimado pelo "LLM" (ruidoso e exagerado em eventos grandes). */
  raioImpactoKm: number;
}

export interface SyntheticNight {
  property: SyntheticProperty;
  dateKey: string;
  todayKey: string;
  leadDays: number;
  prevNightBooked: boolean;
  nextNightBooked: boolean;
  event: SyntheticEvent | null;
  eventDistanceKm: number | null;
  /** Preço pelo qual a noite efetivamente foi vendida (alvo do MAPE). */
  realizedPrice: number;
}

export interface SyntheticMarket {
  seed: number;
  properties: SyntheticProperty[];
  events: SyntheticEvent[];
  nights: SyntheticNight[];
}

const NEIGHBORHOODS = [
  { name: 'Jardins', lat: -23.567, lng: -46.664, adr: 520 },
  { name: 'Pinheiros', lat: -23.566, lng: -46.692, adr: 430 },
  { name: 'Vila Mariana', lat: -23.589, lng: -46.634, adr: 330 },
  { name: 'Centro', lat: -23.545, lng: -46.637, adr: 230 },
  { name: 'Barra Funda', lat: -23.526, lng: -46.667, adr: 260 },
  { name: 'Tatuape', lat: -23.540, lng: -46.576, adr: 210 },
  { name: 'Itaquera', lat: -23.536, lng: -46.456, adr: 160 },
];

const VENUES = [
  { name: 'Allianz Parque', lat: -23.5275, lng: -46.6783 },
  { name: 'Anhembi', lat: -23.5157, lng: -46.6352 },
  { name: 'Expo Center Norte', lat: -23.5133, lng: -46.6159 },
  { name: 'Neo Quimica Arena', lat: -23.5453, lng: -46.4742 },
  { name: 'Ibirapuera', lat: -23.5874, lng: -46.6576 },
  { name: 'Interlagos', lat: -23.7036, lng: -46.6997 },
];

/** Fatores de dia da semana do GERADOR (0=dom). Diferentes dos defaults do v2. */
const DOW_FACTOR = [0.97, 0.9, 0.9, 0.92, 0.97, 1.1, 1.14];

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

function weekday(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function haversineKmSimple(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

export interface SyntheticMarketOptions {
  seed?: number;
  properties?: number;
  horizonDays?: number;
  events?: number;
  startDateKey?: string;
}

export function generateSyntheticMarket(options: SyntheticMarketOptions = {}): SyntheticMarket {
  const seed = options.seed ?? 20261024;
  const rand = mulberry32(seed);
  const nProps = options.properties ?? 150;
  const horizon = options.horizonDays ?? 60;
  const nEvents = options.events ?? 30;
  const start = options.startDateKey ?? '2026-11-02';

  const properties: SyntheticProperty[] = [];
  for (let i = 0; i < nProps; i++) {
    const nb = NEIGHBORHOODS[Math.floor(rand() * NEIGHBORHOODS.length)];
    const amenitiesCount = Math.max(1, Math.round(8 + gaussian(rand) * 5));
    const metroDistance = Math.max(0.05, Math.abs(gaussian(rand)) * 1.2);
    const quality = Math.exp(gaussian(rand) * 0.18) * (1 + (amenitiesCount - 8) * 0.012) * (1 - Math.min(metroDistance, 3) * 0.03);
    const fairAdr = nb.adr * quality;
    const hostBias = Math.exp(gaussian(rand) * 0.1 + 0.03); // anfitrião tende a precificar um pouco acima
    properties.push({
      id: `syn-${i}`,
      lat: nb.lat + gaussian(rand) * 0.008,
      lng: nb.lng + gaussian(rand) * 0.008,
      neighborhood: nb.name,
      metroDistance: Number(metroDistance.toFixed(2)),
      amenitiesCount,
      fairAdr,
      basePrice: Number((fairAdr * hostBias).toFixed(2)),
    });
  }

  const events: SyntheticEvent[] = [];
  for (let i = 0; i < nEvents; i++) {
    const venue = VENUES[Math.floor(rand() * VENUES.length)];
    const attendance = Math.round(Math.exp(7.5 + rand() * 3.5)); // ~1,8k a ~60k
    const trueRelevance = Math.min(100, Math.max(1, Math.round((Math.log(attendance) - 7) * 27)));
    const inflatedByLlm = rand() < 0.15;
    const relevancia = inflatedByLlm
      ? 90 + Math.floor(rand() * 11)
      : Math.min(100, Math.max(1, Math.round(trueRelevance + gaussian(rand) * 10)));
    const trueRadiusKm = 1.5 + rand() * 3.5;
    const llmRadius = trueRadiusKm * Math.exp(gaussian(rand) * 0.5) * (relevancia >= 70 ? 3 : 1);
    events.push({
      trueRadiusKm: Number(trueRadiusKm.toFixed(2)),
      raioImpactoKm: Number(Math.min(50, Math.max(0.5, llmRadius)).toFixed(1)),
      id: `evt-${i}`,
      name: `${venue.name} #${i}`,
      lat: venue.lat,
      lng: venue.lng,
      dateKey: addDays(start, Math.floor(rand() * horizon)),
      attendance,
      attendanceObservable: rand() < 0.6,
      relevancia,
      inflatedByLlm,
    });
  }

  const nights: SyntheticNight[] = [];
  for (const property of properties) {
    for (let d = 0; d < horizon; d++) {
      const dateKey = addDays(start, d);
      const leadDays = Math.floor(rand() * 30);
      const todayKey = addDays(dateKey, -leadDays);
      const prevNightBooked = rand() < 0.5;
      const nextNightBooked = rand() < 0.5;

      // Evento mais impactante da noite (até 15 km).
      let best: { e: SyntheticEvent; dist: number; effect: number } | null = null;
      for (const e of events) {
        if (e.dateKey !== dateKey) continue;
        const dist = haversineKmSimple(property, e);
        if (dist > 15) continue;
        const impact = Math.min(1, Math.log(e.attendance / 1000) / Math.log(60));
        const effect = 0.32 * impact * Math.exp(-dist / e.trueRadiusKm);
        if (!best || effect > best.effect) best = { e, dist, effect };
      }

      let price = property.fairAdr * DOW_FACTOR[weekday(dateKey)] * (1 + (best?.effect ?? 0));
      const strongEvent = (best?.effect ?? 0) > 0.05;
      if (!strongEvent && leadDays <= 3) price *= 0.9; // noite encalhada vende com desconto
      if (!strongEvent && prevNightBooked && nextNightBooked) price *= 0.87; // lacuna é difícil de vender
      price *= Math.exp(gaussian(rand) * 0.06);

      nights.push({
        property,
        dateKey,
        todayKey,
        leadDays,
        prevNightBooked,
        nextNightBooked,
        event: best?.e ?? null,
        eventDistanceKm: best ? Number(best.dist.toFixed(2)) : null,
        realizedPrice: Number(price.toFixed(2)),
      });
    }
  }

  return { seed, properties, events, nights };
}
