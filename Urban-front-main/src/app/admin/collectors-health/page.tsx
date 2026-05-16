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
  AdminStatusDot,
  AdminDrawer,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";

type CollectorHealthStatus =
  | "has_events"
  | "missing_key"
  | "no_events"
  | "stale"
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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
              style={{
                fontFamily: "monospace",
                fontWeight: 600,
                color: "var(--admin-text)",
                margin: 0,
              }}
            >
              {s.source}
            </p>
            {stale && (
              <p
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--admin-warning)",
                }}
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "flex-end",
            fontFamily: "monospace",
            color: "var(--admin-text)",
          }}
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "flex-end",
              fontFamily: "monospace",
              color: "var(--admin-text)",
            }}
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "flex-end",
              fontFamily: "monospace",
              color: "var(--admin-text)",
            }}
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
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
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
        <Icons.ChevronRight size={14} style={{ color: "var(--admin-text-dim)" }} />
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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

      {/* === KPIs agregados === */}
      <section style={{ marginBottom: 56 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
          TOTAIS AGREGADOS
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 32,
            borderTop: "1px solid var(--admin-divider)",
            borderBottom: "1px solid var(--admin-divider)",
          }}
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
      <section style={{ marginBottom: 32 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <p className="urban-admin-eyebrow">POR SOURCE</p>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--admin-text)",
                margin: "8px 0 0",
                letterSpacing: -0.3,
              }}
            >
              {sources.length} coletores ativos
            </h2>
          </div>
          <p style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
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
        style={{
          borderTop: "1px solid var(--admin-divider)",
          paddingTop: 16,
          fontSize: 12,
          color: "var(--admin-text-muted)",
        }}
      >
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--admin-text-muted)",
            }}
          >
            Como ler
          </summary>
          <ul
            style={{
              listStyle: "disc",
              paddingLeft: 24,
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              lineHeight: 1.6,
            }}
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
          <p style={{ marginTop: 12 }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Métricas detalhadas */}
      <div>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          MÉTRICAS COMPLETAS
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            fontSize: 13,
          }}
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
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          STATUS
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          VARIÁVEIS DE AMBIENTE
        </p>
        {missingEnv.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "var(--admin-danger)", margin: 0 }}>
              {missingEnv.length} faltando:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {missingEnv.map((env) => (
                <AdminBadge key={env} kind="error">
                  {env}
                </AdminBadge>
              ))}
            </div>
          </div>
        ) : requiredEnv.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "var(--admin-success)", margin: 0 }}>
              Todas presentes.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {requiredEnv.map((env) => (
                <AdminBadge key={env} kind="success">
                  {env}
                </AdminBadge>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--admin-text-dim)", margin: 0 }}>
            Sem variáveis mapeadas.
          </p>
        )}
      </div>

      {/* Sinais */}
      <div>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          SINAIS
        </p>
        {signals.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {signals.map((signal) => (
              <AdminBadge key={signal} kind="warn">
                {formatSignal(signal)}
              </AdminBadge>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--admin-text-dim)", margin: 0 }}>
            Sem sinais ativos.
          </p>
        )}
      </div>

      {/* Aliases */}
      {aliases.length > 0 && (
        <div>
          <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
            ALIASES
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 8 }}>
          ÚLTIMO CRAWL
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--admin-text)",
            fontFamily: "monospace",
            margin: 0,
          }}
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
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--admin-text-muted)",
          fontWeight: 600,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "monospace",
          fontSize: 14,
          color: "var(--admin-text)",
          margin: "4px 0 0",
        }}
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
    default:
      return status.replace(/_/g, " ");
  }
}

function formatSignal(signal: string) {
  return signal.replace(/_/g, " ");
}
