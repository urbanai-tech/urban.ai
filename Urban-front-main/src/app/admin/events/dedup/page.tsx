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
  AdminConfirmDialog,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminSelect,
  AdminTable,
  AdminTextarea,
  Icons,
  type AdminTableColumn,
} from "../../_components";
import styles from "./page.module.css";

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
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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

  function reject(id: string) {
    // Abre o dialog de motivo (substitui o window.prompt nativo — DS-1).
    setRejectReason("");
    setRejectingId(id);
  }

  async function confirmReject() {
    if (!rejectingId) return;
    const id = rejectingId;
    setActionId(id);
    setError(null);
    try {
      await rejectEventDedupCandidate(id, rejectReason.trim() || undefined);
      setRejectingId(null);
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
        <div className={styles.scoreCell}>
          <span className={styles.scoreValue}>
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
          <div className={styles.rowActions}>
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
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="Motor de eventos"
        title="Deduplicação"
        subtitle="Fila operacional de revisão e merge de eventos encontrados por múltiplas fontes."
        actions={
          <div className={styles.headerActions}>
            <AdminInput
              aria-label="Limite do scan"
              type="number"
              min={50}
              max={5000}
              value={scanLimit}
              onChange={(event) => setScanLimit(Number(event.target.value))}
              className={styles.scanLimitInput}
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
        <AdminCard variant="accent" className={styles.errorCard}>
          {error}
        </AdminCard>
      )}

      <div
        className={styles.summaryGrid}
      >
        <AdminMetricCard label="Fila filtrada" value={total} variant="sm" accent />
        <AdminMetricCard label="Pendentes visíveis" value={pending} variant="sm" status={pending ? "warn" : "success"} />
        <AdminMetricCard label="Alta confiança" value={high} variant="sm" />
        <AdminMetricCard label="Score médio" value={`${averageScore}%`} variant="sm" />
      </div>

      {lastScan && (
        <AdminCard variant="subtle" className={styles.scanSummaryCard}>
          <div
            className={styles.scanStatsGrid}
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
            <div className={styles.filterRow}>
              <AdminSelect
                aria-label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(1);
                }}
                className={styles.statusSelect}
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
                className={styles.confidenceSelect}
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
                className={styles.limitSelect}
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
            className={styles.paginationBar}
          >
            <span>
              Página {page} de {totalPages} · {total.toLocaleString("pt-BR")} candidato(s)
            </span>
            <div className={styles.paginationButtons}>
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

      <AdminConfirmDialog
        open={!!rejectingId}
        onClose={() => setRejectingId(null)}
        onConfirm={confirmReject}
        title="Rejeitar candidato de dedup"
        confirmLabel="Rejeitar"
        cancelLabel="Cancelar"
        destructive
        loading={!!actionId}
        body={
          <div className={styles.verticalStack}>
            <span className={styles.rejectPrompt}>
              Motivo da rejeição (opcional):
            </span>
            <AdminTextarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex.: eventos são de fato distintos"
              rows={3}
            />
          </div>
        }
      />
    </div>
  );
}

function EventCell({ event }: { event: EventDedupEventSummary | null }) {
  if (!event) return <span className={styles.emptyEventCell}>-</span>;
  return (
    <div className={styles.eventCell}>
      <span
        className={styles.eventName}
        title={event.nome}
      >
        {event.nome}
      </span>
      <span className={styles.eventMeta}>
        {event.cidade || "-"} / {event.estado || "-"} · {formatDate(event.dataInicio)}
      </span>
      <span
        className={styles.eventAddress}
        title={event.enderecoCompleto ?? ""}
      >
        {event.enderecoCompleto || "Endereço não informado"}
      </span>
      <span className={styles.eventSource}>
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
    <div className={styles.verticalStack}>
      <span className={styles.signalReason}>{candidate.reason}</span>
      <div className={styles.signalList}>
        {entries.map(([label, value]) => (
          <span
            key={label}
            className={styles.signalItem}
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
      <p className={`urban-admin-eyebrow-muted ${styles.scanStatLabel}`}>
        {label}
      </p>
      <p className={styles.scanStatValue}>
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
