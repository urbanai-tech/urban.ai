"use client";

import React from "react";

/**
 * Inputs admin Urban AI — variante única, dark, sem rounded.
 *
 * Substitui as 5 variantes diferentes de input que existiam:
 *  - bg-slate-800 border border-slate-700
 *  - bg-slate-900 border border-slate-700
 *  - bg-slate-950 border border-slate-700
 *  - <select> nativo sem skin
 *  - <input> nativo sem skin
 *
 * Estilo: bg rgba(255,255,255,0.03), border rgba(255,255,255,0.08),
 * focus border #E8500A + glow accent-soft, radius 2px, fonte Inter 13px.
 */

const baseFieldStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 12px",
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid var(--admin-divider)",
  borderRadius: 2,
  color: "var(--admin-text)",
  fontSize: 13,
  fontWeight: 400,
  outline: "none",
  transition: "border-color 120ms, background 120ms",
  fontFamily: "Inter, system-ui, sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "var(--admin-text-muted)",
  marginBottom: 8,
};

const helperStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--admin-text-muted)",
};

const errorStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--admin-danger)",
};

type FieldShellProps = {
  label?: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

function FieldShell({ label, helper, error, children, style }: FieldShellProps) {
  return (
    <label style={{ display: "block", ...style }}>
      {label && <span style={labelStyle}>{label}</span>}
      {children}
      {error ? (
        <p style={errorStyle}>{error}</p>
      ) : helper ? (
        <p style={helperStyle}>{helper}</p>
      ) : null}
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

export const AdminInput = React.forwardRef<HTMLInputElement, InputProps>(
  function AdminInput(
    { label, helper, error, leftAddon, style, shellStyle, ...rest },
    ref,
  ) {
    const input = (
      <input
        ref={ref}
        style={{
          ...baseFieldStyle,
          paddingLeft: leftAddon ? 36 : 12,
          borderColor: error ? "var(--admin-danger)" : (baseFieldStyle.border as string),
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
                color: "var(--admin-text-muted)",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
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
  },
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helper?: string;
  error?: string;
  shellStyle?: React.CSSProperties;
};

export const AdminSelect = React.forwardRef<HTMLSelectElement, SelectProps>(
  function AdminSelect(
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
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.55)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
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
  },
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helper?: string;
  error?: string;
  shellStyle?: React.CSSProperties;
};

export const AdminTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function AdminTextarea(
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
            padding: "10px 12px",
            lineHeight: 1.55,
            resize: "vertical",
            fontFamily: "Inter, system-ui, sans-serif",
            ...style,
          }}
          {...rest}
        />
      </FieldShell>
    );
  },
);
