"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  acceptWaitlistInvite,
  validateWaitlistInvite,
  type WaitlistInviteValidation,
} from "../../service/api";
import { trackAnalyticsEvent } from "../../componentes/Analytics";
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppButton,
  AppInput,
  Icons,
} from "../../componentes/ui";

/**
 * Pagina de aceite de convite da waitlist (F8.4).
 *
 * Fluxo:
 *   /waitlist/aceitar?token=<token>
 *
 *   1. Valida token via GET /waitlist/invite
 *   2. Se OK: mostra form para criar senha (email ja vem do backend)
 *   3. Submit chama POST /auth/register com flag de invite_token
 *   4. Backend reconhece, cria User real, marca waitlist como converted
 *   5. Redireciona para /dashboard
 *
 * REDESENHADA no Sprint 3: continuidade visual com /lancamento (manifesto
 * publico dark) mas em light premium do app. Esta tela e o PRIMEIRO contato
 * pago do convidado — precisa ter peso editorial.
 */
export default function AceitarConvitePage() {
  return (
    <Suspense
      fallback={
        <AppPageShell maxWidth={560}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "120px 0",
            }}
          >
            <Spinner />
            <p style={{ color: "var(--app-text-muted)", fontSize: 14 }}>
              Carregando…
            </p>
          </div>
        </AppPageShell>
      }
    >
      <AceitarConvite />
    </Suspense>
  );
}

/** Spinner laranja simples, sem Chakra. */
function Spinner() {
  return (
    <>
      <style>{`
        @keyframes urban-spin { to { transform: rotate(360deg); } }
      `}</style>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 36,
          height: 36,
          border: "3px solid var(--app-accent-soft)",
          borderTopColor: "var(--app-accent)",
          borderRadius: "50%",
          animation: "urban-spin 0.9s linear infinite",
        }}
      />
    </>
  );
}

function AceitarConvite() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [validation, setValidation] = useState<WaitlistInviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setValidation({ valid: false, reason: "Link sem token" });
      setLoading(false);
      return;
    }
    validateWaitlistInvite(token)
      .then((v) => {
        setValidation(v);
        trackAnalyticsEvent(v.valid ? "waitlist_invite_valid" : "waitlist_invite_invalid", {
          reason: v.reason,
        });
      })
      .catch(() => {
        setValidation({ valid: false, reason: "Erro ao validar convite" });
        trackAnalyticsEvent("waitlist_invite_invalid", {
          reason: "validation_request_failed",
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <AppPageShell maxWidth={560}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: "120px 0",
          }}
        >
          <Spinner />
          <p style={{ color: "var(--app-text-muted)", fontSize: 14 }}>
            Validando seu convite…
          </p>
        </div>
      </AppPageShell>
    );
  }

  if (!validation?.valid) {
    return (
      <AppPageShell maxWidth={560}>
        <AppSectionHeader
          eyebrow="WAITLIST · CONVITE INVÁLIDO"
          title="Não conseguimos validar este link"
          subtitle="Pode ter expirado, sido usado ou estar incompleto."
        />
        <AppCard variant="elevated" style={{ padding: 28 }}>
          <div
            role="alert"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              background: "rgba(194, 52, 46, 0.06)",
              border: "1px solid rgba(194, 52, 46, 0.20)",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 24,
            }}
          >
            <span style={{ color: "var(--app-danger)", marginTop: 2 }}>
              <Icons.AlertCircle size={18} />
            </span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--app-text)",
                }}
              >
                Convite inválido
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--app-text-muted)",
                  lineHeight: 1.55,
                }}
              >
                {validation?.reason ??
                  "Este link de convite está expirado ou já foi usado."}
              </p>
            </div>
          </div>
          <AppButton
            variant="primary"
            size="md"
            onClick={() => router.push("/lancamento")}
            leftIcon={<Icons.ArrowLeft size={14} />}
          >
            Voltar ao pré-lançamento
          </AppButton>
        </AppCard>
      </AppPageShell>
    );
  }

  const passwordsMatch = password.length >= 8 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch || !validation) return;
    setSubmitting(true);
    setSubmitError("");
    trackAnalyticsEvent("waitlist_invite_accept_attempt", {
      source: "waitlist-invite",
    });
    try {
      await acceptWaitlistInvite({
        token,
        username: validation.name ?? validation.email?.split("@")[0],
        password,
      });
      trackAnalyticsEvent("waitlist_invite_accept", {
        source: "waitlist-invite",
      });
      router.push("/dashboard");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Não foi possível ativar sua conta. Tente novamente ou fale com o suporte.";
      setSubmitError(message);
      trackAnalyticsEvent("waitlist_invite_accept_error", {
        reason: error?.response?.status
          ? `http_${error.response.status}`
          : error?.message || "unknown",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = validation.name?.split(" ")[0];
  const heroTitle = firstName
    ? `Bem-vindo, ${firstName}.`
    : validation.email
      ? `Bem-vindo, ${validation.email.split("@")[0]}.`
      : "Bem-vindo à Urban AI.";
  const positionLabel = validation.position
    ? `Sua posição na fila: #${validation.position}.`
    : "Você foi convidado.";

  return (
    <AppPageShell maxWidth={560}>
      <AppSectionHeader
        eyebrow="WAITLIST · CONVITE ATIVO"
        title={heroTitle}
        subtitle={`${positionLabel} Aceite e libere acesso completo à plataforma.`}
      />

      <AppCard variant="elevated" style={{ padding: 32 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <AppInput
            label="E-mail"
            value={validation.email ?? ""}
            readOnly
            helper="Confirmado via convite. Não pode ser alterado."
            style={{
              background: "var(--app-surface-muted)",
              color: "var(--app-text-muted)",
            }}
          />

          <AppInput
            label="Crie sua senha"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
          />

          <AppInput
            label="Confirme a senha"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a senha"
            autoComplete="new-password"
            required
            error={
              confirmPassword && !passwordsMatch
                ? "As senhas não conferem."
                : undefined
            }
          />

          {submitError && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "rgba(194, 52, 46, 0.08)",
                border: "1px solid rgba(194, 52, 46, 0.25)",
                borderRadius: 8,
                padding: "10px 14px",
                color: "var(--app-danger)",
                fontSize: 13,
              }}
            >
              <Icons.AlertCircle size={14} />
              <span>{submitError}</span>
            </div>
          )}

          <AppButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!passwordsMatch || submitting}
            loading={submitting}
            rightIcon={<Icons.ArrowRight size={14} />}
            style={{ marginTop: 6 }}
          >
            {submitting ? "Ativando…" : "Aceitar convite"}
          </AppButton>
        </form>
      </AppCard>
    </AppPageShell>
  );
}
