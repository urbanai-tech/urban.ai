"use client";

import React from "react";
import { AppButton } from "./AppButton";
import { AppBadge } from "./AppBadge";
import { ArrowRight, Calendar, MapPin, Sparkles, TrendingUp } from "./Icons";

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
    </div>
  );
}
