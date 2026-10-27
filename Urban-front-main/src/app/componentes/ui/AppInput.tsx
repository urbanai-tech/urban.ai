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

/** Liga label, ajuda e erro ao campo: id estavel, aria-describedby e aria-invalid. */
function useFieldA11y({
  id,
  helper,
  error,
  describedBy,
}: {
  id?: string;
  helper?: string;
  error?: string;
  describedBy?: string;
}) {
  const generated = React.useId();
  const fieldId = id ?? `field-${generated}`;
  const messageId = error || helper ? `${fieldId}-message` : undefined;
  const ids = [describedBy, messageId].filter(Boolean).join(" ") || undefined;
  return {
    fieldId,
    messageId,
    fieldProps: {
      id: fieldId,
      "aria-describedby": ids,
      "aria-invalid": error ? (true as const) : undefined,
    },
  };
}

function FieldShell({
  fieldId,
  messageId,
  label,
  helper,
  error,
  children,
  style,
}: {
  fieldId: string;
  messageId?: string;
  label?: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "block", maxWidth: "100%", minWidth: 0, ...style }}>
      {label && (
        <label htmlFor={fieldId} style={appLabelStyle}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={messageId} role="alert" style={appErrorTextStyle}>
          {error}
        </p>
      ) : helper ? (
        <p id={messageId} style={appHelperTextStyle}>
          {helper}
        </p>
      ) : null}
    </div>
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
  { label, helper, error, leftAddon, style, shellStyle, id, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { fieldId, messageId, fieldProps } = useFieldA11y({ id, helper, error, describedBy });
  const input = (
    <input
      ref={ref}
      {...fieldProps}
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
    <FieldShell fieldId={fieldId} messageId={messageId} label={label} helper={helper} error={error} style={shellStyle}>
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
  { label, helper, error, style, shellStyle, children, id, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { fieldId, messageId, fieldProps } = useFieldA11y({ id, helper, error, describedBy });
  return (
    <FieldShell fieldId={fieldId} messageId={messageId} label={label} helper={helper} error={error} style={shellStyle}>
      <select
        ref={ref}
        {...fieldProps}
        style={{
          ...appFieldBaseStyle,
          appearance: "none",
          paddingRight: 36,
          backgroundColor: appVar.surface,
          backgroundImage: "var(--app-select-chevron)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
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
  { label, helper, error, style, shellStyle, rows = 4, id, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { fieldId, messageId, fieldProps } = useFieldA11y({ id, helper, error, describedBy });
  return (
    <FieldShell fieldId={fieldId} messageId={messageId} label={label} helper={helper} error={error} style={shellStyle}>
      <textarea
        ref={ref}
        {...fieldProps}
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
