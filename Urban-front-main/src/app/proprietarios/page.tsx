"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppButton,
  AppEmptyState,
  AppPageShell,
  AppSectionHeader,
  Icons,
  useAppToast,
} from "../componentes/ui";
import { todayKeySP } from "../lib/owner-report";
import {
  createPropertyOwner,
  deletePropertyOwner,
  fetchOwnerConsent,
  fetchPropertyOwners,
  getFriendlyApiErrorMessage,
  getPropriedadesDropdownList,
  updatePropertyOwner,
  type OwnerConsentInfo,
  type PropertyDropdown,
  type PropertyOwner,
  type PropertyOwnerInput,
} from "../service/api";
import { OwnerCard } from "./OwnerCard";
import { OwnerForm } from "./OwnerForm";
import styles from "./page.module.css";

type FormState = { mode: "create" } | { mode: "edit"; owner: PropertyOwner } | null;

/**
 * Proprietários dos imóveis (ADR 0027). O anfitrião cadastra quem recebe o relatório mensal,
 * registra a declaração de base legal e controla pré-visualização, link, envio e revogação.
 */
export default function OwnersPage() {
  const toast = useAppToast();
  const [owners, setOwners] = useState<PropertyOwner[]>([]);
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [consent, setConsent] = useState<OwnerConsentInfo | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const todayKey = useMemo(() => todayKeySP(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, props, consentInfo] = await Promise.all([
        fetchPropertyOwners(),
        getPropriedadesDropdownList(),
        fetchOwnerConsent().catch(() => null),
      ]);
      setOwners(list);
      setProperties(props);
      setConsent(consentInfo);
    } catch (err) {
      setError(getFriendlyApiErrorMessage(err, "Não foi possível carregar os proprietários."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const takenByOthers = useMemo(() => {
    const editingId = form?.mode === "edit" ? form.owner.id : null;
    const ids = new Set<string>();
    for (const owner of owners) {
      if (owner.id === editingId) continue;
      for (const property of owner.properties) ids.add(property.id);
    }
    return ids;
  }, [owners, form]);

  async function handleSubmit(input: PropertyOwnerInput) {
    if (form?.mode === "edit") {
      await updatePropertyOwner(form.owner.id, input);
      toast.success("Proprietário atualizado");
    } else {
      await createPropertyOwner(input);
      toast.success("Proprietário cadastrado", "Agora você pode pré-visualizar o relatório e copiar o link.");
    }
    setForm(null);
    await load();
  }

  async function handleDelete(owner: PropertyOwner) {
    try {
      await deletePropertyOwner(owner.id);
      toast.success("Proprietário removido");
      await load();
    } catch (err) {
      toast.error("Não foi possível remover", getFriendlyApiErrorMessage(err));
    }
  }

  return (
    <AppPageShell maxWidth={1040}>
      <AppSectionHeader
        eyebrow="CONTA · PROPRIETÁRIOS"
        title="Proprietários e relatório mensal"
        subtitle="Cadastre quem é dono dos imóveis que você administra. O My Urban monta o relatório do mês só com números registrados e você escolhe: enviar por e-mail ou copiar o link."
        actions={
          <AppButton variant="primary" leftIcon={<Icons.Plus size={14} />} onClick={() => setForm({ mode: "create" })} disabled={loading || Boolean(error)}>
            Adicionar proprietário
          </AppButton>
        }
      />

      {form ? (
        <OwnerForm
          key={form.mode === "edit" ? form.owner.id : "new"}
          owner={form.mode === "edit" ? form.owner : null}
          properties={properties}
          consent={consent}
          takenPropertyIds={takenByOthers}
          onCancel={() => setForm(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {loading ? (
        <p role="status" className={styles.muted}>
          Carregando proprietários…
        </p>
      ) : error ? (
        <AppEmptyState
          eyebrow="ALGO DEU ERRADO"
          title="Não foi possível carregar"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AppButton variant="primary" onClick={() => void load()}>
              Tentar de novo
            </AppButton>
          }
        />
      ) : owners.length === 0 ? (
        <AppEmptyState
          eyebrow="NENHUM PROPRIETÁRIO"
          title="Ninguém recebe o relatório ainda"
          body="Adicione o primeiro proprietário e vincule os imóveis dele. O relatório mostra receita, diária média e ocupação apenas quando houver resultado registrado."
          icon={<Icons.Users size={32} />}
        />
      ) : (
        <div className={styles.ownerList}>
          {owners.map((owner) => (
            <OwnerCard
              key={owner.id}
              owner={owner}
              todayKey={todayKey}
              onEdit={(value) => setForm({ mode: "edit", owner: value })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </AppPageShell>
  );
}
