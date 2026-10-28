"use client";

import { useEffect, useState } from "react";
import {
  fetchCollectorsHealth,
  type CollectorsHealthResponse,
  type CollectorSourceStats,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminButton,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminBadge,
  AdminCard,
  AdminStatusDot,
  AdminDrawer,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";
import styles from "./page.module.css";

type CollectorHealthStatus =
  | "has_events"
  | "missing_key"
  | "no_events"
  | "stale"
  | "zero_yield"
  | (string & {});

type CollectorHealthRow = CollectorSourceStats & {
  status?: CollectorHealthStatus;
  critical?: boolean | null;
  missingEnv?: string[];
  missingVariables?: string[];
  missingKeys?: string[];
  missingRequiredEnv?: string[];
  missing_env?: string[];
  requiredEnv?: string[];
  aliases?: string[];
  signals?: string[];
  stale?: boolean;
};

/**
 * /admin/collectors-health — saúde dos coletores agrupada por source.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - 5 KPIs agregados em grid.
 *  - Tabela reduzida a 6 colunas principais; row clicável → AdminDrawer com
 *    detalhes técnicos (variáveis, sinais, missing_env, aliases).
 *  - HealthBadge / CriticalityBadge → AdminBadge.
 *  - Métricas threshold-colored substituídas por número monocromático +
 *    AdminStatusDot warn quando acima do limite.
 *  - Footer "Como ler" colapsado em <details>.
 */
export default function CollectorsHealthPage() {
  const [data, setData] = useState<CollectorsHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CollectorHealthRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCollectorsHealth());
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(
        status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <AdminPageLoading />;

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={load}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const sources = (data?.sources ?? []) as CollectorHealthRow[];
  const totals = sources.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.last24h += s.last24h;
      acc.outOfScope += s.outOfScope;
      acc.withErrors += s.withErrors;
      acc.pendingEnrichment += s.pendingEnrichment;
      return acc;
    },
    { total: 0, last24h: 0, outOfScope: 0, withErrors: 0, pendingEnrichment: 0 },
  );

  const columns: AdminTableColumn<CollectorHealthRow>[] = [
    {
      key: "source",
      header: "Source",
      render: (s) => {
        const stale = isStale(s);
        return (
          <div>
            <p
              className={styles.sourceName}
            >
              {s.source}
            </p>
            {stale && (
              <p
                className={styles.staleHint}
              >
                Stale &gt; 48h
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: 180,
      render: (s) => (
        <div className={styles.badgeRow}>
          <AdminBadge kind={statusKind(s.status ?? "has_events", s.critical)}>
            {formatStatus(s.status ?? "has_events")}
          </AdminBadge>
          {s.critical === true && <AdminBadge kind="error">Crítico</AdminBadge>}
          {s.critical === false && <AdminBadge kind="neutral">Opcional</AdminBadge>}
        </div>
      ),
    },
    {
      key: "last24h",
      header: "Últimas 24h",
      width: 110,
      align: "right",
      render: (s) => (
        <div
          className={styles.numericCell}
        >
          {s.last24h === 0 && <AdminStatusDot kind="error" size={7} />}
          <span>{s.last24h.toLocaleString("pt-BR")}</span>
        </div>
      ),
    },
    {
      key: "outOfScopePercent",
      header: "Out-of-scope %",
      width: 140,
      align: "right",
      render: (s) => {
        const high = s.outOfScopePercent > 30;
        const mid = !high && s.outOfScopePercent > 10;
        return (
          <div
            className={styles.numericCell}
          >
            {high && <AdminStatusDot kind="error" size={7} />}
            {mid && <AdminStatusDot kind="warn" size={7} />}
            <span>{s.outOfScopePercent}%</span>
          </div>
        );
      },
    },
    {
      key: "errorRate",
      header: "Erro %",
      width: 100,
      align: "right",
      render: (s) => {
        const high = s.errorRate > 20;
        const mid = !high && s.errorRate > 5;
        return (
          <div
            className={styles.numericCell}
          >
            {high && <AdminStatusDot kind="error" size={7} />}
            {mid && <AdminStatusDot kind="warn" size={7} />}
            <span>{s.errorRate}%</span>
          </div>
        );
      },
    },
    {
      key: "lastSeen",
      header: "Último crawl",
      width: 150,
      render: (s) => (
        <span className={styles.lastCrawlText}>
          {s.lastSeen
            ? new Date(s.lastSeen).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 36,
      align: "right",
      render: () => (
        <Icons.ChevronRight size={14} className={styles.chevronIcon} />
      ),
    },
  ];

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · COLETORES"
        title="Saúde dos coletores"
        subtitle="Volume + qualidade por source. Os spiders Scrapy + coletores REST + curadoria manual + import CSV — tudo agrupado aqui. Clique numa linha para ver detalhes técnicos."
        actions={
          <AdminButton
            variant="secondary"
            onClick={load}
            disabled={loading}
            leftIcon={<Icons.RefreshCw size={12} />}
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </AdminButton>
        }
      />

      {/* === KPIs agregados (com alerta de zero-yield no topo) === */}
      <section className={styles.kpiSection}>
        {data?.zeroYield && data.zeroYield.alerts.length > 0 && (
          <div role="alert">
            <AdminCard variant="accent">
              <p className="urban-admin-eyebrow">
                <AdminBadge kind="error">zero-yield</AdminBadge> FONTES SEM DADOS
              </p>
              <ul>
                {data.zeroYield.alerts.map((a) => (
                  <li key={a.source}>
                    <code>{a.source}</code> — nenhum item há{" "}
                    {a.hoursSinceLastItem ?? "?"}h (janela {a.windowHours}h; baseline{" "}
                    {a.baselineItems} itens). Provável mudança no site/API de origem.
                  </li>
                ))}
              </ul>
            </AdminCard>
            <br />
          </div>
        )}
        <p className={`urban-admin-eyebrow ${styles.kpiEyebrow}`}>
          TOTAIS AGREGADOS
        </p>
        <div
          className={styles.kpiGrid}
        >
          <AdminMetricCard label="Total no DB" value={totals.total} />
          <AdminMetricCard
            label="Últimas 24h"
            value={totals.last24h}
            status={totals.last24h === 0 ? "error" : undefined}
          />
          <AdminMetricCard
            label="Out-of-scope"
            value={totals.outOfScope}
            status={totals.outOfScope > 0 ? "error" : undefined}
          />
          <AdminMetricCard
            label="Pendentes Gemini"
            value={totals.pendingEnrichment}
            status={totals.pendingEnrichment > 0 ? "warn" : undefined}
          />
          <AdminMetricCard
            label="Erros enrichment"
            value={totals.withErrors}
            status={totals.withErrors > 0 ? "error" : undefined}
          />
        </div>
      </section>

      {/* === Tabela por source === */}
      <section className={styles.sourcesSection}>
        <header
          className={styles.sourcesHeader}
        >
          <div>
            <p className="urban-admin-eyebrow">POR SOURCE</p>
            <h2
              className={styles.sourcesTitle}
            >
              {sources.length} coletores ativos
            </h2>
          </div>
          <p className={styles.lastCrawlText}>
            Linha clicável → drawer com variáveis, sinais, aliases
          </p>
        </header>

        <AdminTable
          columns={columns}
          rows={sources}
          rowKey={(s) => s.source}
          onRowClick={(s) => setSelected(s)}
          empty={
            <AdminEmptyState
              title="Nenhum evento ainda no DB"
              body="Os coletores ainda não rodaram ou o backend está vazio."
            />
          }
        />
      </section>

      {/* === Footer explicativo === */}
      <section
        className={styles.footerNote}
      >
        <details>
          <summary
            className={styles.footerSummary}
          >
            Como ler
          </summary>
          <ul
            className={styles.footerList}
          >
            <li>
              <code>last24h = 0</code> em coletor que devia rodar diário → coletor
              caiu ou cron não disparou.
            </li>
            <li>
              <code>outOfScopePercent</code> alto (&gt;30%) → query do coletor está
              pegando muita coisa de fora; refinar.
            </li>
            <li>
              <code>errorRate</code> alto → Gemini falhando (rate-limit, prompt
              malformado, JSON inválido).
            </li>
            <li>
              <code>(sem source)</code> aparecendo → coletor antigo mandando sem{" "}
              <code>source</code> setado.
            </li>
          </ul>
        </details>
        {data && (
          <p className={styles.snapshotText}>
            Snapshot tirado em {new Date(data.generatedAt).toLocaleString("pt-BR")}.
          </p>
        )}
      </section>

      {/* === Drawer: detalhes técnicos === */}
      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow="COLETOR"
        title={selected?.source ?? ""}
        width={520}
      >
        {selected && <CollectorDetail s={selected} />}
      </AdminDrawer>
    </div>
  );
}

function CollectorDetail({ s }: { s: CollectorHealthRow }) {
  const stale = isStale(s);
  const missingEnv = getMissingEnv(s);
  const signals = getSignals(s, stale, missingEnv);
  const aliases = uniqueList(s.aliases);
  const requiredEnv = uniqueList(s.requiredEnv);

  return (
    <div className={styles.detailStack}>
      {/* Métricas detalhadas */}
      <div>
        <p className={`urban-admin-eyebrow-muted ${styles.detailEyebrow}`}>
          MÉTRICAS COMPLETAS
        </p>
        <div
          className={styles.detailMetricsGrid}
        >
          <DetailRow label="Total no DB" value={s.total.toLocaleString("pt-BR")} />
          <DetailRow label="Últimas 24h" value={s.last24h.toLocaleString("pt-BR")} />
          <DetailRow label="Últimos 7d" value={s.last7d.toLocaleString("pt-BR")} />
          <DetailRow
            label="Out-of-scope"
            value={`${s.outOfScope.toLocaleString("pt-BR")} (${s.outOfScopePercent}%)`}
          />
          <DetailRow
            label="Pendentes geocode"
            value={s.pendingGeocode > 0 ? s.pendingGeocode.toLocaleString("pt-BR") : "—"}
          />
          <DetailRow
            label="Pendentes Gemini"
            value={s.pendingEnrichment > 0 ? s.pendingEnrichment.toLocaleString("pt-BR") : "—"}
          />
          <DetailRow
            label="Enriquecidos"
            value={s.enriched.toLocaleString("pt-BR")}
          />
          <DetailRow label="Erro %" value={`${s.errorRate}%`} />
        </div>
      </div>

      {/* Status técnico */}
      <div>
        <p className={`urban-admin-eyebrow-muted ${styles.detailEyebrow}`}>
          STATUS
        </p>
        <div className={styles.statusRow}>
          <AdminBadge kind={statusKind(s.status ?? "has_events", s.critical)}>
            {formatStatus(s.status ?? "has_events")}
          </AdminBadge>
          {s.critical === true && <AdminBadge kind="error">Crítico</AdminBadge>}
          {s.critical === false && <AdminBadge kind="neutral">Opcional</AdminBadge>}
          {stale && <AdminBadge kind="warn">Stale</AdminBadge>}
        </div>
      </div>

      {/* Variáveis */}
      <div>
        <p className={`urban-admin-eyebrow-muted ${styles.detailEyebrow}`}>
          VARIÁVEIS DE AMBIENTE
        </p>
        {missingEnv.length > 0 ? (
          <div className={styles.envGroup}>
            <p className={styles.envMissingText}>
              {missingEnv.length} faltando:
            </p>
            <div className={styles.badgeRow}>
              {missingEnv.map((env) => (
                <AdminBadge key={env} kind="error">
                  {env}
                </AdminBadge>
              ))}
            </div>
          </div>
        ) : requiredEnv.length > 0 ? (
          <div className={styles.envGroup}>
            <p className={styles.envOkText}>
              Todas presentes.
            </p>
            <div className={styles.badgeRow}>
              {requiredEnv.map((env) => (
                <AdminBadge key={env} kind="success">
                  {env}
                </AdminBadge>
              ))}
            </div>
          </div>
        ) : (
          <p className={styles.emptyHint}>
            Sem variáveis mapeadas.
          </p>
        )}
      </div>

      {/* Sinais */}
      <div>
        <p className={`urban-admin-eyebrow-muted ${styles.detailEyebrow}`}>
          SINAIS
        </p>
        {signals.length > 0 ? (
          <div className={styles.badgeRow}>
            {signals.map((signal) => (
              <AdminBadge key={signal} kind="warn">
                {formatSignal(signal)}
              </AdminBadge>
            ))}
          </div>
        ) : (
          <p className={styles.emptyHint}>
            Sem sinais ativos.
          </p>
        )}
      </div>

      {/* Aliases */}
      {aliases.length > 0 && (
        <div>
          <p className={`urban-admin-eyebrow-muted ${styles.detailEyebrow}`}>
            ALIASES
          </p>
          <div className={styles.badgeRow}>
            {aliases.map((alias) => (
              <AdminBadge key={alias} kind="neutral">
                {alias}
              </AdminBadge>
            ))}
          </div>
        </div>
      )}

      {/* Último crawl */}
      <div>
        <p className={`urban-admin-eyebrow-muted ${styles.detailEyebrowTight}`}>
          ÚLTIMO CRAWL
        </p>
        <p
          className={styles.lastCrawlValue}
        >
          {s.lastSeen ? new Date(s.lastSeen).toLocaleString("pt-BR") : "—"}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p
        className={styles.detailRowLabel}
      >
        {label}
      </p>
      <p
        className={styles.detailRowValue}
      >
        {value}
      </p>
    </div>
  );
}

function isStale(s: CollectorHealthRow): boolean {
  const local = Boolean(
    s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() > 48 * 60 * 60 * 1000,
  );
  return Boolean(s.stale || s.status === "stale" || local);
}

function statusKind(
  status: CollectorHealthStatus,
  critical?: boolean | null,
): AdminBadgeKind {
  if (status === "missing_key") return critical ? "error" : "warn";
  if (status === "zero_yield") return "error";
  if (status === "no_events" || status === "stale") return "warn";
  if (status === "has_events") return "success";
  return "neutral";
}

function getMissingEnv(s: CollectorHealthRow) {
  return uniqueList([
    ...(s.missingEnv ?? []),
    ...(s.missingVariables ?? []),
    ...(s.missingKeys ?? []),
    ...(s.missingRequiredEnv ?? []),
    ...(s.missing_env ?? []),
  ]);
}

function getSignals(
  s: CollectorHealthRow,
  stale: boolean,
  missingEnv: string[],
) {
  return uniqueList([
    ...(s.signals ?? []),
    stale ? "stale" : "",
    s.status === "missing_key" || missingEnv.length > 0 ? "missing_key" : "",
    s.status === "no_events" ? "no_events" : "",
  ]);
}

function uniqueList(values?: string[]) {
  return Array.from(new Set((values ?? []).filter(Boolean)));
}

function formatStatus(status: CollectorHealthStatus) {
  switch (status) {
    case "has_events":
      return "com eventos";
    case "missing_key":
      return "sem chave";
    case "no_events":
      return "sem eventos";
    case "stale":
      return "stale";
    case "zero_yield":
      return "sem dados (zero-yield)";
    default:
      return status.replace(/_/g, " ");
  }
}

function formatSignal(signal: string) {
  return signal.replace(/_/g, " ");
}
