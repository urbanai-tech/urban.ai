"use client";

import Link from "next/link";
import type { EventCoverageReport, EventLeadTime, EventLeadTimeGroup } from "../../../service/api";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
} from "../../_components";
import { formatDays, formatPct, leadTimeVerdict, sizeLabel } from "../coverage-domain";

/** Rótulo da linha: porte ganha texto legível; fonte/categoria já vêm normalizadas do backend. */
type GroupKind = "source" | "category" | "size";

function groupColumns(kind: GroupKind, firstHeader: string): AdminTableColumn<EventLeadTimeGroup>[] {
  return [
    {
      key: "key",
      header: firstHeader,
      render: (g) => <span className="ec-source-name">{kind === "size" ? sizeLabel(g.key) : g.key}</span>,
    },
    {
      key: "count",
      header: "Eventos",
      width: 100,
      align: "right",
      render: (g) => <span className="ec-num">{g.count.toLocaleString("pt-BR")}</span>,
    },
    {
      key: "median",
      header: "Mediana",
      width: 110,
      align: "right",
      render: (g) => <span className="ec-num">{formatDays(g.medianDays)}</span>,
    },
    {
      key: "range",
      header: "Faixa típica (P25–P75)",
      width: 190,
      align: "right",
      render: (g) => (
        <span className="ec-muted">
          {formatDays(g.p25Days)} a {formatDays(g.p75Days)}
        </span>
      ),
    },
  ];
}

/**
 * Aba "Qualidade": lacunas dos dados dos próximos 30 dias (coordenadas, categoria, duplicatas) e
 * lead time (antecedência com que cada evento entra no radar), por fonte, categoria e porte. Deixa
 * um lugar para "Referência e recall" (página criada pela frente da lista de referência).
 */
export default function QualidadePanel({
  data,
  leadTime,
  leadTimeError,
}: {
  data: EventCoverageReport;
  leadTime: EventLeadTime | null;
  leadTimeError: boolean;
}) {
  const verdict = leadTime ? leadTimeVerdict(leadTime.overall.medianDays, leadTime.targetMedianDays) : null;
  const maxBucket = leadTime ? Math.max(1, ...leadTime.distribution.map((b) => b.count)) : 1;

  return (
    <>
      <section className="ec-section" aria-label="Referência e recall">
        <AdminCard variant="subtle">
          <div className="ec-reference">
            <div>
              <p className="urban-admin-eyebrow-muted">Referência e recall</p>
              <p className="ec-muted">
                Quantos dos grandes eventos de São Paulo o radar enxerga: lista de referência, recall e precisão por
                categoria, venue e porte.
              </p>
            </div>
            <Link className="ec-link" href="/admin/event-coverage/reference">
              Abrir referência e recall
            </Link>
          </div>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="Qualidade dos dados">
        <p className="urban-admin-eyebrow ec-section-title">QUALIDADE · PRÓXIMOS 30 DIAS</p>
        <AdminCard>
          <div className="ec-quality">
            <div className="ec-quality-item">
              <p className="urban-admin-eyebrow-muted">Com coordenadas</p>
              <span className="ec-quality-value">{formatPct(data.quality.geocodedPct)}</span>
              <p className="ec-muted">
                {data.quality.missingGeocode30d} sem lat/lng (mínimo {data.target.minGeocodedPct}%).
              </p>
            </div>
            <div className="ec-quality-item">
              <p className="urban-admin-eyebrow-muted">Com categoria</p>
              <span className="ec-quality-value">{formatPct(data.quality.withCategoryPct)}</span>
              <p className="ec-muted">{data.quality.missingCategory30d} sem categoria.</p>
            </div>
            <div className="ec-quality-item">
              <p className="urban-admin-eyebrow-muted">Duplicatas em revisão</p>
              <span className="ec-quality-value">{data.duplicatesPendingReview.total}</span>
              <p className="ec-muted">
                {data.duplicatesPendingReview.high} de alta confiança.{" "}
                <Link className="ec-link" href="/admin/events/dedup">
                  Revisar
                </Link>
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="Lead time">
        <p className="urban-admin-eyebrow ec-section-title">LEAD TIME · ANTECEDÊNCIA COM QUE O EVENTO ENTRA</p>
        {leadTimeError ? (
          <AdminCard variant="subtle">
            <p className="ec-muted">Não foi possível carregar o lead time agora. Atualize a página para tentar de novo.</p>
          </AdminCard>
        ) : !leadTime ? (
          <AdminCard variant="subtle">
            <p className="ec-muted">Carregando lead time…</p>
          </AdminCard>
        ) : leadTime.overall.count === 0 ? (
          <AdminCard variant="subtle">
            <p className="ec-muted">
              Ainda não há eventos com primeira entrada registrada na janela de {leadTime.windowDays} dias.
            </p>
          </AdminCard>
        ) : (
          <>
            <AdminCard>
              <div className="ec-kpis ec-kpis-flat">
                <AdminMetricCard
                  label="Mediana"
                  value={formatDays(leadTime.overall.medianDays)}
                  sub={`meta ${leadTime.targetMedianDays} d`}
                  accent
                />
                <AdminMetricCard
                  label="Faixa típica"
                  value={`${formatDays(leadTime.overall.p25Days)} a ${formatDays(leadTime.overall.p75Days)}`}
                  sub="P25 a P75"
                />
                <AdminMetricCard label="Eventos medidos" value={leadTime.overall.count} />
                <AdminMetricCard
                  label="Entraram já iniciados"
                  value={leadTime.lateDiscovered}
                  sub="fora das estatísticas"
                />
              </div>
              <div className="ec-verdict">
                {verdict && <AdminBadge kind={verdict.badge}>{verdict.label}</AdminBadge>}
                <p className="ec-muted">
                  Janela: eventos de {leadTime.windowDays} dias atrás até {leadTime.windowDays * 2} dias à frente. Eventos
                  anteriores ao histórico usam a data de criação do registro como primeira entrada.
                </p>
              </div>
            </AdminCard>

            <div className="ec-subsection">
              <p className="urban-admin-eyebrow-muted ec-section-title">Distribuição</p>
              <AdminCard>
                <ul className="ec-dist">
                  {leadTime.distribution.map((b) => (
                    <li key={b.key} className="ec-dist-row">
                      <span className="ec-dist-label">{b.label}</span>
                      <progress
                        className="ec-progress"
                        value={b.count}
                        max={maxBucket}
                        aria-label={`${b.label}: ${b.count} evento(s)`}
                      />
                      <span className="ec-num ec-dist-count">{b.count.toLocaleString("pt-BR")}</span>
                    </li>
                  ))}
                </ul>
              </AdminCard>
            </div>

            <div className="ec-subsection">
              <p className="urban-admin-eyebrow-muted ec-section-title">Por fonte</p>
              <AdminTable
                columns={groupColumns("source", "Fonte")}
                rows={leadTime.bySource}
                rowKey={(g) => g.key}
                empty={<AdminEmptyState title="Sem dados por fonte" />}
              />
            </div>
            <div className="ec-subsection">
              <p className="urban-admin-eyebrow-muted ec-section-title">Por categoria</p>
              <AdminTable
                columns={groupColumns("category", "Categoria")}
                rows={leadTime.byCategory}
                rowKey={(g) => g.key}
                empty={<AdminEmptyState title="Sem dados por categoria" />}
              />
            </div>
            <div className="ec-subsection">
              <p className="urban-admin-eyebrow-muted ec-section-title">Por porte</p>
              <AdminTable
                columns={groupColumns("size", "Porte")}
                rows={leadTime.bySize}
                rowKey={(g) => g.key}
                empty={<AdminEmptyState title="Sem dados por porte" />}
              />
            </div>
          </>
        )}
      </section>
    </>
  );
}
