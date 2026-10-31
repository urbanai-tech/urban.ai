"use client";

import { useId, useMemo, useState } from "react";
import { OwnerReportView } from "../componentes/OwnerReportView";
import { AppBadge, AppButton, AppCard, AppConfirmDialog, AppSelect, Icons, useAppToast } from "../componentes/ui";
import { dateSP, dateTimeSP } from "../lib/format";
import { periodKeyLabel, recentPeriodKeys, type OwnerReportPayload } from "../lib/owner-report";
import {
  createOwnerReportLink,
  fetchOwnerReports,
  getFriendlyApiErrorMessage,
  previewOwnerReport,
  revokeAllOwnerReportLinks,
  revokeOwnerReportLink,
  sendOwnerReportNow,
  type OwnerReportListItem,
  type PropertyOwner,
} from "../service/api";
import styles from "./page.module.css";

const EMAIL_STATUS_LABEL: Record<string, string> = {
  pending: "Ainda não enviado",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Falha no envio",
};

const LINK_STATE_LABEL = { valid: "Ativo", expired: "Expirado", revoked: "Revogado" } as const;

type Busy = "preview" | "link" | "send" | "reports" | "revoke" | null;

export function OwnerCard({
  owner,
  todayKey,
  onEdit,
  onDelete,
}: {
  owner: PropertyOwner;
  /** `YYYY-MM-DD` de hoje em São Paulo (vem da página para o teste poder fixar a data). */
  todayKey: string;
  onEdit: (owner: PropertyOwner) => void;
  onDelete: (owner: PropertyOwner) => Promise<void>;
}) {
  const toast = useAppToast();
  const selectId = useId();
  const periods = useMemo(() => recentPeriodKeys(todayKey, 6), [todayKey]);
  // Padrão: o último mês fechado (o que o envio mensal cobre).
  const [period, setPeriod] = useState(periods[1] ?? periods[0]);
  const [busy, setBusy] = useState<Busy>(null);
  const [preview, setPreview] = useState<OwnerReportPayload | null>(null);
  const [reports, setReports] = useState<OwnerReportListItem[] | null>(null);
  const [lastLink, setLastLink] = useState<{ url: string; expiresAt: string; period: string } | null>(null);
  const [confirm, setConfirm] = useState<"send" | "revoke" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(kind: Exclude<Busy, null>, task: () => Promise<T>, failure: string): Promise<T | null> {
    setBusy(kind);
    setError(null);
    try {
      return await task();
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      setError(code?.message || getFriendlyApiErrorMessage(err, failure));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function loadReports() {
    const list = await run("reports", () => fetchOwnerReports(owner.id), "Não foi possível carregar os relatórios.");
    if (list) setReports(list);
  }

  async function showPreview() {
    const payload = await run("preview", () => previewOwnerReport(owner.id, period), "Não foi possível montar o relatório.");
    if (payload) setPreview(payload);
  }

  async function copyLink() {
    const created = await run("link", () => createOwnerReportLink(owner.id, period), "Não foi possível gerar o link.");
    if (!created) return;
    setLastLink(created);
    try {
      await navigator.clipboard.writeText(created.url);
      toast.success("Link copiado", `Vale até ${dateSP(created.expiresAt)}. Só mostra o relatório, sem login.`);
    } catch {
      toast.info("Link gerado", "Não consegui copiar sozinho: selecione o link abaixo e copie.");
    }
    if (reports) void loadReports();
  }

  async function sendNow() {
    setConfirm(null);
    const result = await run("send", () => sendOwnerReportNow(owner.id, period), "Não foi possível enviar agora.");
    if (!result) return;
    if (result.status === "sent") toast.success("Relatório enviado", `${owner.name} recebeu o relatório de ${periodKeyLabel(period)}.`);
    else if (result.status === "already_sent") toast.info("Já enviado", "Este mês já foi enviado a este proprietário.");
    else toast.warn("Não foi enviado", "Tente de novo em instantes.");
    void loadReports();
  }

  async function revokeAll() {
    setConfirm(null);
    const result = await run("revoke", () => revokeAllOwnerReportLinks(owner.id), "Não foi possível revogar os links.");
    if (!result) return;
    setLastLink(null);
    toast.success("Links revogados", `${result.revoked} link(s) desativado(s).`);
    if (reports) void loadReports();
  }

  async function revokeOne(linkId: string) {
    const ok = await run("revoke", () => revokeOwnerReportLink(owner.id, linkId), "Não foi possível revogar o link.");
    if (ok !== null) {
      toast.success("Link revogado");
      void loadReports();
    }
  }

  const headingId = `owner-${owner.id}-name`;
  return (
    <AppCard variant="default" className={styles.ownerCard} as="article">
      <header className={styles.ownerHeader}>
        <div>
          <h2 id={headingId} className={styles.ownerName}>
            {owner.name}
          </h2>
          <p className={styles.ownerEmail}>{owner.email}</p>
        </div>
        <div className={styles.badges}>
          {owner.unsubscribed ? (
            <AppBadge kind="warn">Descadastrado pelo proprietário</AppBadge>
          ) : owner.monthlyReportEnabled ? (
            <AppBadge kind="success">Envio mensal ligado</AppBadge>
          ) : (
            <AppBadge kind="neutral">Envio mensal desligado</AppBadge>
          )}
        </div>
      </header>

      <ul className={styles.propertyList} aria-label={`Imóveis de ${owner.name}`}>
        {owner.properties.map((property) => (
          <li key={property.id}>
            {property.title}
            {property.location ? <span className={styles.muted}> · {property.location}</span> : null}
          </li>
        ))}
      </ul>

      <p className={styles.muted}>
        Declaração de base legal ({owner.consent.version}) registrada em {dateSP(owner.consent.acceptedAt)}.
        {owner.lastReport
          ? ` Último relatório: ${periodKeyLabel(owner.lastReport.period)} · ${EMAIL_STATUS_LABEL[owner.lastReport.emailStatus] ?? owner.lastReport.emailStatus}${
              owner.lastReport.emailSentAt ? ` em ${dateTimeSP(owner.lastReport.emailSentAt)}` : ""
            }.`
          : " Nenhum relatório gerado ainda."}
      </p>

      <div className={styles.reportBar}>
        <AppSelect
          label="Mês do relatório"
          id={selectId}
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setPreview(null);
          }}
        >
          {periods.map((key, index) => (
            <option key={key} value={key}>
              {periodKeyLabel(key)}
              {index === 0 ? " (em andamento)" : ""}
            </option>
          ))}
        </AppSelect>
        <div className={styles.actions}>
          <AppButton variant="secondary" size="sm" loading={busy === "preview"} onClick={showPreview}>
            Pré-visualizar
          </AppButton>
          <AppButton variant="primary" size="sm" loading={busy === "link"} leftIcon={<Icons.ExternalLink size={14} />} onClick={copyLink}>
            Copiar link
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            loading={busy === "send"}
            disabled={owner.unsubscribed}
            leftIcon={<Icons.Mail size={14} />}
            onClick={() => setConfirm("send")}
          >
            Enviar por e-mail
          </AppButton>
        </div>
      </div>

      {lastLink ? (
        <div className={styles.linkBox} role="status">
          <label htmlFor={`${selectId}-link`} className={styles.linkLabel}>
            Link do relatório de {periodKeyLabel(lastLink.period)} (vale até {dateSP(lastLink.expiresAt)})
          </label>
          <input
            id={`${selectId}-link`}
            className={styles.linkInput}
            readOnly
            value={lastLink.url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      ) : null}

      <div className={styles.secondaryActions}>
        <AppButton variant="ghost" size="sm" loading={busy === "reports"} onClick={loadReports}>
          {reports ? "Atualizar histórico" : "Ver histórico e links"}
        </AppButton>
        <AppButton variant="ghost" size="sm" onClick={() => onEdit(owner)}>
          Editar
        </AppButton>
        <AppButton variant="ghost" size="sm" loading={busy === "revoke"} onClick={() => setConfirm("revoke")}>
          Revogar todos os links
        </AppButton>
        <AppButton variant="danger" size="sm" onClick={() => setConfirm("delete")}>
          Remover
        </AppButton>
      </div>

      {reports ? (
        reports.length === 0 ? (
          <p className={styles.muted}>Nenhum relatório gerado para este proprietário ainda.</p>
        ) : (
          <ul className={styles.historyList} aria-label={`Histórico de relatórios de ${owner.name}`}>
            {reports.map((report) => (
              <li key={report.period} className={styles.historyItem}>
                <p className={styles.historyTitle}>
                  {periodKeyLabel(report.period)} · {EMAIL_STATUS_LABEL[report.emailStatus] ?? report.emailStatus}
                  {report.emailSentAt ? ` (${dateTimeSP(report.emailSentAt)})` : ""}
                </p>
                {report.links.length === 0 ? (
                  <p className={styles.muted}>Sem links emitidos.</p>
                ) : (
                  <ul className={styles.linkList}>
                    {report.links.map((link) => (
                      <li key={link.id} className={styles.linkRow}>
                        <span>
                          <AppBadge kind={link.state === "valid" ? "success" : "neutral"}>{LINK_STATE_LABEL[link.state]}</AppBadge>{" "}
                          {link.origin === "email" ? "Enviado por e-mail" : "Gerado por você"} · vale até {dateSP(link.expiresAt)} ·{" "}
                          {link.viewCount === 0 ? "ainda não aberto" : `aberto ${link.viewCount}x`}
                        </span>
                        {link.state === "valid" ? (
                          <AppButton variant="ghost" size="sm" onClick={() => revokeOne(link.id)}>
                            Revogar
                          </AppButton>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {preview ? (
        <section className={styles.previewBox} aria-label={`Pré-visualização do relatório de ${periodKeyLabel(period)}`}>
          <div className={styles.previewBar}>
            <p className={styles.muted}>Pré-visualização: é exatamente o que o proprietário vê. Não conta como visualização.</p>
            <AppButton variant="ghost" size="sm" onClick={() => setPreview(null)}>
              Fechar
            </AppButton>
          </div>
          <OwnerReportView report={preview} generatedAt={preview.generatedAt} />
        </section>
      ) : null}

      <AppConfirmDialog
        open={confirm === "send"}
        onClose={() => setConfirm(null)}
        onConfirm={sendNow}
        title="Enviar o relatório por e-mail?"
        body={`O My Urban enviará o relatório de ${periodKeyLabel(period)} para ${owner.email}, em seu nome, com link de descadastro. Cada mês só é enviado uma vez.`}
        confirmLabel="Enviar agora"
      />
      <AppConfirmDialog
        open={confirm === "revoke"}
        onClose={() => setConfirm(null)}
        onConfirm={revokeAll}
        title="Revogar todos os links?"
        body="Quem tiver um link deste proprietário deixa de conseguir abrir o relatório. Você pode gerar novos links quando quiser."
        confirmLabel="Revogar links"
        destructive
      />
      <AppConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await onDelete(owner);
        }}
        title={`Remover ${owner.name}?`}
        body="O cadastro, os relatórios gerados e todos os links deste proprietário serão apagados. Os imóveis continuam na sua conta."
        confirmLabel="Remover proprietário"
        destructive
      />
    </AppCard>
  );
}
