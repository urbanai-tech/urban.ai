"use client";

import { useEffect, useState } from "react";
import {
  fetchDashboardSummary,
  type DashboardSummary,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminBadge,
  AdminStatusDot,
  AdminSwitch,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";
import type { AdminStatusKind } from "../_components";
import styles from "./page.module.css";

/**
 * /admin/dashboard — overview executivo agregado em 1 chamada de API.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Emojis 🟢🟡🔴🚨⚠️ℹ️ substituídos por AdminStatusDot + ícones SVG.
 *  - Cards Block (8x) viram AdminCard + AdminMetricCard com hierarquia (KPI
 *    principal grande Archivo, sub-KPIs menores).
 *  - "Saúde geral" vira faixa horizontal com border-left de 4px na cor do estado.
 *  - MiniTimeline com paleta branco/orange (não verde/vermelho saturado).
 *  - Auto-refresh checkbox cru vira AdminSwitch.
 *  - Banner "Fallback manual" vira AdminCard accent no topo (não embaixo cortado).
 *
 * Auto-refresh a cada 60s.
 */
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function load() {
    try {
      const r = await fetchDashboardSummary();
      setData(r);
      setError(null);
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

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Não foi possível carregar"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton
              variant="primary"
              onClick={load}
              leftIcon={<Icons.RefreshCw size={12} />}
            >
              Tentar de novo
            </AdminButton>
          }
        />
      </div>
    );
  }

  if (loading || !data) {
    return <AdminPageLoading showTable={false} />;
  }

  const healthKind: AdminStatusKind =
    data.health === "green" ? "success" : data.health === "amber" ? "warn" : "error";

  const healthLabel =
    data.health === "green"
      ? "Tudo certo"
      : data.health === "amber"
        ? "Atenção em alguns pontos"
        : "Problemas críticos";

  const healthBorderColor =
    data.health === "green"
      ? "var(--admin-success)"
      : data.health === "amber"
        ? "var(--admin-warning)"
        : "var(--admin-danger)";

  const emailProviderConfigured = data.email?.brevoApiKeyConfigured ?? false;

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · DASHBOARD EXECUTIVO"
        title="Snapshot da operação"
        subtitle={
          <span>
            Atualiza a cada 60s · Última leitura:{" "}
            <strong className={styles.inlineStrong}>
              {new Date(data.generatedAt).toLocaleTimeString("pt-BR")}
            </strong>
          </span>
        }
        actions={
          <div className={styles.headerActions}>
            <AdminSwitch
              id="auto-refresh"
              checked={autoRefresh}
              onChange={setAutoRefresh}
              label="Auto-refresh"
            />
            <AdminButton
              variant="secondary"
              onClick={load}
              leftIcon={<Icons.RefreshCw size={12} />}
            >
              Atualizar
            </AdminButton>
          </div>
        }
      />

      {/* === Saúde geral — faixa horizontal === */}
      <section
        className={styles.healthStrip}
        style={{ "--health-color": healthBorderColor } as React.CSSProperties}
      >
        <div
          className={styles.healthHeader}
        >
          <div className={styles.healthTitle}>
            <AdminStatusDot kind={healthKind} size={14} pulse={data.health !== "green"} />
            <div>
              <p className="urban-admin-eyebrow-muted">SAÚDE GERAL DO SISTEMA</p>
              <p
                className={styles.healthLabel}
              >
                {healthLabel}
              </p>
            </div>
          </div>
          {data.alerts.length === 0 && (
            <AdminBadge kind="neutral">Nenhum alerta ativo</AdminBadge>
          )}
        </div>

        {data.alerts.length > 0 && (
          <ul
            className={styles.alertList}
          >
            {data.alerts.map((a, i) => {
              const aKind: AdminStatusKind =
                a.severity === "red"
                  ? "error"
                  : a.severity === "amber"
                    ? "warn"
                    : "accent";
              return (
                <li
                  key={i}
                  className={styles.alertItem}
                >
                  <span className={styles.alertDotWrap}>
                    <AdminStatusDot kind={aKind} size={7} />
                  </span>
                  <span className={styles.alertMessage}>{a.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* === Fallback de eventos — só se cobertura abaixo do gate === */}
      {data.integrationsReadiness && (
        <section className={styles.section}>
          <AdminCard variant="subtle">
            <AdminCardHeader
              title="Go-live Track 3"
              actions={<AdminBadge kind="neutral">sem chamadas externas</AdminBadge>}
            />
            <div
              className={styles.readinessGrid}
            >
              {Object.values(data.integrationsReadiness).map((item) => (
                <ReadinessTile key={item.label} item={item} />
              ))}
            </div>
          </AdminCard>
        </section>
      )}

      {data.events.next30d < 100 && (
        <section className={styles.section}>
          <AdminCard variant="accent" className={styles.featuredCard}>
            <div
              className={styles.fallbackHeader}
            >
              <div className={styles.fallbackBody}>
                <p className="urban-admin-eyebrow">FALLBACK MANUAL DE EVENTOS</p>
                <h3
                  className={styles.fallbackTitle}
                >
                  Cobertura futura abaixo do gate beta
                </h3>
                <p
                  className={styles.fallbackText}
                >
                  Existem {data.events.next30d.toLocaleString("pt-BR")} eventos
                  nos próximos 30 dias. Para liberar beta assistido, complete o
                  calendário de SP via cadastro manual ou importação CSV
                  enquanto os coletores amadurecem.
                </p>
              </div>
              <div className={styles.fallbackActions}>
                <AdminButton variant="primary" as="a" href="/admin/events/new" leftIcon={<Icons.Plus size={12} />}>
                  Cadastrar evento
                </AdminButton>
                <AdminButton variant="secondary" as="a" href="/admin/events/import" leftIcon={<Icons.Upload size={12} />}>
                  Importar CSV
                </AdminButton>
                <AdminButton variant="ghost" as="a" href="/admin/jobs" leftIcon={<Icons.Server size={12} />}>
                  Rodar jobs
                </AdminButton>
              </div>
            </div>
          </AdminCard>
        </section>
      )}

      {/* === 8 blocos — 2 rows × 4 cols === */}
      <section
        className={styles.blockGrid}
      >
        <DataBlock title="Motor de eventos" icon={<Icons.Calendar size={14} />} href="/admin/events">
          <SmallStat label="Total" value={data.events.total} />
          <SmallStat
            label="Dentro da cobertura"
            value={data.events.inScope}
            sub={`${data.events.outOfScope} fora (${data.events.outOfScopePercent}%)`}
            status="success"
          />
          <SmallStat
            label="Próximos 30 dias"
            value={data.events.next30d}
            sub={`${data.events.megaUpcoming} mega-eventos (rel ≥ 80)`}
          />
          <SmallStat
            label="Coletados últimas 24h"
            value={data.events.last24h}
            status={data.events.last24h === 0 ? "error" : "success"}
            sub={`${data.events.last7d} nos últimos 7d`}
          />
        </DataBlock>

        <DataBlock title="Lista de espera" icon={<Icons.Users size={14} />} href="/admin/waitlist">
          <SmallStat label="Total" value={data.waitlist.total} />
          <SmallStat label="Aguardando convite" value={data.waitlist.pending} status="warn" />
          <SmallStat label="Convidados" value={data.waitlist.invited} status="accent" />
          <SmallStat label="Convertidos em conta" value={data.waitlist.converted} status="success" />
        </DataBlock>

        <DataBlock title="Pipeline de processamento" icon={<Icons.Server size={14} />} href="/admin/collectors-health">
          <SmallStat
            label="Sources distintos"
            value={data.events.distinctSources}
            sub="coletores ativos"
          />
          <SmallStat
            label="Pendentes Gemini"
            value={data.events.pendingEnrichment}
            status={data.events.pendingEnrichment > 100 ? "warn" : "neutral"}
            sub="aguardando enriquecimento"
          />
          <SmallStat
            label="Pendentes Geocoding"
            value={data.events.pendingGeocode}
            status={data.events.pendingGeocode > 50 ? "warn" : "neutral"}
          />
          <SmallStat
            label="Regiões cobertas"
            value={data.coverage.activeRegions}
            sub={
              data.coverage.bootstrapRegions > 0
                ? `+${data.coverage.bootstrapRegions} bootstrap`
                : undefined
            }
          />
        </DataBlock>

        <DataBlock title="Receita & assinaturas" icon={<Icons.DollarSign size={14} />} href="/admin/finance">
          <SmallStat label="Assinaturas ativas" value={data.revenue.activeSubscriptions} status="success" />
          <NavLink href="/admin/finance">Ver MRR + custos + margem</NavLink>
          <NavLink href="/admin/pricing-config">Configurar preços (matriz F6.5)</NavLink>
          <NavLink href="/admin/coverage">Cobertura geográfica</NavLink>
        </DataBlock>
      </section>

      <section
        className={styles.blockGrid}
      >
        <DataBlock title="Recomendações" icon={<Icons.Activity size={14} />} href="/admin/funnel">
          <SmallStat
            label="Criadas 24h"
            value={data.pricing.last24h}
            status={data.pricing.last24h === 0 ? "error" : "success"}
            sub={`${data.pricing.last30d} nos últimos 30d`}
          />
          <SmallStat
            label="Futuras"
            value={data.pricing.futureRecommendations}
            sub={`${data.pricing.activeWithFuturePricing}/${data.pricing.activeAddresses} imóveis ativos`}
          />
          <SmallStat
            label="Cobertura"
            value={`${data.pricing.coveragePercent}%`}
            status={data.pricing.coveragePercent < 70 ? "error" : "success"}
            sub="gate beta: 70%"
          />
          <SmallStat
            label="Preço aplicado"
            value={data.pricing.appliedPriceCaptured}
            sub={
              data.pricing.invalidLocalityAddresses > 0
                ? `${data.pricing.invalidLocalityAddresses} imóveis com localidade inválida`
                : "ground truth capturado"
            }
          />
        </DataBlock>

        <DataBlock title="Dataset & ROI" icon={<Icons.Database size={14} />} href="/admin/roi">
          <SmallStat
            label="Health"
            value={data.dataset.health}
            status={
              data.dataset.health === "red"
                ? "error"
                : data.dataset.health === "amber"
                  ? "warn"
                  : "success"
            }
          />
          <SmallStat
            label="Price snapshots"
            value={data.dataset.priceSnapshots}
            sub={data.dataset.latestSnapshotDate ?? "sem snapshot"}
          />
          <SmallStat label="Ocupação" value={data.dataset.occupancyRecords} />
          <SmallStat label="Features evento" value={data.dataset.eventProximityFeatures} />
        </DataBlock>

        <DataBlock title="Billing" icon={<Icons.Briefcase size={14} />} href="/admin/pricing-config">
          <SmallStat
            label="Stripe secret"
            value={data.billing.stripeSecretMode ?? (data.billing.stripeSecretConfigured ? "ok" : "faltando")}
            status={
              !data.billing.stripeSecretConfigured || data.billing.stripeSecretMode === "unknown"
                ? "error"
                : data.billing.stripeModeMismatch
                  ? "error"
                  : "success"
            }
          />
          <SmallStat
            label="Webhook"
            value={data.billing.stripeWebhookConfigured ? "ok" : "faltando"}
            status={data.billing.stripeWebhookConfigured ? "success" : "error"}
          />
          <SmallStat
            label="Publishable"
            value={data.billing.stripePublishableMode ?? "não visível"}
            status={
              data.billing.stripeModeMismatch || data.billing.stripePublishableMode === "unknown"
                ? "error"
                : data.billing.stripePublishableConfigured
                  ? "success"
                  : "warn"
            }
          />
          <SmallStat
            label="Status peding"
            value={data.billing.legacyPedingPayments}
            status={data.billing.legacyPedingPayments > 0 ? "warn" : "success"}
          />
          <SmallStat label="Ativas" value={data.billing.activeSubscriptions} />
        </DataBlock>

        <DataBlock title="E-mail" icon={<Icons.Mail size={14} />} href="/admin/onboarding-drip">
          <SmallStat
            label="Brevo"
            value={emailProviderConfigured ? "ok" : "faltando"}
            status={emailProviderConfigured ? "success" : "warn"}
          />
          <SmallStat
            label="Sender"
            value={data.email?.emailSenderConfigured ? "env" : "fallback"}
            status={data.email?.senderUsesUrbanDomain ? "success" : "warn"}
            sub={data.email?.senderDomain || "sem domínio"}
          />
          <SmallStat
            label="FRONT_URL"
            value={data.email?.frontUrlConfigured ? "ok" : "fallback"}
            status={data.email?.frontUrlConfigured ? "success" : "warn"}
          />
          <NavLink href="/admin/onboarding-drip">Ver drip onboarding</NavLink>
        </DataBlock>

        <DataBlock title="Suporte & LGPD" icon={<Icons.AlertCircle size={14} />} href="/admin/contacts">
          <SmallStat
            label="Abertos"
            value={data.support?.open ?? 0}
            status={(data.support?.open ?? 0) > 0 ? "warn" : "success"}
          />
          <SmallStat
            label="SLA vencido"
            value={data.support?.overdue ?? 0}
            status={(data.support?.overdue ?? 0) > 0 ? "error" : "success"}
          />
          <SmallStat
            label="P0 abertos"
            value={data.support?.p0Open ?? 0}
            status={(data.support?.p0Open ?? 0) > 0 ? "error" : "success"}
          />
          <SmallStat label="LGPD" value={data.support?.lgpdOpen ?? 0} />
          <SmallStat
            label="Canal suporte"
            value={data.support?.supportEmailConfigured ? "env" : "fallback"}
            status={data.support?.supportEmailDomainOk ? "success" : "warn"}
            sub={data.support?.supportEmail}
          />
          <SmallStat
            label="Privacidade"
            value={data.support?.privacyEmailConfigured ? "env" : "fallback"}
            status={data.support?.privacyEmailDomainOk ? "success" : "warn"}
            sub={data.support?.privacyEmail}
          />
          <SmallStat
            label="Dono suporte"
            value={data.support?.supportOwnerConfigured ? "definido" : "faltando"}
            status={data.support?.supportOwnerConfigured && data.support?.supportOwnerDomainOk ? "success" : "warn"}
            sub={data.support?.supportOwnerEmail || "SUPPORT_OWNER_EMAIL"}
          />
          <SmallStat
            label="Dono LGPD"
            value={data.support?.privacyOwnerConfigured ? "definido" : "faltando"}
            status={data.support?.privacyOwnerConfigured && data.support?.privacyOwnerDomainOk ? "success" : "warn"}
            sub={data.support?.privacyOwnerEmail || "PRIVACY_OWNER_EMAIL"}
          />
        </DataBlock>

        <DataBlock title="Stays" icon={<Icons.Layers size={14} />} href="/admin/stays">
          <SmallStat
            label="Modo"
            value={data.stays.betaPrivate ? "restrito" : "configurado"}
            status={data.stays.betaPrivate ? "warn" : "success"}
          />
          <SmallStat label="Contas" value={data.stays.accounts} />
          <SmallStat label="Listings" value={data.stays.listings} />
          <SmallStat label="Pushes 30d" value={data.stays.priceUpdatesLast30d} />
        </DataBlock>
      </section>

      {/* === Bloqueios dataset (opcional) === */}
      {data.dataset.blockers.length > 0 && (
        <section className={styles.section}>
          <AdminCard variant="default">
            <AdminCardHeader title="Bloqueios de dataset e qualidade" />
            <ul className={styles.plainList}>
              {data.dataset.blockers.map((blocker) => {
                const kind: AdminStatusKind =
                  blocker.severity === "red"
                    ? "error"
                    : blocker.severity === "amber"
                      ? "warn"
                      : "neutral";
                return (
                  <li
                    key={blocker.code}
                    className={styles.blockerItem}
                  >
                    <span className={styles.blockerDotWrap}>
                      <AdminStatusDot kind={kind} size={7} />
                    </span>
                    <div className={styles.blockerBody}>
                      <p
                        className={styles.blockerMessage}
                      >
                        <code className={styles.accentCode}>
                          {blocker.code}
                        </code>
                        {": "}
                        {blocker.message}
                      </p>
                      <p
                        className={styles.blockerNextAction}
                      >
                        {blocker.nextAction}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </AdminCard>
        </section>
      )}

      {/* === Mini-timeline + Top sources === */}
      <section
        className={styles.timelineSourcesGrid}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader
            title={`Ingestão últimos ${data.timeline.days} dias`}
            actions={
              <AdminButton
                variant="ghost"
                size="sm"
                as="a"
                href="/admin/events"
                rightIcon={<Icons.ArrowRight size={11} />}
              >
                Ver completo
              </AdminButton>
            }
          />
          <MiniTimeline buckets={data.timeline.buckets} />
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader
            title="Top 5 sources (7d)"
            actions={
              <AdminButton
                variant="ghost"
                size="sm"
                as="a"
                href="/admin/collectors-health"
                rightIcon={<Icons.ArrowRight size={11} />}
              >
                Ver todos
              </AdminButton>
            }
          />
          {data.topSources.length === 0 ? (
            <p
              className={styles.emptySources}
            >
              Sem dados nos últimos 7 dias.
            </p>
          ) : (
            <ul className={styles.plainList}>
              {data.topSources.map((s, i) => {
                const max = Math.max(...data.topSources.map((x) => x.count), 1);
                const pct = (s.count / max) * 100;
                return (
                  <li key={s.source} className={styles.sourceItem}>
                    <div
                      className={styles.sourceHeader}
                    >
                      <code
                        className={styles.sourceName}
                      >
                        {String(i + 1).padStart(2, "0")} · {s.source}
                      </code>
                      <span
                        className={styles.accentCode}
                      >
                        {s.count.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div
                      className={styles.sourceBarTrack}
                    >
                      <div
                        className={styles.sourceBarFill}
                        style={{ "--pct": `${pct}%` } as React.CSSProperties}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminCard>
      </section>

      <footer
        className={styles.pageFooter}
      >
        <p className={styles.footerText}>
          <strong className={styles.inlineStrong}>Como ler:</strong> dot
          verde = sem alertas; amarelo = atenção em algum ponto; vermelho =
          problema crítico (coletor caído, cobertura zero, etc.). Auto-refresh
          60s pode ser desligado no header acima.
        </p>
      </footer>
    </div>
  );
}

function DataBlock({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <AdminCard variant="subtle" className={styles.sectionCard}>
      <AdminCardHeader
        title={
          <span className={styles.blockTitle}>
            <span className={styles.blockIcon}>{icon}</span>
            {title}
          </span>
        }
        actions={
          href && (
            <AdminButton
              variant="ghost"
              size="sm"
              as="a"
              href={href}
              rightIcon={<Icons.ArrowRight size={11} />}
            >
              Detalhes
            </AdminButton>
          )
        }
      />
      <div className={styles.blockContent}>
        {children}
      </div>
    </AdminCard>
  );
}

function SmallStat({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: number | string;
  sub?: string;
  status?: AdminStatusKind;
}) {
  return (
    <div>
      <div className={styles.statLabelRow}>
        {status && <AdminStatusDot kind={status} size={6} />}
        <p
          className={styles.statLabel}
        >
          {label}
        </p>
      </div>
      <p
        className={`${styles.statValue} ${
          status === "error" ? styles.statValueError : status === "warn" ? styles.statValueWarn : ""
        } ${typeof value === "number" ? styles.statValueNumeric : ""}`}
      >
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {sub && (
        <p
          className={styles.statSub}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={styles.navLink}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.color = "var(--admin-accent)";
        (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = "var(--admin-accent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.color = "var(--admin-text-muted)";
        (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = "transparent";
      }}
    >
      {children} <Icons.ArrowRight size={10} />
    </a>
  );
}

function ReadinessTile({
  item,
}: {
  item: {
    label: string;
    status: "ready" | "blocked";
    blockers: string[];
    nextAction: string;
  };
}) {
  const kind: AdminStatusKind = item.status === "ready" ? "success" : "warn";
  const blockerText =
    item.blockers.length > 0
      ? item.blockers.slice(0, 2).join(" | ")
      : "Pronto para smoke real.";

  return (
    <div
      className={styles.readinessTile}
    >
      <div
        className={styles.readinessTileHeader}
      >
        <span className={styles.readinessTileTitle}>
          <AdminStatusDot kind={kind} size={7} />
          <strong className={styles.readinessTileLabel}>{item.label}</strong>
        </span>
        <AdminBadge kind={item.status === "ready" ? "success" : "warn"}>
          {item.status === "ready" ? "ready" : "bloqueado"}
        </AdminBadge>
      </div>
      <p className={styles.readinessTileBlockers}>
        {blockerText}
        {item.blockers.length > 2 ? ` +${item.blockers.length - 2}` : ""}
      </p>
      <p className={styles.readinessTileNext}>
        {item.nextAction}
      </p>
    </div>
  );
}

function MiniTimeline({
  buckets,
}: {
  buckets: Array<{ day: string; inScope: number; outOfScope: number }>;
}) {
  const max = Math.max(...buckets.map((b) => b.inScope + b.outOfScope), 1);
  return (
    <div>
      <div
        className={styles.timelineBars}
      >
        {buckets.map((b) => {
          const inHeight = (b.inScope / max) * 100;
          const outHeight = (b.outOfScope / max) * 100;
          return (
            <div
              key={b.day}
              title={`${new Date(b.day).toLocaleDateString("pt-BR")} — in: ${b.inScope}, out: ${b.outOfScope}`}
              className={styles.timelineBar}
            >
              {b.outOfScope > 0 && (
                <div
                  className={styles.timelineOut}
                  style={{ "--bar-h": `${outHeight}%` } as React.CSSProperties}
                />
              )}
              {b.inScope > 0 && (
                <div
                  className={styles.timelineIn}
                  style={{ "--bar-h": `${inHeight}%` } as React.CSSProperties}
                />
              )}
            </div>
          );
        })}
      </div>
      <div
        className={styles.timelineAxis}
      >
        {buckets.map((b, i) => (
          <div key={b.day} className={styles.timelineAxisLabel}>
            {i % Math.ceil(buckets.length / 7) === 0
              ? new Date(b.day).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })
              : ""}
          </div>
        ))}
      </div>
      <div
        className={styles.timelineLegend}
      >
        <span className={styles.legendItem}>
          <span
            className={styles.legendSwatchInScope}
          />
          in-scope
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendSwatchOutScope}
          />
          out-of-scope
        </span>
      </div>
    </div>
  );
}
