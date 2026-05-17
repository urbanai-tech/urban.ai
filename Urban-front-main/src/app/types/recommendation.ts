/**
 * Tipos do Contrato A — recomendacao enriquecida (Dev 1 -> Dev 2).
 *
 * Roadmap 4 Tracks (semana 1-2, Gap 6). Espelha o tipo publicado por
 * Dev 1 em `urban-ai-backend-main/src/types/recommendation.ts`.
 *
 * Consumido por `<RecommendationCard>`, `<DriverBar>`, `<ScenarioComparison>`.
 */

export type DriverSegment = {
  /** Peso 0-100 do driver dentro do mix. Soma dos 4 = 100. */
  weight: number;
  /** Rotulo curto pra UI (ex: "+12% pela proximidade do show"). */
  label: string;
};

export type Drivers = {
  event: DriverSegment;
  pace: DriverSegment;
  compSet: DriverSegment;
  seasonality: DriverSegment;
};

export type HistoricalComparison = {
  similarDatesLastYear: {
    adr: number;
    occupancy: number;
    n: number;
  };
  comparableHosts: {
    medianAdr: number;
    medianOccupancy: number;
  };
};

export type ScenarioLabel = "sugerido" | "atual" | "agressivo";

export type Scenario = {
  label: ScenarioLabel;
  price: number;
  estimatedOccupancy: number;
  estimatedRevenue: number;
};
