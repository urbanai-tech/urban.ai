import { Injectable } from '@nestjs/common';
import {
  priceAbsorptionCurve,
  PriceAbsorptionCurveInput,
  PriceAbsorptionCurveResult,
  PriceAbsorptionScenario as EnginePriceAbsorptionScenario,
  PriceAbsorptionScenarioName,
} from '../knn-engine/event-pricing-intelligence.service';
import {
  PricingDecisionSnapshot,
  PricingDecisionSnapshotGuardrails,
  PricingDecisionSnapshotInputSignals,
  PricingDecisionSnapshotOutcomeStatus,
  PricingDecisionStatus,
} from '../entities/pricing-decision-snapshot.entity';
import { PriceAbsorptionScenario } from '../entities/event-property-impact.entity';

type AjustePrecoParams = {
  precoReferencia: number;
  seuPrecoAtual: number;
  capacidadeReferencia: number;
  suaCapacidade: number;
  banheiroReferencia: number;
  seuBanheiro: number;
  ocupacaoReferencia?: number;
  suaOcupacao?: number;
  fatorLocalizacao?: number;
  relevanciaEvento?: number | null;
  publicoEsperado?: number | null;
  maxAumentoPercent?: number;
  maxReducaoPercent?: number;
};

type AjustePrecoResultado = {
  precoSugerido: number;
  seuPrecoAtual: number;
  diferencaPercentual: number;
  recomendacao: string;
  motivo: string;
};

export const PRICING_DECISION_AUDIT_TRAIL_VERSION = 'pricing-decision-audit-v0';
export const PRICING_DECISION_AUDIT_SOURCE = 'pricing-calculate.service';

export type PricingDecisionSnapshotAuditInput = {
  user: PricingDecisionSnapshot['user'];
  property?: PricingDecisionSnapshot['property'];
  list?: PricingDecisionSnapshot['list'];
  event?: PricingDecisionSnapshot['event'];
  eventIntelligenceSnapshot?: PricingDecisionSnapshot['eventIntelligenceSnapshot'];
  eventPropertyImpact?: PricingDecisionSnapshot['eventPropertyImpact'];
  analisePreco?: PricingDecisionSnapshot['analisePreco'];
  priceUpdate?: PricingDecisionSnapshot['priceUpdate'];
  targetDate?: string | Date | null;
  generatedAt?: string | Date | null;
  jobRunId?: string | null;
  decisionType?: string | null;
  status?: PricingDecisionStatus | null;
  priceInput?: PriceAbsorptionCurveInput | null;
  priceAbsorptionCurve?: PriceAbsorptionCurveResult | null;
  selectedScenario?: PriceAbsorptionScenarioName | string | null;
  selectedPriceCents?: number | null;
  appliedPriceCents?: number | null;
  inputSignals?: Partial<PricingDecisionSnapshotInputSignals> | null;
  guardrails?: PricingDecisionSnapshotGuardrails | null;
};

export type PricingDecisionSnapshotAuditDraft = Omit<
  Partial<PricingDecisionSnapshot>,
  'inputSignals' | 'guardrails' | 'priceAbsorptionScenarios'
> & {
  inputSignals: PricingDecisionSnapshotInputSignals;
  guardrails: PricingDecisionSnapshotGuardrails;
  priceAbsorptionScenarios: PriceAbsorptionScenario[];
};

export type PricingDecisionOutcomeAuditInput = {
  snapshot?: Partial<PricingDecisionSnapshot> | null;
  priceUpdate?: PricingDecisionSnapshot['priceUpdate'];
  analisePreco?: PricingDecisionSnapshot['analisePreco'];
  decisionStatus?: PricingDecisionStatus | null;
  status?: PricingDecisionSnapshotOutcomeStatus | null;
  appliedPriceCents?: number | null;
  expectedRevenueCents?: number | null;
  expectedIncrementalRevenueCents?: number | null;
  realizedRevenueCents?: number | null;
  bookedNights?: number | null;
  externalReservationId?: string | null;
  acceptedAt?: string | Date | null;
  rejectedAt?: string | Date | null;
  appliedAt?: string | Date | null;
  recordedAt?: string | Date | null;
  source?: string | null;
  sourceDetail?: string | null;
  currency?: string | null;
  note?: string | null;
};

export type PricingDecisionOutcomeAuditPatch = Pick<
  Partial<PricingDecisionSnapshot>,
  | 'status'
  | 'priceUpdate'
  | 'appliedPriceCents'
  | 'expectedRevenueCents'
  | 'expectedIncrementalRevenueCents'
  | 'inputSignals'
  | 'riskFlags'
> & {
  inputSignals: PricingDecisionSnapshotInputSignals;
};

@Injectable()
export class PricingCalculateService {
  calcularCurvaAbsorcaoEvento(input: PriceAbsorptionCurveInput): PriceAbsorptionCurveResult {
    return priceAbsorptionCurve(input);
  }

  criarSnapshotDecisaoPricingEvento(
    input: PricingDecisionSnapshotAuditInput,
  ): PricingDecisionSnapshotAuditDraft {
    const priceInput = this.normalizeAuditPriceInput(input);
    const curve = input.priceAbsorptionCurve ?? this.calcularCurvaAbsorcaoEvento(priceInput);
    const selectedScenario = this.resolveSelectedScenario(curve, input.selectedScenario);
    const currentPriceCents =
      this.toCents(priceInput.currentPriceCents) ??
      this.moneyToCents(input.analisePreco?.seuPrecoAtual) ??
      this.toCents(curve.basePriceCents);
    const selectedPriceCents =
      this.toCents(input.selectedPriceCents) ?? this.toCents(selectedScenario.priceCents);
    const appliedPriceCents =
      this.toCents(input.appliedPriceCents) ?? this.toCents(input.priceUpdate?.newPriceCents);
    const recommendedMultiplier =
      this.toDecimal(curve.recommendedMultiplier) ??
      this.multiplierFromPrices(curve.recommendedPriceCents, curve.basePriceCents);
    const status = input.status ?? this.resolveDecisionStatus(appliedPriceCents, input.priceUpdate);

    return {
      user: input.user,
      property: input.property ?? input.analisePreco?.endereco ?? null,
      list: input.list ?? input.property?.list ?? input.analisePreco?.endereco?.list ?? null,
      event: input.event ?? input.analisePreco?.evento ?? null,
      eventIntelligenceSnapshot: input.eventIntelligenceSnapshot ?? null,
      eventPropertyImpact: input.eventPropertyImpact ?? null,
      analisePreco: input.analisePreco ?? null,
      priceUpdate: input.priceUpdate ?? null,
      targetDate: this.normalizeTargetDate(input.targetDate ?? input.event?.dataInicio ?? null),
      generatedAt: this.toDate(input.generatedAt) ?? new Date(),
      jobRunId: input.jobRunId ?? null,
      metricVersion: curve.metricVersion,
      modelVersion: curve.modelVersion,
      decisionType: input.decisionType ?? 'event_pricing',
      basePriceCents: this.toCents(curve.basePriceCents),
      currentPriceCents,
      recommendedPriceCents: this.toCents(curve.recommendedPriceCents),
      selectedPriceCents,
      appliedPriceCents,
      recommendedMultiplier,
      bookingProbability: this.toDecimal(selectedScenario.bookingProbability),
      expectedRevenueCents: this.toCents(selectedScenario.expectedRevenueCents),
      expectedIncrementalRevenueCents: this.toCents(
        selectedScenario.expectedIncrementalRevenueCents,
      ),
      confidence: curve.confidence,
      status,
      inputSignals: this.buildDecisionInputSignals(input, priceInput, curve, selectedScenario),
      guardrails: this.buildDecisionGuardrails(input, priceInput, curve),
      drivers: this.mapAuditDrivers(curve.drivers),
      priceAbsorptionScenarios: this.mapAuditScenarios(curve.scenarios),
      riskFlags: this.unique([...(curve.riskFlags ?? []), ...(selectedScenario.riskFlags ?? [])]),
      explanation: curve.interpretation,
    };
  }

  criarPatchOutcomeSnapshotDecisao(
    input: PricingDecisionOutcomeAuditInput,
  ): PricingDecisionOutcomeAuditPatch {
    const snapshot = input.snapshot ?? {};
    const priceUpdate = input.priceUpdate ?? snapshot.priceUpdate ?? null;
    const analisePreco = input.analisePreco ?? snapshot.analisePreco ?? priceUpdate?.analise ?? null;
    const appliedPriceCents =
      this.toCents(input.appliedPriceCents) ??
      this.toCents(priceUpdate?.newPriceCents) ??
      this.moneyToCents(analisePreco?.precoAplicado) ??
      this.toCents(snapshot.appliedPriceCents);
    const realizedRevenueCents =
      this.toCents(input.realizedRevenueCents) ?? this.moneyToCents(analisePreco?.receitaReal);
    const expectedRevenueCents =
      this.toCents(input.expectedRevenueCents) ?? this.toCents(snapshot.expectedRevenueCents);
    const expectedIncrementalRevenueCents =
      this.toCents(input.expectedIncrementalRevenueCents) ??
      this.toCents(snapshot.expectedIncrementalRevenueCents);
    const bookedNights = this.toInteger(input.bookedNights) ?? this.toInteger(analisePreco?.noitesReservadas);
    const outcomeStatus =
      input.status ??
      this.normalizeOutcomeStatus(analisePreco?.reservaStatus) ??
      this.resolveOutcomeStatus(realizedRevenueCents, bookedNights);
    const decisionStatus = this.resolveDecisionStatusFromOutcome({
      requestedStatus: input.decisionStatus,
      priceUpdate,
      analisePreco,
      outcomeStatus,
      currentStatus: snapshot.status,
      appliedPriceCents,
    });
    const revenueDeltaCents =
      realizedRevenueCents !== null && expectedRevenueCents !== null
        ? realizedRevenueCents - expectedRevenueCents
        : null;
    const source = input.source ?? this.resolveOutcomeSource(priceUpdate, analisePreco);
    const sourceDetail =
      input.sourceDetail ?? priceUpdate?.origin ?? analisePreco?.origemAplicacao ?? null;
    const reservationGenerated =
      outcomeStatus === 'booked' ||
      Boolean(input.externalReservationId) ||
      Boolean(this.isPositive(bookedNights));
    const existingSignals = snapshot.inputSignals ?? {
      auditTrailVersion: PRICING_DECISION_AUDIT_TRAIL_VERSION,
      generatedFrom: PRICING_DECISION_AUDIT_SOURCE,
    };
    const riskFlags = this.unique([
      ...(snapshot.riskFlags ?? []),
      ...this.outcomeRiskFlags({
        outcomeStatus,
        decisionStatus,
        appliedPriceCents,
        selectedPriceCents: snapshot.selectedPriceCents,
        expectedRevenueCents,
        realizedRevenueCents,
      }),
    ]);

    return {
      priceUpdate,
      appliedPriceCents,
      expectedRevenueCents,
      expectedIncrementalRevenueCents,
      status: decisionStatus,
      inputSignals: {
        ...existingSignals,
        auditTrailVersion:
          existingSignals.auditTrailVersion ?? PRICING_DECISION_AUDIT_TRAIL_VERSION,
        generatedFrom: existingSignals.generatedFrom ?? PRICING_DECISION_AUDIT_SOURCE,
        outcome: {
          decisionStatus,
          status: outcomeStatus,
          appliedPriceCents,
          expectedRevenueCents,
          expectedIncrementalRevenueCents,
          realizedRevenueCents,
          bookedNights,
          reservationGenerated,
          externalReservationId: input.externalReservationId ?? null,
          priceAbsorbed: outcomeStatus === 'booked' && appliedPriceCents !== null,
          acceptedAt: this.toIso(input.acceptedAt) ?? this.toIso(analisePreco?.aceitoEm),
          rejectedAt: this.toIso(input.rejectedAt) ?? this.toIso(analisePreco?.rejeitadoEm),
          appliedAt:
            this.toIso(input.appliedAt) ??
            this.toIso(analisePreco?.aplicadoEm) ??
            (decisionStatus === 'applied' ? this.toIso(priceUpdate?.createdAt) : null),
          recordedAt:
            this.toIso(input.recordedAt) ??
            this.toIso(analisePreco?.resultadoRegistradoEm) ??
            new Date().toISOString(),
          source,
          sourceDetail,
          currency: input.currency ?? priceUpdate?.currency ?? null,
          priceUpdateId: this.entityId(priceUpdate),
          priceUpdateStatus: priceUpdate?.status ?? null,
          priceUpdateOrigin: priceUpdate?.origin ?? null,
          revenueDeltaCents,
          note: input.note ?? analisePreco?.feedbackObservacao ?? null,
        },
      },
      riskFlags,
    };
  }

  calcular({
    precoReferencia,
    seuPrecoAtual,
    capacidadeReferencia,
    suaCapacidade,
    banheiroReferencia,
    seuBanheiro,
    ocupacaoReferencia,
    suaOcupacao,
    fatorLocalizacao = 1.0,
    relevanciaEvento,
    publicoEsperado,
    maxAumentoPercent = 45,
    maxReducaoPercent = 25,
  }: AjustePrecoParams): AjustePrecoResultado {
    if (!this.isPositive(seuPrecoAtual) || !this.isPositive(precoReferencia)) {
      return {
        precoSugerido: this.roundMoney(seuPrecoAtual || precoReferencia || 0),
        seuPrecoAtual: this.roundMoney(seuPrecoAtual || 0),
        diferencaPercentual: 0,
        recomendacao: 'Manter',
        motivo: 'Preco atual ou preco de referencia ausente/invalidos; sugestao conservadora.',
      };
    }

    const ajusteCapacidade = this.clamp(
      1 + (this.safeNumber(suaCapacidade, 1) - this.safeNumber(capacidadeReferencia, 1)) * 0.04,
      0.85,
      1.2,
    );
    const ajusteBanheiro = this.clamp(
      1 + (this.safeNumber(seuBanheiro, 1) - this.safeNumber(banheiroReferencia, 1)) * 0.05,
      0.9,
      1.15,
    );
    const ajusteLocalizacao = this.clamp(this.safeNumber(fatorLocalizacao, 1), 0.9, 1.15);

    let fatorOcupacao = 1;
    if (this.isFiniteNumber(suaOcupacao) && this.isFiniteNumber(ocupacaoReferencia)) {
      fatorOcupacao = this.clamp(
        1 + (Number(suaOcupacao) - Number(ocupacaoReferencia)) * 0.005,
        0.9,
        1.1,
      );
    }

    const precoMercado =
      precoReferencia * ajusteCapacidade * ajusteBanheiro * ajusteLocalizacao * fatorOcupacao;

    const fatorEvento = this.getFatorEvento(relevanciaEvento, publicoEsperado);
    const precoBase = seuPrecoAtual * 0.65 + precoMercado * 0.35;
    const precoSemGuardrail = precoBase * fatorEvento;

    const minPrice = seuPrecoAtual * (1 - maxReducaoPercent / 100);
    const maxPrice = seuPrecoAtual * (1 + maxAumentoPercent / 100);
    const precoSugerido = this.clamp(precoSemGuardrail, minPrice, maxPrice);

    const diferenca = ((precoSugerido - seuPrecoAtual) / seuPrecoAtual) * 100;

    let recomendacao: string;
    if (diferenca > 15) {
      recomendacao = 'AUMENTAR (preco abaixo do mercado/evento)';
    } else if (diferenca > 5) {
      recomendacao = 'Pode aumentar';
    } else if (Math.abs(diferenca) <= 5) {
      recomendacao = 'Manter';
    } else {
      recomendacao = 'Reduzir levemente (preco acima do sugerido)';
    }

    return {
      precoSugerido: this.roundMoney(precoSugerido),
      seuPrecoAtual: this.roundMoney(seuPrecoAtual),
      diferencaPercentual: Number(diferenca.toFixed(1)),
      recomendacao,
      motivo:
        `Mercado=${this.roundMoney(precoMercado)}, evento=${fatorEvento.toFixed(2)}x, ` +
        `guardrail=${maxReducaoPercent}% queda/${maxAumentoPercent}% alta.`,
    };
  }

  private getFatorEvento(relevanciaEvento?: number | null, publicoEsperado?: number | null): number {
    const relevancia = this.safeNumber(relevanciaEvento, 0);
    const publico = this.safeNumber(publicoEsperado, 0);
    let fator = 1;

    if (relevancia >= 85) fator += 0.18;
    else if (relevancia >= 70) fator += 0.12;
    else if (relevancia >= 50) fator += 0.06;

    if (publico >= 30000) fator += 0.12;
    else if (publico >= 10000) fator += 0.08;
    else if (publico >= 3000) fator += 0.04;

    return this.clamp(fator, 1, 1.3);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private roundMoney(value: number): number {
    return Number(Number(value || 0).toFixed(2));
  }

  private isPositive(value: number): boolean {
    return this.isFiniteNumber(value) && Number(value) > 0;
  }

  private isFiniteNumber(value: unknown): boolean {
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  }

  private safeNumber(value: unknown, fallback: number): number {
    return this.isFiniteNumber(value) ? Number(value) : fallback;
  }

  private normalizeAuditPriceInput(input: PricingDecisionSnapshotAuditInput): PriceAbsorptionCurveInput {
    const source = input.priceInput ?? {};
    return {
      ...source,
      basePriceCents:
        this.toCents(source.basePriceCents) ?? this.moneyToCents(input.analisePreco?.seuPrecoAtual),
      currentPriceCents:
        this.toCents(source.currentPriceCents) ?? this.moneyToCents(input.analisePreco?.seuPrecoAtual),
      marketReferencePriceCents:
        this.toCents(source.marketReferencePriceCents) ??
        this.moneyToCents(input.analisePreco?.precoSugerido),
    };
  }

  private buildDecisionInputSignals(
    input: PricingDecisionSnapshotAuditInput,
    priceInput: PriceAbsorptionCurveInput,
    curve: PriceAbsorptionCurveResult,
    selectedScenario: EnginePriceAbsorptionScenario,
  ): PricingDecisionSnapshotInputSignals {
    const previous = input.inputSignals ?? {};
    return {
      ...previous,
      auditTrailVersion: previous.auditTrailVersion ?? PRICING_DECISION_AUDIT_TRAIL_VERSION,
      generatedFrom: previous.generatedFrom ?? PRICING_DECISION_AUDIT_SOURCE,
      relationIds: {
        ...(previous.relationIds ?? {}),
        userId: this.entityId(input.user),
        propertyId: this.entityId(input.property ?? input.analisePreco?.endereco ?? null),
        listId: this.entityId(input.list ?? input.property?.list ?? input.analisePreco?.endereco?.list ?? null),
        eventId: this.entityId(input.event ?? input.analisePreco?.evento ?? null),
        eventIntelligenceSnapshotId: this.entityId(input.eventIntelligenceSnapshot),
        eventPropertyImpactId: this.entityId(input.eventPropertyImpact),
        analisePrecoId: this.entityId(input.analisePreco),
        priceUpdateId: this.entityId(input.priceUpdate),
      },
      pricing: {
        ...(previous.pricing ?? {}),
        basePriceCents: this.toCents(curve.basePriceCents),
        currentPriceCents: this.toCents(priceInput.currentPriceCents),
        marketReferencePriceCents: this.toCents(priceInput.marketReferencePriceCents),
        eventDemandScore: this.toDecimal(priceInput.eventDemandScore),
        propertyCaptureScore: this.toDecimal(priceInput.propertyCaptureScore),
        supplyCompressionScore: this.toDecimal(priceInput.supplyCompressionScore),
        affectedNights: this.toInteger(curve.affectedNights),
      },
      selectedScenario: {
        scenario: selectedScenario.scenario,
        priceCents: this.toCents(selectedScenario.priceCents),
        multiplier: this.toDecimal(selectedScenario.multiplier),
        bookingProbability: this.toDecimal(selectedScenario.bookingProbability),
        expectedRevenueCents: this.toCents(selectedScenario.expectedRevenueCents),
        expectedIncrementalRevenueCents: this.toCents(
          selectedScenario.expectedIncrementalRevenueCents,
        ),
        isRecommended: selectedScenario.isRecommended,
      },
      outcome: previous.outcome ?? null,
    };
  }

  private buildDecisionGuardrails(
    input: PricingDecisionSnapshotAuditInput,
    priceInput: PriceAbsorptionCurveInput,
    curve: PriceAbsorptionCurveResult,
  ): PricingDecisionSnapshotGuardrails {
    const guardrail = priceInput.guardrail ?? {};
    return {
      ...(input.guardrails ?? {}),
      minMultiplier: this.toDecimal(guardrail.minMultiplier),
      maxMultiplier: this.toDecimal(guardrail.maxMultiplier),
      maxReducaoPercent: this.toDecimal(guardrail.maxReducaoPercent),
      maxAumentoPercent: this.toDecimal(guardrail.maxAumentoPercent),
      label: guardrail.label ?? null,
      cappedRecommendedPrice: curve.scenarios.some(
        (scenario) => scenario.isRecommended && scenario.cappedByGuardrail,
      ),
    };
  }

  private resolveSelectedScenario(
    curve: PriceAbsorptionCurveResult,
    selectedScenario?: PriceAbsorptionScenarioName | string | null,
  ): EnginePriceAbsorptionScenario {
    return (
      (selectedScenario
        ? curve.scenarios.find((scenario) => scenario.scenario === selectedScenario)
        : null) ??
      curve.scenarios.find((scenario) => scenario.isRecommended) ??
      curve.scenarios[0]
    );
  }

  private mapAuditScenarios(scenarios: EnginePriceAbsorptionScenario[]): PriceAbsorptionScenario[] {
    return scenarios.map((scenario) => ({
      scenario: scenario.scenario,
      priceCents: this.toCents(scenario.priceCents),
      multiplier: this.toDecimal(scenario.multiplier),
      bookingProbability: this.toDecimal(scenario.bookingProbability),
      expectedRevenueCents: this.toCents(scenario.expectedRevenueCents),
      interpretation: `${scenario.label}: ${scenario.explanation}`,
    }));
  }

  private mapAuditDrivers(
    drivers: PriceAbsorptionCurveResult['drivers'],
  ): PricingDecisionSnapshot['drivers'] {
    return drivers.map((driver) => ({
      key: driver.key,
      label: driver.label,
      weight: driver.weight,
      explanation:
        driver.value === null || driver.value === undefined
          ? driver.explanation
          : `${driver.explanation} Valor auditado: ${driver.value}.`,
    }));
  }

  private resolveDecisionStatus(
    appliedPriceCents: number | null,
    priceUpdate?: PricingDecisionSnapshot['priceUpdate'],
  ): PricingDecisionStatus {
    return appliedPriceCents !== null || priceUpdate ? 'applied' : 'suggested';
  }

  private resolveOutcomeStatus(
    realizedRevenueCents: number | null,
    bookedNights?: number | null,
  ): PricingDecisionSnapshotOutcomeStatus {
    if (realizedRevenueCents !== null && realizedRevenueCents > 0) return 'booked';
    if (this.toInteger(bookedNights) !== null && Number(bookedNights) > 0) return 'booked';
    return 'unknown';
  }

  private normalizeOutcomeStatus(value?: string | null): PricingDecisionSnapshotOutcomeStatus | null {
    if (!value) return null;
    if (['unknown', 'booked', 'not_booked', 'blocked', 'pending', 'cancelled'].includes(value)) {
      return value as PricingDecisionSnapshotOutcomeStatus;
    }
    return null;
  }

  private resolveDecisionStatusFromOutcome(input: {
    requestedStatus?: PricingDecisionStatus | null;
    priceUpdate?: PricingDecisionSnapshot['priceUpdate'];
    analisePreco?: PricingDecisionSnapshot['analisePreco'];
    outcomeStatus: PricingDecisionSnapshotOutcomeStatus;
    currentStatus?: PricingDecisionStatus | null;
    appliedPriceCents?: number | null;
  }): PricingDecisionStatus {
    if (input.requestedStatus) return input.requestedStatus;

    const priceUpdateStatus = this.decisionStatusFromPriceUpdate(input.priceUpdate);
    if (priceUpdateStatus) return priceUpdateStatus;

    const analysisStatus = this.decisionStatusFromAnalisePreco(input.analisePreco, input.appliedPriceCents);
    if (analysisStatus) return analysisStatus;

    if (input.appliedPriceCents !== null || input.currentStatus === 'applied') return 'applied';
    if (
      input.outcomeStatus === 'not_booked' ||
      input.outcomeStatus === 'blocked' ||
      input.outcomeStatus === 'cancelled'
    ) {
      return input.currentStatus ?? 'expired';
    }
    return input.currentStatus ?? 'suggested';
  }

  private decisionStatusFromPriceUpdate(
    priceUpdate?: PricingDecisionSnapshot['priceUpdate'],
  ): PricingDecisionStatus | null {
    if (!priceUpdate) return null;
    if (priceUpdate.origin === 'rollback') return 'superseded';
    if (priceUpdate.status === 'success') return 'applied';
    if (priceUpdate.status === 'rejected') return 'rejected';
    if (priceUpdate.status === 'pending' || priceUpdate.status === 'error') return 'accepted';
    return null;
  }

  private decisionStatusFromAnalisePreco(
    analisePreco?: PricingDecisionSnapshot['analisePreco'],
    appliedPriceCents?: number | null,
  ): PricingDecisionStatus | null {
    if (!analisePreco) return null;
    if (analisePreco.status === 'applied_manual' || analisePreco.status === 'applied_stays') return 'applied';
    if (analisePreco.status === 'accepted') return appliedPriceCents !== null ? 'applied' : 'accepted';
    if (analisePreco.status === 'rejected') return 'rejected';
    if (analisePreco.status === 'expired') return 'expired';
    if (analisePreco.aceito) return appliedPriceCents !== null ? 'applied' : 'accepted';
    if (analisePreco.status === 'suggested') return 'suggested';
    return null;
  }

  private resolveOutcomeSource(
    priceUpdate?: PricingDecisionSnapshot['priceUpdate'],
    analisePreco?: PricingDecisionSnapshot['analisePreco'],
  ): string {
    if (priceUpdate) return 'price_update';
    if (analisePreco) return 'analise_preco';
    return 'manual';
  }

  private outcomeRiskFlags(input: {
    outcomeStatus: PricingDecisionSnapshotOutcomeStatus;
    decisionStatus?: PricingDecisionStatus | null;
    appliedPriceCents?: number | null;
    selectedPriceCents?: number | null;
    expectedRevenueCents?: number | null;
    realizedRevenueCents?: number | null;
  }): string[] {
    const flags: string[] = [];
    if (input.decisionStatus === 'rejected') flags.push('decision_rejected');
    if (input.decisionStatus === 'accepted' && input.appliedPriceCents === null) {
      flags.push('accepted_without_applied_price');
    }
    if (input.outcomeStatus === 'not_booked') flags.push('no_booking_after_decision');
    if (input.outcomeStatus === 'booked' && input.realizedRevenueCents === null) {
      flags.push('missing_realized_revenue');
    }
    if (
      this.isPositive(input.appliedPriceCents) &&
      this.isPositive(input.selectedPriceCents) &&
      Number(input.appliedPriceCents) > Number(input.selectedPriceCents) * 1.2
    ) {
      flags.push('applied_price_above_selected_scenario');
    }
    if (
      this.isPositive(input.expectedRevenueCents) &&
      this.isPositive(input.realizedRevenueCents) &&
      Number(input.realizedRevenueCents) < Number(input.expectedRevenueCents) * 0.7
    ) {
      flags.push('realized_revenue_below_expected');
    }
    return flags;
  }

  private multiplierFromPrices(priceCents?: number | null, basePriceCents?: number | null): number | null {
    if (!this.isPositive(priceCents) || !this.isPositive(basePriceCents)) return null;
    return Number((Number(priceCents) / Number(basePriceCents)).toFixed(2));
  }

  private normalizeTargetDate(value?: string | Date | null): string | null {
    const date = this.toDate(value);
    if (date) return date.toISOString().slice(0, 10);
    return typeof value === 'string' && value ? value.slice(0, 10) : null;
  }

  private toIso(value?: string | Date | null): string | null {
    return this.toDate(value)?.toISOString() ?? null;
  }

  private toDate(value?: string | Date | null): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toCents(value: unknown): number | null {
    return this.isFiniteNumber(value) ? Math.round(Number(value)) : null;
  }

  private moneyToCents(value: unknown): number | null {
    return this.isFiniteNumber(value) ? Math.round(Number(value) * 100) : null;
  }

  private toDecimal(value: unknown): number | null {
    return this.isFiniteNumber(value) ? Number(value) : null;
  }

  private toInteger(value: unknown): number | null {
    return this.isFiniteNumber(value) ? Math.round(Number(value)) : null;
  }

  private entityId(entity?: { id?: string | null } | null): string | null {
    return entity?.id ?? null;
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
  }
}
