"use client";

import React from "react";

/**
 * Input/Select/Textarea light premium do app autenticado.
 * Substitui `Input size="sm"` chakra default + variantes filled cinza.
 *
 * Estilo: bg branco, border divider, focus border accent #E8500A + ring soft.
 * Label persistente em cima (uppercase 2xs).
 */

const baseFieldStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 14px",
  background: "var(--app-surface)",
  border: "1px solid var(--app-divider-strong)",
  borderRadius: 10,
  color: "var(--app-text)",
  fontSize: 14,
  fontWeight: 400,
  outline: "none",
  transition: "border-color 120ms, box-shadow 120ms",
  fontFamily: "Inter, system-ui, sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "var(--app-text-muted)",
  marginBottom: 6,
};

const helperStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--app-text-muted)",
};

const errorStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--app-danger)",
};

function FieldShell({
  label,
  helper,
  error,
  children,
  style,
}: {
  label?: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "block", ...style }}>
      {label && <span style={labelStyle}>{label}</span>}
      {children}
      {error ? <p style={errorStyle}>{error}</p> : helper ? <p style={helperStyle}>{helper}</p> : null}
    </label>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label?: string;
  helper?: string;
  error?: string;
  leftAddon?: React.ReactNode;
  shellStyle?: React.CSSProperties;
};

export const AppInput = React.forwardRef<HTMLInputElement, InputProps>(function AppInput(
  { label, helper, error, leftAddon, style, shellStyle, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      style={{
        ...baseFieldStyle,
        paddingLeft: leftAddon ? 38 : 14,
        borderColor: error ? "var(--app-danger)" : "var(--app-divider-strong)",
        ...style,
      }}
      {...rest}
    />
  );
  return (
    <FieldShell label={label} helper={helper} error={error} style={shellStyle}>
      {leftAddon ? (
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--app-text-muted)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {leftAddon}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helper?: string;
  error?: string;
  shellStyle?: React.CSSProperties;
};

export const AppSelect = React.forwardRef<HTMLSelectElement, SelectProps>(function AppSelect(
  { label, helper, error, style, shellStyle, children, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} helper={helper} error={error} style={shellStyle}>
      <select
        ref={ref}
        style={{
          ...baseFieldStyle,
          appearance: "none",
          paddingRight: 36,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(14,17,22,0.55)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helper?: string;
  error?: string;
  shellStyle?: React.CSSProperties;
};

export const AppTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function AppTextarea(
  { label, helper, error, style, shellStyle, rows = 4, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} helper={helper} error={error} style={shellStyle}>
      <textarea
        ref={ref}
        rows={rows}
        style={{
          ...baseFieldStyle,
          height: "auto",
          padding: "10px 14px",
          lineHeight: 1.55,
          resize: "vertical",
          fontFamily: "Inter, system-ui, sans-serif",
          ...style,
        }}
        {...rest}
      />
    </FieldShell>
  );
});
