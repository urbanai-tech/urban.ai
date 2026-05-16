"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminOverview,
  fetchAdminPricingStatus,
  fetchAdminDatasetMetrics,
  type AdminOverview,
  type AdminPricingStatus,
  type AdminDatasetMetrics,
} from "../service/api";
import {
  AdminSectionHeader,
  AdminMetricCard,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminBadge,
  AdminEmptyState,
  AdminPageLoading,
  AdminStatusDot,
  Icons,
} from "./_components";

/**
 * /admin — overview Urban AI.
 *
 * Migrado para o design system admin (.urban-admin). A navegação entre seções
 * vive no AdminShell (sidebar lateral) — esta página foca em KPIs + estado
 * do motor IA + dataset.
 *
 * Acesso requer role='admin' no backend (RolesGuard).
 */
export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [pricing, setPricing] = useState<AdminPricingStatus | null>(null);
  const [dataset, setDataset] = useState<AdminDatasetMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, p, d] = await Promise.all([
          fetchAdminOverview(),
          fetchAdminPricingStatus(),
          fetchAdminDatasetMetrics(),
        ]);
        setOverview(o);
        setPricing(p);
        setDataset(d);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; message?: string };
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setError("Acesso negado. Você precisa ser admin para ver este painel.");
        } else {
          setError(e?.message || "Erro ao carregar painel.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <AdminPageLoading />;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Acesso negado"
          title="Erro de autenticação"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · OVERVIEW"
        title="Painel"
        subtitle="Visão consolidada da operação Urban AI. Acesso restrito a usuários com role=admin."
        actions={
          <AdminButton
            variant="primary"
            as="a"
            href="/admin/dashboard"
            rightIcon={<Icons.ArrowRight size={12} />}
          >
            Dashboard executivo
          </AdminButton>
        }
      />

      {/* === Overview KPIs === */}
      {overview && (
        <section style={{ marginBottom: 64 }}>
          <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
            VISÃO GERAL
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
            <KpiCell
              label="Usuários ativos"
              value={overview.users.active}
              sub={`de ${overview.users.total.toLocaleString("pt-BR")} cadastrados`}
            />
            <KpiCell
              label="Imóveis cadastrados"
              value={overview.product.propertiesRegistered}
            />
            <KpiCell
              label="Assinaturas ativas"
              value={overview.revenue.activeSubscriptions}
            />
            <KpiCell
              label="Eventos no DB"
              value={overview.product.eventsTotal}
              sub={`+${overview.product.eventsLast7d.toLocaleString("pt-BR")} nos últimos 7d`}
            />
            <KpiCell
              label="Análises geradas"
              value={overview.product.analysesTotal}
            />
            <KpiCell
              label="Sugestões aceitas"
              value={overview.product.analysesAccepted}
              sub={`${overview.product.acceptanceRatePercent}% taxa de aceite`}
            />
            <KpiCell label="Admins" value={overview.users.admins} />
          </div>
        </section>
      )}

      {/* === Motor IA === */}
      {overview && pricing && (
        <section style={{ marginBottom: 64 }}>
          <AdminCard variant="accent" style={{ padding: "32px 32px 28px" }}>
            <AdminCardHeader
              eyebrow="MOTOR DE IA — ESTADO ATUAL"
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  Estratégia ativa:{" "}
                  <strong style={{ color: "var(--admin-accent)" }}>
                    {pricing.activeStrategy}
                  </strong>
                </span>
              }
              actions={<AdminBadge kind="accent">{overview.ai.currentTier}</AdminBadge>}
            />
            <p
              style={{
                fontSize: 14,
                color: "var(--admin-text-muted)",
                lineHeight: 1.6,
                margin: 0,
                marginBottom: 8,
              }}
            >
              {overview.ai.reason}
            </p>
            <p
              style={{
                fontSize: 12,
                color: "var(--admin-text-dim)",
                lineHeight: 1.5,
                margin: 0,
                marginBottom: 24,
              }}
            >
              Default por env (PRICING_STRATEGY):{" "}
              <code style={{ color: "var(--admin-text)" }}>
                {pricing.strategyEnvDefault}
              </code>{" "}
              · Bootstrap on boot:{" "}
              <strong style={{ color: "var(--admin-text)" }}>
                {pricing.bootstrapOnBoot ? "sim" : "não"}
              </strong>
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 32,
                borderTop: "1px solid var(--admin-divider)",
                paddingTop: 24,
              }}
            >
              <KpiCell
                label="Snapshots no dataset"
                value={overview.ai.dataset.totalSnapshots}
                small
              />
              <KpiCell
                label="Listings distintos"
                value={overview.ai.dataset.distinctListings}
                small
              />
              <KpiCell
                label="Dias cobertos"
                value={overview.ai.dataset.distinctDays}
                small
              />
              <KpiCell
                label="Snapshots training-ready"
                value={overview.ai.dataset.trainingReady}
                sub={
                  overview.ai.dataset.totalSnapshots > 0
                    ? `${Math.round(
                        (overview.ai.dataset.trainingReady /
                          overview.ai.dataset.totalSnapshots) *
                          100,
                      )}%`
                    : undefined
                }
                small
              />
            </div>
            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid var(--admin-divider)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                fontSize: 12,
                color: "var(--admin-text-muted)",
                lineHeight: 1.55,
              }}
            >
              <TierTip
                tier="Tier 0"
                desc="regras + multiplicadores (default sem dataset)"
                active={overview.ai.currentTier === "TIER_0"}
              />
              <TierTip
                tier="Tier 1-2"
                desc="≥500 listings × 30 dias + XGBoost ready → switch automático"
                active={
                  overview.ai.currentTier === "TIER_1" ||
                  overview.ai.currentTier === "TIER_2"
                }
              />
              <TierTip
                tier="Tier 3"
                desc="≥5000 × 90 dias com MAPE ≤15%"
                active={overview.ai.currentTier === "TIER_3"}
              />
              <TierTip
                tier="Tier 4 (moat)"
                desc="≥10k × 365 dias + modelo neural híbrido"
                active={overview.ai.currentTier === "TIER_4"}
              />
            </div>
          </AdminCard>
        </section>
      )}

      {/* === Dataset proprietário === */}
      {dataset && (
        <section style={{ marginBottom: 32 }}>
          <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
            DATASET PROPRIETÁRIO
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            <AdminCard variant="subtle">
              <AdminCardHeader title="Por origem" />
              {dataset.byOrigin.length === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--admin-text-muted)",
                    margin: 0,
                  }}
                >
                  Sem snapshots ainda. O cron diário começa a popular após o
                  próximo deploy.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {dataset.byOrigin.map((row) => (
                    <li
                      key={row.origin}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid var(--admin-divider)",
                        fontSize: 13,
                      }}
                    >
                      <code style={{ color: "var(--admin-text)" }}>{row.origin}</code>
                      <span style={{ color: "var(--admin-accent)", fontWeight: 600 }}>
                        {row.count.toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p
                style={{
                  fontSize: 11,
                  color: "var(--admin-text-dim)",
                  marginTop: 16,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Dias cobertos: {dataset.daysCovered.toLocaleString("pt-BR")}
              </p>
            </AdminCard>

            <AdminCard variant="subtle">
              <AdminCardHeader title="Top listings (por volume de snapshots)" />
              {dataset.topListings.length === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--admin-text-muted)",
                    margin: 0,
                  }}
                >
                  Aguardando primeiro batch.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {dataset.topListings.map((row) => (
                    <li
                      key={row.listingId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--admin-divider)",
                        fontSize: 13,
                        fontFamily: "monospace",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--admin-text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "70%",
                        }}
                      >
                        {row.listingId}
                      </span>
                      <span style={{ color: "var(--admin-accent)", fontWeight: 600 }}>
                        {row.snapshots}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCell({
  label,
  value,
  sub,
  small = false,
}: {
  label: string;
  value: number;
  sub?: string;
  small?: boolean;
}) {
  return (
    <AdminMetricCard
      label={label}
      value={value}
      sub={sub}
      variant={small ? "sm" : "md"}
    />
  );
}

function TierTip({
  tier,
  desc,
  active,
}: {
  tier: string;
  desc: string;
  active: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <AdminStatusDot
        kind={active ? "accent" : "neutral"}
        size={6}
        style={{ marginTop: 5 }}
      />
      <div>
        <strong
          style={{
            color: active ? "var(--admin-accent)" : "var(--admin-text)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {tier}:
        </strong>{" "}
        <span style={{ fontSize: 12 }}>{desc}</span>
      </div>
    </div>
  );
}
