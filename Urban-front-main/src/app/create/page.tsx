"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import "../../../i18n";
import { ToastContainer, toast } from "react-toastify";
import { api } from "../service/api";
import { usePrelaunch } from "../componentes/usePrelaunch";
import { WaitlistSignup } from "../componentes/WaitlistSignup";
import {
  AppButton,
  AppCard,
  AppInput,
  AppSectionHeader,
  Icons,
} from "../componentes/ui";

const MotionDiv = motion.div;

// Função de hash
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * /create — tela de signup do anfitriao Urban AI.
 *
 * MIGRADA no Sprint 3 do redesign anfitriao:
 *  - bg="#1C1D3B" (azul escuro hex) -> AppButton primary (accent #E8500A).
 *  - color="blue.500" link -> AppButton ghost com cor accent.
 *  - Card de regras de senha bg="gray.50" + CheckCircleIcon green.500 ->
 *    CheckList custom com Icons.Check + var(--app-success).
 *  - Loading prelaunch bg="#f8fafb" -> bg neutro var(--app-bg).
 *  - Inputs Chakra -> AppInput com label persistente.
 *  - Painel esquerdo: imagem mantida + overlay editorial leve.
 */
const PASSWORD_RULES: { key: keyof PasswordChecks; label: string }[] = [
  { key: "lower", label: "Pelo menos uma letra minúscula" },
  { key: "upper", label: "Pelo menos uma letra maiúscula" },
  { key: "number", label: "Pelo menos um número" },
  { key: "special", label: "Pelo menos um caractere especial (!@#$%^&*)" },
  { key: "length", label: "Mínimo de 8 caracteres" },
];

type PasswordChecks = {
  lower: boolean;
  upper: boolean;
  number: boolean;
  special: boolean;
  length: boolean;
};

const Register = () => {
  const router = useRouter();
  const { loading: prelaunchLoading, prelaunchMode } = usePrelaunch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Hooks SEMPRE no topo. Gating depois.
  const checks: PasswordChecks = useMemo(
    () => ({
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*]/.test(password),
      length: password.length >= 8,
    }),
    [password],
  );

  const match = useMemo(
    () => password.length > 0 && password === confirmPassword,
    [password, confirmPassword],
  );

  const satisfiedCount = useMemo(
    () => Object.values(checks).filter(Boolean).length,
    [checks],
  );

  const strength = useMemo(() => {
    if (satisfiedCount <= 2) return "Fraca";
    if (satisfiedCount <= 4) return "Média";
    return "Forte";
  }, [satisfiedCount]);

  const canSubmit = useMemo(() => {
    const allRulesOk = Object.values(checks).every(Boolean);
    return !loading && allRulesOk && match && !!email && !!username;
  }, [checks, match, email, username, loading]);

  // F8: durante prelaunch, /create vira waitlist em vez de signup tradicional.
  if (prelaunchLoading) {
    return (
      <div
        className="urban-app"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--app-bg)",
        }}
      >
        <p style={{ color: "var(--app-text-muted)", fontSize: 14 }}>
          Carregando…
        </p>
      </div>
    );
  }
  if (prelaunchMode) {
    return (
      <div
        className="urban-app"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--app-bg)",
          padding: 16,
        }}
      >
        <WaitlistSignup source="create-signup" />
      </div>
    );
  }

  const handleRegister = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      const hashedPassword = await sha256(password);

      await api.post("/auth/register", {
        email,
        username,
        password: hashedPassword,
      });

      await api.post("/auth/login", {
        email,
        password: hashedPassword,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("lastRegisterEmail", email);
      }

      toast("Conta criada com sucesso! Carregando seu painel...", {
        type: "success",
      });

      setTimeout(() => {
        router.push("/post-login");
      }, 1500);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || err.message || "Erro desconhecido.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="urban-app"
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--app-bg)",
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      {/* Painel esquerdo: imagem + overlay editorial discreto */}
      <div
        style={{
          display: "none",
          width: "50%",
          height: "100vh",
          position: "relative",
        }}
        className="urban-create-side"
      >
        <Image
          src="/urbanai_only.png"
          alt="Urban AI"
          fill
          priority
          style={{ objectFit: "cover" }}
          sizes="50vw"
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8,10,15,0.0) 0%, rgba(8,10,15,0.45) 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 40,
            bottom: 40,
            color: "#fff",
            maxWidth: 360,
            pointerEvents: "none",
          }}
        >
          <p
            className="urban-app-eyebrow"
            style={{ color: "#fff", opacity: 0.85, marginBottom: 12 }}
          >
            BEM-VINDO À URBAN AI
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1.45,
              letterSpacing: -0.1,
            }}
          >
            Preços otimizados, anúncios sincronizados e ROI mensurado em um só
            lugar.
          </p>
        </div>
      </div>

      {/* Painel direito: formulário */}
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--app-bg)",
          overflowY: "auto",
        }}
        className="urban-create-form"
      >
        <MotionDiv
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            width: "100%",
            maxWidth: 480,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Image
              alt="Urban AI"
              src="/urban-logo-transparent-soft.png"
              width={180}
              height={56}
              priority
              style={{ height: "auto" }}
            />
          </div>

          <AppSectionHeader
            eyebrow="CADASTRO · ANFITRIÃO"
            title="Criar conta"
            subtitle="Preencha seus dados para começar a usar a Urban AI."
            size="sm"
          />

          <AppCard variant="elevated" style={{ padding: 28 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <AppInput
                label="Nome de usuário"
                value={username}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Seu usuário"
                autoComplete="username"
                leftAddon={<Icons.Sparkles size={13} />}
              />
              <AppInput
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail"
                autoComplete="email"
                leftAddon={<span style={{ fontSize: 13 }}>@</span>}
              />
              <PasswordField
                label="Senha"
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword((s) => !s)}
                placeholder="Digite sua senha"
              />
              <PasswordField
                label="Confirmar senha"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((s) => !s)}
                placeholder="Repita a senha"
                helper={
                  confirmPassword.length > 0
                    ? match
                      ? "As senhas coincidem."
                      : undefined
                    : undefined
                }
                error={
                  confirmPassword.length > 0 && !match
                    ? "As senhas não conferem."
                    : undefined
                }
              />
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 16,
                background: "var(--app-surface-muted)",
                border: "1px solid var(--app-divider)",
                borderRadius: 10,
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--app-text)",
                }}
              >
                Regras da senha
              </p>
              <ul
                style={{ listStyle: "none", padding: 0, margin: 0 }}
                aria-live="polite"
              >
                {PASSWORD_RULES.map((rule) => (
                  <RuleRow
                    key={rule.key}
                    ok={checks[rule.key]}
                    label={rule.label}
                  />
                ))}
                <RuleRow ok={match} label="As senhas devem coincidir" />
              </ul>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--app-text-muted)",
                }}
              >
                Força:{" "}
                <strong
                  style={{
                    color:
                      strength === "Forte"
                        ? "var(--app-success)"
                        : strength === "Média"
                          ? "var(--app-warning)"
                          : "var(--app-danger)",
                  }}
                >
                  {strength}
                </strong>
              </p>
            </div>

            <AppButton
              variant="primary"
              size="lg"
              fullWidth
              disabled={!canSubmit}
              loading={loading}
              onClick={handleRegister}
              rightIcon={<Icons.ArrowRight size={14} />}
              style={{ marginTop: 20 }}
            >
              {loading ? "Criando…" : "Criar conta"}
            </AppButton>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Link
                href="/"
                style={{
                  fontSize: 13,
                  color: "var(--app-accent)",
                  fontWeight: 600,
                  textDecoration: "none",
                  letterSpacing: 0.2,
                }}
              >
                Já tem conta? Entrar
              </Link>
            </div>
          </AppCard>
        </MotionDiv>
      </div>

      <ToastContainer />

      {/* Responsividade do painel esquerdo via CSS escopado */}
      <style>{`
        @media (min-width: 768px) {
          .urban-create-side { display: block !important; }
          .urban-create-form { width: 50% !important; }
        }
      `}</style>
    </div>
  );
};

export default Register;

/* ============================================================== */
/* Helpers locais                                                    */
/* ============================================================== */

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        padding: "3px 0",
        color: ok ? "var(--app-text)" : "var(--app-text-muted)",
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: ok ? "var(--app-success)" : "var(--app-surface)",
          border: ok
            ? "1px solid var(--app-success)"
            : "1px solid var(--app-divider-strong)",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {ok ? <Icons.Check size={10} /> : null}
      </span>
      {label}
    </li>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  helper,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  helper?: string;
  error?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <AppInput
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        helper={helper}
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
          top: 30, // alinha com input (label acima)
          height: 36,
          width: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          borderRadius: 8,
          color: "var(--app-text-muted)",
          cursor: "pointer",
        }}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.86 19.86 0 0 1-3.16 4.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
