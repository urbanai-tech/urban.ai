"use client";

import React from "react";
import { AppButton } from "./AppButton";
import { AppBadge } from "./AppBadge";
import { DriverBar } from "./DriverBar";
import { ScenarioComparison } from "./ScenarioComparison";
import {
  ArrowRight,
  Calendar,
  Close,
  MapPin,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "./Icons";
import type {
  Drivers,
  HistoricalComparison,
  Scenario,
} from "@/app/types/recommendation";

/**
 * RecommendationCard — o objeto central da Urban AI.
 *
 * Pilar D do plano de redesign do anfitrião (docs/plano-redesign-2026-05-16.md):
 * a recomendação de preço era card operacional com hierarquia INVERTIDA
 * (ATUAL em verde dominante + SUG em azul discreto). Agora o preço SUGERIDO
 * domina visualmente (Bebas Neue 56-72px), o preço atual aparece como
 * referência menor, o delta % vira badge accent, o motivo é pull-quote e
 * o CTA primário "Aplicar sugestão" é impossível de perder.
 *
 * Roadmap 4 Tracks (Gap 6, semana 1-2): estendido com seção "POR QUE ESSE
 * PREÇO?" expandable contendo DriverBar + HistoricalComparison +
 * ScenarioComparison. Mobile abre como full-screen sheet.
 *
 * Usado em /painel, /dashboard (calendário), /notificacao, futuro email.
 */

export type RecommendationConfidence = "high" | "medium" | "low";

export type RecommendationCardProps = {
  /** Evento que motiva a recomendação (ex: "Show no Allianz Parque") */
  eventTitle: string;
  /** Categoria/eyebrow (ex: "SHOW", "FEIRA", "CONGRESSO") */
  eventCategory?: string;
  /** Data do evento (ISO ou pt-BR já formatado) */
  eventDate: string;
  /** Localização curta (ex: "Allianz Parque, São Paulo") */
  eventLocation?: string;
  /** Distância em km (opcional) */
  distanceKm?: number;
  /** Preço atual configurado pelo anfitrião (R$, já em reais) */
  currentPrice: number;
  /** Preço sugerido pela IA (R$, já em reais) */
  suggestedPrice: number;
  /** Motivo curto (1 frase) que justifica a sugestão */
  reason?: string;
  /** Nível de confiança da IA */
  confidence?: RecommendationConfidence;
  /** Estado da sugestão */
  status?: "pending" | "accepted" | "applied" | "rejected";
  /** Ação primária (aceitar / aplicar / etc) */
  onPrimary?: () => void;
  primaryLabel?: string;
  /** Ação secundária (ver detalhes) */
  onSecondary?: () => void;
  secondaryLabel?: string;
  /** Loading durante apply */
  loading?: boolean;
  density?: "regular" | "compact";
  /** Contrato A — drivers da engine (peso 0-100 por dimensão). */
  drivers?: Drivers;
  /** Contrato A — comparação com mesma data ano passado + hosts comparáveis. */
  historicalComparison?: HistoricalComparison;
  /** Contrato A — 2-3 cenários (atual/sugerido/agressivo) com receita estimada. */
  scenarios?: Scenario[];
};

function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtDate(value: string): string {
  try {
    const d = new Date(value);
    if (Number.isFinite(d.getTime())) {
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  } catch {
    // fallthrough
  }
  return value;
}

function fmtPct(value: number, fractionDigits = 0): string {
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(fractionDigits)}%`;
}

function fmtSignedPct(value: number, fractionDigits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

const CONFIDENCE_LABEL: Record<RecommendationConfidence, string> = {
  high: "Confiança alta",
  medium: "Confiança média",
  low: "Confiança baixa",
};

const CONFIDENCE_KIND: Record<RecommendationConfidence, "success" | "warn" | "neutral"> = {
  high: "success",
  medium: "warn",
  low: "neutral",
};

/**
 * Traduz justificativas técnicas do motor em leitura didática para o anfitrião.
 */
type ParsedReason = {
  marketPrice?: number;
  eventMultiplier?: number;
  guardrailDownPct?: number;
  guardrailUpPct?: number;
  isTechnical: boolean;
};

type ExplanationItem = {
  label: string;
  value: string;
  detail: string;
};

function parseLocaleNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/R\$/gi, "").replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(",", ".");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function parseReason(reason?: string): ParsedReason {
  const text = reason?.trim() ?? "";
  const marketMatch = text.match(/\bmercado\s*=\s*(?:R\$\s*)?([\d.,]+)/i);
  const eventMatch = text.match(/\bevento\s*=\s*([\d.,]+)\s*x/i);
  const guardrailMatch = text.match(
    /\bguardrail\s*=\s*([\d.,]+)\s*%\s*queda\s*\/\s*([\d.,]+)\s*%\s*alta/i,
  );

  return {
    marketPrice: parseLocaleNumber(marketMatch?.[1]),
    eventMultiplier: parseLocaleNumber(eventMatch?.[1]),
    guardrailDownPct: parseLocaleNumber(guardrailMatch?.[1]),
    guardrailUpPct: parseLocaleNumber(guardrailMatch?.[2]),
    isTechnical: /\w+\s*=/.test(text) || Boolean(marketMatch || eventMatch || guardrailMatch),
  };
}

function buildExplanation({
  currentPrice,
  suggestedPrice,
  deltaAbs,
  deltaPct,
  eventTitle,
  reason,
}: {
  currentPrice: number;
  suggestedPrice: number;
  deltaAbs: number;
  deltaPct: number;
  eventTitle: string;
  reason?: string;
}): { lead: string; body: string; items: ExplanationItem[]; humanReason?: string } {
  const parsed = parseReason(reason);
  const isIncrease = deltaAbs > 0.5;
  const isDecrease = deltaAbs < -0.5;
  const marketPrice = parsed.marketPrice;
  const eventImpactPct =
    typeof parsed.eventMultiplier === "number"
      ? (parsed.eventMultiplier - 1) * 100
      : undefined;

  const lead = isIncrease
    ? `Aumentar ${fmtBRL(Math.abs(deltaAbs))} (${fmtSignedPct(deltaPct)}).`
    : isDecrease
      ? `Reduzir ${fmtBRL(Math.abs(deltaAbs))} (${fmtSignedPct(deltaPct)}).`
      : "Manter a diária atual.";

  let body: string;
  if (typeof eventImpactPct === "number" && Math.abs(eventImpactPct) >= 0.5) {
    if (eventImpactPct > 0) {
      body = `O evento adiciona ${fmtSignedPct(eventImpactPct, 0)} de demanda estimada. Por isso a Urban AI parte da referência e sobe a diária para ${fmtBRL(suggestedPrice)}.`;
    } else {
      body = `O sinal de demanda está ${fmtSignedPct(eventImpactPct, 0)} abaixo da referência. Por isso a Urban AI recomenda um valor mais competitivo para a data.`;
    }
  } else if (isIncrease) {
    body = "A Urban AI encontrou sinais de procura acima do normal para esta data e sugere capturar essa oportunidade sem ultrapassar a faixa de segurança.";
  } else if (isDecrease) {
    body = "A Urban AI entende que a demanda esperada não sustenta o preço atual. A redução deixa a diária mais competitiva para converter reserva.";
  } else {
    body = "A Urban AI não encontrou pressão suficiente para subir ou baixar a diária com segurança nesta data.";
  }

  const items: ExplanationItem[] = [
    {
      label: "Referência",
      value: fmtBRL(marketPrice ?? currentPrice),
      detail: marketPrice
        ? "Preço-base usado para comparar esta diária com o mercado."
        : "Ponto de partida usado no cálculo da recomendação.",
    },
  ];

  if (typeof eventImpactPct === "number") {
    items.push({
      label: "Evento",
      value: fmtSignedPct(eventImpactPct, 0),
      detail:
        eventImpactPct > 0
          ? "Pressão extra de demanda por causa do evento próximo."
          : eventImpactPct < 0
            ? "Sinal de menor demanda para a data analisada."
            : "Sem impacto relevante de evento no preço final.",
    });
  } else {
    items.push({
      label: "Sinal",
      value: eventTitle ? "Evento próximo" : "Demanda",
      detail: eventTitle
        ? "O evento é um dos sinais usados para estimar procura na região."
        : "A Urban AI compara demanda esperada, mercado e preço atual.",
    });
  }

  if (
    typeof parsed.guardrailDownPct === "number" &&
    typeof parsed.guardrailUpPct === "number"
  ) {
    items.push({
      label: "Segurança",
      value: `-${parsed.guardrailDownPct.toFixed(0)}% / +${parsed.guardrailUpPct.toFixed(0)}%`,
      detail: "Limite que evita queda ou alta agressiva demais.",
    });
  }

  items.push({
    label: "Resultado",
    value: fmtBRL(suggestedPrice),
    detail: isIncrease
      ? "Preço final sugerido depois do ajuste de demanda."
      : isDecrease
        ? "Preço final sugerido para ganhar competitividade."
        : "Preço final sugerido para manter estabilidade.",
  });

  return {
    lead,
    body,
    items,
    humanReason: reason && !parsed.isTechnical ? reason : undefined,
  };
}

function RecommendationReason({
  currentPrice,
  suggestedPrice,
  deltaAbs,
  deltaPct,
  eventTitle,
  reason,
}: {
  currentPrice: number;
  suggestedPrice: number;
  deltaAbs: number;
  deltaPct: number;
  eventTitle: string;
  reason?: string;
}) {
  const explanation = buildExplanation({
    currentPrice,
    suggestedPrice,
    deltaAbs,
    deltaPct,
    eventTitle,
    reason,
  });

  return (
    <section
      aria-label="Explicação da sugestão"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingTop: 14,
        borderTop: "1px solid var(--app-divider)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr)",
          gap: 10,
          alignItems: "start",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--app-accent-soft)",
            color: "var(--app-accent)",
            flexShrink: 0,
          }}
        >
          <Sparkles size={14} />
        </span>
        <div style={{ minWidth: 0 }}>
          <span className="urban-app-eyebrow-muted">
            Por que este preço?
          </span>
          <p
            style={{
              fontSize: 13,
              color: "var(--app-text)",
              lineHeight: 1.55,
              margin: "6px 0 0",
            }}
          >
            <strong>{explanation.lead}</strong> {explanation.body}
          </p>
          {explanation.humanReason && (
            <p
              style={{
                fontSize: 12,
                color: "var(--app-text-muted)",
                lineHeight: 1.5,
                margin: "6px 0 0",
              }}
            >
              Motivo informado: {explanation.humanReason}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 136px), 1fr))",
          borderTop: "1px solid var(--app-divider)",
          borderBottom: "1px solid var(--app-divider)",
        }}
      >
        {explanation.items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            style={{
              padding: "10px 12px",
              borderRight:
                index === explanation.items.length - 1
                  ? "none"
                  : "1px solid var(--app-divider)",
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "var(--app-text-dim)",
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {item.label}
            </span>
            <strong
              style={{
                display: "block",
                color: "var(--app-text)",
                fontSize: 13,
                lineHeight: 1.35,
                marginTop: 4,
              }}
            >
              {item.value}
            </strong>
            <span
              style={{
                display: "block",
                color: "var(--app-text-muted)",
                fontSize: 11,
                lineHeight: 1.35,
                marginTop: 3,
              }}
            >
              {item.detail}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExplainerBody({
  drivers,
  historicalComparison,
  scenarios,
}: {
  drivers?: Drivers;
  historicalComparison?: HistoricalComparison;
  scenarios?: Scenario[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {drivers && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="urban-app-eyebrow-muted">Composição da sugestão</span>
          <DriverBar drivers={drivers} />
        </section>
      )}

      {historicalComparison && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="urban-app-eyebrow-muted">Referências históricas</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "var(--app-surface-muted)",
                border: "1px solid var(--app-divider)",
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                style={{ fontSize: 11, color: "var(--app-text-muted)", lineHeight: 1.3 }}
              >
                Datas similares (ano passado, n=
                {historicalComparison.similarDatesLastYear.n})
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--app-text)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                Diária {fmtBRL(historicalComparison.similarDatesLastYear.adr)}
                {" · "}
                Ocup {fmtPct(historicalComparison.similarDatesLastYear.occupancy)}
              </span>
            </div>
            <div
              style={{
                background: "var(--app-surface-muted)",
                border: "1px solid var(--app-divider)",
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                style={{ fontSize: 11, color: "var(--app-text-muted)", lineHeight: 1.3 }}
              >
                Anfitriões comparáveis (mediana)
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--app-text)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                Diária {fmtBRL(historicalComparison.comparableHosts.medianAdr)}
                {" · "}
                Ocup {fmtPct(historicalComparison.comparableHosts.medianOccupancy)}
              </span>
            </div>
          </div>
        </section>
      )}

      {scenarios && scenarios.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="urban-app-eyebrow-muted">Cenários</span>
          <ScenarioComparison scenarios={scenarios} />
        </section>
      )}
    </div>
  );
}

export function RecommendationCard({
  eventTitle,
  eventCategory,
  eventDate,
  eventLocation,
  distanceKm,
  currentPrice,
  suggestedPrice,
  reason,
  confidence,
  status = "pending",
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel = "Ver detalhes",
  loading,
  density = "regular",
  drivers,
  historicalComparison,
  scenarios,
}: RecommendationCardProps) {
  const deltaAbs = suggestedPrice - currentPrice;
  const deltaPct = currentPrice > 0 ? (deltaAbs / currentPrice) * 100 : 0;
  const deltaSign = deltaAbs > 0 ? "+" : "";
  const deltaLabel = `${deltaSign}${deltaPct.toFixed(1)}%`;
  const DeltaIcon = deltaAbs < 0 ? TrendingDown : TrendingUp;

  const isApplied = status === "applied";
  const isAccepted = status === "accepted";
  const compact = density === "compact";

  const defaultPrimary = isApplied
    ? "Aplicado"
    : isAccepted
      ? "Aplicar agora"
      : "Aplicar sugestão";

  const hasExtendedExplainer = Boolean(
    drivers || historicalComparison || (scenarios && scenarios.length > 0),
  );

  const explanation = React.useMemo(
    () =>
      buildExplanation({
        currentPrice,
        suggestedPrice,
        deltaAbs,
        deltaPct,
        eventTitle,
        reason,
      }),
    [currentPrice, deltaAbs, deltaPct, eventTitle, reason, suggestedPrice],
  );
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  // Trava o scroll body enquanto o modal está aberto.
  React.useEffect(() => {
    if (!detailsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailsOpen]);

  // ESC fecha os detalhes.
  React.useEffect(() => {
    if (!detailsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailsOpen]);

  return (
    <div
      className="urban-app-card-accent"
      style={{
        padding: compact ? "18px 20px" : "24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: compact ? 14 : 20,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* === Header: evento + categoria + meta === */}
      <header>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {eventCategory && (
            <span
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--app-accent)",
                fontWeight: 700,
              }}
            >
              {eventCategory}
            </span>
          )}
          {status === "applied" && <AppBadge kind="success">Aplicado</AppBadge>}
          {status === "accepted" && <AppBadge kind="accent">Aceito</AppBadge>}
          {status === "rejected" && <AppBadge kind="neutral">Recusado</AppBadge>}
        </div>
        <h3
          style={{
            fontSize: compact ? 16 : 18,
            fontWeight: 600,
            color: "var(--app-text)",
            letterSpacing: -0.2,
            margin: 0,
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          {eventTitle}
        </h3>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--app-text-muted)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <Calendar size={12} /> {fmtDate(eventDate)}
          </span>
          {eventLocation && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                minWidth: 0,
                maxWidth: "100%",
                overflowWrap: "anywhere",
              }}
            >
              <MapPin size={12} /> {eventLocation}
              {typeof distanceKm === "number" && (
                <span style={{ color: "var(--app-text-dim)" }}>
                  {" · "}
                  {distanceKm.toFixed(1)} km
                </span>
              )}
            </span>
          )}
        </div>
      </header>

      {/* === Preço sugerido domina === */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 16,
          alignItems: "end",
        }}
      >
        <div>
          <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
            Sugestão da IA
          </p>
          <p
            className="urban-app-display-md"
            style={{
              color: "var(--app-accent)",
              fontSize: compact ? 44 : undefined,
              lineHeight: compact ? 0.95 : undefined,
            }}
          >
            {fmtBRL(suggestedPrice)}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--app-text-muted)",
              marginTop: 4,
            }}
          >
            preço atual: <strong style={{ color: "var(--app-text)" }}>{fmtBRL(currentPrice)}</strong>{" "}
            / diária
          </p>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            background: deltaAbs >= 0 ? "var(--app-accent-soft)" : "var(--app-surface-muted)",
            color: deltaAbs >= 0 ? "var(--app-accent)" : "var(--app-danger)",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <DeltaIcon size={12} />
          {deltaLabel}
        </div>
      </div>

      {/* === Resumo compacto: detalhes completos ficam no modal. === */}
      <section
        aria-label="Resumo da sugestão"
        style={{
          display: "flex",
          gap: 12,
          paddingTop: 14,
          borderTop: "1px solid var(--app-divider)",
          minWidth: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "var(--app-accent-soft)",
            color: "var(--app-accent)",
          }}
        >
          <Sparkles size={15} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
            Por que este preço?
          </p>
          <p
            style={{
              margin: 0,
              color: "var(--app-text)",
              fontSize: compact ? 12 : 13,
              lineHeight: 1.5,
              overflowWrap: "anywhere",
              maxHeight: compact ? 72 : undefined,
              overflow: compact ? "hidden" : undefined,
            }}
          >
            <strong>{explanation.lead}</strong>{" "}
            {explanation.humanReason ?? explanation.body}
          </p>
        </div>
      </section>

      {/* === Confiança + CTAs === */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          {confidence && (
            <AppBadge kind={CONFIDENCE_KIND[confidence]}>
              {CONFIDENCE_LABEL[confidence]}
            </AppBadge>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <AppButton variant="secondary" size={compact ? "sm" : "md"} onClick={() => setDetailsOpen(true)}>
            Ver detalhes
          </AppButton>
          {onSecondary && (
            <AppButton variant="ghost" size={compact ? "sm" : "md"} onClick={onSecondary}>
              {secondaryLabel}
            </AppButton>
          )}
          {onPrimary && !isApplied && (
            <AppButton
              variant="primary"
              size={compact ? "sm" : "md"}
              onClick={onPrimary}
              loading={loading}
              rightIcon={<ArrowRight size={14} />}
            >
              {primaryLabel ?? defaultPrimary}
            </AppButton>
          )}
        </div>
      </div>

      {detailsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="recommendation-detail-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1500,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 0, 0, 0.58)",
          }}
        >
          <button
            type="button"
            aria-label="Fechar detalhes da sugestão"
            onClick={() => setDetailsOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
              background: "transparent",
              cursor: "default",
            }}
          />

          <div
            className="urban-app"
            style={{
              position: "relative",
              width: "min(720px, 100%)",
              maxHeight: "calc(100vh - 40px)",
              overflow: "hidden",
              border: "1px solid var(--app-divider-strong)",
              borderRadius: 10,
              background: "var(--app-surface)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "18px 20px",
                borderBottom: "1px solid var(--app-divider)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
                  Detalhes da sugestão
                </p>
                <h2
                  id="recommendation-detail-title"
                  style={{
                    margin: 0,
                    color: "var(--app-text)",
                    fontSize: 20,
                    lineHeight: 1.25,
                    fontWeight: 700,
                    overflowWrap: "anywhere",
                  }}
                >
                  {eventTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-label="Fechar detalhes da sugestão"
                className="urban-focus-ring"
                style={{
                  flex: "0 0 auto",
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  border: "1px solid var(--app-divider-strong)",
                  background: "var(--app-surface-muted)",
                  color: "var(--app-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Close size={17} />
              </button>
            </div>

            <div
              style={{
                padding: 20,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 22,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 16,
                  alignItems: "end",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
                    Sugestão da IA
                  </p>
                  <p className="urban-app-display-md" style={{ color: "var(--app-accent)" }}>
                    {fmtBRL(suggestedPrice)}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--app-text-muted)", marginTop: 4 }}>
                    preço atual:{" "}
                    <strong style={{ color: "var(--app-text)" }}>{fmtBRL(currentPrice)}</strong>{" "}
                    / diária
                  </p>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    background: deltaAbs >= 0 ? "var(--app-accent-soft)" : "var(--app-surface-muted)",
                    color: deltaAbs >= 0 ? "var(--app-accent)" : "var(--app-danger)",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <DeltaIcon size={12} />
                  {deltaLabel}
                </div>
              </div>

              <RecommendationReason
                currentPrice={currentPrice}
                suggestedPrice={suggestedPrice}
                deltaAbs={deltaAbs}
                deltaPct={deltaPct}
                eventTitle={eventTitle}
                reason={reason}
              />

              {hasExtendedExplainer && (
                <ExplainerBody
                  drivers={drivers}
                  historicalComparison={historicalComparison}
                  scenarios={scenarios}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
