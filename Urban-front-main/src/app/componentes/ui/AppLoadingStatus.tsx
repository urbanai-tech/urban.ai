"use client";

import React from "react";
import { AppBadge } from "./AppBadge";
import { AlertCircle, Check } from "./Icons";
import { appRadius, appTone, appVar } from "./styles";

export type AppLoadingStepStatus = "pending" | "active" | "complete" | "error";

export type AppLoadingStep = {
  id: string;
  label: string;
  detail?: string;
  status?: AppLoadingStepStatus;
};

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  steps?: AppLoadingStep[];
  compact?: boolean;
  tone?: "accent" | "warn" | "neutral" | "error";
  style?: React.CSSProperties;
};

export function AppLoadingStatus({
  eyebrow,
  title,
  body,
  steps = [],
  compact = false,
  tone = "accent",
  style,
}: Props) {
  const activeStep = steps.find((step) => step.status === "active");
  const resolvedTone =
    tone === "error"
      ? appTone.error
      : tone === "warn"
        ? appTone.warn
        : tone === "neutral"
          ? appTone.neutral
          : appTone.accent;

  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        display: "grid",
        gap: compact ? 10 : 14,
        padding: compact ? 12 : 16,
        border: `1px solid ${resolvedTone.borderColor}`,
        borderRadius: appRadius.subtle,
        background: resolvedTone.background,
        color: appVar.text,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <p
              style={{
                margin: "0 0 4px",
                color: resolvedTone.color,
                fontSize: 10,
                fontWeight: 750,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </p>
          )}
          <p
            style={{
              margin: 0,
              color: appVar.text,
              fontSize: compact ? 13 : 15,
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {title}
          </p>
          {body && (
            <p
              style={{
                margin: "5px 0 0",
                color: appVar.textMuted,
                fontSize: compact ? 12 : 13,
                lineHeight: 1.5,
              }}
            >
              {body}
            </p>
          )}
        </div>

        <AppBadge
          kind={
            tone === "warn"
              ? "warn"
              : tone === "error"
                ? "error"
                : tone === "neutral"
                  ? "neutral"
                  : "accent"
          }
          style={{ flexShrink: 0 }}
        >
          {activeStep?.label ?? "Em andamento"}
        </AppBadge>
      </div>

      {steps.length > 0 && (
        <ol
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "1fr"
              : "repeat(auto-fit, minmax(160px, 1fr))",
            gap: compact ? 8 : 10,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {steps.map((step) => (
            <li
              key={step.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                minWidth: 0,
                color: step.status === "pending" ? appVar.textMuted : appVar.text,
              }}
            >
              <StepMarker status={step.status ?? "pending"} />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: compact ? 12 : 13,
                    fontWeight: step.status === "active" ? 750 : 600,
                    lineHeight: 1.35,
                  }}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      color: appVar.textMuted,
                      fontSize: 11,
                      lineHeight: 1.4,
                    }}
                  >
                    {step.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      <style>{`
        @keyframes app-loading-status-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes app-loading-status-pulse {
          50% { opacity: 0.42; }
        }
      `}</style>
    </section>
  );
}

function StepMarker({ status }: { status: AppLoadingStepStatus }) {
  if (status === "complete") {
    return (
      <span style={markerBase("var(--app-success)", "rgba(22,160,107,0.14)")}>
        <Check size={11} />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span style={markerBase("var(--app-danger)", "rgba(194,52,46,0.12)")}>
        <AlertCircle size={12} />
      </span>
    );
  }

  if (status === "active") {
    return (
      <span
        aria-hidden
        style={{
          ...markerBase("var(--app-accent)", "rgba(232,80,10,0.12)"),
          border: "2px solid rgba(232,80,10,0.22)",
          borderTopColor: "var(--app-accent)",
          animation: "app-loading-status-spin 0.8s linear infinite",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{
        ...markerBase("var(--app-text-dim)", "var(--app-surface)"),
        border: "1px solid var(--app-divider-strong)",
        animation: "app-loading-status-pulse 1.2s ease-in-out infinite",
      }}
    />
  );
}

function markerBase(color: string, background: string): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    marginTop: 1,
    color,
    background,
    borderRadius: "50%",
  };
}
