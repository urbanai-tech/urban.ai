"use client";

import { useId } from "react";
import { marketingUrl } from "../lib/marketing-url";
import styles from "./WaitlistTermsConsent.module.css";

/**
 * Aceite obrigatório dos Termos de Uso e da Política de Privacidade no cadastro
 * da lista de espera. O backend exige `acceptedTerms: true` e grava data e versão.
 */
export function WaitlistTermsConsent({
  checked,
  onChange,
  invalid = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const errorId = useId();

  return (
    <div className={styles.consent}>
      <label className={styles.label}>
        <input
          type="checkbox"
          name="acceptedTerms"
          className={`${styles.checkbox} ${invalid ? styles.checkboxInvalid : ""}`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          disabled={disabled}
        />
        <span>
          Li e aceito os{" "}
          <a href={marketingUrl("/termos")} target="_blank" rel="noopener noreferrer">
            Termos de Uso
          </a>{" "}
          e a{" "}
          <a href={marketingUrl("/privacidade")} target="_blank" rel="noopener noreferrer">
            Política de Privacidade
          </a>
          .
        </span>
      </label>
      {invalid && (
        <p id={errorId} role="alert" className={styles.error}>
          Aceite os Termos de Uso e a Política de Privacidade para entrar na lista.
        </p>
      )}
    </div>
  );
}
