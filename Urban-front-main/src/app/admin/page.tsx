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
import styles from "./page.module.css";

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
          setError("Acesso negado. Você precisa ter permissão de operação para ver este painel.");
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
      <div className={styles.boxM0xautoP40x32}>
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
    <div className={styles.boxM0xautoP40x32}>
      <AdminSectionHeader
        eyebrow="OPERAÇÃO · RESUMO"
        title="Painel"
        subtitle="Visão consolidada da operação My Urban. Acesso restrito à equipe autorizada."
        actions={
          <AdminButton
            variant="primary"
            as="a"
            href="/admin/dashboard"
            rightIcon={<Icons.ArrowRight size={12} />}
          >
            Abrir painel executivo
          </AdminButton>
        }
      />

      {/* === Overview KPIs === */}
      {overview && (
        <section className={styles.sectionMb64}>
          <p className={`urban-admin-eyebrow ${styles.eyebrowMb24}`}>
            VISÃO GERAL
          </p>
          <div
            className={styles.gridColsAuto180Gap32}
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
            <KpiCell label="Operadores" value={overview.users.admins} />
          </div>
        </section>
      )}

      {/* === Motor IA === */}
      {overview && pricing && (
        <section className={styles.sectionMb64}>
          <AdminCard variant="accent" className={styles.engineCard}>
            <AdminCardHeader
              eyebrow="MOTOR DE IA — ESTADO ATUAL"
              title={
                <span className={styles.rowCenteredGap12}>
                  Estratégia ativa:{" "}
                  <strong className={styles.strongAccent}>
                    {pricing.activeStrategy}
                  </strong>
                </span>
              }
              actions={<AdminBadge kind="accent">{overview.ai.currentTier}</AdminBadge>}
            />
            <p
              className={styles.textTextMutedFs14}
            >
              {overview.ai.reason}
            </p>
            <p
              className={styles.textTextDimFs12}
            >
              Default por env (PRICING_STRATEGY):{" "}
              <code className={styles.codeText}>
                {pricing.strategyEnvDefault}
              </code>{" "}
              · Bootstrap on boot:{" "}
              <strong className={styles.codeText}>
                {pricing.bootstrapOnBoot ? "sim" : "não"}
              </strong>
            </p>
            <div
              className={styles.gridColsAuto160Gap32}
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
              className={styles.gridColsAuto220TextMuted}
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
        <section className={styles.sectionMb32}>
          <p className={`urban-admin-eyebrow ${styles.eyebrowMb24}`}>
            DATASET PROPRIETÁRIO
          </p>
          <div
            className={styles.gridColsAutoGap24}
          >
            <AdminCard variant="subtle">
              <AdminCardHeader title="Por origem" />
              {dataset.byOrigin.length === 0 ? (
                <p
                  className={styles.textTextMutedFs13}
                >
                  Sem snapshots ainda. O cron diário começa a popular após o
                  próximo deploy.
                </p>
              ) : (
                <ul className={styles.listM0P0}>
                  {dataset.byOrigin.map((row) => (
                    <li
                      key={row.origin}
                      className={styles.rowBetweenFs13}
                    >
                      <code className={styles.codeText}>{row.origin}</code>
                      <span className={styles.labelAccentW600}>
                        {row.count.toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p
                className={styles.textTextDimFs11}
              >
                Dias cobertos: {dataset.daysCovered.toLocaleString("pt-BR")}
              </p>
            </AdminCard>

            <AdminCard variant="subtle">
              <AdminCardHeader title="Top listings (por volume de snapshots)" />
              {dataset.topListings.length === 0 ? (
                <p
                  className={styles.textTextMutedFs13}
                >
                  Aguardando primeiro batch.
                </p>
              ) : (
                <ul className={styles.listM0P0}>
                  {dataset.topListings.map((row) => (
                    <li
                      key={row.listingId}
                      className={styles.rowBetweenFs13P8x0BorderedMono}
                    >
                      <span
                        className={styles.labelTextMutedMaxw70pct}
                      >
                        {row.listingId}
                      </span>
                      <span className={styles.labelAccentW600}>
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
    <div className={styles.rowStartGap8}>
      <AdminStatusDot
        kind={active ? "accent" : "neutral"}
        size={6}
        className={styles.statusDot}
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
        <span className={styles.labelFs12}>{desc}</span>
      </div>
    </div>
  );
}
