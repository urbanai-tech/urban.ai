"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import {
  acceptWaitlistInvite,
  validateWaitlistInvite,
  type WaitlistInviteValidation,
} from "../../service/api";
import { trackAnalyticsEvent } from "../../componentes/Analytics";
import { AuthFlowShell } from "../../componentes/AuthFlowShell";
import { AppButton, AppCard, AppInput, Icons } from "../../componentes/ui";

type PasswordChecks = {
  lower: boolean;
  upper: boolean;
  number: boolean;
  special: boolean;
  length: boolean;
  match: boolean;
};

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function AceitarConvitePage() {
  return (
    <Suspense
      fallback={
        <InviteShell title="Carregando convite." subtitle="Estamos preparando sua ativacao.">
          <LoadingCard label="Carregando..." />
        </InviteShell>
      }
    >
      <AceitarConvite />
    </Suspense>
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const checks: PasswordChecks = useMemo(
    () => ({
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*]/.test(password),
      length: password.length >= 8,
      match: password.length > 0 && password === confirmPassword,
    }),
    [password, confirmPassword],
  );

  const canSubmit = Object.values(checks).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !validation) return;

    setSubmitting(true);
    setSubmitError("");
    trackAnalyticsEvent("waitlist_invite_accept_attempt", {
      source: "waitlist-invite",
    });

    try {
      const hashedPassword = await sha256(password);
      await acceptWaitlistInvite({
        token,
        username: validation.name ?? validation.email?.split("@")[0],
        password: hashedPassword,
      });
      trackAnalyticsEvent("waitlist_invite_accept", {
        source: "waitlist-invite",
      });
      router.push("/dashboard");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Nao foi possivel ativar sua conta. Tente novamente ou fale com o suporte.";
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

  if (loading) {
    return (
      <InviteShell title="Validando convite." subtitle="Aguarde um instante para continuarmos.">
        <LoadingCard label="Validando seu convite..." />
      </InviteShell>
    );
  }

  if (!validation?.valid) {
    return (
      <InviteShell
        title="Link indisponivel."
        subtitle="Este convite pode ter expirado, ja ter sido usado ou estar incompleto."
      >
        <AppCard variant="elevated" style={{ padding: 28 }}>
          <InlineNotice kind="error">
            {validation?.reason ?? "Este link de convite esta expirado ou ja foi usado."}
          </InlineNotice>
          <AppButton
            variant="primary"
            size="md"
            onClick={() => router.push("/lancamento")}
            leftIcon={<Icons.ArrowLeft size={14} />}
            style={{ marginTop: 20 }}
          >
            Voltar ao pre-lancamento
          </AppButton>
        </AppCard>
      </InviteShell>
    );
  }

  const firstName = validation.name?.split(" ")[0];
  const heroTitle = firstName
    ? `Bem-vindo, ${firstName}.`
    : validation.email
      ? `Bem-vindo, ${validation.email.split("@")[0]}.`
      : "Bem-vindo a Urban AI.";
  const positionLabel = validation.position
    ? `Sua posicao na fila: #${validation.position}.`
    : "Voce foi convidado.";

  return (
    <InviteShell title={heroTitle} subtitle={`${positionLabel} Crie sua senha para ativar o acesso.`}>
      <AppCard variant="elevated" style={{ padding: 28 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <AppInput
            label="E-mail"
            value={validation.email ?? ""}
            readOnly
            helper="Confirmado via convite. Nao pode ser alterado."
            style={{
              background: "var(--app-surface-muted)",
              color: "var(--app-text-muted)",
            }}
          />

          <PasswordInput
            label="Crie sua senha"
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />

          <PasswordInput
            label="Confirme a senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((v) => !v)}
            error={
              confirmPassword.length > 0 && !checks.match
                ? "As senhas nao conferem."
                : undefined
            }
          />

          <PasswordRules checks={checks} />

          {submitError && <InlineNotice kind="error">{submitError}</InlineNotice>}

          <AppButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canSubmit || submitting}
            loading={submitting}
            rightIcon={<Icons.ArrowRight size={14} />}
          >
            Aceitar convite
          </AppButton>
        </form>
      </AppCard>
    </InviteShell>
  );
}

function InviteShell({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AuthFlowShell
      eyebrow="WAITLIST"
      title={title}
      subtitle={subtitle}
      asideEyebrow="CONVITE URBAN AI"
      asideTitle={
        <>
          Acesso{" "}
          <br />
          antecipado.
        </>
      }
      asideSubtitle="Uma ativacao direta, segura e alinhada ao novo painel dos anfitrioes."
    >
      {children}
    </AuthFlowShell>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <AppCard variant="elevated" style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Spinner />
        <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 14 }}>
          {label}
        </p>
      </div>
    </AppCard>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  onToggle,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <AppInput
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite sua senha"
        autoComplete="new-password"
        leftAddon={<LockKeyhole size={14} />}
        error={error}
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        onClick={onToggle}
        style={{
          position: "absolute",
          right: 8,
          top: 27,
          height: 36,
          width: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 8,
          background: "transparent",
          color: "var(--app-text-muted)",
          cursor: "pointer",
        }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function PasswordRules({ checks }: { checks: PasswordChecks }) {
  const rules: Array<[keyof PasswordChecks, string]> = [
    ["lower", "Letra minuscula"],
    ["upper", "Letra maiuscula"],
    ["number", "Numero"],
    ["special", "Caractere especial (!@#$%^&*)"],
    ["length", "Minimo de 8 caracteres"],
    ["match", "Senhas coincidem"],
  ];

  return (
    <div
      style={{
        padding: 16,
        background: "var(--app-surface-muted)",
        border: "1px solid var(--app-divider)",
        borderRadius: 10,
      }}
    >
      <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 650 }}>
        Regras da senha
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {rules.map(([key, label]) => (
          <li
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "3px 0",
              color: checks[key] ? "var(--app-text)" : "var(--app-text-muted)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: checks[key] ? "var(--app-success)" : "var(--app-surface)",
                border: checks[key]
                  ? "1px solid var(--app-success)"
                  : "1px solid var(--app-divider-strong)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {checks[key] ? <Icons.Check size={10} /> : null}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineNotice({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  const color = kind === "success" ? "var(--app-success)" : "var(--app-danger)";
  const bg = kind === "success" ? "rgba(22, 160, 107, 0.08)" : "rgba(194, 52, 46, 0.08)";
  const border =
    kind === "success" ? "rgba(22, 160, 107, 0.22)" : "rgba(194, 52, 46, 0.22)";

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {kind === "success" ? <Icons.Check size={14} /> : <Icons.AlertCircle size={14} />}
      <span>{children}</span>
    </div>
  );
}

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
          width: 28,
          height: 28,
          border: "3px solid var(--app-accent-soft)",
          borderTopColor: "var(--app-accent)",
          borderRadius: "50%",
          animation: "urban-spin 0.9s linear infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}
