"use client";

import React from "react";
import styles from "./AdminSwitch.module.css";

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
      className={`${styles.label} ${disabled ? styles.labelDisabled : ""}`}
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
