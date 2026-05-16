"use client";

import React from "react";

/**
 * Toggle switch admin Urban AI — usa CSS `.urban-admin-switch` em globals.css.
 * Substitui `<input type="checkbox">` cru no auto-refresh do dashboard.
 */

export function AdminSwitch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 12,
        color: "var(--admin-text-muted)",
        fontWeight: 500,
        letterSpacing: 1.5,
        textTransform: "uppercase",
      }}
    >
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="urban-admin-switch"
        data-checked={checked}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
