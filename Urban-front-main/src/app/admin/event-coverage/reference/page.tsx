"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveEventReference,
  fetchEventCoverageMetrics,
  fetchEventReferenceConfig,
  fetchEventReferenceConflicts,
  fetchEventReferences,
  fetchMissingReferences,
  importEventReferenceCsv,
  rejectEventReference,
  runEventCoverageMatch,
  runEventReferenceCuration,
  type CoverageMetricRow,
  type CurationResultLite,
  type EventCoverageMetrics,
  type EventReferenceConfigResponse,
  type EventReferenceItem,
  type EventReferenceList,
  type EventReferenceStatus,
  type EventReferenceWithVotes,
  type MatchResultLite,
  type ReferenceImportSummary,
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
  Icons,
  useAdminToast,
  type AdminTableColumn,
} from "../../_components";
import {
  dimensionLabel,
  dimensionValueLabel,
  floorY,
  formatDateKey,
  formatPct,
  normalizeApiError,
  recallTone,
  sizeLabel,
  sparkPath,
  sparkPoints,
  statusMeta,
  validatorLabel,
  verdictLabel,
} from "./reference-domain";
import styles from "./page.module.css";

const PAGE_SIZE = 15;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 140;
const BREAKDOWN_DIMENSIONS = ["size", "category", "venue"] as const;

type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

/**
 * /admin/event-coverage/reference — lista de referência de eventos de SP (ADR 0026).
 *
 * A curadoria por agentes alimenta a lista e aprova sozinha só com consenso de fontes
 * independentes; o que diverge cai na fila de conflitos abaixo, para revisão humana.
 * Recall e precisão (com série diária) vêm do snapshot gravado pelo job diário.
 */
export default function EventReferencePage() {
  const toast = useAdminToast();
  const [config, setConfig] = useState<EventReferenceConfigResponse | null>(null);
  const [metrics, setMetrics] = useState<EventCoverageMetrics | null>(null);
  const [conflicts, setConflicts] = useState<EventReferenceWithVotes[]>([]);
  const [missing, setMissing] = useState<Array<{ id: string; name: string; venueName: string; dateKey: string }>>([]);
  const [list, setList] = useState<EventReferenceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<EventReferenceStatus | "">("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [breakdown, setBreakdown] = useState<BreakdownDimension>("size");

  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCurate, setConfirmCurate] = useState(false);
  const [curationResult, setCurationResult] = useState<CurationResultLite | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultLite | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"aprovado" | "candidato">("aprovado");
  const [importResult, setImportResult] = useState<ReferenceImportSummary | null>(null);

  const loadList = useCallback(async () => {
    setList(await fetchEventReferences({ status: statusFilter, q: search.trim(), page, limit: PAGE_SIZE }));
  }, [statusFilter, search, page]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, met, conf, miss] = await Promise.all([
        fetchEventReferenceConfig(),
        fetchEventCoverageMetrics(60),
        fetchEventReferenceConflicts(),
        fetchMissingReferences(15),
      ]);
      setConfig(cfg);
      setMetrics(met);
      setConflicts(conf.items);
      setMissing(miss.items);
      await loadList();
    } catch (err: unknown) {
      setError(normalizeApiError(err, "Erro ao carregar a lista de referência."));
    } finally {
      setLoading(false);
    }
  }, [loadList]);

  useEffect(() => {
    void loadAll();
    // Recarrega tudo só na montagem; filtros recarregam apenas a lista (efeito abaixo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    loadList().catch((err: unknown) => toast.error(normalizeApiError(err, "Erro ao filtrar a lista.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, page]);

  // Debounce da busca por nome: evita uma chamada por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch((current) => {
        if (current === searchDraft.trim()) return current;
        setPage(1);
        return searchDraft.trim();
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const refreshAfterChange = useCallback(async () => {
    try {
      const [cfg, met, conf, miss] = await Promise.all([
        fetchEventReferenceConfig(),
        fetchEventCoverageMetrics(60),
        fetchEventReferenceConflicts(),
        fetchMissingReferences(15),
      ]);
      setConfig(cfg);
      setMetrics(met);
      setConflicts(conf.items);
      setMissing(miss.items);
      await loadList();
    } catch (err: unknown) {
      toast.error(normalizeApiError(err, "Não foi possível atualizar os dados."));
    }
  }, [loadList, toast]);

  async function decide(item: EventReferenceItem, decision: "approve" | "reject") {
    setBusy(`${decision}:${item.id}`);
    try {
      if (decision === "approve") await approveEventReference(item.id);
      else await rejectEventReference(item.id);
      toast.success(decision === "approve" ? `"${item.name}" aprovada.` : `"${item.name}" rejeitada.`);
      await refreshAfterChange();
    } catch (err: unknown) {
      toast.error(normalizeApiError(err, "Não foi possível registrar a decisão."));
    } finally {
      setBusy(null);
    }
  }

  async function runCuration() {
    setBusy("curate");
    try {
      const run = await runEventReferenceCuration();
      if (run.status === "error") throw new Error(run.errorMessage ?? "A curadoria falhou.");
      setCurationResult(run.result as CurationResultLite);
      toast.success("Curadoria concluída.");
      await refreshAfterChange();
    } catch (err: unknown) {
      toast.error(normalizeApiError(err, "A curadoria falhou."));
    } finally {
      setBusy(null);
      setConfirmCurate(false);
    }
  }

  async function runMatch() {
    setBusy("match");
    try {
      const run = await runEventCoverageMatch();
      if (run.status === "error") throw new Error(run.errorMessage ?? "O casamento falhou.");
      setMatchResult(run.result as MatchResultLite);
      toast.success("Métricas recalculadas.");
      await refreshAfterChange();
    } catch (err: unknown) {
      toast.error(normalizeApiError(err, "O recálculo falhou."));
    } finally {
      setBusy(null);
    }
  }

  async function submitImport(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo maior que 2 MB. Divida em partes menores.");
      return;
    }
    setBusy("import");
    setImportResult(null);
    try {
      const summary = await importEventReferenceCsv(file, importStatus);
      setImportResult(summary);
      toast.success(`Import concluído: ${summary.created} criadas, ${summary.updated} atualizadas.`);
      await refreshAfterChange();
    } catch (err: unknown) {
      toast.error(normalizeApiError(err, "Erro ao processar o CSV."));
    } finally {
      setBusy(null);
    }
  }

  function downloadTemplate() {
    if (!config) return;
    const blob = new Blob([config.csvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "urban-ai-referencia-eventos-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const totalPast = metrics?.rows.find((r) => r.scope === "past30" && r.dimension === "total");
  const totalNext = metrics?.rows.find((r) => r.scope === "next90" && r.dimension === "total");
  const floor = metrics?.floorPct ?? config?.config.recallFloorPct ?? 0;

  const points = useMemo(() => sparkPoints(metrics?.series ?? [], CHART_WIDTH, CHART_HEIGHT), [metrics]);
  const breakdownRows = useMemo(() => {
    const byValue = new Map<string, { past?: CoverageMetricRow; next?: CoverageMetricRow }>();
    for (const row of metrics?.rows ?? []) {
      if (row.dimension !== breakdown) continue;
      const entry = byValue.get(row.dimensionValue) ?? {};
      if (row.scope === "past30") entry.past = row;
      else entry.next = row;
      byValue.set(row.dimensionValue, entry);
    }
    return [...byValue.entries()].map(([value, rows]) => ({ value, ...rows }));
  }, [metrics, breakdown]);

  if (loading && !config) return <AdminPageLoading />;

  if (error || !config || !metrics) {
    return (
      <div className={styles.page}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error ?? "Sem dados."}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={loadAll}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const listColumns: AdminTableColumn<EventReferenceItem>[] = [
    {
      key: "name",
      header: "Evento",
      render: (r) => (
        <div>
          <span className={styles.cellStrong}>{r.name}</span>
          <span className={styles.cellMuted}>{r.category ?? "sem categoria"}</span>
        </div>
      ),
    },
    { key: "venue", header: "Venue", render: (r) => <span>{r.venueName}</span> },
    { key: "date", header: "Data", width: 110, render: (r) => <span>{formatDateKey(r.dateKey)}</span> },
    { key: "size", header: "Porte", width: 90, render: (r) => <span>{sizeLabel(r.size)}</span> },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (r) => {
        const meta = statusMeta(r.status);
        return <AdminBadge kind={meta.badge}>{meta.label}</AdminBadge>;
      },
    },
    {
      key: "votes",
      header: "Votos",
      width: 90,
      align: "right",
      render: (r) => <span className={styles.num}>{r.votesSupport}</span>,
    },
    {
      key: "evidence",
      header: "Evidência",
      width: 110,
      render: (r) =>
        r.evidenceUrls.length > 0 ? (
          <a className={styles.link} href={r.evidenceUrls[0]} target="_blank" rel="noopener noreferrer">
            {r.evidenceUrls.length} {r.evidenceUrls.length === 1 ? "link" : "links"}
          </a>
        ) : (
          <span className={styles.cellMuted}>nenhuma</span>
        ),
    },
    {
      key: "match",
      header: "No radar",
      width: 100,
      render: (r) =>
        r.status !== "aprovado" ? (
          <span className={styles.cellMuted}>—</span>
        ) : r.matchedEventId ? (
          <AdminBadge kind="success">Sim</AdminBadge>
        ) : (
          <AdminBadge kind="warn">Não</AdminBadge>
        ),
    },
  ];

  const breakdownColumns: AdminTableColumn<(typeof breakdownRows)[number]>[] = [
    {
      key: "value",
      header: dimensionLabel(breakdown),
      render: (r) => <span className={styles.cellStrong}>{dimensionValueLabel(breakdown, r.value)}</span>,
    },
    {
      key: "past",
      header: "Recall 30 d",
      align: "right",
      width: 130,
      render: (r) => (
        <span className={styles.num}>
          {formatPct(r.past?.recallPct)}
          <span className={styles.cellMuted}>
            {" "}
            {r.past ? `${r.past.referenceMatched}/${r.past.referenceTotal}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "next",
      header: "Recall próx. 90 d",
      align: "right",
      width: 160,
      render: (r) => (
        <span className={styles.num}>
          {formatPct(r.next?.recallPct)}
          <span className={styles.cellMuted}>
            {" "}
            {r.next && r.next.referenceTotal > 0 ? `${r.next.referenceMatched}/${r.next.referenceTotal}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "precision",
      header: "Precisão",
      align: "right",
      width: 130,
      render: (r) => (
        <span className={styles.num}>
          {formatPct(r.next?.precisionPct)}
          <span className={styles.cellMuted}>
            {" "}
            {r.next?.precisionSample ? `${r.next.precisionConfirmed}/${r.next.precisionSample}` : ""}
          </span>
        </span>
      ),
    },
  ];

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className={styles.page}>
      <AdminSectionHeader
        eyebrow="ADMIN · MOTOR DE EVENTOS"
        title="Lista de referência"
        subtitle="Os eventos de SP que o radar deveria ter. Agentes validam entre si; você só revisa o que diverge."
        actions={
          <div className={styles.headerActions}>
            <AdminButton variant="secondary" as="a" href="/admin/event-coverage" leftIcon={<Icons.ArrowLeft size={11} />}>
              Cobertura de eventos
            </AdminButton>
            <AdminButton
              variant="secondary"
              onClick={() => void refreshAfterChange()}
              leftIcon={<Icons.RefreshCw size={12} />}
            >
              Atualizar
            </AdminButton>
          </div>
        }
      />

      {config.warnings.length > 0 && (
        <ul className={styles.warnings} aria-label="Avisos de configuração">
          {config.warnings.map((w) => (
            <li key={w} className={styles.warning}>
              {w}
            </li>
          ))}
        </ul>
      )}

      <section className={styles.section} aria-label="Recall e precisão">
        <p className="urban-admin-eyebrow">RECALL E PRECISÃO{metrics.latestDate ? ` · MEDIDO EM ${formatDateKey(metrics.latestDate)}` : ""}</p>
        {metrics.latestDate === null ? (
          <AdminCard variant="subtle">
            <p className={styles.muted}>
              Ainda não há medição. Importe ou aprove referências e use “Recalcular métricas”; o job diário grava a série.
            </p>
          </AdminCard>
        ) : (
          <div className={styles.kpis}>
            <AdminMetricCard
              label="Recall · últimos 30 dias"
              value={formatPct(totalPast?.recallPct)}
              sub={totalPast ? `${totalPast.referenceMatched} de ${totalPast.referenceTotal} referências no radar` : "sem referências aprovadas já realizadas"}
              accent
              status={
                recallTone(totalPast?.recallPct, floor) === "error"
                  ? "error"
                  : recallTone(totalPast?.recallPct, floor) === "warn"
                    ? "warn"
                    : "success"
              }
            />
            <AdminMetricCard
              label="Recall · próximos 90 dias"
              value={formatPct(totalNext?.recallPct)}
              sub={totalNext ? `${totalNext.referenceMatched} de ${totalNext.referenceTotal} já no radar` : "sem referências futuras aprovadas"}
            />
            <AdminMetricCard
              label="Precisão da amostra"
              value={formatPct(totalNext?.precisionPct)}
              sub={
                totalNext?.precisionSample
                  ? `${totalNext.precisionConfirmed} de ${totalNext.precisionSample} confirmados (${totalNext.precisionRefuted ?? 0} refutados)`
                  : "sem eventos do banco nos venues da lista"
              }
            />
            <AdminMetricCard
              label="Piso do alerta"
              value={floor > 0 ? `${floor}%` : "Desligado"}
              sub="EVENT_COVERAGE_RECALL_FLOOR_PCT"
            />
          </div>
        )}
        <div className={styles.countRow}>
          {(["aprovado", "candidato", "conflito", "rejeitado"] as EventReferenceStatus[]).map((s) => (
            <span key={s} className={styles.countItem}>
              <AdminBadge kind={statusMeta(s).badge}>{statusMeta(s).label}</AdminBadge>{" "}
              <strong>{(config.counts[s] ?? 0).toLocaleString("pt-BR")}</strong>
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-label="Série diária do recall">
        <p className="urban-admin-eyebrow">SÉRIE DIÁRIA · RECALL DOS ÚLTIMOS 30 DIAS</p>
        <AdminCard>
          {points.length === 0 ? (
            <p className={styles.muted}>A série começa no primeiro dia com referências aprovadas já realizadas.</p>
          ) : (
            <>
              <svg
                className={styles.chart}
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                role="img"
                aria-label={`Recall diário, de ${formatPct(points[0].value)} em ${formatDateKey(points[0].date)} a ${formatPct(points[points.length - 1].value)} em ${formatDateKey(points[points.length - 1].date)}`}
              >
                {floor > 0 && (
                  <line
                    className={styles.chartFloor}
                    x1={8}
                    x2={CHART_WIDTH - 8}
                    y1={floorY(floor, CHART_HEIGHT)}
                    y2={floorY(floor, CHART_HEIGHT)}
                  />
                )}
                <path className={styles.chartLine} d={sparkPath(points)} />
                {points.map((p) => (
                  <circle key={p.date} className={styles.chartDot} cx={p.x} cy={p.y} r={3}>
                    <title>{`${formatDateKey(p.date)}: ${formatPct(p.value)}`}</title>
                  </circle>
                ))}
              </svg>
              <p className={styles.muted}>
                {floor > 0 ? `Linha tracejada: piso de ${floor}% (abaixo dele o alerta dispara). ` : ""}
                Dias sem referências aprovadas já realizadas ficam de fora.
              </p>
            </>
          )}
        </AdminCard>
      </section>

      <section className={styles.section} aria-label="Curadoria por agentes">
        <p className="urban-admin-eyebrow">CURADORIA E CASAMENTO</p>
        <AdminCard variant="subtle">
          <div className={styles.actionsRow}>
            <div className={styles.actionsText}>
              <p className={styles.cellStrong}>Agentes que se validam entre si</p>
              <p className={styles.muted}>
                Aprova sozinho com {config.config.minAgree} fontes independentes (uma delas externa) e sem divergência de data. Tetos por
                execução: {config.config.maxSearchCalls} buscas, {config.config.maxScrapeCalls} leituras de página,{" "}
                {config.config.maxLlmCalls} extrações. Cron diário: {config.config.curationEnabled ? "ligado" : "desligado"}. Fontes:{" "}
                {(["tavily", "serpapi", "firecrawl", "gemini", "anthropic"] as const)
                  .map((k) => `${k} ${config.providers[k] ? "sim" : "não"}`)
                  .join(" · ")}
                .
              </p>
            </div>
            <div className={styles.headerActions}>
              <AdminButton
                variant="primary"
                onClick={() => setConfirmCurate(true)}
                loading={busy === "curate"}
                loadingLabel="Rodando…"
                disabled={busy !== null}
              >
                Rodar curadoria
              </AdminButton>
              <AdminButton
                variant="secondary"
                onClick={() => void runMatch()}
                loading={busy === "match"}
                loadingLabel="Calculando…"
                disabled={busy !== null}
              >
                Recalcular métricas
              </AdminButton>
            </div>
          </div>
          {curationResult && (
            <p className={styles.result} role="status">
              Curadoria: {curationResult.venuesProcessed}/{curationResult.venuesTotal} venues, {curationResult.observations} observações,{" "}
              {curationResult.referencesTouched} referências ({curationResult.approvedAuto} aprovadas, {curationResult.conflicts} em
              conflito, {curationResult.candidates} candidatas).
              {curationResult.warnings.length > 0 ? ` Avisos: ${curationResult.warnings.join(" ")}` : ""}
            </p>
          )}
          {matchResult && (
            <p className={styles.result} role="status">
              Casamento de {matchResult.snapshotDate}: {matchResult.matched} de {matchResult.referencesChecked} referências no radar; recall
              30 d {formatPct(matchResult.recallPast30Pct)}; precisão {formatPct(matchResult.precisionPct)}
              {matchResult.alerted ? " — alerta de recall enviado." : "."}
            </p>
          )}
        </AdminCard>
      </section>

      <section className={styles.section} aria-label="Fila de conflitos">
        <p className="urban-admin-eyebrow">FILA DE CONFLITOS · {conflicts.length}</p>
        {conflicts.length === 0 ? (
          <AdminCard variant="subtle">
            <p className={styles.muted}>Nenhum conflito para revisar. Divergências de data entre fontes e rejeições do juiz aparecem aqui.</p>
          </AdminCard>
        ) : (
          <ul className={styles.conflictList}>
            {conflicts.map((c) => (
              <li key={c.id}>
                <AdminCard variant="accent">
                  <div className={styles.conflict}>
                    <div className={styles.conflictHead}>
                      <div>
                        <p className={styles.cellStrong}>{c.name}</p>
                        <p className={styles.muted}>
                          {c.venueName} · {formatDateKey(c.dateKey)} · {sizeLabel(c.size)}
                        </p>
                      </div>
                      <AdminBadge kind="error">Conflito</AdminBadge>
                    </div>
                    {c.conflictReason && <p className={styles.reason}>{c.conflictReason}</p>}
                    <ul className={styles.votes} aria-label={`Votos dos validadores para ${c.name}`}>
                      {c.votes.map((v) => (
                        <li key={v.id} className={styles.vote}>
                          <span className={styles.voteWho}>{validatorLabel(v.validatorKey, v.validatorKind)}</span>
                          <span className={styles.muted}>
                            {verdictLabel(v.verdict)}
                            {v.observedDate ? ` · ${formatDateKey(v.observedDate)}` : ""}
                            {v.snippet ? ` · ${v.snippet}` : ""}
                          </span>
                          {v.sourceUrl && /^https?:\/\//i.test(v.sourceUrl) && (
                            <a className={styles.link} href={v.sourceUrl} target="_blank" rel="noopener noreferrer">
                              Abrir fonte
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className={styles.conflictActions}>
                      <AdminButton
                        variant="primary"
                        size="sm"
                        onClick={() => void decide(c, "approve")}
                        loading={busy === `approve:${c.id}`}
                        disabled={busy !== null}
                        aria-label={`Aprovar ${c.name}`}
                      >
                        Aprovar
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        size="sm"
                        onClick={() => void decide(c, "reject")}
                        loading={busy === `reject:${c.id}`}
                        disabled={busy !== null}
                        aria-label={`Rejeitar ${c.name}`}
                      >
                        Rejeitar
                      </AdminButton>
                    </div>
                  </div>
                </AdminCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-label="Recall por dimensão">
        <div className={styles.breakdownHead}>
          <p className="urban-admin-eyebrow">POR PORTE, CATEGORIA E VENUE</p>
          <AdminSelect
            aria-label="Dimensão do recorte"
            value={breakdown}
            onChange={(e) => setBreakdown(e.target.value as BreakdownDimension)}
          >
            {BREAKDOWN_DIMENSIONS.map((d) => (
              <option key={d} value={d}>
                {dimensionLabel(d)}
              </option>
            ))}
          </AdminSelect>
        </div>
        <AdminTable
          columns={breakdownColumns}
          rows={breakdownRows}
          rowKey={(r) => r.value}
          empty={<AdminEmptyState eyebrow="Sem dados" title="Nenhuma referência aprovada neste recorte" />}
        />
      </section>

      {missing.length > 0 && (
        <section className={styles.section} aria-label="Referências que o radar não achou">
          <p className="urban-admin-eyebrow">REFERÊNCIAS QUE O RADAR NÃO ACHOU</p>
          <AdminCard variant="subtle">
            <ul className={styles.missingList}>
              {missing.map((m) => (
                <li key={m.id}>
                  <span className={styles.cellStrong}>{m.name}</span>{" "}
                  <span className={styles.muted}>
                    {m.venueName} · {formatDateKey(m.dateKey)}
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.muted}>
              Cadastre pelo{" "}
              <Link className={styles.link} href="/admin/events/new">
                cadastro manual
              </Link>{" "}
              ou confira as fontes em{" "}
              <Link className={styles.link} href="/admin/collectors-health">
                Coletores
              </Link>
              .
            </p>
          </AdminCard>
        </section>
      )}

      <section className={styles.section} aria-label="Lista de referência">
        <p className="urban-admin-eyebrow">LISTA · {list ? list.total.toLocaleString("pt-BR") : 0} REFERÊNCIAS</p>
        <div className={styles.filters}>
          <AdminSelect
            label="Status"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as EventReferenceStatus | "");
            }}
          >
            <option value="">Todos</option>
            <option value="aprovado">Aprovadas</option>
            <option value="candidato">Candidatas</option>
            <option value="conflito">Conflitos</option>
            <option value="rejeitado">Rejeitadas</option>
          </AdminSelect>
          <AdminInput
            label="Buscar por nome"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Ex.: Palmeiras"
          />
        </div>
        <AdminTable
          columns={listColumns}
          rows={list?.items ?? []}
          rowKey={(r) => r.id}
          empty={
            <AdminEmptyState
              eyebrow="Lista vazia"
              title="Nenhuma referência neste filtro"
              body="Importe um CSV ou rode a curadoria para começar."
            />
          }
        />
        <div className={styles.pager}>
          <AdminButton variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Anterior
          </AdminButton>
          <span className={styles.muted}>
            Página {page} de {totalPages}
          </span>
          <AdminButton variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
            Próxima
          </AdminButton>
        </div>
      </section>

      <section className={styles.section} aria-label="Importar CSV">
        <p className="urban-admin-eyebrow">IMPORTAR CSV</p>
        <AdminCard variant="subtle">
          <AdminCardHeader
            eyebrow="CURADORIA HUMANA"
            title="Importar referências"
            actions={
              <AdminButton variant="secondary" size="sm" onClick={downloadTemplate} leftIcon={<Icons.Download size={12} />}>
                Baixar template
              </AdminButton>
            }
          />
          <p className={styles.muted}>
            Colunas: <code>nome</code>, <code>venue</code>, <code>dataInicio</code> (AAAA-MM-DD, ISO ou dd/mm/aaaa) e, opcionais,{" "}
            <code>cidade</code>, <code>categoria</code>, <code>porte</code> (grande, medio, pequeno) e <code>url</code> (evidência). Máx.
            2000 linhas, 2 MB. Reimportar o mesmo arquivo não duplica.
          </p>
          <form className={styles.importForm} onSubmit={submitImport}>
            <label className={styles.fileLabel}>
              <span>Arquivo CSV</span>
              <input
                className={styles.fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <AdminSelect
              label="Entrar como"
              value={importStatus}
              onChange={(e) => setImportStatus(e.target.value as "aprovado" | "candidato")}
            >
              <option value="aprovado">Aprovada (já revisada por você)</option>
              <option value="candidato">Candidata (vai para a fila)</option>
            </AdminSelect>
            <AdminButton type="submit" variant="primary" disabled={!file || busy !== null} loading={busy === "import"} loadingLabel="Importando…">
              Importar
            </AdminButton>
          </form>
          {importResult && (
            <div role="status">
              <p className={styles.result}>
                {importResult.parsedRows} linhas lidas: {importResult.created} criadas, {importResult.updated} atualizadas,{" "}
                {importResult.unchanged} sem mudança, {importResult.invalidRows.length} inválidas.
              </p>
              {importResult.invalidRows.length > 0 && (
                <ul className={styles.invalidList}>
                  {importResult.invalidRows.slice(0, 20).map((r) => (
                    <li key={r.line}>
                      Linha {r.line}: {r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </AdminCard>
      </section>

      <AdminConfirmDialog
        open={confirmCurate}
        onClose={() => setConfirmCurate(false)}
        onConfirm={runCuration}
        loading={busy === "curate"}
        title="Rodar a curadoria agora?"
        body={`Consulta as fontes configuradas para os próximos ${config.config.horizonDays} dias, dentro dos tetos de chamadas (podem gerar custo nos provedores). Sem chaves, só o banco de eventos vota e tudo vira candidato.`}
        confirmLabel="Rodar curadoria"
      />
    </div>
  );
}
