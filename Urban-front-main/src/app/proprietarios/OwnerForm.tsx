"use client";

import { useId, useState } from "react";
import { AppButton, AppCard, AppCardHeader, AppInput } from "../componentes/ui";
import {
  formatPropertyPrimaryLabel,
  getFriendlyApiErrorMessage,
  type OwnerConsentInfo,
  type PropertyDropdown,
  type PropertyOwner,
  type PropertyOwnerInput,
} from "../service/api";
import styles from "./page.module.css";

/**
 * Cadastro/edição de proprietário. A declaração de base legal é obrigatória no cadastro e quando
 * o e-mail muda (outro destinatário); a versão do texto aceito vai junto com o pedido e o servidor
 * grava versão, data e IP.
 */
export function OwnerForm({
  owner,
  properties,
  consent,
  takenPropertyIds,
  onCancel,
  onSubmit,
}: {
  owner: PropertyOwner | null;
  properties: PropertyDropdown[];
  consent: OwnerConsentInfo | null;
  /** Imóveis que já têm outro proprietário (não podem ser escolhidos aqui). */
  takenPropertyIds: Set<string>;
  onCancel: () => void;
  onSubmit: (input: PropertyOwnerInput) => Promise<void>;
}) {
  const formId = useId();
  const [name, setName] = useState(owner?.name ?? "");
  const [email, setEmail] = useState(owner?.email ?? "");
  const [propertyIds, setPropertyIds] = useState<string[]>(owner?.properties.map((p) => p.id) ?? []);
  const [monthly, setMonthly] = useState(owner?.monthlyReportEnabled ?? true);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailChanged = owner ? email.trim().toLowerCase() !== owner.email : true;
  const needsConsent = !owner || emailChanged;

  function toggleProperty(id: string) {
    setPropertyIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Informe o nome do proprietário.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Informe um e-mail válido.");
    if (propertyIds.length === 0) return setError("Escolha ao menos um imóvel.");
    if (needsConsent && !accepted) return setError("Confirme a declaração de base legal para continuar.");
    if (needsConsent && !consent) return setError("Não foi possível carregar o texto da declaração. Recarregue a página.");

    const input: PropertyOwnerInput = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      propertyIds,
      monthlyReportEnabled: monthly,
    };
    if (needsConsent && consent) {
      input.consentAccepted = true;
      input.consentVersion = consent.version;
    }
    setSaving(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, "Não foi possível salvar o proprietário."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppCard variant="elevated" className={styles.formCard}>
      <AppCardHeader
        title={owner ? "Editar proprietário" : "Novo proprietário"}
        subtitle="O proprietário não tem login: recebe só o relatório mensal, por e-mail ou por link."
      />
      <form onSubmit={submit} noValidate className={styles.form} aria-label={owner ? "Editar proprietário" : "Novo proprietário"}>
        <div className={styles.formGrid}>
          <AppInput
            label="Nome"
            value={name}
            maxLength={160}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
          <AppInput
            label="E-mail"
            type="email"
            value={email}
            maxLength={254}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
            helper={owner && emailChanged ? "Trocar o e-mail exige nova declaração." : undefined}
          />
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Imóveis deste proprietário</legend>
          {properties.length === 0 ? (
            <p className={styles.muted}>Cadastre um imóvel para vincular a um proprietário.</p>
          ) : (
            <ul className={styles.checkList}>
              {properties.map((property) => {
                const taken = takenPropertyIds.has(property.id) && !propertyIds.includes(property.id);
                const checkboxId = `${formId}-prop-${property.id}`;
                return (
                  <li key={property.id} className={styles.checkItem}>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={propertyIds.includes(property.id)}
                      disabled={taken}
                      onChange={() => toggleProperty(property.id)}
                    />
                    <label htmlFor={checkboxId}>
                      {formatPropertyPrimaryLabel(property)}
                      {taken ? <span className={styles.muted}> (já vinculado a outro proprietário)</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <div className={styles.checkItem}>
          <input id={`${formId}-monthly`} type="checkbox" checked={monthly} onChange={(event) => setMonthly(event.target.checked)} />
          <label htmlFor={`${formId}-monthly`}>Enviar o relatório mensal por e-mail no primeiro dia útil do mês</label>
        </div>

        {needsConsent ? (
          <div className={styles.consentBox}>
            <p className={styles.consentTitle}>Declaração de base legal</p>
            <p className={styles.consentText} data-testid="owner-consent-text">
              {consent?.text ?? "Carregando o texto da declaração…"}
            </p>
            <div className={styles.checkItem}>
              <input
                id={`${formId}-consent`}
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <label htmlFor={`${formId}-consent`}>Declaro que sim e quero compartilhar o relatório com este proprietário</label>
            </div>
          </div>
        ) : (
          <p className={styles.muted}>
            Declaração já registrada em {new Date(owner!.consent.acceptedAt).toLocaleDateString("pt-BR")}.
          </p>
        )}

        {error ? (
          <p role="alert" className={styles.formError}>
            {error}
          </p>
        ) : null}

        <div className={styles.formActions}>
          <AppButton type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton type="submit" variant="primary" loading={saving}>
            {owner ? "Salvar alterações" : "Cadastrar proprietário"}
          </AppButton>
        </div>
      </form>
    </AppCard>
  );
}
