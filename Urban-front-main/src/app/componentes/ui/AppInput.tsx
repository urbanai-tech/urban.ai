"use client";

import React from "react";
import { appErrorTextStyle, appHelperTextStyle, appLabelStyle, appVar } from "./styles";
import styles from "./AppInput.module.css";

/** Junta classes ignorando valores vazios. */
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** `outline: none` fica inline para continuar vencendo `.urban-app input:focus-visible`. */
const noOutline: React.CSSProperties = { outline: "none" };

/**
 * Input/Select/Textarea light premium do app autenticado.
 * Substitui `Input size="sm"` chakra default + variantes filled cinza.
 *
 * Estilo: bg branco, border divider, focus border accent accent da marca + ring soft.
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
  { label, helper, error, leftAddon, style, className, shellStyle, id, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { fieldId, messageId, fieldProps } = useFieldA11y({ id, helper, error, describedBy });
  const input = (
    <input
      ref={ref}
      {...fieldProps}
      className={cx(styles.field, Boolean(leftAddon) && styles.withAddon, Boolean(error) && styles.invalid, className)}
      style={{ ...noOutline, ...style }}
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
  { label, helper, error, style, className, shellStyle, children, id, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { fieldId, messageId, fieldProps } = useFieldA11y({ id, helper, error, describedBy });
  return (
    <FieldShell fieldId={fieldId} messageId={messageId} label={label} helper={helper} error={error} style={shellStyle}>
      <select
        ref={ref}
        {...fieldProps}
        className={cx(styles.field, styles.select, className)}
        style={{ ...noOutline, ...style }}
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
  { label, helper, error, style, className, shellStyle, rows = 4, id, "aria-describedby": describedBy, ...rest },
  ref,
) {
  const { fieldId, messageId, fieldProps } = useFieldA11y({ id, helper, error, describedBy });
  return (
    <FieldShell fieldId={fieldId} messageId={messageId} label={label} helper={helper} error={error} style={shellStyle}>
      <textarea
        ref={ref}
        {...fieldProps}
        rows={rows}
        className={cx(styles.field, styles.textarea, className)}
        style={{ ...noOutline, ...style }}
        {...rest}
      />
    </FieldShell>
  );
});
