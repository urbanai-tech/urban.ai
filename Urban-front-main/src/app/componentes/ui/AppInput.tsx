"use client";

import React from "react";
import {
  appErrorTextStyle,
  appFieldBaseStyle,
  appHelperTextStyle,
  appLabelStyle,
  appVar,
} from "./styles";

/**
 * Input/Select/Textarea light premium do app autenticado.
 * Substitui `Input size="sm"` chakra default + variantes filled cinza.
 *
 * Estilo: bg branco, border divider, focus border accent #E8500A + ring soft.
 * Label persistente em cima (uppercase 2xs).
 */

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
      {label && <span style={appLabelStyle}>{label}</span>}
      {children}
      {error ? <p style={appErrorTextStyle}>{error}</p> : helper ? <p style={appHelperTextStyle}>{helper}</p> : null}
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
        ...appFieldBaseStyle,
        paddingLeft: leftAddon ? 38 : 14,
        borderColor: error ? appVar.danger : appVar.dividerStrong,
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
              color: appVar.textMuted,
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
          ...appFieldBaseStyle,
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
          ...appFieldBaseStyle,
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
