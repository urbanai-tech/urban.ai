# Event Radar Contract v0

Data: 2026-05-22
Owner: Lia Contratos
Escopo: contrato P0 para `Eventos na Cidade`, `Radar de Eventos`, `Radar de Demanda Admin` e fundacao de decision snapshots.

## Status

O backend agora expoe endpoints reais com `contractVersion: "event-radar-v0"`.

Dados ja usados:

- `events`
- `analise_preco`
- `event_intelligence_snapshots`
- `event_property_impacts`

Dados reservados para o motor:

- `eventRevenuePotentialCents`
- `bookingProbability`
- `expectedRevenueCents`
- `priceAbsorptionScenarios`
- `supplyCompressionScore`

Quando o motor ainda nao alimentou o campo, a resposta usa `dataStatus: "stub_pending_engine"` ou `derived_from_*` e mantem o campo como `null`/`[]`.

## Pricing decision outcomes e learning loop

`pricing_decision_snapshot.inputSignals.outcome` e o contrato v0 para fechar o loop entre recomendacao, aceite, aplicacao, reserva e receita.

Fontes aceitas:

- `price_update`: push Stays/Airbnb criado por `StaysService.pushPrice`; cobre aceite/pending, sucesso/aplicacao, rejeicao do canal e erro operacional.
- `analise_preco`: feedback do dashboard/manual; cobre aceite, rejeicao do host, preco aplicado, reserva, receita real e noites.
- `manual`: backfill/admin enquanto reservas reais ainda nao chegam por integracao.

Shape logico persistido em `inputSignals.outcome`:

```ts
type PricingDecisionOutcome = {
  decisionStatus?: "suggested" | "accepted" | "applied" | "rejected" | "expired" | "superseded" | null;
  status: "unknown" | "booked" | "not_booked" | "blocked" | "pending" | "cancelled";
  appliedPriceCents?: number | null;
  expectedRevenueCents?: number | null;
  expectedIncrementalRevenueCents?: number | null;
  realizedRevenueCents?: number | null;
  bookedNights?: number | null;
  reservationGenerated?: boolean | null;
  externalReservationId?: string | null;
  priceAbsorbed?: boolean | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  appliedAt?: string | null;
  recordedAt?: string | null;
  source?: "price_update" | "analise_preco" | "manual" | string | null;
  sourceDetail?: string | null;
  currency?: string | null;
  priceUpdateId?: string | null;
  priceUpdateStatus?: string | null;
  priceUpdateOrigin?: string | null;
  revenueDeltaCents?: number | null;
  note?: string | null;
};
```

Dataset de aprendizado:

- `PricingOutcomeLearningService.buildAbsorptionLearningDataset(...)` transforma snapshots com outcome em linhas de treino.
- Linhas com `booked`, `not_booked`, `cancelled` ou `rejected` entram na calibracao; `blocked`, `pending` e `unknown` ficam fora de treino ate haver ground truth.
- `PricingOutcomeLearningService.buildProbabilityCalibration(...)` gera `PriceAbsorptionCalibrationInput`, que pode ser passado a `priceAbsorptionCurve({ calibration })` para ajustar `bookingProbability` por outcomes reais.

## Endpoints host

### `GET /host/events/catalog`

Query: `city`, `from`, `to`, `category`, `venue`, `search`, `nearMyProperties`, `propertyId`, `confidence`, `limit`.

Response:

```ts
{
  contractVersion: "event-radar-v0";
  generatedAt: string;
  filters: Record<string, unknown>;
  items: EventCatalogItem[];
  meta: { count: number; dataStatus: string };
}
```

### `GET /host/events/radar`

Query: `from`, `to`, `propertyId`, `category`, `confidence`.

Response:

```ts
{
  contractVersion: "event-radar-v0";
  generatedAt: string;
  summary: {
    relevantEvents: number;
    impactedProperties: number;
    opportunities: number;
    expectedIncrementalRevenueCents: number;
    dataStatus: string;
  };
  items: Array<{
    event: EventCatalogItem;
    intelligence: EventIntelligencePayload;
    bestImpact: EventPropertyImpactPayload;
    impacts: EventPropertyImpactPayload[];
  }>;
  stubs: Array<{ owner: "Nico Engine"; status: "stub_pending_engine"; fields: string[] }>;
}
```

### Outros host

- `GET /host/events/heatmap`
- `GET /host/events/:eventId`
- `GET /host/events/:eventId/intelligence`
- `GET /host/events/:eventId/property-impact`
- `POST /host/events/:eventId/simulate-pricing`

### Heatmap geo/celulas

`heatmap` pode vir dentro de `GET /host/events/radar`, em `GET /host/events/heatmap` e em `GET /admin/events/heatmap`.

```ts
type EventRadarHeatmapCell = {
  cellId: string;
  h3Index?: string | null;
  geohash?: string | null;
  geohashPrecision?: number | null;
  bbox?: [number, number, number, number] | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  eventDemandScore: number | null;
  revenuePotentialCents: number | null;
  eventsCount: number;
  topEventIds: string[];
  affectedPropertiesCount: number;
  averageConfidence: "low" | "medium" | "high" | number;
  dominantCategory?: string | null;
  supplyCompressionScore?: number | null;
  coverageScore?: number;
  dataStatus?: "persisted" | "derived_from_events" | string;
};
```

Regras de UX/contrato:

- `h3Index` e `geohash` sao opcionais, mas pelo menos um codigo de celula deve estar disponivel via `cellId`.
- Celulas sem `centerLat`/`centerLng` entram nas listas operacionais, mas nao devem ser desenhadas no mapa.
- Eventos sem latitude/longitude continuam nas listas/calendario e devem ser expostos como backlog de geocoder.
- Quando o backend nao retornar celulas, o front pode derivar celulas temporarias por geohash a partir dos eventos com coordenadas e marcar `dataStatus: "derived_from_events"`.

## Endpoints admin

- `GET /admin/events/intelligence`
- `GET /admin/events/:eventId/intelligence`
- `GET /admin/events/:eventId/property-impact`
- `GET /admin/events/heatmap`
- `GET /admin/events/blind-spots`
- `POST /admin/events/:eventId/recompute-intelligence`
- `POST /admin/events/intelligence/recompute`

`recompute-*` ainda retorna stub explicito ate a Nico conectar o job real de scoring.

## Tipos principais

```ts
type EventCatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  city: string | null;
  state: string | null;
  venueName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  imageUrl?: string | null;
  officialUrl?: string | null;
  crawledUrl?: string | null;
  source?: string | null;
  urbanScore: number | null;
  demandScore?: number | null;
  confidence?: "low" | "medium" | "high";
  badges: string[];
};
```

```ts
type EventIntelligencePayload = {
  eventDemandScore: number | null;
  eventRevenuePotentialCents: number | null;
  demandRadiusKm: number | null;
  expectedAttendance: number | null;
  sourceReliabilityScore: number | null;
  sourceFreshnessHours: number | null;
  confidence: "low" | "medium" | "high";
  interpretation: string;
  drivers: Array<{ key: string; label: string; weight: number; explanation: string }>;
  hotRegions: unknown[];
  riskFlags: string[];
  dataQualityFlags: string[];
  generatedAt: string;
  modelVersion: string;
  metricVersion: string;
  jobRunId?: string | null;
  dataStatus: "persisted" | "derived_from_event_fields" | "derived_from_analise_preco" | "stub_pending_engine";
};
```

```ts
type EventPropertyImpactPayload = {
  propertyId: string;
  propertyName: string;
  listId?: string | null;
  distanceKm: number | null;
  travelTimeMinutes?: number | null;
  propertyCaptureScore: number | null;
  basePriceCents: number | null;
  currentPriceCents: number | null;
  recommendedPriceCents: number | null;
  minAbsorbablePriceCents: number | null;
  maxAbsorbablePriceCents: number | null;
  recommendedMultiplier: number | null;
  maxPlausibleMultiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  expectedIncrementalRevenueCents: number | null;
  confidence: "low" | "medium" | "high";
  mainDrivers: string[];
  priceAbsorptionScenarios: Array<{
    scenario: string;
    priceCents: number | null;
    multiplier: number | null;
    bookingProbability: number | null;
    expectedRevenueCents: number | null;
    interpretation: string;
  }>;
  recommendedAction: "watch" | "simulate" | "apply" | "review";
  riskFlags: string[];
  generatedAt: string;
  modelVersion: string;
  metricVersion: string;
  jobRunId?: string | null;
  dataStatus: string;
};
```

## Dependencias

- Nico: preencher snapshots persistidos, curvas e recompute real.
- Maya: consumir host endpoints; `dataStatus` deve orientar empty/pending states.
- Otto: consumir admin endpoints; blind spots e recompute ja tem rotas estaveis.
- Tais: validar contrato e cobrir happy path + empty/stub states.
