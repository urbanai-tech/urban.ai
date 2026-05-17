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

/**
 * /admin/users/[id] — drill-down de usuario.
 *
 * Tudo que suporte/admin precisa ver de um usuario consolidado:
 *  - Cabecalho: nome, email, role badge, status ativo/inativo, data cadastro
 *  - 4 KPIs: imoveis, recomendacoes aceitas, recomendacoes aplicadas, ROI confirmado
 *  - Card "Assinatura": plano, ciclo, proxima cobranca, link Stripe Customer
 *  - Card "Onboarding drip": dia D+ enviado, ultimo envio
 *  - Card "Stays": conectado/desconectado, ultima sync
 *  - Tabela "Imoveis" do usuario (link pra /admin/properties/[id])
 *  - Acoes: trocar role, ativar/desativar, ver audit log
 *
 * Resiliente: usa endpoints existentes (/admin/users, /admin/properties)
 * + fallback gracioso quando backend ainda nao expoe agregados.
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
  createdAt?: string;
  onboardingDripLastDay?: number | null;
  onboardingDripLastSentAt?: string | null;
};

type PropertyRow = {
  id: string;
  propertyName: string;
  city?: string | null;
  state?: string | null;
  manualDailyPrice?: number | null;
  futureRecommendationsCount?: number;
  appliedRecommendationsCount?: number;
  lastAnalysisAt?: string | null;
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
        // Buscar usuario direto. Backend tem /admin/users (lista paginada) e
        // a entity completa fica em /admin/users/:id se existir, ou fallback.
        let detail: UserDetail | null = null;
        try {
          const r = await api.get(`/admin/users/${id}`);
          detail = r.data;
        } catch {
          // Fallback: percorre listagem ate achar o id.
          const r = await api.get(`/admin/users`, { params: { limit: 100 } });
          const items = (r.data?.data || r.data?.items || r.data) as UserDetail[];
          detail = items.find((u) => u.id === id) || null;
          if (!detail) throw new Error("Usuário não encontrado na listagem admin.");
        }
        setUser(detail);

        // Imoveis do usuario — usa /admin/properties com filtro client-side por hostId.
        try {
          const r = await api.get(`/admin/properties`, { params: { limit: 500 } });
          const items = (r.data?.items || r.data) as Array<PropertyRow & { userId?: string }>;
          const owned = items.filter((p) => p.userId === id || (p as any).host?.id === id);
          setProperties(owned);
        } catch {
          /* sem propriedades — ok */
        }

        // Assinatura ativa via /admin/users (sub-info pode vir junto) ou /payments
        try {
          const r = await api.get(`/admin/users/${id}/subscription`);
          setSubscription(r.data);
        } catch {
          /* sem subscription endpoint — ok */
        }
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow={`ADMIN · USUÁRIO · ${user.id.slice(0, 8)}…`}
        title={user.username}
        subtitle={
          <>
            {user.email}
            {user.createdAt && (
              <>
                {" · "}cadastro em{" "}
                <strong style={{ color: "var(--admin-text)" }}>
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
      <section style={{ marginBottom: 32 }}>
        <AdminCard variant="accent">
          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(232, 80, 10, 0.10)",
                border: "1px solid rgba(232, 80, 10, 0.30)",
                color: "var(--admin-accent)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <AdminBadge kind={roleKind}>{user.role}</AdminBadge>
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
              <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
                {user.phone || "sem telefone"}
                {user.company ? ` · ${user.company}` : ""}
                {user.airbnbHostId ? ` · Airbnb host #${user.airbnbHostId}` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <AdminSelect
                value={user.role}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next !== user.role) setConfirmRole({ next });
                }}
                shellStyle={{ width: 180 }}
              >
                <option value="host">host</option>
                <option value="support">support</option>
                <option value="admin">admin</option>
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
      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 32,
            borderTop: "1px solid var(--admin-divider)",
            borderBottom: "1px solid var(--admin-divider)",
            padding: "24px 0",
          }}
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
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 24,
          marginBottom: 32,
        }}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader title="Onboarding drip" />
          {user.onboardingDripLastDay ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <AdminStatusDot kind="success" size={8} />
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--admin-text)",
                    margin: 0,
                  }}
                >
                  Recebeu até D+{user.onboardingDripLastDay}
                </p>
              </div>
              {user.onboardingDripLastSentAt && (
                <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0 }}>
                  Último envio em{" "}
                  {new Date(user.onboardingDripLastSentAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
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
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                fontSize: 13,
              }}
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
            <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
              Sem assinatura ativa ou endpoint ainda não disponível. Alpha gratuito ou trial.
            </p>
          )}
        </AdminCard>
      </section>

      {/* Imoveis */}
      <section style={{ marginBottom: 32 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 16 }}>
          IMÓVEIS DO USUÁRIO
        </p>
        {properties.length === 0 ? (
          <AdminEmptyState
            title="Nenhum imóvel cadastrado"
            body="Esse usuário ainda não criou imóveis. Se já é cliente, peça pra completar o onboarding."
          />
        ) : (
          <AdminCard variant="default" style={{ padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--admin-divider)" }}>
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
                    className="urban-admin-row"
                    style={{ borderBottom: "1px solid var(--admin-divider)" }}
                  >
                    <Td>
                      <strong style={{ color: "var(--admin-text)" }}>{p.propertyName}</strong>
                      <br />
                      <code style={{ fontSize: 11, color: "var(--admin-text-dim)" }}>
                        {p.id.slice(0, 8)}…
                      </code>
                    </Td>
                    <Td>
                      {p.city ? (
                        <span style={{ color: "var(--admin-text)" }}>
                          {p.city}/{p.state}
                        </span>
                      ) : (
                        <AdminBadge kind="error">A definir</AdminBadge>
                      )}
                    </Td>
                    <Td align="right">
                      {p.manualDailyPrice ? (
                        <span style={{ fontFamily: "monospace" }}>
                          R$ {Number(p.manualDailyPrice).toLocaleString("pt-BR")}
                        </span>
                      ) : (
                        <span style={{ color: "var(--admin-text-dim)" }}>—</span>
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
                        style={{
                          color: "var(--admin-text-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          padding: 4,
                        }}
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
      <section style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--admin-divider)" }}>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Atalhos" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
            ? "Esse usuário ganhará acesso completo ao painel admin. Confirmar?"
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--admin-text-muted)",
          margin: 0,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 13, color: "var(--admin-text)", margin: "4px 0 0", fontWeight: 500 }}>
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
