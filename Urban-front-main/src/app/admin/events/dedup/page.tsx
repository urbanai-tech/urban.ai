"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveEventDedupCandidate,
  fetchEventDedupCandidates,
  rejectEventDedupCandidate,
  scanEventDedupCandidates,
  type EventDedupCandidate,
  type EventDedupCandidateStatus,
  type EventDedupConfidenceBand,
  type EventDedupEventSummary,
  type EventDedupScanResponse,
} from "../../../service/api";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminSelect,
  AdminTable,
  Icons,
  type AdminTableColumn,
} from "../../_components";

type StatusFilter = EventDedupCandidateStatus | "all";
type ConfidenceFilter = EventDedupConfidenceBand | "all";

const statusLabels: Record<StatusFilter, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  obsolete: "Obsoleto",
  all: "Todos",
};

const confidenceLabels: Record<ConfidenceFilter, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  all: "Todas",
};

export default function AdminEventDedupPage() {
  const [items, setItems] = useState<EventDedupCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [confidenceBand, setConfidenceBand] = useState<ConfidenceFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [scanLimit, setScanLimit] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<EventDedupScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageOverride = page) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchEventDedupCandidates({
        page: pageOverride,
        limit,
        status,
        confidenceBand,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [confidenceBand, limit, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const pending = items.filter((item) => item.status === "pending").length;
  const high = items.filter((item) => item.confidenceBand === "high").length;
  const averageScore = useMemo(() => {
    if (!items.length) return 0;
    return Math.round((items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length) * 100);
  }, [items]);

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const response = await scanEventDedupCandidates({
        limit: scanLimit,
        lookbackDays: 30,
        lookaheadDays: 365,
        minScore: 0.74,
        highScore: 0.86,
      });
      setLastScan(response);
      setPage(1);
      await load(1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  async function approve(id: string) {
    setActionId(id);
    setError(null);
    try {
      await approveEventDedupCandidate(id);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Motivo da rejeição", "");
    setActionId(id);
    setError(null);
    try {
      await rejectEventDedupCandidate(id, reason ?? undefined);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  const columns: AdminTableColumn<EventDedupCandidate>[] = [
    {
      key: "score",
      header: "Score",
      width: 105,
      render: (candidate) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 15, color: "var(--admin-text)" }}>
            {Math.round(candidate.score * 100)}%
          </span>
          <AdminBadge kind={candidate.confidenceBand === "high" ? "accent" : "warn"}>
            {confidenceLabels[candidate.confidenceBand]}
          </AdminBadge>
        </div>
      ),
    },
    {
      key: "canonical",
      header: "Canônico",
      width: "28%",
      render: (candidate) => <EventCell event={candidate.canonicalEvent} />,
    },
    {
      key: "duplicate",
      header: "Possível duplicado",
      width: "28%",
      render: (candidate) => <EventCell event={candidate.duplicateEvent} />,
    },
    {
      key: "signals",
      header: "Evidências",
      render: (candidate) => <SignalCell candidate={candidate} />,
    },
    {
      key: "actions",
      header: "Ação",
      width: 180,
      align: "right",
      render: (candidate) =>
        candidate.status === "pending" ? (
          <div style={{ display: "inline-flex", gap: 8 }}>
            <AdminButton
              size="sm"
              variant="primary"
              disabled={Boolean(actionId)}
              loading={actionId === candidate.id}
              onClick={() => approve(candidate.id)}
              leftIcon={<Icons.Check size={12} />}
            >
              Aprovar
            </AdminButton>
            <AdminButton
              size="sm"
              variant="danger"
              disabled={Boolean(actionId)}
              onClick={() => reject(candidate.id)}
              leftIcon={<Icons.Close size={12} />}
            >
              Rejeitar
            </AdminButton>
          </div>
        ) : (
          <AdminBadge kind={candidate.status === "approved" ? "success" : "neutral"}>
            {statusLabels[candidate.status]}
          </AdminBadge>
        ),
    },
  ];

  if (loading && !items.length) return <AdminPageLoading />;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 28px 56px" }}>
      <AdminSectionHeader
        eyebrow="Motor de eventos"
        title="Deduplicação"
        subtitle="Fila operacional de revisão e merge de eventos encontrados por múltiplas fontes."
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <AdminInput
              aria-label="Limite do scan"
              type="number"
              min={50}
              max={5000}
              value={scanLimit}
              onChange={(event) => setScanLimit(Number(event.target.value))}
              style={{ width: 110 }}
            />
            <AdminButton
              variant="primary"
              loading={scanning}
              disabled={scanning}
              onClick={runScan}
              leftIcon={<Icons.Search size={13} />}
            >
              Rodar scan
            </AdminButton>
          </div>
        }
      />

      {error && (
        <AdminCard variant="accent" style={{ marginBottom: 20, color: "var(--admin-danger)" }}>
          {error}
        </AdminCard>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 18,
          marginBottom: 22,
        }}
      >
        <AdminMetricCard label="Fila filtrada" value={total} variant="sm" accent />
        <AdminMetricCard label="Pendentes visíveis" value={pending} variant="sm" status={pending ? "warn" : "success"} />
        <AdminMetricCard label="Alta confiança" value={high} variant="sm" />
        <AdminMetricCard label="Score médio" value={`${averageScore}%`} variant="sm" />
      </div>

      {lastScan && (
        <AdminCard variant="subtle" style={{ marginBottom: 22 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <ScanStat label="Eventos" value={lastScan.scannedEvents} />
            <ScanStat label="Review pending" value={lastScan.reviewPendingEvents} />
            <ScanStat label="Criados" value={lastScan.created} />
            <ScanStat label="Atualizados" value={lastScan.updated} />
            <ScanStat label="Fila total" value={lastScan.pendingTotal} />
          </div>
        </AdminCard>
      )}

      <AdminCard>
        <AdminCardHeader
          eyebrow="Revisão"
          title="Candidatos"
          actions={
            <div style={{ display: "flex", gap: 10 }}>
              <AdminSelect
                aria-label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(1);
                }}
                style={{ width: 150 }}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect
                aria-label="Confiança"
                value={confidenceBand}
                onChange={(event) => {
                  setConfidenceBand(event.target.value as ConfidenceFilter);
                  setPage(1);
                }}
                style={{ width: 140 }}
              >
                {Object.entries(confidenceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect
                aria-label="Limite"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                style={{ width: 100 }}
              >
                {[25, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </AdminSelect>
            </div>
          }
        />

        <AdminTable
          rows={items}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={1100}
          empty={
            <AdminEmptyState
              eyebrow="Sem candidatos"
              title="Nada para revisar"
              body="A fila filtrada está vazia."
              icon={<Icons.Check size={30} />}
            />
          }
          />

        {total > limit && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginTop: 14,
              fontSize: 12,
              color: "var(--admin-text-muted)",
            }}
          >
            <span>
              Página {page} de {totalPages} · {total.toLocaleString("pt-BR")} candidato(s)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <AdminButton
                size="sm"
                variant="ghost"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                leftIcon={<Icons.ArrowLeft size={11} />}
              >
                Anterior
              </AdminButton>
              <AdminButton
                size="sm"
                variant="ghost"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                rightIcon={<Icons.ArrowRight size={11} />}
              >
                Próxima
              </AdminButton>
            </div>
          </div>
        )}
      </AdminCard>
    </div>
  );
}

function EventCell({ event }: { event: EventDedupEventSummary | null }) {
  if (!event) return <span style={{ color: "var(--admin-text-muted)" }}>-</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--admin-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={event.nome}
      >
        {event.nome}
      </span>
      <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
        {event.cidade || "-"} / {event.estado || "-"} · {formatDate(event.dataInicio)}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "var(--admin-text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={event.enderecoCompleto ?? ""}
      >
        {event.enderecoCompleto || "Endereço não informado"}
      </span>
      <span style={{ fontSize: 11, color: "var(--admin-text-muted)", fontFamily: "monospace" }}>
        {event.source || "sem-source"} · fontes {event.sourceCount ?? 0}
      </span>
    </div>
  );
}

function SignalCell({ candidate }: { candidate: EventDedupCandidate }) {
  const entries: Array<[string, number | null]> = [
    ["Data", signalValue(candidate.signals, "date")],
    ["Nome", signalValue(candidate.signals, "name")],
    ["Venue", signalValue(candidate.signals, "venue")],
    ["Geo", signalValue(candidate.signals, "geo")],
    ["URL", signalValue(candidate.signals, "url")],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--admin-text)" }}>{candidate.reason}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {entries.map(([label, value]) => (
          <span
            key={label}
            style={{
              border: "1px solid var(--admin-divider)",
              padding: "3px 6px",
              fontSize: 10,
              color: "var(--admin-text-muted)",
              fontFamily: "monospace",
            }}
          >
            {label}:{typeof value === "number" ? value.toFixed(2) : "-"}
          </span>
        ))}
      </div>
    </div>
  );
}

function signalValue(signals: EventDedupCandidate["signals"], key: string): number | null {
  if (!signals) return null;
  if (Array.isArray(signals)) {
    const found = signals.find((signal) => {
      if (typeof signal === "string") return signal.toLowerCase().includes(key);
      const signalKey = String(signal.key ?? signal.name ?? signal.label ?? "").toLowerCase();
      return signalKey === key || signalKey.includes(key);
    });
    if (!found || typeof found === "string") return null;
    const value = found.score ?? found.value;
    return typeof value === "number" ? value : null;
  }
  const raw = signals[key] ?? signals[`${key}Score`];
  return typeof raw === "number" ? raw : null;
}

function ScanStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "var(--admin-text)" }}>
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function errorMessage(err: unknown) {
  const error = err as { response?: { data?: { message?: string } }; message?: string };
  return error?.response?.data?.message ?? error?.message ?? "Erro inesperado.";
}
