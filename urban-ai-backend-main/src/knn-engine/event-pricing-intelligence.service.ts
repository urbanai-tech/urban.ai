import { Injectable } from '@nestjs/common';

export const EVENT_PRICING_INTELLIGENCE_MODEL_VERSION = 'event-pricing-intelligence-v0';
export const EVENT_PRICING_INTELLIGENCE_METRIC_VERSION = 'rules-v0.1';

export type IntelligenceConfidence = 'low' | 'medium' | 'high';
export type RecommendedPricingAction = 'watch' | 'simulate' | 'apply' | 'review';
export type PriceAbsorptionScenarioName =
  | 'conservative'
  | 'recommended'
  | 'aggressive'
  | 'extreme';

export type IntelligenceDriver = {
  key: string;
  label: string;
  weight: number;
  score: number;
  explanation: string;
  value?: number | string | null;
};

export type EventDemandScoreInput = {
  relevancia?: number | null;
  expectedAttendance?: number | null;
  capacidadeEstimada?: number | null;
  venueCapacity?: number | null;
  venueType?: string | null;
  categoria?: string | null;
  raioImpactoKm?: number | null;
  leadTimeDays?: number | null;
  startsAt?: Date | string | null;
  source?: string | null;
  dataCrawl?: Date | string | null;
  sourceFreshnessHours?: number | null;
  overlapEventsCount?: number | null;
  now?: Date | string | null;
};

export type EventDemandScoreResult = {
  eventDemandScore: number;
  demandRadiusKm: number;
  sourceReliabilityScore: number;
  confidence: IntelligenceConfidence;
  expectedAttendance: number | null;
  leadTimeDays: number | null;
  generatedAt: string;
  modelVersion: string;
  metricVersion: string;
  interpretation: string;
  drivers: IntelligenceDriver[];
  riskFlags: string[];
  dataQualityFlags: string[];
};

export type PropertyCaptureScoreInput = {
  distanceKm?: number | null;
  travelTimeMinutes?: number | null;
  eventDemandScore?: number | null;
  demandRadiusKm?: number | null;
  currentPriceCents?: number | null;
  basePriceCents?: number | null;
  compMedianPriceCents?: number | null;
  occupancyRate?: number | null;
  available?: boolean | null;
  rating?: number | null;
  reviewCount?: number | null;
  accommodates?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  affectedNights?: number | null;
  eventStartsAt?: Date | string | null;
  eventEndsAt?: Date | string | null;
  now?: Date | string | null;
};

export type PropertyCaptureScoreResult = {
  propertyCaptureScore: number;
  affectedNights: number;
  confidence: IntelligenceConfidence;
  recommendedAction: RecommendedPricingAction;
  interpretation: string;
  drivers: IntelligenceDriver[];
  riskFlags: string[];
  dataQualityFlags: string[];
};

export type PriceAbsorptionGuardrailInput = {
  minMultiplier?: number | null;
  maxMultiplier?: number | null;
  maxReducaoPercent?: number | null;
  maxAumentoPercent?: number | null;
  label?: string | null;
};

export type PriceAbsorptionCalibrationInput = {
  predictedAbsorptionRate?: number | null;
  observedAbsorptionRate?: number | null;
  sampleSize?: number | null;
  minSampleSize?: number | null;
  maxAdjustment?: number | null;
  source?: string | null;
};

export type PriceAbsorptionCurveInput = {
  basePriceCents?: number | null;
  currentPriceCents?: number | null;
  marketReferencePriceCents?: number | null;
  eventDemandScore?: number | null;
  propertyCaptureScore?: number | null;
  supplyCompressionScore?: number | null;
  affectedNights?: number | null;
  confidence?: IntelligenceConfidence | null;
  guardrail?: PriceAbsorptionGuardrailInput | null;
  calibration?: PriceAbsorptionCalibrationInput | null;
};

export type PriceAbsorptionScenario = {
  scenario: PriceAbsorptionScenarioName;
  label: string;
  priceCents: number;
  uncappedPriceCents: number;
  multiplier: number;
  uncappedMultiplier: number;
  bookingProbability: number;
  expectedRevenueCents: number;
  expectedIncrementalRevenueCents: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  isRecommended: boolean;
  cappedByGuardrail: boolean;
  explanation: string;
  riskFlags: string[];
};

export type PriceAbsorptionCurveResult = {
  basePriceCents: number;
  affectedNights: number;
  minAbsorbablePriceCents: number;
  maxAbsorbablePriceCents: number;
  recommendedPriceCents: number;
  recommendedMultiplier: number;
  maxPlausibleMultiplier: number;
  bookingProbability: number;
  expectedRevenueCents: number;
  expectedIncrementalRevenueCents: number;
  confidence: IntelligenceConfidence;
  scenarios: PriceAbsorptionScenario[];
  drivers: IntelligenceDriver[];
  riskFlags: string[];
  interpretation: string;
  generatedAt: string;
  modelVersion: string;
  metricVersion: string;
};

type AttendanceResolution = {
  attendance: number | null;
  source: 'expectedAttendance' | 'capacidadeEstimada' | 'venueCapacity' | 'missing';
};

type ResolvedPriceAbsorptionCalibration = {
  predictedAbsorptionRate: number;
  observedAbsorptionRate: number;
  sampleSize: number;
  adjustment: number;
  source: string | null;
};

const SCENARIO_TEMPLATES: Array<{
  scenario: PriceAbsorptionScenarioName;
  label: string;
  fraction: number;
  probabilityAdjustment: number;
  riskLevel: PriceAbsorptionScenario['riskLevel'];
}> = [
  {
    scenario: 'conservative',
    label: 'Conservador',
    fraction: 0.32,
    probabilityAdjustment: 0.08,
    riskLevel: 'low',
  },
  {
    scenario: 'recommended',
    label: 'Recomendado',
    fraction: 0.5,
    probabilityAdjustment: 0.02,
    riskLevel: 'medium',
  },
  {
    scenario: 'aggressive',
    label: 'Agressivo',
    fraction: 0.76,
    probabilityAdjustment: -0.07,
    riskLevel: 'high',
  },
  {
    scenario: 'extreme',
    label: 'Extremo',
    fraction: 1,
    probabilityAdjustment: -0.12,
    riskLevel: 'very_high',
  },
];

@Injectable()
export class EventPricingIntelligenceService {
  eventDemandScore(input: EventDemandScoreInput): EventDemandScoreResult {
    return eventDemandScore(input);
  }

  propertyCaptureScore(input: PropertyCaptureScoreInput): PropertyCaptureScoreResult {
    return propertyCaptureScore(input);
  }

  priceAbsorptionCurve(input: PriceAbsorptionCurveInput): PriceAbsorptionCurveResult {
    return priceAbsorptionCurve(input);
  }
}

export function eventDemandScore(input: EventDemandScoreInput): EventDemandScoreResult {
  const now = parseDate(input.now) ?? new Date();
  const generatedAt = now.toISOString();
  const riskFlags: string[] = [];
  const dataQualityFlags: string[] = [];
  const attendance = resolveAttendance(input);
  const leadTimeDays = resolveLeadTimeDays(input, now);
  const sourceFreshnessHours = resolveFreshnessHours(input, now);
  const sourceReliabilityScore = sourceReliability(input.source, sourceFreshnessHours);
  const demandRadiusKm = resolveDemandRadiusKm(input, attendance.attendance);

  const relevanceKnown = isFiniteNumber(input.relevancia);
  const relevanceScore = relevanceKnown ? clamp(Number(input.relevancia), 0, 100) : 35;
  const attendanceScore = attendance.attendance
    ? logScaleScore(attendance.attendance, 80_000)
    : 25;
  const venueCategoryScore = venueDemandScore(input.venueType, input.categoria);
  const radiusScore = radiusDemandScore(demandRadiusKm);
  const leadTimeScore = leadTimeDemandScore(leadTimeDays);
  const overlapEventsCount = Math.max(0, safeNumber(input.overlapEventsCount, 0));
  const overlapBoost = clamp(overlapEventsCount * 3, 0, 8);

  if (!relevanceKnown) dataQualityFlags.push('missing_relevance');
  if (attendance.source === 'missing') {
    dataQualityFlags.push('missing_attendance');
  } else if (attendance.source !== 'expectedAttendance') {
    dataQualityFlags.push(`attendance_from_${attendance.source}`);
  }
  if (!input.venueType && !input.categoria) dataQualityFlags.push('missing_venue_context');
  if (leadTimeDays === null) dataQualityFlags.push('missing_lead_time');
  if (leadTimeDays !== null && leadTimeDays < 0) riskFlags.push('past_event');
  if (!input.raioImpactoKm) dataQualityFlags.push('radius_estimated');
  if (!input.source) dataQualityFlags.push('missing_source');
  if (sourceReliabilityScore < 50) riskFlags.push('low_source_reliability');
  if (sourceFreshnessHours !== null && sourceFreshnessHours > 168) {
    riskFlags.push('stale_source');
  }
  if (overlapEventsCount >= 3) riskFlags.push('high_event_overlap');

  const weightedScore =
    relevanceScore * 0.3 +
    attendanceScore * 0.25 +
    venueCategoryScore * 0.15 +
    radiusScore * 0.1 +
    leadTimeScore * 0.1 +
    sourceReliabilityScore * 0.1 +
    overlapBoost;
  const eventDemandScoreValue = roundScore(clamp(weightedScore, 0, 100));
  const confidence = eventDemandConfidence({
    relevanceKnown,
    attendanceSource: attendance.source,
    venueKnown: Boolean(input.venueType || input.categoria),
    leadTimeKnown: leadTimeDays !== null,
    sourceReliabilityScore,
    sourceFreshnessHours,
    riskFlags,
  });

  if (confidence === 'low') riskFlags.push('low_confidence');

  const drivers: IntelligenceDriver[] = [
    {
      key: 'relevance',
      label: 'Relevancia do evento',
      weight: 30,
      score: roundScore(relevanceScore),
      value: relevanceKnown ? Number(input.relevancia) : null,
      explanation: relevanceKnown
        ? 'Score informado pelo enriquecimento do evento.'
        : 'Sem relevancia enriquecida; usado fallback conservador.',
    },
    {
      key: 'attendance',
      label: 'Publico esperado',
      weight: 25,
      score: roundScore(attendanceScore),
      value: attendance.attendance,
      explanation:
        attendance.source === 'expectedAttendance'
          ? 'Publico esperado veio da fonte/enriquecimento.'
          : attendance.source === 'missing'
            ? 'Sem publico esperado; peso reduzido para nao superestimar demanda.'
            : `Publico inferido de ${attendance.source}.`,
    },
    {
      key: 'venue_category',
      label: 'Venue e categoria',
      weight: 15,
      score: roundScore(venueCategoryScore),
      value: input.venueType ?? input.categoria ?? null,
      explanation: 'Tipo de venue e categoria indicam amplitude da demanda criada.',
    },
    {
      key: 'impact_radius',
      label: 'Raio de impacto',
      weight: 10,
      score: roundScore(radiusScore),
      value: roundDecimal(demandRadiusKm, 1),
      explanation: input.raioImpactoKm
        ? 'Raio de impacto veio do evento enriquecido.'
        : 'Raio estimado por publico e tipo de venue.',
    },
    {
      key: 'lead_time',
      label: 'Antecedencia',
      weight: 10,
      score: roundScore(leadTimeScore),
      value: leadTimeDays,
      explanation: 'Eventos futuros com janela acionavel recebem mais peso.',
    },
    {
      key: 'source_reliability',
      label: 'Confiabilidade da fonte',
      weight: 10,
      score: roundScore(sourceReliabilityScore),
      value: input.source ?? null,
      explanation: 'Fonte oficial/API e dados frescos aumentam confianca.',
    },
  ];

  if (overlapBoost > 0) {
    drivers.push({
      key: 'event_overlap',
      label: 'Sobreposicao de eventos',
      weight: 8,
      score: roundScore(overlapBoost * 12.5),
      value: overlapEventsCount,
      explanation: 'Eventos simultaneos aumentam compressao de demanda na regiao.',
    });
  }

  return {
    eventDemandScore: eventDemandScoreValue,
    demandRadiusKm: roundDecimal(demandRadiusKm, 1),
    sourceReliabilityScore: roundScore(sourceReliabilityScore),
    confidence,
    expectedAttendance: attendance.attendance,
    leadTimeDays,
    generatedAt,
    modelVersion: EVENT_PRICING_INTELLIGENCE_MODEL_VERSION,
    metricVersion: EVENT_PRICING_INTELLIGENCE_METRIC_VERSION,
    interpretation: demandInterpretation(eventDemandScoreValue, confidence, demandRadiusKm),
    drivers,
    riskFlags: unique(riskFlags),
    dataQualityFlags: unique(dataQualityFlags),
  };
}

export function propertyCaptureScore(input: PropertyCaptureScoreInput): PropertyCaptureScoreResult {
  const riskFlags: string[] = [];
  const dataQualityFlags: string[] = [];
  const eventDemand = clamp(safeNumber(input.eventDemandScore, 45), 0, 100);
  const demandRadiusKm = clamp(safeNumber(input.demandRadiusKm, 3), 0.5, 30);
  const distanceKnown = isFiniteNumber(input.distanceKm);
  const distanceScore = distanceKnown
    ? distanceCaptureScore(Number(input.distanceKm), demandRadiusKm)
    : 40;
  const travelKnown = isFiniteNumber(input.travelTimeMinutes);
  const travelScore = travelKnown
    ? travelCaptureScore(Number(input.travelTimeMinutes))
    : distanceScore * 0.85;
  const marketScore = marketFitScore(input);
  const availabilityScore = availabilityCaptureScore(input);
  const qualityScore = propertyQualityScore(input);
  const affectedNights = resolveAffectedNights(input);

  if (!distanceKnown) dataQualityFlags.push('missing_distance');
  if (!travelKnown) dataQualityFlags.push('travel_time_estimated_from_distance');
  if (!isPositive(input.compMedianPriceCents)) dataQualityFlags.push('missing_comp_price');
  if (input.available === null || input.available === undefined) {
    dataQualityFlags.push('availability_unknown');
  }
  if (input.available === false) riskFlags.push('property_unavailable');
  if (!isFiniteNumber(input.eventDemandScore)) dataQualityFlags.push('missing_event_demand_score');
  if (!input.rating && !input.reviewCount && !input.accommodates) {
    dataQualityFlags.push('limited_property_quality_data');
  }

  let score =
    distanceScore * 0.35 +
    travelScore * 0.2 +
    eventDemand * 0.15 +
    marketScore * 0.1 +
    availabilityScore * 0.1 +
    qualityScore * 0.1;

  if (input.available === false) score = Math.min(score, 35);
  const propertyCaptureScoreValue = roundScore(clamp(score, 0, 100));
  if (propertyCaptureScoreValue < 40) riskFlags.push('low_property_capture');

  const confidence = propertyCaptureConfidence({
    distanceKnown,
    travelKnown,
    eventDemandKnown: isFiniteNumber(input.eventDemandScore),
    marketKnown: isPositive(input.compMedianPriceCents),
    availabilityKnown: input.available !== null && input.available !== undefined,
    qualityKnown: Boolean(input.rating || input.reviewCount || input.accommodates),
  });

  if (confidence === 'low') riskFlags.push('low_confidence');

  const recommendedAction = captureRecommendedAction(
    propertyCaptureScoreValue,
    confidence,
    riskFlags,
  );

  const drivers: IntelligenceDriver[] = [
    {
      key: 'distance',
      label: 'Distancia ao evento',
      weight: 35,
      score: roundScore(distanceScore),
      value: distanceKnown ? roundDecimal(Number(input.distanceKm), 2) : null,
      explanation: 'Quanto mais dentro do raio quente, maior a chance de captura.',
    },
    {
      key: 'travel_time',
      label: 'Tempo de deslocamento',
      weight: 20,
      score: roundScore(travelScore),
      value: travelKnown ? roundDecimal(Number(input.travelTimeMinutes), 0) : null,
      explanation: travelKnown
        ? 'Tempo curto aumenta conversao em eventos.'
        : 'Sem tempo de rota; estimado a partir da distancia.',
    },
    {
      key: 'event_demand',
      label: 'Demanda do evento',
      weight: 15,
      score: roundScore(eventDemand),
      value: roundScore(eventDemand),
      explanation: 'Demanda forte ajuda mesmo imoveis menos centrais.',
    },
    {
      key: 'market_fit',
      label: 'Aderencia ao mercado',
      weight: 10,
      score: roundScore(marketScore),
      value: input.compMedianPriceCents ?? null,
      explanation: 'Preco atual versus comparaveis indica folga para capturar demanda.',
    },
    {
      key: 'availability',
      label: 'Disponibilidade',
      weight: 10,
      score: roundScore(availabilityScore),
      value:
        input.available === null || input.available === undefined
          ? null
          : String(input.available),
      explanation: 'Imovel disponivel tem prioridade; indisponivel deve ser revisado.',
    },
    {
      key: 'property_quality',
      label: 'Qualidade do imovel',
      weight: 10,
      score: roundScore(qualityScore),
      value: input.rating ?? input.reviewCount ?? input.accommodates ?? null,
      explanation: 'Rating, reviews e capacidade sustentam preco maior.',
    },
  ];

  return {
    propertyCaptureScore: propertyCaptureScoreValue,
    affectedNights,
    confidence,
    recommendedAction,
    interpretation: captureInterpretation(propertyCaptureScoreValue, recommendedAction),
    drivers,
    riskFlags: unique(riskFlags),
    dataQualityFlags: unique(dataQualityFlags),
  };
}

export function priceAbsorptionCurve(
  input: PriceAbsorptionCurveInput,
): PriceAbsorptionCurveResult {
  const now = new Date();
  const generatedAt = now.toISOString();
  const riskFlags: string[] = [];
  const basePriceCents = resolveBasePriceCents(input);
  const affectedNights = clamp(Math.round(safeNumber(input.affectedNights, 1)), 1, 30);
  const demandScore = clamp(safeNumber(input.eventDemandScore, 45), 0, 100);
  const captureScore = clamp(safeNumber(input.propertyCaptureScore, 45), 0, 100);
  const supplyCompressionScore = clamp(
    safeNumber(input.supplyCompressionScore, (demandScore + captureScore) / 2),
    0,
    100,
  );
  const confidence = input.confidence ?? inferCurveConfidence(input);
  const guardrail = resolveAbsorptionGuardrail(input.guardrail);
  const maxPlausibleMultiplier = resolveMaxPlausibleMultiplier({
    basePriceCents,
    marketReferencePriceCents: input.marketReferencePriceCents,
    demandScore,
    captureScore,
    supplyCompressionScore,
    confidence,
  });
  const baselineProbability = estimateBookingProbability({
    multiplier: 1,
    maxPlausibleMultiplier,
    demandScore,
    captureScore,
    supplyCompressionScore,
    confidence,
    adjustment: 0.04,
  });
  const calibration = resolveProbabilityCalibration(input.calibration);
  const calibratedBaselineProbability = applyProbabilityCalibration(
    baselineProbability,
    calibration,
  );
  const baselineExpectedRevenueCents = Math.round(
    basePriceCents * calibratedBaselineProbability * affectedNights,
  );

  if (!basePriceCents) riskFlags.push('missing_base_price');
  if (!isFiniteNumber(input.eventDemandScore)) riskFlags.push('missing_event_demand_score');
  if (!isFiniteNumber(input.propertyCaptureScore)) {
    riskFlags.push('missing_property_capture_score');
  }
  if (!isPositive(input.marketReferencePriceCents)) riskFlags.push('missing_market_reference');
  if (confidence === 'low') riskFlags.push('low_confidence');
  if (guardrail.maxMultiplier < maxPlausibleMultiplier) riskFlags.push('guardrail_limited');
  if (maxPlausibleMultiplier >= 3.5) riskFlags.push('extreme_multiplier_possible');

  const scenarios = SCENARIO_TEMPLATES.map((template) => {
    const uncappedMultiplier = roundMultiplier(
      1 + (maxPlausibleMultiplier - 1) * template.fraction,
    );
    const multiplier = roundMultiplier(
      clamp(uncappedMultiplier, guardrail.minMultiplier, guardrail.maxMultiplier),
    );
    const cappedByGuardrail = multiplier !== uncappedMultiplier;
    const priceCents = Math.round(basePriceCents * multiplier);
    const uncappedPriceCents = Math.round(basePriceCents * uncappedMultiplier);
    const bookingProbability = applyProbabilityCalibration(
      estimateBookingProbability({
        multiplier,
        maxPlausibleMultiplier,
        demandScore,
        captureScore,
        supplyCompressionScore,
        confidence,
        adjustment: template.probabilityAdjustment,
      }),
      calibration,
    );
    const expectedRevenueCents = Math.round(priceCents * bookingProbability * affectedNights);
    const expectedIncrementalRevenueCents =
      expectedRevenueCents - baselineExpectedRevenueCents;
    const scenarioRiskFlags = scenarioRiskFlagsFor({
      scenario: template.scenario,
      bookingProbability,
      cappedByGuardrail,
      confidence,
      demandScore,
      captureScore,
      supplyCompressionScore,
    });

    return {
      scenario: template.scenario,
      label: template.label,
      priceCents,
      uncappedPriceCents,
      multiplier,
      uncappedMultiplier,
      bookingProbability,
      expectedRevenueCents,
      expectedIncrementalRevenueCents,
      riskLevel: template.riskLevel,
      isRecommended: false,
      cappedByGuardrail,
      explanation: scenarioExplanation(template.scenario, cappedByGuardrail),
      riskFlags: scenarioRiskFlags,
    };
  });

  const recommendedIndex = chooseRecommendedScenarioIndex({
    scenarios,
    confidence,
    demandScore,
    captureScore,
    supplyCompressionScore,
  });
  scenarios[recommendedIndex] = {
    ...scenarios[recommendedIndex],
    isRecommended: true,
  };
  const recommendedScenario = scenarios[recommendedIndex];

  return {
    basePriceCents,
    affectedNights,
    minAbsorbablePriceCents: scenarios[0].priceCents,
    maxAbsorbablePriceCents: scenarios[scenarios.length - 1].priceCents,
    recommendedPriceCents: recommendedScenario.priceCents,
    recommendedMultiplier: recommendedScenario.multiplier,
    maxPlausibleMultiplier,
    bookingProbability: recommendedScenario.bookingProbability,
    expectedRevenueCents: recommendedScenario.expectedRevenueCents,
    expectedIncrementalRevenueCents: recommendedScenario.expectedIncrementalRevenueCents,
    confidence,
    scenarios,
    drivers: absorptionDrivers({
      demandScore,
      captureScore,
      supplyCompressionScore,
      maxPlausibleMultiplier,
      guardrail,
      calibration,
    }),
    riskFlags: unique([
      ...riskFlags,
      ...scenarios.flatMap((scenario) => scenario.riskFlags),
    ]),
    interpretation: absorptionInterpretation(recommendedScenario, maxPlausibleMultiplier),
    generatedAt,
    modelVersion: EVENT_PRICING_INTELLIGENCE_MODEL_VERSION,
    metricVersion: EVENT_PRICING_INTELLIGENCE_METRIC_VERSION,
  };
}

function resolveAttendance(input: EventDemandScoreInput): AttendanceResolution {
  if (isPositive(input.expectedAttendance)) {
    return { attendance: Math.round(Number(input.expectedAttendance)), source: 'expectedAttendance' };
  }
  if (isPositive(input.capacidadeEstimada)) {
    return { attendance: Math.round(Number(input.capacidadeEstimada)), source: 'capacidadeEstimada' };
  }
  if (isPositive(input.venueCapacity)) {
    return { attendance: Math.round(Number(input.venueCapacity)), source: 'venueCapacity' };
  }
  return { attendance: null, source: 'missing' };
}

function resolveLeadTimeDays(input: EventDemandScoreInput, now: Date): number | null {
  if (isFiniteNumber(input.leadTimeDays)) return Math.round(Number(input.leadTimeDays));
  const startsAt = parseDate(input.startsAt);
  if (!startsAt) return null;
  return Math.ceil((startsAt.getTime() - now.getTime()) / 86_400_000);
}

function resolveFreshnessHours(input: EventDemandScoreInput, now: Date): number | null {
  if (isFiniteNumber(input.sourceFreshnessHours)) return Math.max(0, Number(input.sourceFreshnessHours));
  const dataCrawl = parseDate(input.dataCrawl);
  if (!dataCrawl) return null;
  return Math.max(0, (now.getTime() - dataCrawl.getTime()) / 3_600_000);
}

function sourceReliability(source?: string | null, freshnessHours?: number | null): number {
  const value = String(source ?? '').trim().toLowerCase();
  let score = 40;
  if (value.includes('official') || value.includes('oficial')) score = 95;
  else if (value.includes('admin-manual')) score = 90;
  else if (
    value.includes('sympla-api') ||
    value.includes('eventbrite-api') ||
    value.includes('api-football') ||
    value.includes('sp-aberta-api')
  ) {
    score = 85;
  } else if (value.includes('admin-csv')) score = 75;
  else if (value.includes('firecrawl')) score = 70;
  else if (value.includes('scraper')) score = 55;
  else if (value.includes('csv')) score = 65;

  if (freshnessHours !== null && freshnessHours !== undefined) {
    if (freshnessHours > 720) score -= 40;
    else if (freshnessHours > 168) score -= 25;
    else if (freshnessHours > 72) score -= 15;
  }

  return clamp(score, 20, 100);
}

function venueDemandScore(venueType?: string | null, categoria?: string | null): number {
  const venue = normalizedText(venueType);
  const category = normalizedText(categoria);
  const venueScore =
    venue.includes('stadium') || venue.includes('estadio')
      ? 100
      : venue.includes('arena')
        ? 90
        : venue.includes('convention') || venue.includes('convencao')
          ? 85
          : venue.includes('expo') || venue.includes('exhibition') || venue.includes('feira')
            ? 80
            : venue.includes('concert') || venue.includes('show')
              ? 75
              : venue.includes('outdoor')
                ? 65
                : venue.includes('theater') || venue.includes('teatro')
                  ? 60
                  : venue.includes('hotel')
                    ? 55
                    : venue.includes('club')
                      ? 45
                      : venue.includes('church') || venue.includes('igreja')
                        ? 35
                        : venue.includes('bar')
                          ? 25
                          : null;
  const categoryScore =
    category.includes('festival') ||
    category.includes('show') ||
    category.includes('music') ||
    category.includes('musica') ||
    category.includes('esporte') ||
    category.includes('sport')
      ? 90
      : category.includes('congresso') ||
          category.includes('conference') ||
          category.includes('business') ||
          category.includes('tech') ||
          category.includes('feira')
        ? 80
        : category.includes('cultura') || category.includes('teatro')
          ? 60
          : category.includes('gastronomia') || category.includes('food')
            ? 55
            : category.includes('relig')
              ? 45
              : category.includes('bar')
                ? 35
                : null;

  if (venueScore !== null && categoryScore !== null) return Math.max(venueScore, categoryScore);
  return venueScore ?? categoryScore ?? 45;
}

function resolveDemandRadiusKm(input: EventDemandScoreInput, attendance: number | null): number {
  if (isPositive(input.raioImpactoKm)) return clamp(Number(input.raioImpactoKm), 0.5, 30);

  let radius = 1.2;
  const people = attendance ?? 0;
  if (people >= 100_000) radius += 12;
  else if (people >= 50_000) radius += 8;
  else if (people >= 20_000) radius += 5;
  else if (people >= 5_000) radius += 3;
  else if (people >= 1_000) radius += 1.5;
  else if (people > 0) radius += 0.8;

  const venue = normalizedText(input.venueType);
  if (venue.includes('stadium') || venue.includes('estadio')) radius += 3;
  else if (venue.includes('arena')) radius += 2.5;
  else if (venue.includes('convention') || venue.includes('convencao')) radius += 2;
  else if (venue.includes('outdoor')) radius += 2;
  else if (venue.includes('theater') || venue.includes('teatro')) radius += 0.8;
  else if (venue.includes('bar')) radius += 0.3;

  return clamp(radius, 0.5, 20);
}

function radiusDemandScore(radiusKm: number): number {
  if (radiusKm >= 12) return 100;
  if (radiusKm >= 8) return 85;
  if (radiusKm >= 5) return 70;
  if (radiusKm >= 3) return 55;
  if (radiusKm >= 1.5) return 40;
  return 25;
}

function leadTimeDemandScore(leadTimeDays: number | null): number {
  if (leadTimeDays === null) return 45;
  if (leadTimeDays < 0) return 0;
  if (leadTimeDays <= 1) return 55;
  if (leadTimeDays <= 3) return 70;
  if (leadTimeDays <= 14) return 90;
  if (leadTimeDays <= 60) return 100;
  if (leadTimeDays <= 120) return 75;
  if (leadTimeDays <= 240) return 55;
  return 40;
}

function eventDemandConfidence(input: {
  relevanceKnown: boolean;
  attendanceSource: AttendanceResolution['source'];
  venueKnown: boolean;
  leadTimeKnown: boolean;
  sourceReliabilityScore: number;
  sourceFreshnessHours: number | null;
  riskFlags: string[];
}): IntelligenceConfidence {
  let quality = 0;
  if (input.relevanceKnown) quality += 20;
  if (input.attendanceSource === 'expectedAttendance') quality += 25;
  else if (input.attendanceSource !== 'missing') quality += 15;
  if (input.venueKnown) quality += 10;
  if (input.leadTimeKnown) quality += 10;
  if (input.sourceReliabilityScore >= 75) quality += 20;
  else if (input.sourceReliabilityScore >= 55) quality += 12;
  else quality += 5;
  if (input.sourceFreshnessHours === null || input.sourceFreshnessHours <= 72) quality += 15;
  else if (input.sourceFreshnessHours <= 168) quality += 8;

  if (input.riskFlags.includes('past_event')) return 'low';
  if (quality >= 75 && input.sourceReliabilityScore >= 65) return 'high';
  if (quality >= 50 && input.sourceReliabilityScore >= 45) return 'medium';
  return 'low';
}

function distanceCaptureScore(distanceKm: number, demandRadiusKm: number): number {
  const ratio = distanceKm / demandRadiusKm;
  if (ratio <= 0.25) return 100;
  if (ratio <= 0.5) return 88;
  if (ratio <= 0.75) return 72;
  if (ratio <= 1) return 58;
  if (ratio <= 1.5) return 32;
  if (ratio <= 2) return 15;
  return 5;
}

function travelCaptureScore(minutes: number): number {
  if (minutes <= 10) return 100;
  if (minutes <= 20) return 82;
  if (minutes <= 35) return 58;
  if (minutes <= 50) return 35;
  if (minutes <= 75) return 18;
  return 8;
}

function marketFitScore(input: PropertyCaptureScoreInput): number {
  const current = resolveBasePriceCents({
    currentPriceCents: input.currentPriceCents,
    basePriceCents: input.basePriceCents,
    marketReferencePriceCents: null,
  });
  const comp = safeNumber(input.compMedianPriceCents, 0);
  if (!current || !comp) return 55;
  const ratio = current / comp;
  if (ratio <= 0.85) return 95;
  if (ratio <= 1.05) return 82;
  if (ratio <= 1.25) return 55;
  if (ratio <= 1.5) return 32;
  return 18;
}

function availabilityCaptureScore(input: PropertyCaptureScoreInput): number {
  if (input.available === true) return 90;
  if (input.available === false) return 5;
  if (isFiniteNumber(input.occupancyRate)) {
    const occupancy = clamp(Number(input.occupancyRate), 0, 1);
    return roundScore(65 + occupancy * 25);
  }
  return 60;
}

function propertyQualityScore(input: PropertyCaptureScoreInput): number {
  let score = 55;
  if (isFiniteNumber(input.rating)) {
    const rating = clamp(Number(input.rating), 0, 5);
    score += (rating - 4) * 18;
  }
  if (isFiniteNumber(input.reviewCount)) {
    score += clamp(Math.log10(Number(input.reviewCount) + 1) * 12, 0, 24);
  }
  if (isFiniteNumber(input.accommodates)) {
    const accommodates = Number(input.accommodates);
    if (accommodates >= 6) score += 10;
    else if (accommodates >= 4) score += 6;
    else if (accommodates >= 2) score += 2;
  }
  if (isFiniteNumber(input.bedrooms) && Number(input.bedrooms) >= 2) score += 4;
  if (isFiniteNumber(input.bathrooms) && Number(input.bathrooms) >= 2) score += 4;
  return clamp(score, 20, 100);
}

function resolveAffectedNights(input: PropertyCaptureScoreInput): number {
  if (isPositive(input.affectedNights)) return clamp(Math.round(Number(input.affectedNights)), 1, 30);
  const startsAt = parseDate(input.eventStartsAt);
  const endsAt = parseDate(input.eventEndsAt);
  if (!startsAt || !endsAt) return 1;
  const days = Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86_400_000);
  return clamp(days || 1, 1, 30);
}

function propertyCaptureConfidence(input: {
  distanceKnown: boolean;
  travelKnown: boolean;
  eventDemandKnown: boolean;
  marketKnown: boolean;
  availabilityKnown: boolean;
  qualityKnown: boolean;
}): IntelligenceConfidence {
  let quality = 0;
  if (input.distanceKnown) quality += 25;
  if (input.travelKnown) quality += 15;
  if (input.eventDemandKnown) quality += 20;
  if (input.marketKnown) quality += 15;
  if (input.availabilityKnown) quality += 15;
  if (input.qualityKnown) quality += 10;
  if (quality >= 75) return 'high';
  if (quality >= 50) return 'medium';
  return 'low';
}

function captureRecommendedAction(
  score: number,
  confidence: IntelligenceConfidence,
  riskFlags: string[],
): RecommendedPricingAction {
  if (riskFlags.includes('property_unavailable')) return 'review';
  if (score >= 75 && confidence !== 'low') return 'apply';
  if (score >= 55) return 'simulate';
  if (score >= 35 && confidence !== 'low') return 'watch';
  return 'review';
}

function resolveBasePriceCents(input: {
  basePriceCents?: number | null;
  currentPriceCents?: number | null;
  marketReferencePriceCents?: number | null;
}): number {
  const candidates = [
    input.basePriceCents,
    input.currentPriceCents,
    input.marketReferencePriceCents,
  ];
  for (const value of candidates) {
    if (isPositive(value)) return Math.round(Number(value));
  }
  return 0;
}

function resolveAbsorptionGuardrail(
  guardrail?: PriceAbsorptionGuardrailInput | null,
): { minMultiplier: number; maxMultiplier: number; label: string | null } {
  const minMultiplier = isPositive(guardrail?.minMultiplier)
    ? Number(guardrail?.minMultiplier)
    : isFiniteNumber(guardrail?.maxReducaoPercent)
      ? 1 - Math.abs(Number(guardrail?.maxReducaoPercent)) / 100
      : 0.5;
  const maxMultiplier = isPositive(guardrail?.maxMultiplier)
    ? Number(guardrail?.maxMultiplier)
    : isFiniteNumber(guardrail?.maxAumentoPercent)
      ? 1 + Math.abs(Number(guardrail?.maxAumentoPercent)) / 100
      : 4.5;

  return {
    minMultiplier: clamp(minMultiplier, 0.1, 4.5),
    maxMultiplier: clamp(Math.max(maxMultiplier, minMultiplier), 0.1, 4.5),
    label: guardrail?.label ?? null,
  };
}

function resolveProbabilityCalibration(
  calibration?: PriceAbsorptionCalibrationInput | null,
): ResolvedPriceAbsorptionCalibration | null {
  if (!calibration) return null;
  const sampleSize = Math.round(safeNumber(calibration.sampleSize, 0));
  const minSampleSize = Math.max(1, Math.round(safeNumber(calibration.minSampleSize, 20)));
  if (sampleSize < minSampleSize) return null;

  if (
    !isFiniteNumber(calibration.predictedAbsorptionRate) ||
    !isFiniteNumber(calibration.observedAbsorptionRate)
  ) {
    return null;
  }

  const predictedAbsorptionRate = clamp(Number(calibration.predictedAbsorptionRate), 0, 1);
  const observedAbsorptionRate = clamp(Number(calibration.observedAbsorptionRate), 0, 1);
  const maxAdjustment = clamp(Math.abs(safeNumber(calibration.maxAdjustment, 0.12)), 0, 0.25);
  const sampleWeight = clamp(sampleSize / 100, 0.25, 1);
  const adjustment = roundProbability(
    clamp((observedAbsorptionRate - predictedAbsorptionRate) * sampleWeight, -maxAdjustment, maxAdjustment),
  );

  return {
    predictedAbsorptionRate,
    observedAbsorptionRate,
    sampleSize,
    adjustment,
    source: calibration.source ?? null,
  };
}

function applyProbabilityCalibration(
  probability: number,
  calibration: ResolvedPriceAbsorptionCalibration | null,
): number {
  if (!calibration) return probability;
  return roundProbability(clamp(probability + calibration.adjustment, 0.03, 0.95));
}

function resolveMaxPlausibleMultiplier(input: {
  basePriceCents: number;
  marketReferencePriceCents?: number | null;
  demandScore: number;
  captureScore: number;
  supplyCompressionScore: number;
  confidence: IntelligenceConfidence;
}): number {
  const demand = input.demandScore / 100;
  const capture = input.captureScore / 100;
  const compression = input.supplyCompressionScore / 100;
  let marketAdjustment = 0;
  if (input.basePriceCents > 0 && isPositive(input.marketReferencePriceCents)) {
    const marketRatio = Number(input.marketReferencePriceCents) / input.basePriceCents;
    marketAdjustment =
      marketRatio >= 1
        ? Math.min((marketRatio - 1) * 0.35, 0.35)
        : -Math.min((1 - marketRatio) * 0.3, 0.25);
  }

  let multiplier = 1 + demand * 1.45 + capture * 0.95 + compression * 0.85 + marketAdjustment;
  if (input.demandScore >= 90 && input.captureScore >= 80) multiplier += 0.35;
  if (input.supplyCompressionScore >= 80) multiplier += 0.25;
  if (input.captureScore < 40) multiplier -= 0.35;
  if (input.demandScore < 50) multiplier -= 0.25;
  if (input.confidence === 'low') multiplier -= 0.45;
  else if (input.confidence === 'medium') multiplier -= 0.15;

  return roundMultiplier(clamp(multiplier, 1.15, 4.5));
}

function inferCurveConfidence(input: PriceAbsorptionCurveInput): IntelligenceConfidence {
  let quality = 0;
  if (isPositive(input.basePriceCents) || isPositive(input.currentPriceCents)) quality += 25;
  if (isFiniteNumber(input.eventDemandScore)) quality += 25;
  if (isFiniteNumber(input.propertyCaptureScore)) quality += 25;
  if (isPositive(input.marketReferencePriceCents)) quality += 15;
  if (isFiniteNumber(input.supplyCompressionScore)) quality += 10;
  if (quality >= 80) return 'high';
  if (quality >= 50) return 'medium';
  return 'low';
}

function estimateBookingProbability(input: {
  multiplier: number;
  maxPlausibleMultiplier: number;
  demandScore: number;
  captureScore: number;
  supplyCompressionScore: number;
  confidence: IntelligenceConfidence;
  adjustment: number;
}): number {
  const demandIndex = (input.demandScore * 0.6 + input.captureScore * 0.4) / 100;
  const compression = input.supplyCompressionScore / 100;
  let baseProbability = 0.28 + demandIndex * 0.5 + compression * 0.12;
  if (input.confidence === 'low') baseProbability -= 0.18;
  else if (input.confidence === 'medium') baseProbability -= 0.06;
  baseProbability = clamp(baseProbability, 0.22, 0.9);

  const floorProbability = clamp(0.05 + demandIndex * 0.16 + compression * 0.04, 0.06, 0.28);
  const pricePosition =
    input.maxPlausibleMultiplier > 1
      ? clamp((input.multiplier - 1) / (input.maxPlausibleMultiplier - 1), 0, 1)
      : 0;
  const pricePenalty = Math.pow(pricePosition, 1.25);
  const probability =
    baseProbability -
    (baseProbability - floorProbability) * pricePenalty +
    input.adjustment;

  return roundProbability(clamp(probability, 0.03, 0.95));
}

function scenarioRiskFlagsFor(input: {
  scenario: PriceAbsorptionScenarioName;
  bookingProbability: number;
  cappedByGuardrail: boolean;
  confidence: IntelligenceConfidence;
  demandScore: number;
  captureScore: number;
  supplyCompressionScore: number;
}): string[] {
  const flags: string[] = [];
  if (input.cappedByGuardrail) flags.push('guardrail_limited');
  if (input.confidence === 'low') flags.push('low_confidence');
  if (input.bookingProbability < 0.25) flags.push('high_vacancy_risk');
  if (input.scenario === 'extreme') flags.push('extreme_price_risk');
  if (input.scenario === 'extreme' && input.supplyCompressionScore < 75) {
    flags.push('extreme_requires_supply_compression');
  }
  if (input.captureScore < 50) flags.push('weak_property_capture');
  if (input.demandScore < 55) flags.push('weak_event_demand');
  return unique(flags);
}

function chooseRecommendedScenarioIndex(input: {
  scenarios: PriceAbsorptionScenario[];
  confidence: IntelligenceConfidence;
  demandScore: number;
  captureScore: number;
  supplyCompressionScore: number;
}): number {
  const extremeAllowed =
    input.confidence === 'high' &&
    input.demandScore >= 85 &&
    input.captureScore >= 80 &&
    input.supplyCompressionScore >= 70;
  const candidateScenarios = input.scenarios
    .map((scenario, index) => ({ scenario, index }))
    .filter(({ scenario }) => extremeAllowed || scenario.scenario !== 'extreme');

  return candidateScenarios.sort((left, right) => {
    if (right.scenario.expectedRevenueCents !== left.scenario.expectedRevenueCents) {
      return right.scenario.expectedRevenueCents - left.scenario.expectedRevenueCents;
    }
    return scenarioPreference(left.scenario.scenario) - scenarioPreference(right.scenario.scenario);
  })[0].index;
}

function scenarioPreference(scenario: PriceAbsorptionScenarioName): number {
  switch (scenario) {
    case 'recommended':
      return 0;
    case 'conservative':
      return 1;
    case 'aggressive':
      return 2;
    case 'extreme':
      return 3;
  }
}

function absorptionDrivers(input: {
  demandScore: number;
  captureScore: number;
  supplyCompressionScore: number;
  maxPlausibleMultiplier: number;
  guardrail: { minMultiplier: number; maxMultiplier: number; label: string | null };
  calibration?: ResolvedPriceAbsorptionCalibration | null;
}): IntelligenceDriver[] {
  const drivers: IntelligenceDriver[] = [
    {
      key: 'event_demand',
      label: 'Demanda do evento',
      weight: 35,
      score: roundScore(input.demandScore),
      value: roundScore(input.demandScore),
      explanation: 'Score de demanda aumenta a faixa de preco absorvivel.',
    },
    {
      key: 'property_capture',
      label: 'Captura do imovel',
      weight: 30,
      score: roundScore(input.captureScore),
      value: roundScore(input.captureScore),
      explanation: 'Imovel mais perto e conveniente sustenta preco maior.',
    },
    {
      key: 'supply_compression',
      label: 'Compressao de oferta',
      weight: 20,
      score: roundScore(input.supplyCompressionScore),
      value: roundScore(input.supplyCompressionScore),
      explanation: 'Oferta curta aumenta tolerancia do mercado a multiplicadores maiores.',
    },
    {
      key: 'max_plausible_multiplier',
      label: 'Multiplicador plausivel',
      weight: 10,
      score: roundScore((input.maxPlausibleMultiplier / 4.5) * 100),
      value: input.maxPlausibleMultiplier,
      explanation: 'Limite v0 antes de guardrails, usado para montar os cenarios.',
    },
    {
      key: 'guardrail',
      label: 'Guardrail do host',
      weight: 5,
      score: roundScore((input.guardrail.maxMultiplier / 4.5) * 100),
      value: input.guardrail.label ?? input.guardrail.maxMultiplier,
      explanation: 'Limite do host ou da plataforma corta sugestoes acima do permitido.',
    },
  ];

  if (input.calibration) {
    drivers.push({
      key: 'outcome_calibration',
      label: 'Calibracao por outcomes',
      weight: 10,
      score: roundScore(input.calibration.observedAbsorptionRate * 100),
      value: input.calibration.sampleSize,
      explanation:
        `Probabilidade ajustada em ${input.calibration.adjustment} ponto absoluto ` +
        `a partir de outcomes reais de absorcao.`,
    });
  }

  return drivers;
}

function demandInterpretation(
  score: number,
  confidence: IntelligenceConfidence,
  radiusKm: number,
): string {
  const strength =
    score >= 80
      ? 'alto potencial de demanda'
      : score >= 60
        ? 'potencial relevante de demanda'
        : score >= 40
          ? 'impacto moderado'
          : 'impacto baixo';
  return `Evento com ${strength} em raio aproximado de ${roundDecimal(
    radiusKm,
    1,
  )} km. Confianca ${confidence}; score combina relevancia, publico, venue, antecedencia, fonte e sobreposicao.`;
}

function captureInterpretation(score: number, action: RecommendedPricingAction): string {
  const strength =
    score >= 75
      ? 'alta captura provavel'
      : score >= 55
        ? 'captura razoavel'
        : score >= 35
          ? 'captura limitada'
          : 'baixa captura';
  return `Imovel com ${strength}. Acao v0 sugerida: ${action}.`;
}

function absorptionInterpretation(
  recommendedScenario: PriceAbsorptionScenario,
  maxPlausibleMultiplier: number,
): string {
  return `Cenario ${recommendedScenario.label.toLowerCase()} escolhido por receita esperada, com probabilidade estimada de ${Math.round(
    recommendedScenario.bookingProbability * 100,
  )}%. O multiplicador maximo plausivel v0 e ${maxPlausibleMultiplier}x, sem promessa de reserva.`;
}

function scenarioExplanation(
  scenario: PriceAbsorptionScenarioName,
  cappedByGuardrail: boolean,
): string {
  const suffix = cappedByGuardrail
    ? ' Guardrail aplicado; preco exibido foi limitado.'
    : '';
  switch (scenario) {
    case 'conservative':
      return `Prioriza chance de reserva e menor risco de vacancia.${suffix}`;
    case 'recommended':
      return `Equilibra diaria maior e probabilidade de absorcao.${suffix}`;
    case 'aggressive':
      return `Busca capturar upside, aceitando queda relevante na chance de reserva.${suffix}`;
    case 'extreme':
      return `So faz sentido com demanda e compressao muito fortes; risco de vacancia alto.${suffix}`;
  }
}

function logScaleScore(value: number, maxReference: number): number {
  if (value <= 0) return 0;
  return clamp((Math.log10(value + 1) / Math.log10(maxReference + 1)) * 100, 0, 100);
}

function normalizedText(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function parseDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFiniteNumber(value: unknown): boolean {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function isPositive(value: unknown): boolean {
  return isFiniteNumber(value) && Number(value) > 0;
}

function safeNumber(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundScore(value: number): number {
  return Math.round(value);
}

function roundMultiplier(value: number): number {
  return Number(value.toFixed(2));
}

function roundProbability(value: number): number {
  return Number(value.toFixed(2));
}

function roundDecimal(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
