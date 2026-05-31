"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminCommunicationSummary,
  fetchAdminCommunications,
  type CommunicationChannel,
  type CommunicationEvent,
  type CommunicationEventListResponse,
  type CommunicationStatus,
  type CommunicationSummary,
} from "../../service/api";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminSelect,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";

const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  email: "E-mail",
  push: "Push",
  in_app: "In-app",
};

const STATUS_LABELS: Record<CommunicationStatus, string> = {
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Pulado",
};

export default function AdminCommunicationsPage() {
  const [data, setData] = useState<CommunicationEventListResponse | null>(null);
  const [summary, setSummary] = useState<CommunicationSummary | null>(null);
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState<CommunicationChannel | "all">("all");
  const [status, setStatus] = useState<CommunicationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const [list, rollup] = await Promise.all([
        fetchAdminCommunications({
          page: nextPage,
          limit: 30,
          channel,
          status,
          search: search.trim() || undefined,
        }),
        fetchAdminCommunicationSummary(),
      ]);
      setData(list);
      setSummary(rollup);
      setPage(nextPage);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const code = e?.response?.status;
      setError(code === 401 || code === 403 ? "Acesso negado." : e?.message || "Erro ao carregar comunicacoes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, status]);

  const totals24h = useMemo(() => {
    const base = { sent: 0, failed: 0, skipped: 0, email: 0, push: 0, in_app: 0 };
    summary?.totals.forEach((item) => {
      base[item.status] += item.count;
      base[item.channel] += item.count;
    });
    return base;
  }, [summary]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  if (loading && !data) return <AdminPageLoading />;

  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar comunicacoes"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={<AdminButton variant="primary" onClick={() => load(1)}>Tentar novamente</AdminButton>}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · COMUNICACOES"
        title="Central de envios"
        subtitle="Acompanhe e-mails, push PWA e notificações in-app: status, destinatário, tipo, provedor e falhas recentes."
        actions={
          <AdminButton variant="secondary" onClick={() => load(page)} leftIcon={<Icons.RefreshCw size={12} />}>
            Atualizar
          </AdminButton>
        }
      />

      <section style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 28,
            borderTop: "1px solid var(--admin-divider)",
            borderBottom: "1px solid var(--admin-divider)",
          }}
        >
          <AdminMetricCard label="Enviados 24h" value={totals24h.sent.toLocaleString("pt-BR")} status="success" />
          <AdminMetricCard label="Falhas 24h" value={totals24h.failed.toLocaleString("pt-BR")} status={totals24h.failed > 0 ? "error" : "neutral"} />
          <AdminMetricCard label="Pulados 24h" value={totals24h.skipped.toLocaleString("pt-BR")} status="warn" />
          <AdminMetricCard label="E-mails" value={totals24h.email.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Push" value={totals24h.push.toLocaleString("pt-BR")} />
          <AdminMetricCard label="In-app" value={totals24h.in_app.toLocaleString("pt-BR")} />
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <AdminCard variant="subtle">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "end",
            }}
          >
            <AdminInput
              label="Busca"
              placeholder="email, assunto, tipo ou erro"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load(1);
              }}
              shellStyle={{ flex: "1 1 260px", maxWidth: 420 }}
            />
            <AdminSelect
              label="Canal"
              value={channel}
              onChange={(e) => setChannel(e.target.value as CommunicationChannel | "all")}
              shellStyle={{ flex: "0 0 150px" }}
            >
              <option value="all">Todos</option>
              <option value="email">E-mail</option>
              <option value="push">Push</option>
              <option value="in_app">In-app</option>
            </AdminSelect>
            <AdminSelect
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as CommunicationStatus | "all")}
              shellStyle={{ flex: "0 0 150px" }}
            >
              <option value="all">Todos</option>
              <option value="sent">Enviado</option>
              <option value="failed">Falhou</option>
              <option value="skipped">Pulado</option>
            </AdminSelect>
            <AdminButton variant="primary" onClick={() => load(1)} leftIcon={<Icons.Search size={12} />}>
              Filtrar
            </AdminButton>
          </div>
        </AdminCard>
      </section>

      <section>
        {!data?.items.length ? (
          <AdminEmptyState
            title="Nenhum envio encontrado"
            body="Quando a plataforma enviar e-mails, push ou notificações in-app, os eventos aparecem aqui."
            icon={<Icons.Mail size={32} />}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.items.map((event) => (
              <CommunicationRow key={event.id} event={event} />
            ))}
          </div>
        )}

        {data && data.total > data.limit && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-muted)" }}>
              Pagina {page} de {totalPages} · {data.total.toLocaleString("pt-BR")} registros
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <AdminButton variant="secondary" disabled={page <= 1} onClick={() => load(page - 1)}>
                Anterior
              </AdminButton>
              <AdminButton variant="secondary" disabled={page >= totalPages} onClick={() => load(page + 1)}>
                Proxima
              </AdminButton>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CommunicationRow({ event }: { event: CommunicationEvent }) {
  const target = event.recipientEmail || event.recipientDeviceId || event.userId || "sem destinatario";
  return (
    <AdminCard variant={event.status === "failed" ? "accent" : "subtle"} style={{ padding: "16px 18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AdminBadge kind={channelBadge(event.channel)}>{CHANNEL_LABELS[event.channel]}</AdminBadge>
            <AdminBadge kind={statusBadge(event.status)}>{STATUS_LABELS[event.status]}</AdminBadge>
          </div>
          <span style={{ fontSize: 11, color: "var(--admin-text-dim)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            {formatDate(event.createdAt)}
          </span>
        </div>

        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 14, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {event.subject || event.title || event.kind || "Comunicacao"}
          </p>
          <p style={{ margin: "5px 0 0", color: "var(--admin-text-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {target}
          </p>
          {event.failureReason && (
            <p style={{ margin: "8px 0 0", color: "var(--admin-danger)", fontSize: 12, lineHeight: 1.45 }}>
              {event.failureReason}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--admin-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
            {event.kind || "sem tipo"}
          </span>
          <span style={{ fontSize: 11, color: "var(--admin-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
            {event.provider || event.templateName || "interno"}
          </span>
        </div>
      </div>
    </AdminCard>
  );
}

function channelBadge(channel: CommunicationChannel): AdminBadgeKind {
  if (channel === "email") return "accent";
  if (channel === "push") return "warn";
  return "neutral";
}

function statusBadge(status: CommunicationStatus): AdminBadgeKind {
  if (status === "sent") return "success";
  if (status === "failed") return "error";
  return "warn";
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}
