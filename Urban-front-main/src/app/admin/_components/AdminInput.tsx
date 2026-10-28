"use client";

import React from "react";
import styles from "./AdminInput.module.css";

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
 * Estilo: bg e borda por tokens,
 * focus border accent da marca + glow accent-soft, radius 2px, fonte da marca 13px.
 */

/** Junta classes ignorando valores vazios. */
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type FieldShellProps = {
  label?: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

function FieldShell({
  label,
  helper,
  error,
  children,
  style,
  className,
}: FieldShellProps) {
  return (
    <label className={cx(styles.shell, className)} style={style}>
      {label && <span className={styles.label}>{label}</span>}
      {children}
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : helper ? (
        <p className={styles.helper}>{helper}</p>
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
  shellClassName?: string;
};

export const AdminInput = React.forwardRef<HTMLInputElement, InputProps>(
  function AdminInput(
    { label, helper, error, leftAddon, style, className, shellStyle, shellClassName, ...rest },
    ref,
  ) {
    const input = (
      <input
        ref={ref}
        className={cx(
          styles.field,
          leftAddon ? styles.fieldWithAddon : null,
          error && styles.fieldInvalid,
          className,
        )}
        style={style}
        {...rest}
      />
    );

    return (
      <FieldShell
        label={label}
        helper={helper}
        error={error}
        style={shellStyle}
        className={shellClassName}
      >
        {leftAddon ? (
          <div className={styles.addonWrap}>
            <span
              className={styles.addonIcon}
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
  shellClassName?: string;
};

export const AdminSelect = React.forwardRef<HTMLSelectElement, SelectProps>(
  function AdminSelect(
    { label, helper, error, style, className, shellStyle, shellClassName, children, ...rest },
    ref,
  ) {
    return (
      <FieldShell
        label={label}
        helper={helper}
        error={error}
        style={shellStyle}
        className={shellClassName}
      >
        <select
          ref={ref}
          className={cx(styles.field, styles.select, className)}
          style={style}
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
  shellClassName?: string;
};

export const AdminTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function AdminTextarea(
    { label, helper, error, style, className, shellStyle, shellClassName, rows = 4, ...rest },
    ref,
  ) {
    return (
      <FieldShell
        label={label}
        helper={helper}
        error={error}
        style={shellStyle}
        className={shellClassName}
      >
        <textarea
          ref={ref}
          rows={rows}
          className={cx(styles.field, styles.textarea, className)}
          style={style}
          {...rest}
        />
      </FieldShell>
    );
  },
);
