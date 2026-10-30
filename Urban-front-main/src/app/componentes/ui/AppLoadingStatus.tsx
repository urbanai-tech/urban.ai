"use client";

import React from "react";
import { AppBadge } from "./AppBadge";
import styles from "./AppLoadingStatus.module.css";
import { AlertCircle, Check } from "./Icons";

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
  /** Classe extra no container. Propriedades de tom (border/background) seguem inline; classes cobrem margens e dimensoes. */
  className?: string;
};

export function AppLoadingStatus({
  eyebrow,
  title,
  body,
  steps = [],
  compact = false,
  tone = "accent",
  style,
  className,
}: Props) {
  const activeStep = steps.find((step) => step.status === "active");
  const toneClass =
    tone === "error"
      ? styles.toneError
      : tone === "warn"
        ? styles.toneWarn
        : tone === "neutral"
          ? styles.toneNeutral
          : styles.toneAccent;

  return (
    <section
      role="status"
      aria-live="polite"
      className={[styles.root, toneClass, compact ? styles.compact : "", className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <div className={styles.header}>
        <div className={styles.headerText}>
          {eyebrow && (
            <p className={styles.eyebrow}>
              {eyebrow}
            </p>
          )}
          <p className={styles.title}>
            {title}
          </p>
          {body && (
            <p className={styles.body}>
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
          className={styles.badge}
        >
          {activeStep?.label ?? "Em andamento"}
        </AppBadge>
      </div>

      {steps.length > 0 && (
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li
              key={step.id}
              className={`${styles.step} ${step.status === "pending" ? styles.stepPending : ""}`}
            >
              <StepMarker status={step.status ?? "pending"} />
              <span className={styles.stepText}>
                <span
                  className={`${styles.stepLabel} ${step.status === "active" ? styles.stepLabelActive : ""}`}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className={styles.stepDetail}>
                    {step.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StepMarker({ status }: { status: AppLoadingStepStatus }) {
  if (status === "complete") {
    return (
      <span className={`${styles.marker} ${styles.markerComplete}`}>
        <Check size={11} />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={`${styles.marker} ${styles.markerError}`}>
        <AlertCircle size={12} />
      </span>
    );
  }

  if (status === "active") {
    return <span aria-hidden className={`${styles.marker} ${styles.markerActive}`} />;
  }

  return <span aria-hidden className={`${styles.marker} ${styles.markerPending}`} />;
}
