"use client";

import React from "react";
import { brl, brlWhole, dateSP, dateTimeSP, integer, pct } from "../lib/format";
import {
  NO_DATA_TEXT,
  describeDelta,
  metricSourceLabel,
  occupancySourceLabel,
  outcomeLabel,
  type OwnerReportDelta,
  type OwnerReportPayload,
  type OwnerReportProperty,
} from "../lib/owner-report";
import { AppBadge } from "./ui";
import { BrandLogo } from "./ui/BrandLogo";
import styles from "./OwnerReportView.module.css";

/**
 * Relatório mensal do proprietário (ADR 0027). Usado na página pública (`/relatorio/[token]`) e na
 * pré-visualização do anfitrião. Só mostra o que veio no payload: campo nulo vira "Sem dado",
 * nunca zero nem estimativa. Tem folha de estilo de impressão (Ctrl+P / "Salvar como PDF").
 */

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string | null;
}) {
  return (
    <div className={styles.metric}>
      <dt className={styles.metricLabel}>{label}</dt>
      <dd className={styles.metricValue}>
        {value === null ? <span className={styles.noData}>{NO_DATA_TEXT}</span> : value}
      </dd>
      {hint ? <dd className={styles.metricHint}>{hint}</dd> : null}
    </div>
  );
}

function ComparisonLine({
  label,
  delta,
  format,
  previousLabel,
}: {
  label: string;
  delta: OwnerReportDelta | null;
  format: (value: number) => string;
  previousLabel: string;
}) {
  return (
    <li className={styles.comparisonItem}>
      <span className={styles.comparisonLabel}>{label}:</span> {describeDelta(delta, format, previousLabel)}
    </li>
  );
}

function PropertySection({ property, report }: { property: OwnerReportProperty; report: OwnerReportPayload }) {
  const previousLabel = report.previousPeriod.label;
  const occupancyHint = property.occupancy.pct !== null
    ? `${integer(property.occupancy.occupiedNights)} noites reservadas · fonte: ${occupancySourceLabel(property.occupancy.source)}`
    : property.occupancy.note;
  return (
    <section className={styles.property} aria-labelledby={`owner-property-${property.ref}`}>
      <header className={styles.propertyHeader}>
        <h2 id={`owner-property-${property.ref}`} className={styles.propertyTitle}>
          {property.title}
        </h2>
        {property.location ? <p className={styles.propertyLocation}>{property.location}</p> : null}
      </header>

      {property.dataMessage ? <p className={styles.dataMessage}>{property.dataMessage}</p> : null}

      <dl className={styles.metrics}>
        <Metric
          label="Receita registrada"
          value={property.revenue === null ? null : brl(property.revenue)}
          hint={property.revenue === null ? null : `Fonte: ${metricSourceLabel(property.revenueSource)}`}
        />
        <Metric
          label="Diária média"
          value={property.averageDailyRate === null ? null : brl(property.averageDailyRate)}
          hint={property.averageDailyRate === null ? null : `Fonte: ${metricSourceLabel(property.adrSource)}`}
        />
        <Metric
          label="Ocupação"
          value={property.occupancy.pct === null ? null : pct(property.occupancy.pct)}
          hint={occupancyHint}
        />
      </dl>

      <h3 className={styles.subheading}>Comparação com {previousLabel}</h3>
      <ul className={styles.comparison}>
        <ComparisonLine label="Receita" delta={property.comparison.revenue} format={brl} previousLabel={previousLabel} />
        <ComparisonLine
          label="Diária média"
          delta={property.comparison.averageDailyRate}
          format={brl}
          previousLabel={previousLabel}
        />
        <ComparisonLine
          label="Ocupação"
          delta={property.comparison.occupancyPct}
          format={(value) => pct(value)}
          previousLabel={previousLabel}
        />
      </ul>

      <h3 className={styles.subheading}>Eventos do mês que afetaram este imóvel</h3>
      {property.events.total === 0 ? (
        <p className={styles.muted}>Nenhum evento relevante foi analisado para este imóvel no mês.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {property.events.items.map((event, index) => (
              <li key={`${event.name}-${index}`} className={styles.listItem}>
                <span className={styles.listMain}>
                  {event.name} <span className={styles.muted}>({event.dateLabel})</span>
                </span>
                <span className={styles.listMeta}>
                  {event.suggestedPrice !== null ? `Sugestão ${brlWhole(event.suggestedPrice)}` : "Sugestão sem dado"}
                  {event.liftPercent !== null ? ` · ${event.liftPercent > 0 ? "+" : ""}${pct(event.liftPercent, 0)} sobre o preço atual` : ""}
                </span>
              </li>
            ))}
          </ul>
          {property.events.total > property.events.items.length ? (
            <p className={styles.muted}>
              e mais {property.events.total - property.events.items.length} evento(s) de menor relevância.
            </p>
          ) : null}
        </>
      )}

      <h3 className={styles.subheading}>Recomendações aplicadas e efeito</h3>
      <p className={styles.muted}>
        {property.recommendations.generated} geradas · {property.recommendations.accepted} aceitas ·{" "}
        {property.recommendations.applied} aplicadas no mês.
      </p>
      {property.applied.total === 0 ? (
        <p className={styles.muted}>Nenhum preço foi aplicado pelo anfitrião neste mês.</p>
      ) : (
        <ul className={styles.list}>
          {property.applied.items.map((item, index) => (
            <li key={`${item.eventName}-${index}`} className={styles.listItem}>
              <span className={styles.listMain}>
                {item.eventName} <span className={styles.muted}>({item.dateLabel})</span>
              </span>
              <span className={styles.listMeta}>
                {item.startingPrice !== null ? `Partiu de ${brlWhole(item.startingPrice)}` : "Preço de partida sem dado"} ·{" "}
                {item.appliedPrice !== null ? `aplicado ${brlWhole(item.appliedPrice)}` : "preço aplicado sem dado"}
              </span>
              <span className={styles.listOutcome}>
                <AppBadge
                  kind={
                    item.outcome.status === "booked"
                      ? "success"
                      : item.outcome.status === "pending"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {outcomeLabel(item.outcome.status)}
                </AppBadge>
                {item.outcome.revenue !== null ? ` ${brl(item.outcome.revenue)}` : ""}
                {item.outcome.nights !== null ? ` · ${integer(item.outcome.nights)} noite(s)` : ""}
                {item.outcome.confirmedExtra !== null
                  ? ` · efeito confirmado ${brl(item.outcome.confirmedExtra)}`
                  : item.outcome.status === "booked" || item.outcome.status === "recorded"
                    ? " · sem efeito confirmado"
                    : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OwnerReportView({
  report,
  generatedAt,
  expiresAt,
  notice,
}: {
  report: OwnerReportPayload;
  generatedAt?: string;
  expiresAt?: string;
  notice?: string;
}) {
  const { summary } = report;
  const previousLabel = report.previousPeriod.label;
  return (
    <article className={styles.report} aria-labelledby="owner-report-title">
      <header className={styles.header}>
        <BrandLogo variant="wordmark" className={styles.logo} alt="My Urban" />
        <p className={styles.eyebrow}>Relatório mensal do proprietário</p>
        <h1 id="owner-report-title" className={styles.title}>
          {report.period.label.charAt(0).toUpperCase() + report.period.label.slice(1)}
        </h1>
        <p className={styles.lead}>
          Para <strong>{report.owner.name}</strong>
          {report.preparedBy ? <> · preparado por {report.preparedBy}</> : null}
        </p>
        <p className={styles.muted}>
          {generatedAt ? `Atualizado em ${dateTimeSP(generatedAt)}` : null}
          {expiresAt ? ` · link válido até ${dateSP(expiresAt)}` : null}
        </p>
        {report.period.isPartial ? (
          <p>
            <AppBadge kind="warn">Mês em andamento</AppBadge>{" "}
            <span className={styles.muted}>Os números ainda podem mudar até o fim do mês.</span>
          </p>
        ) : null}
      </header>

      <section className={styles.summary} aria-labelledby="owner-summary-title">
        <h2 id="owner-summary-title" className={styles.sectionTitle}>
          Resumo do mês
        </h2>
        <p
          className={summary.dataStatus === "none" ? `${styles.headline} ${styles.headlineNone}` : styles.headline}
          data-testid="owner-report-headline"
        >
          {summary.headline}
        </p>
        <dl className={styles.metrics}>
          <Metric
            label="Receita registrada"
            value={summary.totalRevenue === null ? null : brl(summary.totalRevenue)}
            hint={
              summary.totalRevenue === null
                ? null
                : `${summary.propertiesWithRevenue} de ${summary.propertyCount} imóveis com dado`
            }
          />
          <Metric
            label="Diária média"
            value={summary.averageDailyRate === null ? null : brl(summary.averageDailyRate)}
          />
          <Metric
            label="Ocupação"
            value={summary.occupancyPct === null ? null : pct(summary.occupancyPct)}
            hint={
              summary.occupancyPct === null
                ? "Calendário insuficiente ou não sincronizado"
                : `${summary.propertiesWithOccupancy} de ${summary.propertyCount} imóveis com calendário`
            }
          />
          <Metric
            label="Efeito confirmado das recomendações"
            value={summary.confirmedExtra === null ? null : brl(summary.confirmedExtra)}
            hint={`${summary.recommendationsApplied} recomendação(ões) aplicada(s)`}
          />
        </dl>
        <h3 className={styles.subheading}>Comparação com {previousLabel}</h3>
        <ul className={styles.comparison}>
          <ComparisonLine label="Receita" delta={summary.comparison.revenue} format={brl} previousLabel={previousLabel} />
          <ComparisonLine
            label="Ocupação média"
            delta={summary.comparison.occupancyPct}
            format={(value) => pct(value)}
            previousLabel={previousLabel}
          />
        </ul>
        {summary.comparison.comparableProperties > 0 ? (
          <p className={styles.muted}>
            Comparação feita só com os {summary.comparison.comparableProperties} imóvel(is) que têm dado nos dois meses.
          </p>
        ) : null}
        {summary.pendingOutcomes > 0 ? (
          <p className={styles.pending} role="note">
            {summary.pendingOutcomes} {summary.pendingOutcomes === 1 ? "aplicação aguarda" : "aplicações aguardam"} o registro do
            resultado pelo anfitrião; por isso a receita pode estar incompleta.
          </p>
        ) : null}
      </section>

      {report.properties.length === 0 ? (
        <p className={styles.muted}>Nenhum imóvel está vinculado a este relatório.</p>
      ) : (
        report.properties.map((property) => <PropertySection key={property.ref} property={property} report={report} />)
      )}

      <footer className={styles.footer}>
        <h2 className={styles.sectionTitle}>Como ler este relatório</h2>
        <ul className={styles.notes}>
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {notice ? <p className={styles.notice}>{notice}</p> : null}
      </footer>
    </article>
  );
}
