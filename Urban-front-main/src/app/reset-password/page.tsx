"use client";

import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  PENDING_RESET_TOKEN_KEY,
  RESET_PASSWORD_PATH,
  parseResetTokenFromHash,
  scrubCurrentUrl,
} from "@/app/lib/auth-links";
import { AuthFlowShell } from "@/app/componentes/AuthFlowShell";
import { AppButton, AppCard, AppInput, Icons, useAppToast } from "@/app/componentes/ui";
import { updatePassword } from "@/app/service/api";
import styles from "./page.module.css";

const PASSWORD_RULES: { key: keyof PasswordChecks; label: string }[] = [
  { key: "lower", label: "Letra minúscula" },
  { key: "upper", label: "Letra maiúscula" },
  { key: "number", label: "Número" },
  { key: "special", label: "Caractere especial (!@#$%^&*)" },
  { key: "length", label: "Mínimo de 8 caracteres" },
  { key: "match", label: "Senhas coincidem" },
];

type PasswordChecks = {
  lower: boolean;
  upper: boolean;
  number: boolean;
  special: boolean;
  length: boolean;
  match: boolean;
};

export default function PasswordConfirmation() {
  const router = useRouter();
  const toast = useAppToast();

  // Token só em memória: vem do fragmento (`#token=...`, nunca enviado a servidor)
  // ou, para links antigos, da entrega feita pela rota legada /reset-password/<token>.
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  useEffect(() => {
    let found = parseResetTokenFromHash(window.location.hash);
    try {
      const handoff = window.sessionStorage.getItem(PENDING_RESET_TOKEN_KEY);
      if (handoff) window.sessionStorage.removeItem(PENDING_RESET_TOKEN_KEY);
      found = found ?? (handoff?.trim() || null);
    } catch {
      /* sessionStorage indisponível: segue só com o fragmento */
    }
    if (found) setToken(found);
    setTokenChecked(true);
    // Tira o fragmento da URL (histórico, Referer, analytics) imediatamente.
    if (window.location.hash || window.location.search) scrubCurrentUrl(RESET_PASSWORD_PATH);
  }, []);

  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

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

  const satisfiedCount = useMemo(
    () => Object.values(checks).filter(Boolean).length,
    [checks],
  );

  const strength = useMemo(() => {
    if (satisfiedCount <= 3) return "Fraca";
    if (satisfiedCount <= 5) return "Média";
    return "Forte";
  }, [satisfiedCount]);

  const canSubmit = useMemo(
    () => Boolean(token) && !loading && Object.values(checks).every(Boolean),
    [checks, loading, token],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !token) return;

    try {
      setLoading(true);
      // Senha em texto puro sob TLS; o hash é feito só no servidor (ADR 0025).
      const res = await updatePassword(token, password);

      if (!res.enviado) {
        throw new Error(res.motivo || "Erro ao confirmar redefinição de senha");
      }

      toast.success("Sua senha foi redefinida com sucesso.");
      setSuccess(true);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || error.message || "Erro ao atualizar senha.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFlowShell
      eyebrow="NOVA SENHA"
      title={
        <>
          Crie uma{" "}
          <br />
          senha segura.
        </>
      }
      subtitle="Escolha uma senha forte para concluir a redefinição da sua conta My Urban."
      asideEyebrow="ACESSO SEGURO"
      asideTitle={
        <>
          Volte ao{" "}
          <br />
          seu painel.
        </>
      }
      asideSubtitle="Depois da troca, o link expira e você entra normalmente com a nova senha."
    >
      <AppCard variant="elevated" className={styles.formCard}>
        {success ? (
          <div className={styles.successStack}>
            <div className={styles.successIcon}>
              <Icons.Check size={20} />
            </div>
            <div>
              <h2 className={styles.successTitle}>
                Senha atualizada
              </h2>
              <p className={styles.successText}>
                Agora você já pode acessar o My Urban com sua nova senha.
              </p>
            </div>
            <AppButton
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => router.push("/")}
              rightIcon={<Icons.ArrowRight size={14} />}
            >
              Ir para login
            </AppButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.successStack}>
            <PasswordInput
              label="Nova senha"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirmar senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((v) => !v)}
              autoComplete="new-password"
              error={
                confirmPassword.length > 0 && !checks.match
                  ? "As senhas não coincidem."
                  : undefined
              }
            />

            <PasswordRulesPanel checks={checks} strength={strength} />

            {tokenChecked && !token && (
              <InlineAlert>Link de redefinição incompleto. Solicite um novo e-mail.</InlineAlert>
            )}

            <AppButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!canSubmit}
              loading={loading}
              rightIcon={<Icons.ArrowRight size={14} />}
            >
              Confirmar nova senha
            </AppButton>
          </form>
        )}
      </AppCard>
    </AuthFlowShell>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
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
        autoComplete={autoComplete}
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

function PasswordRulesPanel({
  checks,
  strength,
}: {
  checks: PasswordChecks;
  strength: string;
}) {
  return (
    <div className={styles.rulesPanel}>
      <div className={styles.rulesHeader}>
        <p className={styles.rulesTitle}>Regras da senha</p>
        <strong
          className={`${styles.strengthLabel} ${
            strength === "Forte"
              ? styles.strengthStrong
              : strength === "Média"
                ? styles.strengthMedium
                : styles.strengthWeak
          }`}
        >
          {strength}
        </strong>
      </div>
      <ul className={styles.rulesList}>
        {PASSWORD_RULES.map((rule) => (
          <li
            key={rule.key}
            className={`${styles.ruleItem} ${checks[rule.key] ? styles.ruleItemMet : ""}`}
          >
            <span
              aria-hidden
              className={`${styles.ruleMark} ${checks[rule.key] ? styles.ruleMarkMet : ""}`}
            >
              {checks[rule.key] ? <Icons.Check size={10} /> : null}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className={styles.inlineAlert}
    >
      <Icons.AlertCircle size={14} />
      <span>{children}</span>
    </div>
  );
}
