import type {
  DemandHeatmapCell,
  EventCatalogItem,
  EventIntelligenceDetail,
  EventPropertyImpact,
  HostEventCatalogFilters,
  HostEventCatalogResponse,
  HostEventConfidence,
  HostEventRadarFilters,
  HostEventRadarItem,
  HostEventRadarResponse,
  HostEventDetailResponse,
  PriceAbsorptionScenario,
} from "./api";

// TEMP HOST EVENT RADAR MOCKS.
// Remover quando Lia/Nico entregarem os endpoints reais em /host/events/*.

const generatedAt = "2026-05-22T15:00:00.000Z";

const scenariosByProperty: Record<string, PriceAbsorptionScenario[]> = {
  "prop-vila-mariana": [
    {
      id: "conservative",
      label: "Conservador",
      dailyPriceCents: 65000,
      multiplier: 2.0,
      bookingProbability: 0.82,
      expectedRevenueCents: 53300,
      risk: "low",
      reading: "Alta chance de capturar demanda com pouca friccao.",
    },
    {
      id: "recommended",
      label: "Recomendado",
      dailyPriceCents: 85000,
      multiplier: 2.6,
      bookingProbability: 0.63,
      expectedRevenueCents: 53550,
      risk: "medium",
      recommended: true,
      reading: "Melhor equilíbrio entre diária maior e chance de reservar.",
    },
    {
      id: "aggressive",
      label: "Agressivo",
      dailyPriceCents: 115000,
      multiplier: 3.5,
      bookingProbability: 0.32,
      expectedRevenueCents: 36800,
      risk: "high",
      reading: "Pode funcionar se a oferta secar perto da data.",
    },
    {
      id: "extreme",
      label: "Extremo",
      dailyPriceCents: 140000,
      multiplier: 4.3,
      bookingProbability: 0.14,
      expectedRevenueCents: 19600,
      risk: "high",
      reading: "Só faz sentido com compressão extrema de oferta.",
    },
  ],
  "prop-paulista": [
    {
      id: "conservative",
      label: "Conservador",
      dailyPriceCents: 68000,
      multiplier: 1.7,
      bookingProbability: 0.76,
      expectedRevenueCents: 51680,
      risk: "low",
      reading: "Bom para garantir ocupação antes do pico de busca.",
    },
    {
      id: "recommended",
      label: "Recomendado",
      dailyPriceCents: 92000,
      multiplier: 2.2,
      bookingProbability: 0.58,
      expectedRevenueCents: 53360,
      risk: "medium",
      recommended: true,
    reading: "Faixa mais provável de absorção para este imóvel.",
    },
    {
      id: "aggressive",
      label: "Agressivo",
      dailyPriceCents: 105000,
      multiplier: 2.6,
      bookingProbability: 0.41,
      expectedRevenueCents: 43050,
      risk: "medium",
      reading: "Risco moderado, depende de baixa disponibilidade no bairro.",
    },
    {
      id: "extreme",
      label: "Extremo",
      dailyPriceCents: 129000,
      multiplier: 3.1,
      bookingProbability: 0.18,
      expectedRevenueCents: 23220,
      risk: "high",
      reading: "Chance cai bastante acima deste ponto.",
    },
  ],
  "prop-pinheiros": [
    {
      id: "conservative",
      label: "Conservador",
      dailyPriceCents: 54000,
      multiplier: 1.5,
      bookingProbability: 0.79,
      expectedRevenueCents: 42660,
      risk: "low",
      reading: "Boa opção se a prioridade for preencher agenda.",
    },
    {
      id: "recommended",
      label: "Recomendado",
      dailyPriceCents: 72000,
      multiplier: 2.0,
      bookingProbability: 0.61,
      expectedRevenueCents: 43920,
      risk: "medium",
      recommended: true,
      reading: "Preço ainda competitivo para demanda aquecida.",
    },
    {
      id: "aggressive",
      label: "Agressivo",
      dailyPriceCents: 89000,
      multiplier: 2.5,
      bookingProbability: 0.36,
      expectedRevenueCents: 32040,
      risk: "high",
      reading: "Só vale testar se houver sinal de compressão no entorno.",
    },
    {
      id: "extreme",
      label: "Extremo",
      dailyPriceCents: 109000,
      multiplier: 3.0,
      bookingProbability: 0.15,
      expectedRevenueCents: 16350,
      risk: "high",
      reading: "Alta chance de vacância para este perfil.",
    },
  ],
};

const propertyImpacts: Record<string, EventPropertyImpact[]> = {
  "evt-tech-summit-sp": [
    {
      propertyId: "prop-vila-mariana",
      propertyName: "Studio Vila Mariana",
      distanceKm: 1.8,
      travelTimeMinutes: 12,
      propertyCaptureScore: 87,
      currentPriceCents: 32000,
      recommendedPriceCents: 85000,
      minAbsorbablePriceCents: 65000,
      maxAbsorbablePriceCents: 95000,
      recommendedMultiplier: 2.6,
      maxPlausibleMultiplier: 3.4,
      bookingProbability: 0.63,
      expectedRevenueCents: 53550,
      expectedIncrementalRevenueCents: 21550,
      confidence: "high",
      recommendedAction: "simulate",
      mainDrivers: ["Muito perto do evento", "Alta antecedência de busca", "Oferta limitada no bairro"],
      affectedNights: ["2026-06-12", "2026-06-13"],
      absorptionScenarios: scenariosByProperty["prop-vila-mariana"],
    },
    {
      propertyId: "prop-paulista",
      propertyName: "Loft Paulista",
      distanceKm: 4.2,
      travelTimeMinutes: 18,
      propertyCaptureScore: 72,
      currentPriceCents: 41000,
      recommendedPriceCents: 92000,
      minAbsorbablePriceCents: 68000,
      maxAbsorbablePriceCents: 105000,
      recommendedMultiplier: 2.2,
      maxPlausibleMultiplier: 2.9,
      bookingProbability: 0.58,
      expectedRevenueCents: 53360,
      expectedIncrementalRevenueCents: 12360,
      confidence: "medium",
      recommendedAction: "simulate",
      mainDrivers: ["Boa conexão por metrô", "Perfil corporativo", "Diária atual abaixo do pico"],
      affectedNights: ["2026-06-12", "2026-06-13"],
      absorptionScenarios: scenariosByProperty["prop-paulista"],
    },
  ],
  "evt-ibirapuera-festival": [
    {
      propertyId: "prop-vila-mariana",
      propertyName: "Studio Vila Mariana",
      distanceKm: 2.4,
      travelTimeMinutes: 10,
      propertyCaptureScore: 81,
      currentPriceCents: 32000,
      recommendedPriceCents: 76000,
      minAbsorbablePriceCents: 59000,
      maxAbsorbablePriceCents: 88000,
      recommendedMultiplier: 2.3,
      maxPlausibleMultiplier: 3.0,
      bookingProbability: 0.66,
      expectedRevenueCents: 50160,
      expectedIncrementalRevenueCents: 18160,
      confidence: "high",
      recommendedAction: "apply",
      mainDrivers: ["Evento de grande porte", "Público noturno", "Região com alta procura"],
      affectedNights: ["2026-07-04"],
      absorptionScenarios: scenariosByProperty["prop-vila-mariana"].map((scenario) => ({
        ...scenario,
        dailyPriceCents:
          scenario.id === "recommended"
            ? 76000
            : scenario.id === "conservative"
              ? 59000
              : scenario.id === "aggressive"
                ? 98000
                : 119000,
      })),
    },
    {
      propertyId: "prop-pinheiros",
      propertyName: "Apartamento Pinheiros",
      distanceKm: 5.8,
      travelTimeMinutes: 24,
      propertyCaptureScore: 64,
      currentPriceCents: 36000,
      recommendedPriceCents: 72000,
      minAbsorbablePriceCents: 54000,
      maxAbsorbablePriceCents: 89000,
      recommendedMultiplier: 2.0,
      maxPlausibleMultiplier: 2.5,
      bookingProbability: 0.61,
      expectedRevenueCents: 43920,
      expectedIncrementalRevenueCents: 7920,
      confidence: "medium",
      recommendedAction: "watch",
      mainDrivers: ["Acesso viavel por transporte", "Público de lazer", "Concorrencia ainda disponível"],
      affectedNights: ["2026-07-04"],
      absorptionScenarios: scenariosByProperty["prop-pinheiros"],
    },
  ],
  "evt-medical-congress": [
    {
      propertyId: "prop-paulista",
      propertyName: "Loft Paulista",
      distanceKm: 1.1,
      travelTimeMinutes: 8,
      propertyCaptureScore: 90,
      currentPriceCents: 41000,
      recommendedPriceCents: 99000,
      minAbsorbablePriceCents: 76000,
      maxAbsorbablePriceCents: 116000,
      recommendedMultiplier: 2.4,
      maxPlausibleMultiplier: 3.0,
      bookingProbability: 0.64,
      expectedRevenueCents: 63360,
      expectedIncrementalRevenueCents: 22360,
      confidence: "high",
      recommendedAction: "apply",
      mainDrivers: ["Hóspede quer ficar perto", "Evento de múltiplos dias", "Demanda corporativa"],
      affectedNights: ["2026-06-26", "2026-06-27", "2026-06-28"],
      absorptionScenarios: scenariosByProperty["prop-paulista"].map((scenario) => ({
        ...scenario,
        dailyPriceCents:
          scenario.id === "recommended"
            ? 99000
            : scenario.id === "conservative"
              ? 76000
              : scenario.id === "aggressive"
                ? 116000
                : 138000,
      })),
    },
  ],
  "evt-esports-final": [
    {
      propertyId: "prop-pinheiros",
      propertyName: "Apartamento Pinheiros",
      distanceKm: 2.2,
      travelTimeMinutes: 14,
      propertyCaptureScore: 74,
      currentPriceCents: 36000,
      recommendedPriceCents: 69000,
      minAbsorbablePriceCents: 52000,
      maxAbsorbablePriceCents: 84000,
      recommendedMultiplier: 1.9,
      maxPlausibleMultiplier: 2.4,
      bookingProbability: 0.57,
      expectedRevenueCents: 39330,
      expectedIncrementalRevenueCents: 3330,
      confidence: "medium",
      recommendedAction: "review",
      mainDrivers: ["Público jovem", "Evento concentrado em uma noite", "Busca ainda em formacao"],
      affectedNights: ["2026-06-20"],
      absorptionScenarios: scenariosByProperty["prop-pinheiros"],
    },
  ],
  "evt-food-week-pending-geo": [
    {
      propertyId: "prop-paulista",
      propertyName: "Loft Paulista",
      distanceKm: null,
      travelTimeMinutes: undefined,
      propertyCaptureScore: 58,
      currentPriceCents: 41000,
      recommendedPriceCents: 64000,
      minAbsorbablePriceCents: 52000,
      maxAbsorbablePriceCents: 76000,
      recommendedMultiplier: 1.6,
      maxPlausibleMultiplier: 2.1,
      bookingProbability: 0.49,
      expectedRevenueCents: 31360,
      expectedIncrementalRevenueCents: 9360,
      confidence: "medium",
      recommendedAction: "review",
      mainDrivers: ["Endereço pendente", "Público gastronomico", "Potencial alto antes do geocoder"],
      affectedNights: ["2026-06-18", "2026-06-19"],
      absorptionScenarios: scenariosByProperty["prop-paulista"].map((scenario) => ({
        ...scenario,
        dailyPriceCents:
          scenario.id === "recommended"
            ? 64000
            : scenario.id === "conservative"
              ? 52000
              : scenario.id === "aggressive"
                ? 76000
                : 94000,
      })),
    },
  ],
};

const catalogItems: EventCatalogItem[] = [
  {
    id: "evt-tech-summit-sp",
    name: "São Paulo Tech Summit",
    description: "Conferencia de tecnologia com público corporativo e alta procura por hospedagem perto de eixos de mobilidade.",
    startsAt: "2026-06-12T11:00:00.000Z",
    endsAt: "2026-06-14T22:00:00.000Z",
    city: "São Paulo",
    state: "SP",
    venueName: "Expo Center Norte",
    address: "Rua Jose Bernardo Pinto, Vila Guilherme",
    latitude: -23.5156,
    longitude: -46.6178,
    category: "Negocios",
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
    officialUrl: "https://www.sympla.com.br/",
    source: "sympla",
    crawledUrl: "https://www.sympla.com.br/eventos/sao-paulo-sp",
    urbanScore: 92,
    demandScore: 91,
    confidence: "high",
    badges: ["alto impacto", "perto de você", "fonte oficial", "demanda aquecida"],
  },
  {
    id: "evt-ibirapuera-festival",
    name: "Festival de Musica no Ibirapuera",
    description: "Festival ao ar livre com fluxo noturno e chance de aquecer a região por uma noite.",
    startsAt: "2026-07-04T18:00:00.000Z",
    endsAt: "2026-07-05T02:00:00.000Z",
    city: "São Paulo",
    state: "SP",
    venueName: "Parque Ibirapuera",
    address: "Av. Pedro Alvares Cabral, Vila Mariana",
    latitude: -23.5874,
    longitude: -46.6576,
    category: "Musica",
    imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    officialUrl: "https://www.eventim.com.br/",
    source: "eventim",
    crawledUrl: "https://www.eventim.com.br/",
    urbanScore: 88,
    demandScore: 86,
    confidence: "high",
    badges: ["alto impacto", "evento monitorado", "demanda aquecida"],
  },
  {
    id: "evt-medical-congress",
    name: "Congresso Medico Paulista",
    description: "Congresso de três dias com perfil profissional e demanda previsível perto de hospitais e centro de convenções.",
    startsAt: "2026-06-26T09:00:00.000Z",
    endsAt: "2026-06-28T18:00:00.000Z",
    city: "São Paulo",
    state: "SP",
    venueName: "Centro de Convenções Frei Caneca",
    address: "Rua Frei Caneca, Consolacao",
    latitude: -23.5545,
    longitude: -46.6534,
    category: "Congresso",
    imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    officialUrl: null,
    source: "curadoria-urban-ai",
    crawledUrl: "https://www.sympla.com.br/eventos/sao-paulo-sp",
    urbanScore: 84,
    demandScore: 83,
    confidence: "high",
    badges: ["perto de você", "evento monitorado", "fonte em validação"],
  },
  {
    id: "evt-esports-final",
    name: "Final Estadual de E-sports",
    description: "Final competitiva com público concentrado em uma noite e possível pico de busca em Pinheiros.",
    startsAt: "2026-06-20T16:00:00.000Z",
    endsAt: "2026-06-21T01:00:00.000Z",
    city: "São Paulo",
    state: "SP",
    venueName: "Arena Pinheiros",
    address: "Rua Butanta, Pinheiros",
    latitude: -23.5679,
    longitude: -46.6991,
    category: "Esportes",
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    officialUrl: null,
    source: "crawler-web",
    crawledUrl: "https://www.eventbrite.com.br/d/brazil--sao-paulo/events/",
    urbanScore: 76,
    demandScore: 74,
    confidence: "medium",
    badges: ["perto de você", "evento monitorado"],
  },
  {
    id: "evt-food-week-pending-geo",
    name: "Semana Gastronomica Centro Expandido",
    description: "Evento com bom sinal de demanda, mas ainda sem coordenada confiável do venue.",
    startsAt: "2026-06-18T18:00:00.000Z",
    endsAt: "2026-06-20T02:00:00.000Z",
    city: "São Paulo",
    state: "SP",
    venueName: "Venue a confirmar",
    address: null,
    latitude: null,
    longitude: null,
    category: "Gastronomia",
    imageUrl: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80",
    officialUrl: null,
    source: "crawler-web",
    crawledUrl: "https://www.sympla.com.br/eventos/sao-paulo-sp",
    urbanScore: 82,
    demandScore: 81,
    confidence: "medium",
    badges: ["alto impacto", "geo pendente", "evento monitorado"],
  },
];

const intelligenceById: Record<string, EventIntelligenceDetail["intelligence"]> = {
  "evt-tech-summit-sp": {
    eventDemandScore: 91,
    eventRevenuePotentialCents: 184000,
    demandRadiusKm: 6.5,
    expectedAttendance: 18000,
    sourceReliabilityScore: 0.88,
    confidence: "high",
    interpretation: "Este evento deve aquecer a região por 2 noites. Seus imóveis perto de metrô ou vias rápidas tendem a capturar melhor a demanda corporativa.",
    drivers: [
      { key: "attendance", label: "Público esperado", weight: 0.34, explanation: "Volume alto para a cidade e público com maior disposição a pagar por conveniência." },
      { key: "lead_time", label: "Antecedência", weight: 0.22, explanation: "Há tempo suficiente para testar preço sem pressionar ocupação." },
      { key: "supply", label: "Oferta no entorno", weight: 0.2, explanation: "A oferta próxima tende a comprimir perto da data." },
    ],
    riskFlags: ["Estimativa baseada em fonte externa", "Capacidade ainda não confirmada pelo organizador"],
    dataQualityFlags: ["contract_mock"],
    dataStatus: "contract_mock",
    generatedAt,
    modelVersion: "mock-v0",
    metricVersion: "event-demand-v0",
    jobRunId: "mock-host-radar-2026-05-22",
  },
  "evt-ibirapuera-festival": {
    eventDemandScore: 86,
    eventRevenuePotentialCents: 128000,
    demandRadiusKm: 4.8,
    expectedAttendance: 24000,
    sourceReliabilityScore: 0.91,
    confidence: "high",
    interpretation: "O festival deve concentrar demanda por uma noite. A faixa segura aparece antes do agressivo porque a estadia média tende a ser curta.",
    drivers: [
      { key: "venue", label: "Venue forte", weight: 0.3, explanation: "Ibirapuera cria demanda regional e fácil reconhecimento pelo hóspede." },
      { key: "night_event", label: "Evento noturno", weight: 0.24, explanation: "Hóspedes tendem a buscar hospedagem perto depois do evento." },
      { key: "weekend", label: "Fim de semana", weight: 0.2, explanation: "Soma demanda de lazer com demanda do evento." },
    ],
    riskFlags: ["Risco de chuva pode alterar comparecimento"],
    dataQualityFlags: ["contract_mock"],
    dataStatus: "contract_mock",
    generatedAt,
    modelVersion: "mock-v0",
    metricVersion: "event-demand-v0",
    jobRunId: "mock-host-radar-2026-05-22",
  },
  "evt-medical-congress": {
    eventDemandScore: 83,
    eventRevenuePotentialCents: 156000,
    demandRadiusKm: 5.2,
    expectedAttendance: 7200,
    sourceReliabilityScore: 0.74,
    confidence: "high",
    interpretation: "Congresso de vários dias costuma gerar demanda menos explosiva, mas mais previsível. Imóveis perto da Paulista podem cobrar prêmio de conveniência.",
    drivers: [
      { key: "multi_day", label: "Multiplos dias", weight: 0.28, explanation: "Aumenta noites impactadas e chance de reserva." },
      { key: "business", label: "Perfil profissional", weight: 0.26, explanation: "Hóspede valoriza localização e previsibilidade." },
      { key: "distance", label: "Proximidade", weight: 0.22, explanation: "Loft Paulista está dentro do raio de maior impacto." },
    ],
    riskFlags: ["Fonte oficial pendente"],
    dataQualityFlags: ["contract_mock"],
    dataStatus: "contract_mock",
    generatedAt,
    modelVersion: "mock-v0",
    metricVersion: "event-demand-v0",
    jobRunId: "mock-host-radar-2026-05-22",
  },
  "evt-esports-final": {
    eventDemandScore: 74,
    eventRevenuePotentialCents: 64000,
    demandRadiusKm: 3.6,
    expectedAttendance: 5200,
    sourceReliabilityScore: 0.62,
    confidence: "medium",
    interpretation: "Evento relevante, mas concentrado em uma noite. O melhor caminho e simular antes de aplicar preço agressivo.",
    drivers: [
      { key: "niche", label: "Público especifico", weight: 0.24, explanation: "Pode ter alta intencao, mas menor volume que congresso ou festival." },
      { key: "distance", label: "Proximidade", weight: 0.24, explanation: "Apartamento Pinheiros está bem posicionado." },
      { key: "confidence", label: "Fonte em validação", weight: 0.16, explanation: "Ainda há incerteza sobre público final." },
    ],
    riskFlags: ["Confiança média", "Evento de uma noite"],
    dataQualityFlags: ["contract_mock"],
    dataStatus: "contract_mock",
    generatedAt,
    modelVersion: "mock-v0",
    metricVersion: "event-demand-v0",
    jobRunId: "mock-host-radar-2026-05-22",
  },
  "evt-food-week-pending-geo": {
    eventDemandScore: 81,
    eventRevenuePotentialCents: 92000,
    demandRadiusKm: null,
    expectedAttendance: 11000,
    sourceReliabilityScore: 0.58,
    confidence: "medium",
    interpretation: "A demanda parece relevante, mas a recomendação fica em revisão até o venue receber coordenada confiável.",
    drivers: [
      { key: "category", label: "Categoria de lazer", weight: 0.24, explanation: "Gastronomia tende a gerar busca curta em fins de semana." },
      { key: "geo", label: "Geo pendente", weight: -0.2, explanation: "Sem latitude e longitude, o impacto por bairro ainda precisa de enriquecimento." },
      { key: "lead_time", label: "Antecedência", weight: 0.18, explanation: "Ainda há janela para validar endereço antes de aplicar preço." },
    ],
    riskFlags: ["Coordenada ausente", "Venue pendente"],
    dataQualityFlags: ["contract_mock", "missing_coordinates"],
    dataStatus: "contract_mock",
    generatedAt,
    modelVersion: "mock-v0",
    metricVersion: "event-demand-v0",
    jobRunId: "mock-host-radar-2026-05-22",
  },
};

const heatmap: DemandHeatmapCell[] = [
  {
    cellId: "h3-sp-vila-mariana",
    h3Index: "mock-h3-vila-mariana",
    geohashPrecision: 5,
    centerLat: -23.5874,
    centerLng: -46.6576,
    radiusKm: 2.2,
    eventDemandScore: 88,
    revenuePotentialCents: 312000,
    eventsCount: 2,
    topEventIds: ["evt-ibirapuera-festival", "evt-tech-summit-sp"],
    affectedPropertiesCount: 2,
    averageConfidence: "high",
    dominantCategory: "Musica",
    supplyCompressionScore: 81,
  },
  {
    cellId: "h3-sp-paulista",
    h3Index: "mock-h3-paulista",
    geohashPrecision: 5,
    centerLat: -23.5545,
    centerLng: -46.6534,
    radiusKm: 2.4,
    eventDemandScore: 83,
    revenuePotentialCents: 248000,
    eventsCount: 1,
    topEventIds: ["evt-medical-congress"],
    affectedPropertiesCount: 1,
    averageConfidence: "high",
    dominantCategory: "Congresso",
    supplyCompressionScore: 76,
  },
  {
    cellId: "h3-sp-pinheiros",
    h3Index: "mock-h3-pinheiros",
    geohashPrecision: 5,
    centerLat: -23.5679,
    centerLng: -46.6991,
    radiusKm: 2.1,
    eventDemandScore: 74,
    revenuePotentialCents: 98000,
    eventsCount: 1,
    topEventIds: ["evt-esports-final"],
    affectedPropertiesCount: 1,
    averageConfidence: "medium",
    dominantCategory: "Esportes",
    supplyCompressionScore: 62,
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function confidenceMatches(confidence: HostEventConfidence | undefined, filter?: HostEventConfidence | "all") {
  return !filter || filter === "all" || confidence === filter;
}

function withinDateRange(item: EventCatalogItem, from?: string, to?: string) {
  const startsAt = new Date(item.startsAt).getTime();
  if (from && startsAt < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && startsAt > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

function matchesCatalogFilters(item: EventCatalogItem, filters: HostEventCatalogFilters = {}) {
  const search = filters.search?.trim().toLowerCase();
  const haystack = [item.name, item.description, item.venueName, item.city, item.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (search && !haystack.includes(search)) return false;
  if (filters.city && filters.city !== "all" && item.city !== filters.city) return false;
  if (filters.category && filters.category !== "all" && item.category !== filters.category) return false;
  if (filters.source && filters.source !== "all" && item.source !== filters.source) return false;
  if (!confidenceMatches(item.confidence, filters.confidence)) return false;
  if (!withinDateRange(item, filters.from, filters.to)) return false;
  if (filters.nearMyProperties && !(item.badges ?? []).includes("perto de você")) return false;
  if (filters.highImpact && (item.demandScore ?? item.urbanScore ?? 0) < 80) return false;

  return true;
}

function toRadarItem(item: EventCatalogItem): HostEventRadarItem {
  const impacts = propertyImpacts[item.id] ?? [];
  const sortedImpacts = [...impacts].sort(
    (a, b) => (b.expectedIncrementalRevenueCents ?? 0) - (a.expectedIncrementalRevenueCents ?? 0),
  );
  const intelligence = intelligenceById[item.id];

  return {
    ...item,
    intelligence,
    impactedProperties: sortedImpacts,
    bestPropertyImpact: sortedImpacts[0] ?? null,
    eventRevenuePotentialCents: intelligence?.eventRevenuePotentialCents ?? null,
    demandRadiusKm: intelligence?.demandRadiusKm ?? null,
    heatLevel: item.demandScore ?? item.urbanScore ?? null,
    interpretation: intelligence?.interpretation ?? null,
  };
}

export function mockFetchHostEventCatalog(
  filters: HostEventCatalogFilters = {},
): HostEventCatalogResponse {
  const items = catalogItems.filter((item) => matchesCatalogFilters(item, filters));
  return {
    generatedAt,
    items: clone(items),
    total: items.length,
    cities: Array.from(new Set(catalogItems.map((item) => item.city))).sort(),
    categories: Array.from(new Set(catalogItems.map((item) => item.category).filter(Boolean))) as string[],
    sources: Array.from(new Set(catalogItems.map((item) => item.source).filter(Boolean))) as string[],
    mock: true,
  };
}

export function mockFetchHostEventRadar(
  filters: HostEventRadarFilters = {},
): HostEventRadarResponse {
  const catalog = mockFetchHostEventCatalog({
    from: filters.from,
    to: filters.to,
    category: filters.category,
    confidence: filters.confidence,
    highImpact: true,
  });
  const events = catalog.items
    .map(toRadarItem)
    .filter((item) =>
      filters.propertyId
        ? item.impactedProperties.some((impact) => impact.propertyId === filters.propertyId)
        : true,
    )
    .sort((a, b) => (b.eventRevenuePotentialCents ?? 0) - (a.eventRevenuePotentialCents ?? 0));

  const revenuePotentialCents = events.reduce(
    (sum, event) => sum + (event.eventRevenuePotentialCents ?? 0),
    0,
  );
  const affectedNights = new Set(
    events.flatMap((event) =>
      event.impactedProperties.flatMap((impact) => impact.affectedNights ?? []),
    ),
  );
  const impactedProperties = new Set(
    events.flatMap((event) => event.impactedProperties.map((impact) => impact.propertyId)),
  );
  const scoreTotal = events.reduce((sum, event) => sum + (event.demandScore ?? 0), 0);

  return {
    generatedAt,
    summary: {
      revenuePotentialCents,
      relevantEvents: events.length,
      opportunityNights: affectedNights.size,
      impactedProperties: impactedProperties.size,
      averageDemandScore: events.length ? Math.round(scoreTotal / events.length) : null,
    },
    events: clone(events),
    heatmap: clone(heatmap),
    mock: true,
  };
}

export function mockFetchHostEventDetail(eventId: string): HostEventDetailResponse {
  const event = catalogItems.find((item) => item.id === eventId) ?? catalogItems[0];
  const relatedEvents = catalogItems.filter((item) => item.id !== event.id).slice(0, 2);
  return {
    event: clone(event),
    intelligence: clone(intelligenceById[event.id]),
    propertyImpacts: clone(propertyImpacts[event.id] ?? []),
    relatedEvents: clone(relatedEvents),
    mock: true,
  };
}

export function mockFetchHostEventHeatmap(): DemandHeatmapCell[] {
  return clone(heatmap);
}

export function mockSimulateHostEventPricing(
  eventId: string,
  propertyId?: string,
): EventPropertyImpact | null {
  const impacts = propertyImpacts[eventId] ?? [];
  return clone(
    propertyId
      ? impacts.find((impact) => impact.propertyId === propertyId) ?? null
      : impacts[0] ?? null,
  );
}
