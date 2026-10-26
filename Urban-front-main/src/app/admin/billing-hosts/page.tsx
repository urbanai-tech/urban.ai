"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminBillingHosts,
  sendAdminBillingLink,
  type AdminBillingHost,
  type AdminBillingHostsResponse,
} from "../../service/api/beta-ops";
import {
  AdminBadge,
  AdminButton,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminSelect,
  AdminTable,
  Icons,
  useAdminToast,
  type AdminTableColumn,
} from "../_components";
import {
  BILLING_FILTERS,
  formatSaoPauloDate,
  formatSaoPauloDateTime,
  planSummary,
  sendLinkConfirmation,
  sendLinkLabel,
  statusBadgeKind,
  trialText,
} from "./billing-hosts-domain";

/**
 * /admin/billing-hosts — cobrança assistida do beta.
 * Mostra cada anfitrião com o estado real da assinatura (a mesma regra do bloqueio 402) e
 * reenvia, por e-mail, o link de checkout/portal que o sistema já gera. O link não aparece
 * na tela nem no log: vai direto para o e-mail do anfitrião.
 */
export default function AdminBillingHostsPage() {
  const toast = useAdminToast();
  const [data, setData] = useState<AdminBillingHostsResponse | null>(null);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<AdminBillingHost | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await fetchAdminBillingHosts({ status, search: search.trim() || undefined }));
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const code = e?.response?.status;
      setError(code === 401 || code === 403 ? "Acesso negado." : e?.message || "Erro ao carregar anfitriões.");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  async function confirmSend() {
    if (!target) return;
    setSending(true);
    try {
      const result = await sendAdminBillingLink(target.userId, "auto");
      toast.success(
        `${result.kind === "portal" ? "Link do portal" : "Link de checkout"} enviado para ${result.sentTo}.`,
      );
      setTarget(null);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message || e?.message || "Não foi possível enviar o link.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <AdminPageLoading />;

  if (error && !data) {
    return (
      <div className="beta-ops-page">
        <AdminEmptyState eyebrow="Erro" title="Falha ao carregar" body={error} icon={<Icons.AlertCircle size={32} />} />
      </div>
    );
  }

  const columns: AdminTableColumn<AdminBillingHost>[] = [
    {
      key: "host",
      header: "Anfitrião",
      render: (host) => (
        <div>
          <p className="font-semibold">{host.name || "sem nome"}</p>
          <p className="beta-ops-muted">{host.email || "sem e-mail"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Assinatura",
      render: (host) => (
        <div className="beta-ops-stack">
          <AdminBadge kind={statusBadgeKind(host.status)}>{host.statusLabel}</AdminBadge>
          {trialText(host.status, host.trialDaysLeft) && (
            <span className="beta-ops-warn">{trialText(host.status, host.trialDaysLeft)}</span>
          )}
          {host.attentionReason && host.status !== "trialing" && (
            <span className="beta-ops-muted">{host.attentionReason}</span>
          )}
        </div>
      ),
    },
    { key: "plan", header: "Plano", render: (host) => planSummary(host) },
    {
      key: "period",
      header: "Período",
      render: (host) => (
        <div>
          <p>fim: {formatSaoPauloDate(host.periodEnd)}</p>
          {host.graceEndsAt && (
            <p className="beta-ops-muted">carência até {formatSaoPauloDate(host.graceEndsAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: "last",
      header: "Último evento de cobrança",
      render: (host) => formatSaoPauloDateTime(host.lastBillingEventAt),
    },
    {
      key: "action",
      header: "Ação",
      align: "right",
      render: (host) =>
        host.status === "alpha" || host.status === "inactive" ? (
          <span className="beta-ops-muted">sem cobrança</span>
        ) : (
          <AdminButton
            size="sm"
            variant={host.needsAttention ? "primary" : "secondary"}
            onClick={() => setTarget(host)}
            disabled={!host.email}
          >
            {sendLinkLabel(host.suggestedLink, host.status)}
          </AdminButton>
        ),
    },
  ];

  const summary = data?.summary;

  return (
    <div className="beta-ops-page">
      <AdminSectionHeader
        eyebrow="ADMIN · COBRANÇA"
        title="Cobrança dos anfitriões"
        subtitle="Estado real da assinatura de cada anfitrião do beta e reenvio do link de pagamento que o sistema já gera."
      />

      <section className="beta-ops-metrics">
        <AdminMetricCard label="Anfitriões" value={summary?.total ?? 0} variant="md" />
        <AdminMetricCard
          label="Precisam de atenção"
          value={summary?.needsAttention ?? 0}
          variant="md"
          status={summary && summary.needsAttention > 0 ? "warn" : "success"}
        />
        <AdminMetricCard label="Em trial" value={summary?.byStatus.trialing ?? 0} variant="md" />
        <AdminMetricCard
          label="Pagamento falhou"
          value={summary?.byStatus.past_due ?? 0}
          variant="md"
          status={summary && summary.byStatus.past_due > 0 ? "error" : "success"}
        />
      </section>

      <div className="beta-ops-filters">
        <AdminSelect label="Mostrar" value={status} onChange={(event) => setStatus(event.target.value)}>
          {BILLING_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </AdminSelect>
        <AdminInput
          label="Buscar por nome ou e-mail"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ana@exemplo.com"
        />
      </div>

      {data?.truncated && (
        <p className="beta-ops-note-tight">Lista cortada nos 500 anfitriões mais recentes.</p>
      )}

      <AdminTable
        columns={columns}
        rows={data?.hosts ?? []}
        rowKey={(host) => host.userId}
        minWidth={980}
        empty={
          <AdminEmptyState
            title="Nenhum anfitrião neste filtro"
            body="Ajuste o filtro ou a busca. Anfitriões sem assinatura aparecem como “Sem assinatura”."
          />
        }
      />

      <p className="beta-ops-note">
        “Último evento de cobrança” é a última atualização recebida do Stripe para esse anfitrião (webhook); não é a data
        do último pagamento. O link enviado expira em algumas horas e nunca é exibido aqui.
      </p>

      <AdminConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={confirmSend}
        loading={sending}
        title="Enviar link de cobrança"
        body={target ? sendLinkConfirmation(target, target.suggestedLink) : undefined}
        confirmLabel="Enviar e-mail"
      />
    </div>
  );
}
