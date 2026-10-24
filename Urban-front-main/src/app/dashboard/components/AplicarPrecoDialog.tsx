"use client";

import React, { useEffect, useRef, useState } from "react";
import { AppButton, AppInput, useToastCompat } from "@/app/componentes/ui";
import { useDialogFocus } from "@/app/componentes/ui/useDialogFocus";
import {
  AIRBNB_STEPS,
  checkAppliedPrice,
  formatBrl,
  formatPlainPrice,
  formatSaoPauloDay,
  saoPauloDayKey,
} from "./aplicar-preco-domain";

/**
 * Dialog "Vou aplicar este preço".
 *
 * A Urban AI não muda o preço no Airbnb: aqui o anfitrião vê o valor e a data,
 * copia o valor, segue o passo a passo no Airbnb e DEPOIS confirma o preço que
 * de fato aplicou. Só a confirmação grava o preço aplicado.
 */

export interface AplicarPrecoDialogProps {
  open: boolean;
  onClose: () => void;
  /** Recebe o preço (R$) já validado. Deve lançar se não conseguir gravar. */
  onConfirm: (appliedPrice: number) => Promise<void>;
  eventName: string;
  /** Início do evento (ISO). O dia mostrado é o de São Paulo. */
  eventStart: string;
  eventEnd?: string | null;
  suggestedPrice: number;
  currentPrice?: number;
  /** Preço já informado antes (reabertura para corrigir). */
  appliedPrice?: number | null;
}

export function AplicarPrecoDialog({
  open,
  onClose,
  onConfirm,
  eventName,
  eventStart,
  eventEnd,
  suggestedPrice,
  currentPrice,
  appliedPrice,
}: AplicarPrecoDialogProps) {
  const toast = useToastCompat();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prefill = appliedPrice ?? suggestedPrice;
  const [value, setValue] = useState(formatPlainPrice(prefill));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(formatPlainPrice(appliedPrice ?? suggestedPrice));
      setError(undefined);
      setSaving(false);
    }
  }, [open, appliedPrice, suggestedPrice]);

  useDialogFocus({ open, containerRef: dialogRef, initialFocusRef: inputRef, onClose });

  if (!open) return null;

  const startDay = saoPauloDayKey(eventStart);
  const endDay = saoPauloDayKey(eventEnd);
  const multiDay = Boolean(startDay && endDay && startDay !== endDay);

  async function copyValue() {
    const text = formatPlainPrice(suggestedPrice);
    try {
      await navigator.clipboard.writeText(text);
      toast(`Valor ${text} copiado.`, { type: "success" });
    } catch {
      toast("Não foi possível copiar. Digite o valor manualmente.", { type: "warning" });
    }
  }

  async function confirm() {
    const check = checkAppliedPrice(value, [suggestedPrice, currentPrice]);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await onConfirm(check.value);
    } catch {
      setError("Não foi possível salvar agora. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    <div className="aplicar-root" role="dialog" aria-modal="true" aria-labelledby="aplicar-title">
      <div className="aplicar-backdrop" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div ref={dialogRef} tabIndex={-1} className="aplicar-panel urban-app">
        <p className="urban-app-eyebrow">VOCÊ APLICA NO AIRBNB</p>
        <h2 id="aplicar-title" className="aplicar-title">
          Vou aplicar este preço
        </h2>
        <p className="aplicar-lead">
          A Urban AI não altera o preço no Airbnb por você. Aplique o valor abaixo e depois confirme aqui o que
          você realmente aplicou.
        </p>

        <dl className="aplicar-facts">
          <div>
            <dt>Evento</dt>
            <dd>{eventName}</dd>
          </div>
          <div>
            <dt>Data da sugestão</dt>
            <dd>{formatSaoPauloDay(eventStart)}</dd>
          </div>
          <div>
            <dt>Preço recomendado</dt>
            <dd className="aplicar-price">{formatBrl(suggestedPrice)}</dd>
          </div>
        </dl>
        {multiDay && (
          <p className="aplicar-note">
            O evento vai até {formatSaoPauloDay(eventEnd)}. A sugestão vale para o primeiro dia; confira os demais
            dias no seu calendário.
          </p>
        )}

        <div className="aplicar-copy">
          <AppButton variant="secondary" size="sm" onClick={copyValue}>
            Copiar valor ({formatPlainPrice(suggestedPrice)})
          </AppButton>
        </div>

        <ol className="aplicar-steps">
          {AIRBNB_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <AppInput
          ref={inputRef}
          label="Preço que apliquei"
          leftAddon={<span>R$</span>}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          inputMode="decimal"
          placeholder="0,00"
          helper="Pode ajustar se você aplicou um valor diferente do recomendado."
          error={error}
        />

        <div className="aplicar-actions">
          <AppButton variant="ghost" onClick={onClose} disabled={saving}>
            Ainda não apliquei
          </AppButton>
          <AppButton variant="primary" onClick={confirm} loading={saving}>
            Confirmar
          </AppButton>
        </div>
      </div>

      <style jsx>{`
        .aplicar-root {
          position: fixed;
          inset: 0;
          z-index: 1300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .aplicar-backdrop {
          position: absolute;
          inset: 0;
          background: var(--app-backdrop);
        }
        .aplicar-panel {
          position: relative;
          width: 100%;
          max-width: 520px;
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 14px;
          padding: 24px;
          background: var(--app-surface-elevated, var(--app-surface));
          border: 1px solid var(--app-divider-strong);
          border-radius: 14px;
          box-shadow: var(--app-shadow-overlay);
        }
        .aplicar-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--app-text);
        }
        .aplicar-lead,
        .aplicar-note {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: var(--app-text-muted);
        }
        .aplicar-facts {
          width: 100%;
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .aplicar-facts div {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }
        .aplicar-facts dt {
          color: var(--app-text-muted);
          font-size: 13px;
        }
        .aplicar-facts dd {
          margin: 0;
          color: var(--app-text);
          font-size: 14px;
          font-weight: 600;
          text-align: right;
        }
        .aplicar-price {
          color: var(--app-accent);
          font-size: 18px;
        }
        .aplicar-copy {
          display: flex;
        }
        .aplicar-steps {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 4px;
          font-size: 14px;
          color: var(--app-text);
        }
        .aplicar-actions {
          width: 100%;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        @media (max-width: 767px) {
          .aplicar-panel {
            padding: 20px 16px;
          }
          .aplicar-actions {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </div>
  );
}
