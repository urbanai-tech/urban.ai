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
  AdminMetricCard,
  AdminBadge,
  AdminStatusDot,
  AdminSwitch,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";
import type { AdminStatusKind } from "../_components";

/**
 * /admin/dashboard — overview executivo agregado em 1 chamada de API.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Emojis 🟢🟡🔴🚨⚠️ℹ️ substituídos por AdminStatusDot + ícones SVG.
 *  - Cards Block (8x) viram AdminCard + AdminMetricCard com hierarquia (KPI
 *    principal grande Bebas, sub-KPIs menores).
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · DASHBOARD EXECUTIVO"
        title="Snapshot da operação"
        subtitle={
          <span>
            Atualiza a cada 60s · Última leitura:{" "}
            <strong style={{ color: "var(--admin-text)" }}>
              {new Date(data.generatedAt).toLocaleTimeString("pt-BR")}
            </strong>
          </span>
        }
        actions={
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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
        style={{
          padding: "20px 24px",
          borderLeft: `3px solid ${healthBorderColor}`,
          background: "var(--admin-surface)",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AdminStatusDot kind={healthKind} size={14} pulse={data.health !== "green"} />
            <div>
              <p className="urban-admin-eyebrow-muted">SAÚDE GERAL DO SISTEMA</p>
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: "var(--admin-text)",
                  margin: "4px 0 0",
                  letterSpacing: -0.3,
                }}
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
            style={{
              listStyle: "none",
              padding: 0,
              margin: "16px 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
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
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    fontSize: 13,
                    color: "var(--admin-text)",
                  }}
                >
                  <span style={{ paddingTop: 5 }}>
                    <AdminStatusDot kind={aKind} size={7} />
                  </span>
                  <span style={{ lineHeight: 1.55 }}>{a.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* === Fallback de eventos — só se cobertura abaixo do gate === */}
      {data.integrationsReadiness && (
        <section style={{ marginBottom: 32 }}>
          <AdminCard variant="subtle">
            <AdminCardHeader
              title="Go-live Track 3"
              actions={<AdminBadge kind="neutral">sem chamadas externas</AdminBadge>}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {Object.values(data.integrationsReadiness).map((item) => (
                <ReadinessTile key={item.label} item={item} />
              ))}
            </div>
          </AdminCard>
        </section>
      )}

      {data.events.next30d < 100 && (
        <section style={{ marginBottom: 32 }}>
          <AdminCard variant="accent" style={{ padding: "20px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="urban-admin-eyebrow">FALLBACK MANUAL DE EVENTOS</p>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--admin-text)",
                    margin: "8px 0 8px",
                    letterSpacing: -0.2,
                  }}
                >
                  Cobertura futura abaixo do gate beta
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--admin-text-muted)",
                    lineHeight: 1.55,
                    margin: 0,
                    maxWidth: 720,
                  }}
                >
                  Existem {data.events.next30d.toLocaleString("pt-BR")} eventos
                  nos próximos 30 dias. Para liberar beta assistido, complete o
                  calendário de SP via cadastro manual ou importação CSV
                  enquanto os coletores amadurecem.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          marginBottom: 32,
        }}
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
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          marginBottom: 32,
        }}
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
            value={data.billing.stripePublishableMode ?? "nao visivel"}
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
            label="MailerSend"
            value={data.email?.mailerSendApiKeyConfigured ? "ok" : "faltando"}
            status={data.email?.mailerSendApiKeyConfigured ? "success" : "warn"}
          />
          <SmallStat
            label="Sender"
            value={data.email?.emailSenderConfigured ? "env" : "fallback"}
            status={data.email?.senderUsesUrbanDomain ? "success" : "warn"}
            sub={data.email?.senderDomain || "sem dominio"}
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
            value={data.stays.betaPrivate ? "beta privado" : "configurado"}
            status={data.stays.betaPrivate ? "warn" : "success"}
          />
          <SmallStat label="Contas" value={data.stays.accounts} />
          <SmallStat label="Listings" value={data.stays.listings} />
          <SmallStat label="Pushes 30d" value={data.stays.priceUpdatesLast30d} />
        </DataBlock>
      </section>

      {/* === Bloqueios dataset (opcional) === */}
      {data.dataset.blockers.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <AdminCard variant="default">
            <AdminCardHeader title="Bloqueios de dataset e qualidade" />
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
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
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid var(--admin-divider)",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ paddingTop: 6 }}>
                      <AdminStatusDot kind={kind} size={7} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--admin-text)",
                          margin: 0,
                          fontWeight: 500,
                        }}
                      >
                        <code style={{ color: "var(--admin-accent)", fontWeight: 600 }}>
                          {blocker.code}
                        </code>
                        {": "}
                        {blocker.message}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--admin-text-muted)",
                          margin: "4px 0 0",
                        }}
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
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 24,
          marginBottom: 32,
        }}
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
              style={{
                fontSize: 13,
                color: "var(--admin-text-muted)",
                margin: 0,
              }}
            >
              Sem dados nos últimos 7 dias.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.topSources.map((s, i) => {
                const max = Math.max(...data.topSources.map((x) => x.count), 1);
                const pct = (s.count / max) * 100;
                return (
                  <li key={s.source} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 6,
                      }}
                    >
                      <code
                        style={{
                          color: "var(--admin-text)",
                          fontFamily: "monospace",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")} · {s.source}
                      </code>
                      <span
                        style={{
                          color: "var(--admin-accent)",
                          fontWeight: 600,
                        }}
                      >
                        {s.count.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 2,
                        background: "var(--admin-divider)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "var(--admin-accent)",
                        }}
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
        style={{
          paddingTop: 24,
          borderTop: "1px solid var(--admin-divider)",
          fontSize: 12,
          color: "var(--admin-text-muted)",
          lineHeight: 1.55,
        }}
      >
        <p style={{ margin: 0 }}>
          <strong style={{ color: "var(--admin-text)" }}>Como ler:</strong> dot
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
    <AdminCard variant="subtle" style={{ display: "flex", flexDirection: "column" }}>
      <AdminCardHeader
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--admin-text-muted)" }}>{icon}</span>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {status && <AdminStatusDot kind={status} size={6} />}
        <p
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--admin-text-muted)",
            fontWeight: 600,
            margin: 0,
          }}
        >
          {label}
        </p>
      </div>
      <p
        style={{
          fontSize: 22,
          fontWeight: 600,
          color:
            status === "error"
              ? "var(--admin-danger)"
              : status === "warn"
                ? "var(--admin-warning)"
                : "var(--admin-text)",
          margin: 0,
          letterSpacing: -0.3,
          fontFamily: typeof value === "number" ? "'Bebas Neue', Inter, sans-serif" : "Inter, sans-serif",
        }}
      >
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {sub && (
        <p
          style={{
            fontSize: 11,
            color: "var(--admin-text-muted)",
            margin: "2px 0 0",
          }}
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--admin-text-muted)",
        textDecoration: "none",
        padding: "4px 0",
        borderBottom: "1px solid transparent",
        width: "fit-content",
        transition: "color 120ms, border-color 120ms",
      }}
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
      style={{
        border: "1px solid var(--admin-divider)",
        padding: "14px 16px",
        minHeight: 150,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <AdminStatusDot kind={kind} size={7} />
          <strong style={{ fontSize: 13, color: "var(--admin-text)" }}>{item.label}</strong>
        </span>
        <AdminBadge kind={item.status === "ready" ? "success" : "warn"}>
          {item.status === "ready" ? "ready" : "bloqueado"}
        </AdminBadge>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-muted)", lineHeight: 1.55 }}>
        {blockerText}
        {item.blockers.length > 2 ? ` +${item.blockers.length - 2}` : ""}
      </p>
      <p style={{ margin: "auto 0 0", fontSize: 11, color: "var(--admin-text-dim)", lineHeight: 1.5 }}>
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
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          height: 120,
          paddingBottom: 4,
          borderBottom: "1px solid var(--admin-divider)",
        }}
      >
        {buckets.map((b) => {
          const inHeight = (b.inScope / max) * 100;
          const outHeight = (b.outOfScope / max) * 100;
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
                cursor: "default",
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
                    opacity: 0.85,
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
          gap: 3,
          marginTop: 6,
          fontSize: 9,
          color: "var(--admin-text-dim)",
        }}
      >
        {buckets.map((b, i) => (
          <div key={b.day} style={{ flex: 1, textAlign: "center" }}>
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
        style={{
          display: "flex",
          gap: 16,
          marginTop: 12,
          fontSize: 11,
          color: "var(--admin-text-muted)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 6,
              background: "var(--admin-text)",
              opacity: 0.85,
            }}
          />
          in-scope
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 6,
              background: "var(--admin-accent)",
              opacity: 0.35,
            }}
          />
          out-of-scope
        </span>
      </div>
    </div>
  );
}
