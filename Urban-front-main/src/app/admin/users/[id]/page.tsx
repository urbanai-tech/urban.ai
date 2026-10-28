"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminMetricCard,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminPageLoading,
  AdminConfirmDialog,
  AdminSelect,
  AdminStatusDot,
  useAdminToast,
  Icons,
} from "../../_components";
import type { AdminBadgeKind } from "../../_components";
import styles from "./page.module.css";

/**
 * /admin/users/[id] — drill-down de usuário.
 *
 * Tudo que suporte/admin precisa ver de um usuário consolidado:
 *  - Cabeçalho: nome, e-mail, role badge, status ativo/inativo, data cadastro
 *  - 4 KPIs: imóveis, recomendações aceitas, recomendações aplicadas, ROI confirmado
 *  - Card "Assinatura": plano, ciclo, próxima cobrança, link Stripe Customer
 *  - Card "Onboarding drip": dia D+ enviado, último envio
 *  - Card "Stays": conectado/desconectado, última sync
 *  - Tabela "Imóveis" do usuário (link pra /admin/properties/[id])
 *  - Ações: trocar role, ativar/desativar, ver audit log
 *
 * Usa endpoints administrativos dedicados para evitar fallback com lista truncada
 * ou filtro client-side em dados incompletos.
 */

type UserDetail = {
  id: string;
  username: string;
  email: string;
  role: string;
  ativo: boolean;
  phone?: string | null;
  company?: string | null;
  pricingStrategy?: string | null;
  operationMode?: string | null;
  airbnbHostId?: string | null;
  createdAt: string;
  onboardingDripLastDay?: number | null;
  onboardingDripLastSentAt: string | null;
};

type PropertyRow = {
  id: string;
  propertyName: string;
  city?: string | null;
  state?: string | null;
  manualDailyPrice?: number | null;
  futureRecommendationsCount?: number;
  appliedRecommendationsCount?: number;
  lastAnalysisAt: string | null;
};

type SubscriptionInfo = {
  planName?: string;
  billingCycle?: string;
  status?: string;
  contratados?: number;
  ativos?: number;
  nextBillingDate?: string;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useAdminToast();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRole, setConfirmRole] = useState<{ next: string } | null>(null);
  const [confirmActive, setConfirmActive] = useState<{ next: boolean } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const userResponse = await api.get(`/admin/users/${id}`);
        const detail: UserDetail | null = userResponse.data;
        setUser(detail);

        const propertiesResponse = await api.get(`/admin/users/${id}/properties`);
        const propertiesData = propertiesResponse.data;
        setProperties(propertiesData?.items ?? propertiesData ?? []);

        const subscriptionResponse = await api.get(`/admin/users/${id}/subscription`);
        setSubscription(subscriptionResponse.data);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; message?: string };
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          setError("Acesso negado.");
        } else {
          setError(e?.message ?? "Falha ao carregar usuário.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleRoleChange() {
    if (!user || !confirmRole) return;
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: confirmRole.next });
      setUser({ ...user, role: confirmRole.next });
      toast.success(`Role atualizada para ${confirmRole.next}.`);
      setConfirmRole(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        "Erro: " + (e?.response?.data?.message ?? e?.message ?? "falhou"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleActiveChange() {
    if (!user || confirmActive == null) return;
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user.id}/active`, { ativo: confirmActive.next });
      setUser({ ...user, ativo: confirmActive.next });
      toast.success(confirmActive.next ? "Usuário reativado." : "Usuário desativado.");
      setConfirmActive(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        "Erro: " + (e?.response?.data?.message ?? e?.message ?? "falhou"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <AdminPageLoading />;

  if (error || !user) {
    return (
      <div className={styles.boxM0xautoP40x32}>
        <AdminEmptyState
          eyebrow="ERRO"
          title="Não foi possível carregar"
          body={error ?? "Usuário não encontrado."}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton
              variant="secondary"
              as="a"
              href="/admin/users"
              leftIcon={<Icons.ArrowLeft size={12} />}
            >
              Voltar para lista
            </AdminButton>
          }
        />
      </div>
    );
  }

  const initial = (user.username?.[0] || user.email[0] || "U").toUpperCase();
  const roleKind: AdminBadgeKind =
    user.role === "admin" ? "accent" : user.role === "support" ? "warn" : "neutral";
  const totalProps = properties.length;
  const totalApplied = properties.reduce((acc, p) => acc + (p.appliedRecommendationsCount ?? 0), 0);
  const totalFutureRecs = properties.reduce(
    (acc, p) => acc + (p.futureRecommendationsCount ?? 0),
    0,
  );
  const validProperties = properties.filter((p) => p.manualDailyPrice).length;

  return (
    <div className={styles.boxM0xautoP40x32}>
      <AdminSectionHeader
        eyebrow={`ADMIN · USUÁRIO · ${user.id.slice(0, 8)}…`}
        title={user.username}
        subtitle={
          <>
            {user.email}
            {user.createdAt && (
              <>
                {" · "}cadastro em{" "}
                <strong className={styles.strongText}>
                  {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                </strong>
              </>
            )}
          </>
        }
        actions={
          <AdminButton
            variant="secondary"
            as="a"
            href="/admin/users"
            leftIcon={<Icons.ArrowLeft size={12} />}
          >
            Voltar
          </AdminButton>
        }
      />

      {/* Identity card */}
      <section className={styles.sectionMb32}>
        <AdminCard variant="accent">
          <div
            className={styles.rowCenteredWrap}
          >
            <div
              aria-hidden
              className={styles.rowJustifyCenterCentered}
            >
              {initial}
            </div>
            <div className={styles.boxMinw200Flex1}>
              <div className={styles.rowWrapGap10}>
                <AdminBadge kind={roleKind}>{roleLabel(user.role)}</AdminBadge>
                <AdminBadge kind={user.ativo ? "success" : "neutral"}>
                  {user.ativo ? "Ativo" : "Inativo"}
                </AdminBadge>
                {user.pricingStrategy && (
                  <AdminBadge kind="neutral">{user.pricingStrategy}</AdminBadge>
                )}
                {user.operationMode === "auto" && (
                  <AdminBadge kind="accent">Modo auto</AdminBadge>
                )}
              </div>
              <p className={styles.textTextMutedFs13}>
                {user.phone || "sem telefone"}
                {user.company ? ` · ${user.company}` : ""}
                {user.airbnbHostId ? ` · Airbnb host #${user.airbnbHostId}` : ""}
              </p>
            </div>
            <div className={styles.rowWrapGap8}>
              <AdminSelect
                value={user.role}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next !== user.role) setConfirmRole({ next });
                }}
                shellStyle={{ width: 180 }}
              >
                <option value="host">Anfitrião</option>
                <option value="support">Suporte</option>
                <option value="admin">Operação completa</option>
              </AdminSelect>
              <AdminButton
                variant={user.ativo ? "danger" : "primary"}
                onClick={() => setConfirmActive({ next: !user.ativo })}
                leftIcon={user.ativo ? <Icons.Close size={12} /> : <Icons.Check size={12} />}
              >
                {user.ativo ? "Desativar" : "Reativar"}
              </AdminButton>
            </div>
          </div>
        </AdminCard>
      </section>

      {/* KPIs */}
      <section className={styles.sectionMb32}>
        <div
          className={styles.gridColsAuto180Gap32}
        >
          <AdminMetricCard label="Imóveis ativos" value={totalProps} />
          <AdminMetricCard
            label="Com preço base"
            value={`${validProperties}/${totalProps}`}
            accent={validProperties === totalProps && totalProps > 0}
          />
          <AdminMetricCard
            label="Recomendações futuras"
            value={totalFutureRecs}
            sub={hasFutureRecsSub(totalFutureRecs)}
          />
          <AdminMetricCard
            label="Sugestões aplicadas"
            value={totalApplied}
            status={totalApplied > 0 ? "success" : "neutral"}
          />
        </div>
      </section>

      {/* Drip + Subscription side-by-side */}
      <section
        className={styles.gridColsAuto360Gap24}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader title="E-mails de boas-vindas" />
          {user.onboardingDripLastDay ? (
            <div>
              <div className={styles.rowCenteredGap10}>
                <AdminStatusDot kind="success" size={8} />
                <p
                  className={styles.textTextFs16}
                >
                  Recebeu até D+{user.onboardingDripLastDay}
                </p>
              </div>
              {user.onboardingDripLastSentAt && (
                <p className={styles.textTextMutedFs12}>
                  Último envio em{" "}
                  {new Date(user.onboardingDripLastSentAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          ) : (
            <p className={styles.textTextMutedFs13}>
              Ainda não recebeu nenhum e-mail do drip. Próximo: D+1 quando completar 24h
              após cadastro.
            </p>
          )}
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader
            title="Assinatura"
            actions={
              subscription?.status ? (
                <AdminBadge kind={subscription.status === "active" ? "success" : "warn"}>
                  {subscription.status}
                </AdminBadge>
              ) : null
            }
          />
          {subscription ? (
            <div
              className={styles.gridColsFs13}
            >
              <Field label="Plano" value={subscription.planName ?? "—"} />
              <Field label="Ciclo" value={subscription.billingCycle ?? "—"} />
              <Field
                label="Quota"
                value={
                  subscription.contratados != null
                    ? `${subscription.ativos ?? 0}/${subscription.contratados}`
                    : "—"
                }
              />
              <Field
                label="Próx. cobrança"
                value={
                  subscription.nextBillingDate
                    ? new Date(subscription.nextBillingDate).toLocaleDateString("pt-BR")
                    : "—"
                }
              />
            </div>
          ) : (
            <p className={styles.textTextMutedFs13}>
              Sem assinatura ativa ou endpoint ainda não disponível. Alpha gratuito ou trial.
            </p>
          )}
        </AdminCard>
      </section>

      {/* Imóveis */}
      <section className={styles.sectionMb32}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb16}`}>
          IMÓVEIS DO USUÁRIO
        </p>
        {properties.length === 0 ? (
          <AdminEmptyState
            title="Nenhum imóvel cadastrado"
            body="Esse usuário ainda não criou imóveis. Se já é cliente, peça pra completar o onboarding."
          />
        ) : (
          <AdminCard variant="default" style={{ padding: 0, overflowX: "auto" }}>
            <table className={styles.tableFs13W100pct}>
              <thead>
                <tr className={styles.tableRowBordered}>
                  <Th>Imóvel</Th>
                  <Th>Localidade</Th>
                  <Th align="right">Diária base</Th>
                  <Th align="right">Recs futuras</Th>
                  <Th align="right">Aplicadas</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr
                    key={p.id}
                    className={`urban-admin-row ${styles.rowBordered}`}
                  >
                    <Td>
                      <strong className={styles.strongText}>{p.propertyName}</strong>
                      <br />
                      <code className={styles.codeTextDimFs11}>
                        {p.id.slice(0, 8)}…
                      </code>
                    </Td>
                    <Td>
                      {p.city ? (
                        <span className={styles.strongText}>
                          {p.city}/{p.state}
                        </span>
                      ) : (
                        <AdminBadge kind="error">A definir</AdminBadge>
                      )}
                    </Td>
                    <Td align="right">
                      {p.manualDailyPrice ? (
                        <span className={styles.labelMono}>
                          R$ {Number(p.manualDailyPrice).toLocaleString("pt-BR")}
                        </span>
                      ) : (
                        <span className={styles.labelTextDim}>—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span
                        style={{
                          color:
                            (p.futureRecommendationsCount ?? 0) > 0
                              ? "var(--admin-accent)"
                              : "var(--admin-text-dim)",
                          fontWeight: 600,
                        }}
                      >
                        {p.futureRecommendationsCount ?? 0}
                      </span>
                    </Td>
                    <Td align="right">{p.appliedRecommendationsCount ?? 0}</Td>
                    <Td align="right">
                      <a
                        href={`/admin/properties/${p.id}`}
                        className={styles.rowCenteredTextMuted}
                      >
                        <Icons.ArrowRight size={14} />
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>
        )}
      </section>

      {/* Atalhos */}
      <section className={styles.sectionMt48Bordered}>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Atalhos" />
          <div className={styles.rowWrapGap102}>
            <AdminButton
              variant="ghost"
              as="a"
              href={`/admin/audit-logs?actorId=${id}`}
              leftIcon={<Icons.Shield size={11} />}
            >
              Audit log deste usuário
            </AdminButton>
            <AdminButton
              variant="ghost"
              as="a"
              href={`/admin/alpha?email=${encodeURIComponent(user.email)}`}
              leftIcon={<Icons.Zap size={11} />}
            >
              Ver no Alpha (se aplicável)
            </AdminButton>
            <AdminButton variant="ghost" as="a" href="/admin/users" leftIcon={<Icons.Users size={11} />}>
              Listagem completa
            </AdminButton>
          </div>
        </AdminCard>
      </section>

      <AdminConfirmDialog
        open={!!confirmRole}
        onClose={() => setConfirmRole(null)}
        onConfirm={handleRoleChange}
        loading={busy}
        title={`Alterar role para ${confirmRole?.next}?`}
        body={
          confirmRole?.next === "admin"
            ? "Esse usuário ganhará acesso completo ao painel de operação. Confirmar?"
            : `Esse usuário será rebaixado para ${confirmRole?.next}.`
        }
        confirmLabel="Confirmar"
        destructive={confirmRole?.next !== "admin" && user.role === "admin"}
      />

      <AdminConfirmDialog
        open={confirmActive != null}
        onClose={() => setConfirmActive(null)}
        onConfirm={handleActiveChange}
        loading={busy}
        title={confirmActive?.next ? "Reativar usuário?" : "Desativar usuário?"}
        body={
          confirmActive?.next
            ? "Usuário poderá voltar a acessar o app."
            : "Login fica bloqueado e o motor para de gerar recomendações para esse user."
        }
        confirmLabel={confirmActive?.next ? "Reativar" : "Desativar"}
        destructive={!confirmActive?.next}
      />
    </div>
  );
}

function hasFutureRecsSub(count: number): string {
  if (count === 0) return "Sem cobertura futura";
  if (count < 5) return "Pouca cobertura";
  return "Cobertura saudável";
}

function roleLabel(role: string): string {
  if (role === "admin") return "Operação completa";
  if (role === "support") return "Suporte";
  if (role === "host") return "Anfitrião";
  return role;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className={styles.textTextMutedFs10}
      >
        {label}
      </p>
      <p className={styles.textTextFs13}>
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        padding: "12px 16px",
        textAlign: align,
        fontSize: 10,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "var(--admin-text-muted)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td style={{ padding: "14px 16px", textAlign: align, verticalAlign: "middle" }}>
      {children}
    </td>
  );
}
