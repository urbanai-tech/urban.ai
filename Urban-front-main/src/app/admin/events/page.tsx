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
  AdminEmptyState,
  AdminPageLoading,
  AdminStatusDot,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";
import styles from "./page.module.css";

/**
 * /admin/events — analytics do motor de eventos (F6.2).
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero: cobertura % em Archivo (display) (KPI estratégico).
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
      <div className={styles.boxM0xautoP40x32}>
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
    { key: "nome", header: "Nome", render: (e) => <span className={styles.labelW500}>{e.nome}</span> },
    { key: "cidade", header: "Cidade", render: (e) => <span className={styles.labelTextMuted}>{e.cidade}</span> },
    {
      key: "data",
      header: "Data",
      render: (e) => (
        <span className={styles.labelTextMutedFs12}>
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
        <span className={styles.labelTextMutedFs12}>{e.categoria || "—"}</span>
      ),
    },
    {
      key: "cap",
      header: "Capacidade",
      align: "right",
      render: (e) => (
        <span className={styles.labelFs12Mono}>{e.capacidadeEstimada ?? "—"}</span>
      ),
    },
    {
      key: "raio",
      header: "Raio",
      align: "right",
      render: (e) => (
        <span className={styles.labelFs12Mono}>
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
          <Icons.Check size={14} className={styles.okIcon} />
        ) : (
          <Icons.Close size={14} className={styles.offIcon} />
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
          className={styles.labelFs12W500}
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
        <span className={styles.labelTextMutedFs12}>
          {e.cidade}/{e.estado}
        </span>
      ),
    },
    {
      key: "data",
      header: "Data",
      width: 90,
      render: (e) => (
        <span className={styles.labelTextMutedFs12Mono}>
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
        <code className={styles.codeTextDimFs11}>
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
          <Icons.Check size={14} className={styles.okIcon} />
        ) : e.pendingGeocode ? (
          <AdminStatusDot kind="warn" size={6} />
        ) : (
          <Icons.Close size={14} className={styles.offIcon} />
        ),
    },
    {
      key: "scope",
      header: "Scope",
      width: 60,
      align: "center",
      render: (e) =>
        e.outOfScope ? (
          <Icons.Close size={14} className={styles.offIcon} />
        ) : (
          <Icons.Check size={14} className={styles.okIcon} />
        ),
    },
    {
      key: "enrich",
      header: "Enrich",
      width: 80,
      align: "center",
      render: (e) =>
        e.relevancia !== null ? (
          <Icons.Check size={14} className={styles.okIcon} />
        ) : e.enrichmentAttempts > 0 ? (
          <span
            title={e.enrichmentLastError ?? ""}
            className={styles.labelWarningFs11}
          >
            {e.enrichmentAttempts}× retry
          </span>
        ) : (
          <AdminStatusDot kind="warn" size={6} />
        ),
    },
  ];

  return (
    <div className={styles.boxM0xautoP40x32Maxw1400}>
      <AdminSectionHeader
        eyebrow="ADMIN · MOTOR DE EVENTOS"
        title="Cobertura & motor"
        subtitle={
          <>
            Cobertura, categorias, top eventos próximos.
            {lastCrawlAt && (
              <>
                {" "}· Último crawl:{" "}
                <strong className={styles.strongText}>
                  {new Date(lastCrawlAt).toLocaleString("pt-BR")}
                </strong>
              </>
            )}
          </>
        }
        actions={
          <div className={styles.rowWrapGap8}>
            <AdminButton variant="ghost" as="a" href="/admin/event-radar" rightIcon={<Icons.ArrowRight size={11} />}>
              Radar de demanda
            </AdminButton>
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
      <section className={styles.sectionMb56}>
        <AdminCard variant="accent" className={styles.heroCard}>
          <div
            className={styles.gridColsGap32}
          >
            <div>
              <p className="urban-admin-eyebrow">COBERTURA GEOGRÁFICA</p>
              <p className={`urban-admin-display-hero ${styles.displayHeroMt12}`}>
                {summary.coveragePercent}%
              </p>
              <p
                className={styles.textTextMutedFs14}
              >
                {summary.total.toLocaleString("pt-BR")} eventos no DB ·{" "}
                {summary.coordsMissing.toLocaleString("pt-BR")} sem coordenadas.
              </p>
            </div>
            <div className={styles.boxBordered}>
              <p className="urban-admin-eyebrow-muted">Dentro da cobertura</p>
              <p
                className={`urban-admin-display-md ${styles.displayMdSuccessMt12}`}
              >
                {summary.inScope.toLocaleString("pt-BR")}
              </p>
              <p
                className={styles.textTextMutedFs12}
              >
                {summary.outOfScope.toLocaleString("pt-BR")} fora
              </p>
            </div>
            <div className={styles.boxBordered}>
              <p className="urban-admin-eyebrow-muted">Enriquecidos (Gemini)</p>
              <p className={`urban-admin-display-md ${styles.displayHeroMt12}`}>
                {summary.enrichmentPercent}%
              </p>
              <p
                className={styles.textTextMutedFs12}
              >
                {summary.relevanceMissing} sem relevância
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === KPIs próximos === */}
      <section className={styles.sectionMb64}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb24}`}>
          EVENTOS PRÓXIMOS
        </p>
        <div
          className={styles.gridColsAuto180Gap32}
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
        className={styles.gridColsAutoGap24}
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
      <section className={styles.sectionMb64}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb16}`}>
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
      <section className={styles.sectionMb64}>
        <header
          className={styles.rowBetweenCentered}
        >
          <p className={`urban-admin-eyebrow ${styles.eyebrowM0}`}>
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
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb16}`}>
          LISTAGEM DETALHADA
        </p>

        <div
          className={styles.rowAlignEndWrap}
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
            shellClassName={styles.searchShell}
          />

          <AdminInput
            placeholder="Source (api-football, sympla…)"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            onBlur={() => setPage(1)}
            shellClassName={styles.sourceShell}
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
              <p className={styles.textTextMutedFs13}>
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
            className={styles.rowBetweenCenteredTextMutedFs12Mt16}
          >
            <span>
              Página {listing.page} · {listing.total.toLocaleString("pt-BR")} no total
            </span>
            <div className={styles.rowGap8}>
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
        className={styles.footerTextMutedFs12}
      >
        <p className={styles.textM0}>
          <strong className={styles.strongText}>Status do motor:</strong>{" "}
          spiders Scrapy + APIs oficiais (api-football, sp-cultura) + LLM
          extractors (Camada 2) + curadoria manual (admin-manual / admin-csv-import,
          Camada 3). Cobertura geográfica em{" "}
          <code className={styles.codeAccent}>/admin/coverage</code>.
        </p>
      </footer>
    </div>
  );
}

function RelevanceCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className={styles.labelTextDim}>—</span>;
  }
  let kind: AdminBadgeKind = "neutral";
  if (value >= 80) kind = "accent";
  else if (value >= 60) kind = "warn";
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={styles.stackGap4Minw70}>
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
      <div className={styles.boxBgDividerH2}>
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
      className={styles.rowScrollBordered}
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
      <p className={styles.textTextMutedFs12M0}>
        Sem dados.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className={styles.stackGap12M0}>
      {rows.map((r) => (
        <li key={r.label}>
          <div
            className={styles.rowBetweenFs12}
          >
            <span
              className={styles.labelTextMr8}
            >
              {r.label}
            </span>
            <span className={styles.labelAccentW600}>
              {r.value.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className={styles.boxBgDividerH2}>
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
        className={styles.gridColsAuto140Gap24}
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
        className={styles.rowAlignEndGap2}
      >
        {buckets.map((b) => {
          const inHeight = (b.inScope / maxTotal) * 100;
          const outHeight = (b.outOfScope / maxTotal) * 100;
          return (
            <div
              key={b.day}
              title={`${new Date(b.day).toLocaleDateString("pt-BR")} — in: ${b.inScope}, out: ${b.outOfScope}`}
              className={styles.stackEndFlex1}
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
        className={styles.rowTextDimFs10}
      >
        {buckets.map((b, i) => (
          <div key={b.day} className={styles.boxCenterAlignedFlex1}>
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
        className={styles.rowTextMutedFs11}
      >
        <span className={styles.rowCenteredGap6}>
          <span className={styles.labelBgTextW12} />
          In-scope
        </span>
        <span className={styles.rowCenteredGap6}>
          <span className={styles.labelBgAccentW12} />
          Out-of-scope
        </span>
      </div>
    </AdminCard>
  );
}
