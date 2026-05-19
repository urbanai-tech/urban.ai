"use client";

import { useEffect, useState } from "react";
import { api } from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminMetricCard,
  AdminButton,
  AdminBadge,
  AdminEmptyState,
  AdminPageLoading,
  AdminStatusDot,
  AdminConfirmDialog,
  useAdminToast,
  Icons,
} from "../_components";

/**
 * /admin/onboarding-drip — observability + trigger manual do drip D1/D3/D7.
 *
 * Backend (gap H9): `OnboardingDripService` ja existe + endpoint
 * `POST /admin/onboarding-drip/run-now` retorna `{ d1, d3, d7 }` com
 * `{ eligible, sent, failed, skipped }`.
 *
 * Esta tela:
 *  - Mostra estado do cron (proximo agendamento, ultima execucao)
 *  - 4 KPIs por dia (eligible/sent/failed/skipped)
 *  - Botao "Disparar agora" — chama o endpoint manual com confirmacao
 *  - Resultado da ultima execucao com expand para detalhes por dia
 *
 * Cobre gap "observability operacional" do roadmap (operador entende
 * por que e-mails nao saem sem abrir terminal/log).
 */

type DripDayResult = {
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
};

type DripRunResult = {
  d1: DripDayResult;
  d3: DripDayResult;
  d7: DripDayResult;
  ranAt?: string;
};

export default function AdminOnboardingDripPage() {
  const [lastRun, setLastRun] = useState<DripRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useAdminToast();

  useEffect(() => {
    // Hoje o backend nao expoe GET de "ultima execucao" — so o trigger manual.
    // Carregamento inicial so confirma autenticacao admin via /admin/overview.
    (async () => {
      try {
        await api.get("/admin/overview");
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; message?: string };
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          setError("Acesso negado. Você precisa ser admin.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleRunNow() {
    setRunning(true);
    try {
      const r = await api.post("/admin/onboarding-drip/run-now");
      const result = r.data as DripRunResult;
      result.ranAt = new Date().toISOString();
      setLastRun(result);
      const total = sum(result);
      toast.success(
        `Drip executado: ${total.sent} enviados, ${total.failed} falhas, ${total.skipped} pulados.`,
      );
      setConfirmRun(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error("Erro: " + (e?.response?.data?.message ?? e?.message ?? "falhou"));
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <AdminPageLoading />;

  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Acesso negado"
          title="Falha na autenticação"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · ONBOARDING DRIP"
        title="E-mails D+1 · D+3 · D+7"
        subtitle="Cron diário 10h UTC envia recomendações adaptadas a quem fez signup há 1, 3 ou 7 dias. Idempotente — não re-envia."
        actions={
          <AdminButton
            variant="primary"
            onClick={() => setConfirmRun(true)}
            leftIcon={<Icons.Zap size={12} />}
            loading={running}
          >
            Disparar agora
          </AdminButton>
        }
      />

      {/* Cron status */}
      <section style={{ marginBottom: 32 }}>
        <AdminCard variant="subtle">
          <AdminCardHeader
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AdminStatusDot kind="success" size={8} /> Cron ativo
              </span>
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 24,
              fontSize: 13,
              color: "var(--admin-text-muted)",
            }}
          >
            <FieldRow label="Agendamento" value="0 10 * * * (10h UTC)" />
            <FieldRow label="Idempotência" value="onboardingDripLastDay" />
            <FieldRow label="Janela D+N" value="[now - N, now - N + 1]" />
            <FieldRow
              label="Templates"
              value="email/templates.ts"
              code
            />
          </div>
        </AdminCard>
      </section>

      {/* Última execução */}
      <section style={{ marginBottom: 32 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 20 }}>
          ÚLTIMA EXECUÇÃO {lastRun?.ranAt ? `· ${new Date(lastRun.ranAt).toLocaleString("pt-BR")}` : "· nenhuma execução manual desta sessão"}
        </p>
        {!lastRun ? (
          <AdminEmptyState
            title="Nenhuma execução manual ainda"
            body="Use o botão 'Disparar agora' acima para testar o fluxo. Em produção, o cron roda automaticamente todos os dias às 10h UTC."
            action={
              <AdminButton
                variant="secondary"
                onClick={() => setConfirmRun(true)}
                leftIcon={<Icons.Zap size={12} />}
              >
                Disparar drip agora
              </AdminButton>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Resumo agregado */}
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
              <AdminMetricCard
                label="Total elegível"
                value={sum(lastRun).eligible}
                sub="usuários nas janelas D+1, D+3, D+7"
              />
              <AdminMetricCard
                label="Total enviado"
                value={sum(lastRun).sent}
                status="success"
              />
              <AdminMetricCard
                label="Total falhou"
                value={sum(lastRun).failed}
                status={sum(lastRun).failed > 0 ? "error" : "neutral"}
              />
              <AdminMetricCard
                label="Total pulado (idempotência)"
                value={sum(lastRun).skipped}
              />
            </div>

            {/* Detalhe por dia */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              <DayCard
                day={1}
                desc="Lembra que o motor está coletando + sugere cadastrar primeiro imóvel se vazio."
                result={lastRun.d1}
              />
              <DayCard
                day={3}
                desc="Mostra primeiras recomendações ou explica por que ainda não apareceram."
                result={lastRun.d3}
              />
              <DayCard
                day={7}
                desc="Foco em conversão pra plano pago se ainda não tem assinatura ativa."
                result={lastRun.d7}
              />
            </div>
          </div>
        )}
      </section>

      {/* Como funciona */}
      <section style={{ marginBottom: 32 }}>
        <AdminCard variant="default">
          <AdminCardHeader title="Como o cron decide quem recebe" />
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: "var(--admin-text-muted)",
              lineHeight: 1.7,
            }}
          >
            <li>
              Todos os dias às 10h UTC, query usuários ativos criados nas janelas
              [hoje−1, hoje−0), [hoje−3, hoje−2) e [hoje−7, hoje−6).
            </li>
            <li>
              Pra cada usuário, verifica <code style={{ color: "var(--admin-accent)" }}>onboardingDripLastDay</code>. Se já recebeu D≥N, pula (idempotência).
            </li>
            <li>
              Calcula contexto: número de imóveis, recomendações futuras, assinatura ativa.
              Escolhe variante de copy adaptativa (sem imóvel → CTA cadastrar; sem assinatura no D+7 → CTA planos).
            </li>
            <li>
              Dispara via Brevo best-effort. Se falhar, conta como{" "}
              <code style={{ color: "var(--admin-danger)" }}>failed</code> mas não bloqueia os próximos.
            </li>
            <li>
              Atualiza <code style={{ color: "var(--admin-accent)" }}>onboardingDripLastSentAt</code> + <code style={{ color: "var(--admin-accent)" }}>onboardingDripLastDay</code>.
            </li>
          </ol>
        </AdminCard>
      </section>

      <AdminConfirmDialog
        open={confirmRun}
        onClose={() => setConfirmRun(false)}
        onConfirm={handleRunNow}
        loading={running}
        title="Disparar drip de onboarding agora?"
        body="Vai chamar processAll() do OnboardingDripService — D+1, D+3 e D+7 em sequência. Usuários que já receberam são pulados por idempotência. Recomendado: usar em smoke pós-deploy ou debug."
        confirmLabel="Disparar drip"
      />
    </div>
  );
}

function sum(r: DripRunResult): DripDayResult {
  return {
    eligible: r.d1.eligible + r.d3.eligible + r.d7.eligible,
    sent: r.d1.sent + r.d3.sent + r.d7.sent,
    failed: r.d1.failed + r.d3.failed + r.d7.failed,
    skipped: r.d1.skipped + r.d3.skipped + r.d7.skipped,
  };
}

function DayCard({
  day,
  desc,
  result,
}: {
  day: number;
  desc: string;
  result: DripDayResult;
}) {
  const issues = result.failed > 0;
  return (
    <AdminCard variant={issues ? "accent" : "subtle"}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <p className="urban-admin-eyebrow" style={{ margin: 0 }}>
          DIA D+{day}
        </p>
        <AdminBadge kind={issues ? "warn" : "success"}>
          {result.sent} enviados
        </AdminBadge>
      </header>
      <p
        style={{
          fontSize: 12,
          color: "var(--admin-text-muted)",
          lineHeight: 1.55,
          margin: "0 0 16px",
        }}
      >
        {desc}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
        }}
      >
        <SmallStat label="Elegíveis" value={result.eligible} />
        <SmallStat label="Enviados" value={result.sent} kind="success" />
        <SmallStat
          label="Falhou"
          value={result.failed}
          kind={result.failed > 0 ? "error" : "neutral"}
        />
        <SmallStat label="Pulado" value={result.skipped} />
      </div>
    </AdminCard>
  );
}

function SmallStat({
  label,
  value,
  kind = "neutral",
}: {
  label: string;
  value: number;
  kind?: "success" | "error" | "neutral";
}) {
  const color =
    kind === "success"
      ? "var(--admin-success)"
      : kind === "error"
        ? "var(--admin-danger)"
        : "var(--admin-text)";
  return (
    <div>
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
      <p
        style={{
          fontSize: 22,
          fontWeight: 600,
          color,
          margin: "4px 0 0",
          fontFamily: "'Bebas Neue', Inter, sans-serif",
          letterSpacing: -0.3,
        }}
      >
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function FieldRow({ label, value, code }: { label: string; value: string; code?: boolean }) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 4 }}>
        {label}
      </p>
      {code ? (
        <code style={{ fontSize: 12, color: "var(--admin-accent)" }}>{value}</code>
      ) : (
        <p style={{ fontSize: 13, color: "var(--admin-text)", margin: 0, fontWeight: 500 }}>
          {value}
        </p>
      )}
    </div>
  );
}
