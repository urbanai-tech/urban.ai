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
import styles from "./page.module.css";

type PasswordChecks = {
  lower: boolean;
  upper: boolean;
  number: boolean;
  special: boolean;
  length: boolean;
  match: boolean;
};

export default function AceitarConvitePage() {
  return (
    <Suspense
      fallback={
        <InviteShell title="Carregando convite." subtitle="Estamos preparando sua ativação.">
          <LoadingCard label="Carregando…" />
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
      setValidation({ valid: false, reason: "Este link está incompleto. Peça um novo convite ao suporte." });
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
      // Senha em texto puro sob TLS; o hash é feito só no servidor (ADR 0025).
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

  if (loading) {
    return (
      <InviteShell title="Validando convite." subtitle="Aguarde um instante para continuarmos.">
        <LoadingCard label="Validando seu convite…" />
      </InviteShell>
    );
  }

  if (!validation?.valid) {
    return (
      <InviteShell
        title="Link indisponível."
        subtitle="Este convite pode ter expirado, já ter sido usado ou estar incompleto."
      >
        <AppCard variant="elevated" className={styles.invalidInviteCard}>
          <InlineNotice kind="error">
            {validation?.reason ?? "Este link de convite expirou ou já foi usado."}
          </InlineNotice>
          <AppButton
            variant="primary"
            size="md"
            onClick={() => router.push("/lancamento")}
            leftIcon={<Icons.ArrowLeft size={14} />}
            className={styles.backButton}
          >
            Voltar para o site
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
      : "Bem-vindo ao My Urban.";
  const positionLabel = validation.position
    ? `Sua posição na fila: #${validation.position}.`
    : "Você foi convidado.";

  return (
    <InviteShell title={heroTitle} subtitle={`${positionLabel} Crie sua senha para ativar o acesso.`}>
      <AppCard variant="elevated" className={styles.passwordFormCard}>
        <form onSubmit={handleSubmit} className={styles.passwordForm}>
          <AppInput
            label="E-mail"
            value={validation.email ?? ""}
            readOnly
            helper="Confirmado pelo convite. Não pode ser alterado."
            className={styles.readonlyEmailInput}
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
                ? "As senhas não conferem."
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
      asideEyebrow="CONVITE MY URBAN"
      asideTitle={
        <>
          Acesso{" "}
          <br />
          antecipado.
        </>
      }
      asideSubtitle="Uma ativação simples e segura para acessar o beta do My Urban."
    >
      {children}
    </AuthFlowShell>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <AppCard variant="elevated" className={styles.loadingCard}>
      <div className={styles.loadingRow}>
        <Spinner />
        <p className={styles.loadingText}>{label}</p>
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
    <div className={styles.passwordField}>
      <AppInput
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite sua senha"
        autoComplete="new-password"
        leftAddon={<LockKeyhole size={14} />}
        error={error}
        className={styles.passwordInput}
      />
      <button
        type="button"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        onClick={onToggle}
        className={styles.passwordToggle}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function PasswordRules({ checks }: { checks: PasswordChecks }) {
  const rules: Array<[keyof PasswordChecks, string]> = [
    ["lower", "Letra minúscula"],
    ["upper", "Letra maiúscula"],
    ["number", "Número"],
    ["special", "Caractere especial (!@#$%^&*)"],
    ["length", "Mínimo de 8 caracteres"],
    ["match", "Senhas coincidem"],
  ];

  return (
    <div className={styles.rulesBox}>
      <p className={styles.rulesTitle}>Regras da senha</p>
      <ul className={styles.rulesList}>
        {rules.map(([key, label]) => (
          <li
            key={key}
            className={`${styles.ruleItem} ${checks[key] ? styles.ruleItemMet : ""}`}
          >
            <span
              aria-hidden
              className={`${styles.ruleCheck} ${checks[key] ? styles.ruleCheckMet : ""}`}
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
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`${styles.notice} ${kind === "success" ? styles.noticeSuccess : styles.noticeError}`}
      // Sem token de mesmo valor para a borda de sucesso (verde a 22%): fica inline.
      style={kind === "success" ? { borderColor: "rgba(22, 160, 107, 0.22)" } : undefined}
    >
      {kind === "success" ? <Icons.Check size={14} /> : <Icons.AlertCircle size={14} />}
      <span>{children}</span>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className={styles.spinner} />;
}
