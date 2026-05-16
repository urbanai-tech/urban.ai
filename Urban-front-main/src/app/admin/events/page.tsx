"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminEvents,
  fetchAdminEventsList,
  fetchEventsTimeline,
  type AdminEventsAnalytics,
  type EventListItem,
  type EventsTimelineResponse,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminBadge,
  AdminEmptyState,
  AdminPageLoading,
  AdminStatusDot,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";

/**
 * /admin/events — analytics do motor de eventos (F6.2).
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero: cobertura % em Bebas Neue (KPI estratégico).
 *  - 8 KPIs com hierarquia (3 médios + 4 pequenos), não todos iguais.
 *  - Toggle scope (in/out/all) vira segmented control com underline orange.
 *  - Relevância: número monocromático + barra horizontal (sem badge rosa/amber).
 *  - TimelineChart com paleta branco/orange-30 (sem verde/vermelho saturado).
 *  - Símbolos ✓ ✗ ⌛ viram ícones SVG.
 *  - Tabelas usam AdminTable.
 */
export default function AdminEventsPage() {
  const [data, setData] = useState<AdminEventsAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [listing, setListing] = useState<{
    items: EventListItem[];
    total: number;
    page: number;
    limit: number;
  } | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [scope, setScope] = useState<"in" | "out" | "all">("in");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);

  const [timeline, setTimeline] = useState<EventsTimelineResponse | null>(null);
  const [timelineDays, setTimelineDays] = useState(30);

  useEffect(() => {
    fetchAdminEvents()
      .then(setData)
      .catch((err: unknown) => {
        const e = err as { response?: { status?: number }; message?: string };
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setError("Acesso negado. Você precisa ser admin.");
        } else {
          setError(e?.message || "Erro ao carregar.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEventsTimeline(timelineDays)
      .then(setTimeline)
      .catch(() => {});
  }, [timelineDays]);

  const loadListing = useCallback(async () => {
    setListingLoading(true);
    try {
      const r = await fetchAdminEventsList({
        page,
        limit: 50,
        scope,
        source: sourceFilter || undefined,
        search: search.trim() || undefined,
      });
      setListing({ items: r.items, total: r.total, page: r.page, limit: r.limit });
    } catch (err) {
      console.error(err);
    } finally {
      setListingLoading(false);
    }
  }, [page, scope, sourceFilter, search]);

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, page, sourceFilter]);

  if (loading) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar eventos"
          body={error ?? "Resposta vazia."}
          icon={<Icons.AlertCircle size={32} />}
        />
      </div>
    );
  }

  const { summary, upcoming, byCategory, byCity, byRelevance, topUpcoming, lastCrawlAt } =
    data;

  // Top upcoming columns
  const topCols: AdminTableColumn<(typeof topUpcoming)[number]>[] = [
    { key: "nome", header: "Nome", render: (e) => <span style={{ fontWeight: 500 }}>{e.nome}</span> },
    { key: "cidade", header: "Cidade", render: (e) => <span style={{ color: "var(--admin-text-muted)" }}>{e.cidade}</span> },
    {
      key: "data",
      header: "Data",
      render: (e) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {new Date(e.dataInicio).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
    {
      key: "rel",
      header: "Relevância",
      width: 120,
      align: "center",
      render: (e) => <RelevanceCell value={e.relevancia ?? null} />,
    },
    {
      key: "cat",
      header: "Categoria",
      render: (e) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{e.categoria || "—"}</span>
      ),
    },
    {
      key: "cap",
      header: "Capacidade",
      align: "right",
      render: (e) => (
        <span style={{ fontSize: 12, fontFamily: "monospace" }}>{e.capacidadeEstimada ?? "—"}</span>
      ),
    },
    {
      key: "raio",
      header: "Raio",
      align: "right",
      render: (e) => (
        <span style={{ fontSize: 12, fontFamily: "monospace" }}>
          {e.raioImpactoKm ? `${e.raioImpactoKm} km` : "—"}
        </span>
      ),
    },
    {
      key: "geo",
      header: "Geo",
      width: 60,
      align: "center",
      render: (e) =>
        e.hasCoords ? (
          <Icons.Check size={14} style={{ color: "var(--admin-success)" }} />
        ) : (
          <Icons.Close size={14} style={{ color: "var(--admin-danger)" }} />
        ),
    },
  ];

  // Listing columns (denso)
  const listCols: AdminTableColumn<EventListItem>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (e) => (
        <span
          style={{
            display: "inline-block",
            maxWidth: 320,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 12,
            fontWeight: 500,
          }}
          title={e.nome}
        >
          {e.nome}
        </span>
      ),
    },
    {
      key: "cidade",
      header: "Cidade",
      render: (e) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {e.cidade}/{e.estado}
        </span>
      ),
    },
    {
      key: "data",
      header: "Data",
      width: 90,
      render: (e) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)", fontFamily: "monospace" }}>
          {new Date(e.dataInicio).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
    {
      key: "rel",
      header: "Rel.",
      width: 80,
      align: "center",
      render: (e) => <RelevanceCell value={e.relevancia} />,
    },
    {
      key: "source",
      header: "Source",
      render: (e) => (
        <code style={{ fontSize: 11, color: "var(--admin-text-dim)" }}>
          {e.source ?? "—"}
        </code>
      ),
    },
    {
      key: "geo",
      header: "Geo",
      width: 60,
      align: "center",
      render: (e) =>
        e.latitude && e.longitude ? (
          <Icons.Check size={14} style={{ color: "var(--admin-success)" }} />
        ) : e.pendingGeocode ? (
          <AdminStatusDot kind="warn" size={6} />
        ) : (
          <Icons.Close size={14} style={{ color: "var(--admin-danger)" }} />
        ),
    },
    {
      key: "scope",
      header: "Scope",
      width: 60,
      align: "center",
      render: (e) =>
        e.outOfScope ? (
          <Icons.Close size={14} style={{ color: "var(--admin-danger)" }} />
        ) : (
          <Icons.Check size={14} style={{ color: "var(--admin-success)" }} />
        ),
    },
    {
      key: "enrich",
      header: "Enrich",
      width: 80,
      align: "center",
      render: (e) =>
        e.relevancia !== null ? (
          <Icons.Check size={14} style={{ color: "var(--admin-success)" }} />
        ) : e.enrichmentAttempts > 0 ? (
          <span
            title={e.enrichmentLastError ?? ""}
            style={{
              fontSize: 11,
              color: "var(--admin-warning)",
              fontFamily: "monospace",
            }}
          >
            {e.enrichmentAttempts}× retry
          </span>
        ) : (
          <AdminStatusDot kind="warn" size={6} />
        ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · MOTOR DE EVENTOS"
        title="Cobertura & motor"
        subtitle={
          <>
            Cobertura, categorias, top eventos próximos.
            {lastCrawlAt && (
              <>
                {" "}· Último crawl:{" "}
                <strong style={{ color: "var(--admin-text)" }}>
                  {new Date(lastCrawlAt).toLocaleString("pt-BR")}
                </strong>
              </>
            )}
          </>
        }
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AdminButton variant="ghost" as="a" href="/admin/coverage" rightIcon={<Icons.ArrowRight size={11} />}>
              Cobertura
            </AdminButton>
            <AdminButton variant="ghost" as="a" href="/admin/collectors-health" rightIcon={<Icons.ArrowRight size={11} />}>
              Coletores
            </AdminButton>
            <AdminButton
              variant="primary"
              as="a"
              href="/admin/events/new"
              leftIcon={<Icons.Plus size={12} />}
            >
              Cadastrar evento
            </AdminButton>
          </div>
        }
      />

      {/* === Hero KPI: cobertura geo === */}
      <section style={{ marginBottom: 56 }}>
        <AdminCard variant="accent" style={{ padding: "40px 40px 36px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: 32,
              alignItems: "end",
            }}
          >
            <div>
              <p className="urban-admin-eyebrow">COBERTURA GEOGRÁFICA</p>
              <p className="urban-admin-display-hero" style={{ marginTop: 12 }}>
                {summary.coveragePercent}%
              </p>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  color: "var(--admin-text-muted)",
                  lineHeight: 1.55,
                }}
              >
                {summary.total.toLocaleString("pt-BR")} eventos no DB ·{" "}
                {summary.coordsMissing.toLocaleString("pt-BR")} sem coordenadas.
              </p>
            </div>
            <div style={{ borderLeft: "1px solid var(--admin-divider)", paddingLeft: 32 }}>
              <p className="urban-admin-eyebrow-muted">Dentro da cobertura</p>
              <p
                className="urban-admin-display-md"
                style={{ marginTop: 12, color: "var(--admin-success)" }}
              >
                {summary.inScope.toLocaleString("pt-BR")}
              </p>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--admin-text-muted)",
                }}
              >
                {summary.outOfScope.toLocaleString("pt-BR")} fora
              </p>
            </div>
            <div style={{ borderLeft: "1px solid var(--admin-divider)", paddingLeft: 32 }}>
              <p className="urban-admin-eyebrow-muted">Enriquecidos (Gemini)</p>
              <p className="urban-admin-display-md" style={{ marginTop: 12 }}>
                {summary.enrichmentPercent}%
              </p>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--admin-text-muted)",
                }}
              >
                {summary.relevanceMissing} sem relevância
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === KPIs próximos === */}
      <section style={{ marginBottom: 64 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
          EVENTOS PRÓXIMOS
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
          <AdminMetricCard label="Próximos 7 dias" value={upcoming.next7d} />
          <AdminMetricCard label="Próximos 30 dias" value={upcoming.next30d} />
          <AdminMetricCard label="Próximos 90 dias" value={upcoming.next90d} />
          <AdminMetricCard
            label="Mega-eventos 30d"
            value={upcoming.megaUpcoming}
            sub="relevância ≥ 80"
            accent={upcoming.megaUpcoming > 0}
          />
        </div>
      </section>

      {/* === Breakdown 3 colunas === */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
          marginBottom: 64,
        }}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader title="Por categoria" />
          <BarList rows={byCategory.map((r) => ({ label: r.categoria, value: r.count }))} />
        </AdminCard>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Por cidade (top 10)" />
          <BarList rows={byCity.map((r) => ({ label: r.cidade, value: r.count }))} />
        </AdminCard>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Distribuição de relevância" />
          <BarList rows={byRelevance.map((r) => ({ label: r.bucket, value: r.count }))} />
        </AdminCard>
      </section>

      {/* === Top 10 próximos === */}
      <section style={{ marginBottom: 64 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 16 }}>
          TOP 10 PRÓXIMOS POR RELEVÂNCIA
        </p>
        <AdminTable
          columns={topCols}
          rows={topUpcoming}
          rowKey={(r) => r.id}
          empty={<AdminEmptyState title="Sem eventos próximos" body="Aguardando próximo crawl." />}
        />
      </section>

      {/* === Timeline === */}
      <section style={{ marginBottom: 64 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <p className="urban-admin-eyebrow" style={{ margin: 0 }}>
            EVOLUÇÃO DE INGESTÃO
          </p>
          <SegmentedControl
            value={timelineDays}
            options={[7, 14, 30, 60, 90]}
            onChange={setTimelineDays}
            renderLabel={(d) => `${d}d`}
          />
        </header>
        {timeline && <TimelineChart data={timeline} />}
      </section>

      {/* === Listagem detalhada === */}
      <section>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 16 }}>
          LISTAGEM DETALHADA
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <SegmentedControl
            value={scope}
            options={["in", "out", "all"] as const}
            onChange={(s) => {
              setScope(s as "in" | "out" | "all");
              setPage(1);
            }}
            renderLabel={(s) =>
              s === "in" ? "Dentro" : s === "out" ? "Fora" : "Todos"
            }
          />

          <AdminInput
            placeholder="Buscar por nome ou cidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                loadListing();
              }
            }}
            leftAddon={<Icons.Search size={12} />}
            shellStyle={{ flex: 1, minWidth: 220 }}
          />

          <AdminInput
            placeholder="Source (api-football, sympla…)"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            onBlur={() => setPage(1)}
            shellStyle={{ width: 240 }}
          />

          <AdminButton
            variant="primary"
            onClick={() => {
              setPage(1);
              loadListing();
            }}
            leftIcon={<Icons.Search size={12} />}
          >
            Buscar
          </AdminButton>
        </div>

        <AdminTable
          columns={listCols}
          rows={listing?.items ?? []}
          rowKey={(r) => r.id}
          empty={
            listingLoading ? (
              <p style={{ color: "var(--admin-text-muted)", fontSize: 13, textAlign: "center" }}>
                Carregando…
              </p>
            ) : (
              <AdminEmptyState
                title="Nenhum evento com esses filtros"
                body="Ajuste o escopo, source ou busca."
              />
            )
          }
        />

        {listing && listing.total > listing.limit && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              fontSize: 12,
              color: "var(--admin-text-muted)",
            }}
          >
            <span>
              Página {listing.page} · {listing.total.toLocaleString("pt-BR")} no total
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <AdminButton
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={listing.page === 1}
                leftIcon={<Icons.ArrowLeft size={11} />}
              >
                Anterior
              </AdminButton>
              <AdminButton
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={listing.page * listing.limit >= listing.total}
                rightIcon={<Icons.ArrowRight size={11} />}
              >
                Próxima
              </AdminButton>
            </div>
          </div>
        )}
      </section>

      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: "1px solid var(--admin-divider)",
          fontSize: 12,
          color: "var(--admin-text-muted)",
          lineHeight: 1.55,
        }}
      >
        <p style={{ margin: 0 }}>
          <strong style={{ color: "var(--admin-text)" }}>Status do motor:</strong>{" "}
          spiders Scrapy + APIs oficiais (api-football, sp-cultura) + LLM
          extractors (Camada 2) + curadoria manual (admin-manual / admin-csv-import,
          Camada 3). Cobertura geográfica em{" "}
          <code style={{ color: "var(--admin-accent)" }}>/admin/coverage</code>.
        </p>
      </footer>
    </div>
  );
}

function RelevanceCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span style={{ color: "var(--admin-text-dim)" }}>—</span>;
  }
  let kind: AdminBadgeKind = "neutral";
  if (value >= 80) kind = "accent";
  else if (value >= 60) kind = "warn";
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, minWidth: 70 }}>
      <span
        style={{
          fontFamily: "monospace",
          fontWeight: 600,
          color:
            kind === "accent"
              ? "var(--admin-accent)"
              : kind === "warn"
                ? "var(--admin-warning)"
                : "var(--admin-text)",
          fontSize: 13,
        }}
      >
        {value}
      </span>
      <div style={{ height: 2, background: "var(--admin-divider)" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background:
              kind === "accent"
                ? "var(--admin-accent)"
                : kind === "warn"
                  ? "var(--admin-warning)"
                  : "var(--admin-text-muted)",
          }}
        />
      </div>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  renderLabel: (v: T) => string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              background: "transparent",
              border: "none",
              borderRight: "1px solid var(--admin-divider)",
              borderBottom: active ? "2px solid var(--admin-accent)" : "2px solid transparent",
              color: active ? "var(--admin-text)" : "var(--admin-text-muted)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "8px 14px",
              cursor: "pointer",
              transition: "color 120ms, border-color 120ms",
            }}
          >
            {renderLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0 }}>
        Sem dados.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <li key={r.label}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                color: "var(--admin-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginRight: 8,
              }}
            >
              {r.label}
            </span>
            <span style={{ color: "var(--admin-accent)", fontWeight: 600 }}>
              {r.value.toLocaleString("pt-BR")}
            </span>
          </div>
          <div style={{ height: 2, background: "var(--admin-divider)" }}>
            <div
              style={{
                height: "100%",
                width: `${(r.value / max) * 100}%`,
                background: "var(--admin-accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimelineChart({ data }: { data: EventsTimelineResponse }) {
  const buckets = data.buckets;
  const maxTotal = Math.max(...buckets.map((b) => b.inScope + b.outOfScope), 1);
  const labelStep = Math.max(1, Math.floor(buckets.length / 8));

  return (
    <AdminCard variant="subtle">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <AdminMetricCard label="Período" value={`${data.days}d`} variant="sm" />
        <AdminMetricCard label="Total in-scope" value={data.totalInScope} variant="sm" />
        <AdminMetricCard
          label="Total out-of-scope"
          value={data.totalOutScope}
          variant="sm"
          accent
        />
        <AdminMetricCard
          label="Pico"
          value={
            data.peakDay.day
              ? `${new Date(data.peakDay.day).toLocaleDateString("pt-BR")}: ${data.peakDay.total}`
              : "—"
          }
          variant="sm"
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          height: 140,
          paddingBottom: 4,
          borderBottom: "1px solid var(--admin-divider)",
        }}
      >
        {buckets.map((b) => {
          const inHeight = (b.inScope / maxTotal) * 100;
          const outHeight = (b.outOfScope / maxTotal) * 100;
          return (
            <div
              key={b.day}
              title={`${new Date(b.day).toLocaleDateString("pt-BR")} — in: ${b.inScope}, out: ${b.outOfScope}`}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                position: "relative",
              }}
            >
              {b.outOfScope > 0 && (
                <div
                  style={{
                    height: `${outHeight}%`,
                    background: "var(--admin-accent)",
                    opacity: 0.35,
                  }}
                />
              )}
              {b.inScope > 0 && (
                <div
                  style={{
                    height: `${inHeight}%`,
                    background: "var(--admin-text)",
                    opacity: 0.9,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 2,
          marginTop: 6,
          fontSize: 10,
          color: "var(--admin-text-dim)",
        }}
      >
        {buckets.map((b, i) => (
          <div key={b.day} style={{ flex: 1, textAlign: "center" }}>
            {i % labelStep === 0
              ? new Date(b.day).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })
              : ""}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 16,
          fontSize: 11,
          color: "var(--admin-text-muted)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 6, background: "var(--admin-text)", opacity: 0.9 }} />
          In-scope
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 6, background: "var(--admin-accent)", opacity: 0.35 }} />
          Out-of-scope
        </span>
      </div>
    </AdminCard>
  );
}
