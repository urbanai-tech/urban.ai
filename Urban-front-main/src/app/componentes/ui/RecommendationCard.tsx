"use client";

import React from "react";
import { AppButton } from "./AppButton";
import { AppBadge } from "./AppBadge";
import { DriverBar } from "./DriverBar";
import { ScenarioComparison } from "./ScenarioComparison";
import { ArrowRight, Calendar, ChevronDown, Close, MapPin, Sparkles, TrendingUp } from "./Icons";
import type {
  Drivers,
  HistoricalComparison,
  Scenario,
} from "@/app/types/recommendation";

/**
 * RecommendationCard — o objeto central da Urban AI.
 *
 * Pilar D do plano de redesign do anfitriao (docs/plano-redesign-2026-05-16.md):
 * a recomendacao de preco era card operacional com hierarquia INVERTIDA
 * (ATUAL em verde dominante + SUG em azul discreto). Agora o preco SUGERIDO
 * domina visualmente (Bebas Neue 56-72px), o preco atual aparece como
 * referencia menor, o delta % vira badge accent, o motivo eh pull-quote e
 * o CTA primario "Aplicar sugestao" eh impossivel de perder.
 *
 * Roadmap 4 Tracks (Gap 6, semana 1-2): estendido com secao "POR QUE ESSE
 * PRECO?" expandable contendo DriverBar + HistoricalComparison +
 * ScenarioComparison. Mobile abre como full-screen sheet.
 *
 * Usado em /painel, /dashboard (calendario), /notificacao, futuro email.
 */

export type RecommendationConfidence = "high" | "medium" | "low";

export type RecommendationCardProps = {
  /** Evento que motiva a recomendacao (ex: "Show no Allianz Parque") */
  eventTitle: string;
  /** Categoria/eyebrow (ex: "SHOW", "FEIRA", "CONGRESSO") */
  eventCategory?: string;
  /** Data do evento (ISO ou pt-BR ja formatado) */
  eventDate: string;
  /** Localizacao curta (ex: "Allianz Parque, Sao Paulo") */
  eventLocation?: string;
  /** Distancia em km (opcional) */
  distanceKm?: number;
  /** Preco atual configurado pelo anfitriao (R$, ja em reais) */
  currentPrice: number;
  /** Preco sugerido pela IA (R$, ja em reais) */
  suggestedPrice: number;
  /** Motivo curto (1 frase) que justifica a sugestao */
  reason?: string;
  /** Nivel de confianca da IA */
  confidence?: RecommendationConfidence;
  /** Estado da sugestao */
  status?: "pending" | "accepted" | "applied" | "rejected";
  /** Acao primaria (aceitar / aplicar / etc) */
  onPrimary?: () => void;
  primaryLabel?: string;
  /** Acao secundaria (ver detalhes) */
  onSecondary?: () => void;
  secondaryLabel?: string;
  /** Loading durante apply */
  loading?: boolean;
  /** Contrato A — drivers da engine (peso 0-100 por dimensao). */
  drivers?: Drivers;
  /** Contrato A — comparacao com mesma data ano passado + hosts comparaveis. */
  historicalComparison?: HistoricalComparison;
  /** Contrato A — 2-3 cenarios (atual/sugerido/agressivo) com receita estimada. */
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

const CONFIDENCE_LABEL: Record<RecommendationConfidence, string> = {
  high: "Confianca alta",
  medium: "Confianca media",
  low: "Confianca baixa",
};

const CONFIDENCE_KIND: Record<RecommendationConfidence, "success" | "warn" | "neutral"> = {
  high: "success",
  medium: "warn",
  low: "neutral",
};

const MOBILE_BREAKPOINT = 768;

/**
 * Hook simples — true quando viewport < 768px. SSR-safe (false no server).
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/**
 * Body do bloco "Por que esse preco?" — usado tanto inline (desktop expand)
 * quanto dentro do sheet mobile.
 */
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
          <span className="urban-app-eyebrow-muted">Composicao da sugestao</span>
          <DriverBar drivers={drivers} />
        </section>
      )}

      {historicalComparison && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="urban-app-eyebrow-muted">Referencias historicas</span>
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
                ADR {fmtBRL(historicalComparison.similarDatesLastYear.adr)}
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
                Anfitrioes comparaveis (mediana)
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--app-text)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                ADR {fmtBRL(historicalComparison.comparableHosts.medianAdr)}
                {" · "}
                Ocup {fmtPct(historicalComparison.comparableHosts.medianOccupancy)}
              </span>
            </div>
          </div>
        </section>
      )}

      {scenarios && scenarios.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="urban-app-eyebrow-muted">Cenarios</span>
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
  drivers,
  historicalComparison,
  scenarios,
}: RecommendationCardProps) {
  const deltaAbs = suggestedPrice - currentPrice;
  const deltaPct = currentPrice > 0 ? (deltaAbs / currentPrice) * 100 : 0;
  const deltaSign = deltaAbs > 0 ? "+" : "";
  const deltaLabel = `${deltaSign}${deltaPct.toFixed(1)}%`;

  const isApplied = status === "applied";
  const isAccepted = status === "accepted";

  const defaultPrimary = isApplied
    ? "Aplicado"
    : isAccepted
      ? "Aplicar agora"
      : "Aplicar sugestao";

  const hasExplainer = Boolean(
    drivers || historicalComparison || (scenarios && scenarios.length > 0),
  );

  const isMobile = useIsMobile();
  const [expanded, setExpanded] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const handleToggle = React.useCallback(() => {
    if (isMobile) {
      setSheetOpen(true);
    } else {
      setExpanded((prev) => !prev);
    }
  }, [isMobile]);

  // Trava o scroll body enquanto o sheet mobile esta aberto.
  React.useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  // ESC fecha o sheet mobile.
  React.useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  return (
    <div
      className="urban-app-card-accent"
      style={{
        padding: "24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
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
            fontSize: 18,
            fontWeight: 600,
            color: "var(--app-text)",
            letterSpacing: -0.2,
            margin: 0,
            lineHeight: 1.3,
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Calendar size={12} /> {fmtDate(eventDate)}
          </span>
          {eventLocation && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
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

      {/* === Preco sugerido domina === */}
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
            Sugestao da IA
          </p>
          <p
            className="urban-app-display-md"
            style={{ color: "var(--app-accent)" }}
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
            preco atual: <strong style={{ color: "var(--app-text)" }}>{fmtBRL(currentPrice)}</strong>{" "}
            / diaria
          </p>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            background: deltaAbs >= 0 ? "var(--app-accent-soft)" : "rgba(194, 52, 46, 0.08)",
            color: deltaAbs >= 0 ? "var(--app-accent)" : "var(--app-danger)",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <TrendingUp size={12} />
          {deltaLabel}
        </div>
      </div>

      {/* === Motivo (pull quote curto) === */}
      {reason && (
        <div
          style={{
            display: "flex",
            gap: 10,
            paddingTop: 12,
            borderTop: "1px solid var(--app-divider)",
          }}
        >
          <Sparkles size={14} style={{ color: "var(--app-accent)", marginTop: 2, flexShrink: 0 }} />
          <p
            style={{
              fontSize: 13,
              color: "var(--app-text)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {reason}
          </p>
        </div>
      )}

      {/* === Confianca + CTAs === */}
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
        <div style={{ display: "flex", gap: 10 }}>
          {onSecondary && (
            <AppButton variant="ghost" size="md" onClick={onSecondary}>
              {secondaryLabel}
            </AppButton>
          )}
          {onPrimary && !isApplied && (
            <AppButton
              variant="primary"
              size="md"
              onClick={onPrimary}
              loading={loading}
              rightIcon={<ArrowRight size={14} />}
            >
              {primaryLabel ?? defaultPrimary}
            </AppButton>
          )}
        </div>
      </div>

      {/* === Expandable: "POR QUE ESSE PRECO?" === */}
      {hasExplainer && (
        <div
          style={{
            borderTop: "1px solid var(--app-divider)",
            paddingTop: 14,
            marginTop: -4,
          }}
        >
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isMobile ? sheetOpen : expanded}
            aria-controls="recommendation-explainer"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "var(--app-accent)",
              }}
            >
              Por que esse preco?
            </span>
            <ChevronDown
              size={14}
              style={{
                color: "var(--app-accent)",
                transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                transform: expanded && !isMobile ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Desktop: expand inline com max-height + opacity transition 300ms.
              Mobile: sheet fora dessa arvore (renderizado abaixo). */}
          {!isMobile && (
            <div
              id="recommendation-explainer"
              aria-hidden={!expanded}
              style={{
                overflow: "hidden",
                maxHeight: expanded ? 1200 : 0,
                opacity: expanded ? 1 : 0,
                transition:
                  "max-height 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease, margin-top 300ms ease",
                marginTop: expanded ? 16 : 0,
              }}
            >
              <ExplainerBody
                drivers={drivers}
                historicalComparison={historicalComparison}
                scenarios={scenarios}
              />
            </div>
          )}
        </div>
      )}

      {/* === Mobile full-screen sheet === */}
      {hasExplainer && isMobile && sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Por que esse preco"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "var(--app-bg)",
            display: "flex",
            flexDirection: "column",
            animation: "urban-app-shimmer 1ms",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--app-divider)",
              background: "var(--app-surface)",
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "var(--app-accent)",
              }}
            >
              Por que esse preco?
            </span>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Fechar"
              style={{
                all: "unset",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                color: "var(--app-text)",
              }}
            >
              <Close size={18} />
            </button>
          </header>

          <div
            style={{
              padding: "20px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div>
              <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
                Sugestao da IA
              </p>
              <p
                className="urban-app-display-md"
                style={{ color: "var(--app-accent)" }}
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
                preco atual:{" "}
                <strong style={{ color: "var(--app-text)" }}>{fmtBRL(currentPrice)}</strong>{" "}
                / diaria
              </p>
            </div>

            <ExplainerBody
              drivers={drivers}
              historicalComparison={historicalComparison}
              scenarios={scenarios}
            />
          </div>
        </div>
      )}
    </div>
  );
}
