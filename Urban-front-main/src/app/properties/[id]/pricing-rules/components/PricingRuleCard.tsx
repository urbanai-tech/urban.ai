"use client";

import React, { useMemo } from "react";
import { AppCard } from "../../../../componentes/ui";
import type { PricingRule, PricingRuleType } from "../../../../service/api";

/**
 * Card de regra individual — usado dentro do accordion.
 *
 * Cada `PricingRuleType` define seu próprio shape de `params` e controles
 * (slider OU input numérico). O mini-gráfico SVG é renderizado por uma
 * função `previewSeries` que devolve 14 multiplicadores % por dia.
 */

type ParamControlConfig = {
  key: string;
  label: string;
  /** "slider" usa range input, "number" usa input numérico simples. */
  kind: "slider" | "number";
  min: number;
  max: number;
  step: number;
  unit?: string;
  helper?: string;
};

type RuleConfig = {
  /** Controles principais do card (1–3). */
  controls: ParamControlConfig[];
  /** Pequeno exemplo concreto pra "Por que usar isso?". */
  example: string;
  /** Gera 14 deltas % (-100 a +100) pra alimentar o mini-gráfico SVG. */
  previewSeries: (rule: PricingRule) => number[];
};

const WEEKDAY_HEAD = (i: number) => {
  // simula próximos 14 dias começando "hoje"
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return (d.getDay() + 7) % 7;
};

const RULE_CONFIG: Record<PricingRuleType, RuleConfig> = {
  weekend_uplift: {
    controls: [
      {
        key: "percent",
        label: "Uplift sex/sáb",
        kind: "slider",
        min: 0,
        max: 50,
        step: 1,
        unit: "%",
        helper: "Aumento aplicado em sextas e sábados sobre o preço base.",
      },
    ],
    example:
      "Imóvel R$ 280 base + uplift 15% = R$ 322 nos finais de semana. Em meses de alta procura, isso representa ~R$ 600 a mais de receita por mês.",
    previewSeries: (rule) => {
      const pct = rule.params.percent ?? 0;
      return Array.from({ length: 14 }, (_, i) => {
        const wd = WEEKDAY_HEAD(i);
        return wd === 5 || wd === 6 ? pct : 0;
      });
    },
  },
  weekday_discount: {
    controls: [
      {
        key: "percent",
        label: "Desconto seg–qua",
        kind: "slider",
        min: -30,
        max: 0,
        step: 1,
        unit: "%",
        helper: "Desconto aplicado em segundas, terças e quartas.",
      },
    ],
    example:
      "Em dias úteis lentos, R$ 280 vira R$ 258. Vale a pena: ocupar com -8% rende mais que ficar com a noite vazia.",
    previewSeries: (rule) => {
      const pct = rule.params.percent ?? 0;
      return Array.from({ length: 14 }, (_, i) => {
        const wd = WEEKDAY_HEAD(i);
        return wd === 1 || wd === 2 || wd === 3 ? pct : 0;
      });
    },
  },
  gap_night_filler: {
    controls: [
      {
        key: "percent",
        label: "Desconto no gap",
        kind: "slider",
        min: -50,
        max: 0,
        step: 1,
        unit: "%",
        helper: "Desconto quando há buraco curto entre duas reservas.",
      },
      {
        key: "maxNights",
        label: "Máx. noites",
        kind: "number",
        min: 1,
        max: 5,
        step: 1,
        unit: "n",
        helper: "Só aplica em gaps de até N noites.",
      },
    ],
    example:
      "Se entre duas reservas sobra 1 noite, é quase certeza que ela ficaria vazia. -20% garante a ocupação e evita receita zero.",
    previewSeries: (rule) => {
      const pct = rule.params.percent ?? 0;
      // simula 2 gaps em ~14 dias (dias 5 e 11)
      return Array.from({ length: 14 }, (_, i) => (i === 5 || i === 11 ? pct : 0));
    },
  },
  last_minute: {
    controls: [
      {
        key: "percent",
        label: "Desconto last-minute",
        kind: "slider",
        min: -30,
        max: 0,
        step: 1,
        unit: "%",
        helper: "Desconto aplicado quando faltam poucos dias.",
      },
      {
        key: "daysBefore",
        label: "Janela",
        kind: "number",
        min: 1,
        max: 7,
        step: 1,
        unit: "d",
        helper: "Quantos dias antes da data o desconto começa a valer.",
      },
    ],
    example:
      "Faltam 2 dias pra uma noite vazia: melhor descontar 12% e fechar do que perder a noite.",
    previewSeries: (rule) => {
      const pct = rule.params.percent ?? 0;
      const within = rule.params.daysBefore ?? 3;
      return Array.from({ length: 14 }, (_, i) => (i <= within ? pct : 0));
    },
  },
  length_of_stay: {
    controls: [
      {
        key: "percent",
        label: "Desconto estadia longa",
        kind: "slider",
        min: -30,
        max: 0,
        step: 1,
        unit: "%",
        helper: "Desconto sobre o total da reserva.",
      },
      {
        key: "minNights",
        label: "Mín. noites",
        kind: "number",
        min: 3,
        max: 30,
        step: 1,
        unit: "n",
        helper: "A partir de quantas noites o desconto começa.",
      },
    ],
    example:
      "Reserva de 7 noites com -10% vira ~R$ 1.764 vs R$ 1.960 cheio — mas evita 7 turnovers e atrai bookings estáveis.",
    previewSeries: (rule) => {
      // Visualização indicativa: aplica em ~50% dos dias hipotéticos.
      const pct = rule.params.percent ?? 0;
      return Array.from({ length: 14 }, (_, i) => (i % 2 === 0 ? pct * 0.6 : 0));
    },
  },
  min_stay_dynamic: {
    controls: [
      {
        key: "baseMinNights",
        label: "Mín. normal",
        kind: "number",
        min: 1,
        max: 7,
        step: 1,
        unit: "n",
        helper: "Estadia mínima padrão em ocupação baixa/média.",
      },
      {
        key: "highMinNights",
        label: "Mín. em pico",
        kind: "number",
        min: 1,
        max: 14,
        step: 1,
        unit: "n",
        helper: "Estadia mínima quando ocupação > limite.",
      },
      {
        key: "occupancyThreshold",
        label: "Limite ocupação",
        kind: "slider",
        min: 40,
        max: 95,
        step: 5,
        unit: "%",
        helper: "Acima desse %, eleva a estadia mínima.",
      },
    ],
    example:
      "Carnaval com ocupação 85%: estadia mínima sobe pra 3 noites — protege margem e evita reservas curtas que bloqueiam datas premium.",
    previewSeries: () => {
      // Não afeta preço diretamente — barra neutra.
      return Array.from({ length: 14 }, () => 0);
    },
  },
  occupancy_floor: {
    controls: [
      {
        key: "minPrice",
        label: "Preço mínimo",
        kind: "number",
        min: 50,
        max: 1000,
        step: 10,
        unit: "R$",
        helper: "Nenhuma regra (sozinha ou combinada) pode baixar daqui.",
      },
    ],
    example:
      "Mesmo com 3 regras de desconto somadas, o preço nunca cai abaixo de R$ 180. Trava de segurança contra estratégias agressivas.",
    previewSeries: () => Array.from({ length: 14 }, () => 0),
  },
  event_uplift: {
    controls: [
      {
        key: "percent",
        label: "Uplift por evento",
        kind: "slider",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        helper: "Aumento aplicado em dias com evento de impacto alta no raio.",
      },
      {
        key: "radiusKm",
        label: "Raio",
        kind: "number",
        min: 1,
        max: 15,
        step: 1,
        unit: "km",
        helper: "Distância máxima do evento até o imóvel.",
      },
    ],
    example:
      "Show no Allianz, raio 3km, impacto alta: R$ 280 vira R$ 350 (+25%). Captura o pico de demanda que sempre acontece nesses dias.",
    previewSeries: (rule) => {
      const pct = rule.params.percent ?? 0;
      // 2 picos hipotéticos: dia 4 e dia 10
      return Array.from({ length: 14 }, (_, i) => (i === 4 || i === 10 ? pct : 0));
    },
  },
};

function MiniChart({ deltas }: { deltas: number[] }) {
  const max = Math.max(1, ...deltas.map((d) => Math.abs(d)));
  const w = 120;
  const h = 40;
  const colW = w / deltas.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <line
        x1={0}
        x2={w}
        y1={h / 2}
        y2={h / 2}
        stroke="var(--app-divider-strong)"
        strokeWidth={1}
        strokeDasharray="2 2"
        opacity={0.4}
      />
      {deltas.map((d, i) => {
        const norm = d / max; // -1 .. +1
        const barH = Math.abs(norm) * (h / 2 - 2);
        const y = norm >= 0 ? h / 2 - barH : h / 2;
        return (
          <rect
            key={i}
            x={i * colW + 1}
            y={y}
            width={Math.max(2, colW - 2)}
            height={Math.max(2, barH)}
            rx={1}
            fill="var(--app-accent)"
            opacity={Math.abs(norm) < 0.05 ? 0.2 : 0.85}
          />
        );
      })}
    </svg>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] focus-visible:outline-offset-2"
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "1px solid",
        borderColor: checked ? "var(--app-accent)" : "var(--app-divider-strong)",
        background: checked ? "var(--app-accent)" : "var(--app-surface)",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 140ms, border-color 140ms",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 1px 2px rgba(14, 17, 22, 0.20)",
          transition: "left 140ms",
        }}
      />
    </button>
  );
}

export function PricingRuleCard({
  rule,
  expanded,
  onToggleExpanded,
  onChange,
  disabled,
}: {
  rule: PricingRule;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (next: PricingRule) => void;
  disabled?: boolean;
}) {
  const cfg = RULE_CONFIG[rule.type];
  const deltas = useMemo(() => cfg.previewSeries(rule), [cfg, rule]);

  function updateParam(key: string, value: number) {
    onChange({
      ...rule,
      params: { ...rule.params, [key]: value },
    });
  }

  function toggleEnabled(v: boolean) {
    onChange({ ...rule, enabled: v });
  }

  return (
    <AppCard
      variant={expanded ? "elevated" : "default"}
      style={{
        padding: 0,
        overflow: "hidden",
        borderLeft: rule.enabled ? "3px solid var(--app-accent)" : undefined,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Recolher" : "Expandir"} regra: ${rule.label}`}
        onClick={onToggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpanded();
          }
        }}
        className="focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] focus-visible:outline-offset-[-2px]"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 20px",
          minHeight: 44,
          cursor: "pointer",
          flexWrap: "wrap",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center" }}
        >
          <Switch
            checked={rule.enabled}
            onChange={toggleEnabled}
            disabled={disabled}
            label={`Ativar ${rule.label}`}
          />
        </div>

        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--app-text)",
              letterSpacing: -0.1,
            }}
          >
            {rule.label}
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--app-text-muted)",
              lineHeight: 1.45,
            }}
          >
            {rule.description}
          </p>
        </div>

        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            opacity: rule.enabled ? 1 : 0.4,
            display: "flex",
            alignItems: "center",
          }}
        >
          <MiniChart deltas={deltas} />
        </div>

        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            width: 28,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
            color: "var(--app-text-muted)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 160ms",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polyline
              points="6 9 12 15 18 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {expanded && (
        <div
          style={{
            padding: "8px 20px 22px",
            borderTop: "1px solid var(--app-divider)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
              marginTop: 14,
            }}
          >
            {cfg.controls.map((control) => (
              <ParamControl
                key={control.key}
                control={control}
                value={rule.params[control.key] ?? 0}
                onChange={(v) => updateParam(control.key, v)}
                disabled={disabled || !rule.enabled}
              />
            ))}
          </div>

          <details style={{ marginTop: 18 }}>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--app-accent)",
                letterSpacing: 0.4,
                textTransform: "uppercase",
                outline: "none",
              }}
            >
              Por que usar isso?
            </summary>
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--app-text-muted)",
                maxWidth: 680,
              }}
            >
              {cfg.example}
            </p>
          </details>
        </div>
      )}
    </AppCard>
  );
}

function ParamControl({
  control,
  value,
  onChange,
  disabled,
}: {
  control: ParamControlConfig;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const formattedValue = formatParam(value, control.unit);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "var(--app-text-muted)",
          }}
        >
          {control.label}
        </label>
        <strong
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--app-text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formattedValue}
        </strong>
      </div>
      {control.kind === "slider" ? (
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={control.label}
          style={{
            width: "100%",
            accentColor: "var(--app-accent)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        />
      ) : (
        <input
          type="number"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={control.label}
          style={{
            width: "100%",
            height: 36,
            padding: "0 12px",
            background: "var(--app-surface)",
            border: "1px solid var(--app-divider-strong)",
            borderRadius: 8,
            color: "var(--app-text)",
            fontSize: 14,
            fontWeight: 400,
            outline: "none",
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: disabled ? 0.5 : 1,
          }}
        />
      )}
      {control.helper && (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 11,
            color: "var(--app-text-muted)",
            lineHeight: 1.45,
          }}
        >
          {control.helper}
        </p>
      )}
    </div>
  );
}

function formatParam(value: number, unit?: string): string {
  if (!unit) return String(value);
  if (unit === "R$") return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
  if (unit === "%") return `${value > 0 ? "+" : ""}${value}%`;
  if (unit === "n") return `${value} noite${value === 1 ? "" : "s"}`;
  if (unit === "d") return `${value} dia${value === 1 ? "" : "s"}`;
  if (unit === "km") return `${value} km`;
  return `${value} ${unit}`;
}
