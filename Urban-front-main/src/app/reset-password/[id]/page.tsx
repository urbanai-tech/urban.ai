"use client";

import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { AuthFlowShell } from "@/app/componentes/AuthFlowShell";
import { AppButton, AppCard, AppInput, Icons } from "@/app/componentes/ui";
import { updatePassword } from "@/app/service/api";
import { useToastCustom } from "@/hooks/useToastCustom";

const PASSWORD_RULES: { key: keyof PasswordChecks; label: string }[] = [
  { key: "lower", label: "Letra minuscula" },
  { key: "upper", label: "Letra maiuscula" },
  { key: "number", label: "Numero" },
  { key: "special", label: "Caractere especial (!@#$%^&*)" },
  { key: "length", label: "Minimo de 8 caracteres" },
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

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PasswordConfirmation() {
  const router = useRouter();
  const params = useParams();
  const { showToastCustom } = useToastCustom();

  const rawToken = params?.id;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

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
    if (satisfiedCount <= 5) return "Media";
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
      const hashedPassword = await sha256(password);
      const res = await updatePassword(token, hashedPassword);

      if (!res.enviado) {
        throw new Error(res.motivo || "Erro ao confirmar redefinicao de senha");
      }

      showToastCustom("Sua senha foi redefinida com sucesso.", "success");
      setSuccess(true);
    } catch (error: any) {
      showToastCustom(
        error.response?.data?.message || error.message || "Erro ao atualizar senha.",
        "error",
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
      subtitle="Escolha uma senha forte para concluir a redefinicao da sua conta Urban AI."
      asideEyebrow="ACESSO SEGURO"
      asideTitle={
        <>
          Volte ao{" "}
          <br />
          seu painel.
        </>
      }
      asideSubtitle="Depois da troca, o link expira e voce entra normalmente com a nova senha."
    >
      <AppCard variant="elevated" style={{ padding: 28 }}>
        {success ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(22, 160, 107, 0.10)",
                color: "var(--app-success)",
              }}
            >
              <Icons.Check size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.35 }}>
                Senha atualizada
              </h2>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--app-text-muted)",
                  fontSize: 14,
                  lineHeight: 1.65,
                }}
              >
                Agora voce ja pode acessar a Urban AI com sua nova senha.
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
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                  ? "As senhas nao coincidem."
                  : undefined
              }
            />

            <PasswordRulesPanel checks={checks} strength={strength} />

            {!token && (
              <InlineAlert>Link de redefinicao incompleto. Solicite um novo e-mail.</InlineAlert>
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
    <div style={{ position: "relative" }}>
      <AppInput
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite sua senha"
        autoComplete={autoComplete}
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

function PasswordRulesPanel({
  checks,
  strength,
}: {
  checks: PasswordChecks;
  strength: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--app-surface-muted)",
        border: "1px solid var(--app-divider)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>Regras da senha</p>
        <strong
          style={{
            color:
              strength === "Forte"
                ? "var(--app-success)"
                : strength === "Media"
                  ? "var(--app-warning)"
                  : "var(--app-danger)",
            fontSize: 12,
          }}
        >
          {strength}
        </strong>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {PASSWORD_RULES.map((rule) => (
          <li
            key={rule.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "3px 0",
              color: checks[rule.key] ? "var(--app-text)" : "var(--app-text-muted)",
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
                background: checks[rule.key] ? "var(--app-success)" : "var(--app-surface)",
                border: checks[rule.key]
                  ? "1px solid var(--app-success)"
                  : "1px solid var(--app-divider-strong)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
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
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid rgba(194, 52, 46, 0.25)",
        background: "rgba(194, 52, 46, 0.08)",
        color: "var(--app-danger)",
        fontSize: 13,
      }}
    >
      <Icons.AlertCircle size={14} />
      <span>{children}</span>
    </div>
  );
}
