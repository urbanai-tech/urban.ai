"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import "../../../i18n";
import { api } from "../service/api";
import { marketingUrl } from "../lib/marketing-url";
import { TERMS_VERSION } from "../lib/terms";
import { usePrelaunch } from "../componentes/usePrelaunch";
import { WaitlistSignup } from "../componentes/WaitlistSignup";
import { AuthFlowShell } from "../componentes/AuthFlowShell";
import { BrandLogo } from "../componentes/ui/BrandLogo";
import {
  attributionEventParams,
  captureAttribution,
  trackAnalyticsEvent,
} from "../componentes/Analytics";
import {
  AppButton,
  AppCard,
  AppInput,
  AppSectionHeader,
  Icons,
  useToastCompat,
} from "../componentes/ui";
import { stashPendingEmail } from "@/app/lib/auth-links";
import styles from "./create.module.css";

/**
 * /create — tela de signup do anfitrião Urban AI.
 *
 * MIGRADA no Sprint 3 do redesign anfitrião:
 *  - bg="#1C1D3B" (azul escuro hex) -> AppButton primary (accent da marca).
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
  const toast = useToastCompat();
  const { loading: prelaunchLoading, prelaunchMode } = usePrelaunch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
    return !loading && allRulesOk && match && !!email && !!username && acceptedTerms;
  }, [checks, match, email, username, loading, acceptedTerms]);

  // F8: durante prelaunch, /create vira waitlist em vez de signup tradicional.
  if (prelaunchLoading) {
    return (
      <div
        className={`urban-app ${styles.app}`}
      >
        <p className={styles.loadingText}>
          Carregando…
        </p>
      </div>
    );
  }
  if (prelaunchMode) {
    return (
      <AuthFlowShell
        eyebrow="WAITLIST"
        title={
          <>
            Entre na
            <br />
            lista.
          </>
        }
        subtitle="O My Urban ainda está em acesso antecipado. Cadastre seu e-mail para receber um convite quando sua vez chegar."
        asideEyebrow="PRÉ-LANÇAMENTO"
        asideTitle={
          <>
            Abertura
            <br />
            controlada.
          </>
        }
        asideSubtitle="Estamos liberando novos anfitriões em pequenos grupos para acompanhar tudo de perto e manter a qualidade das recomendações."
      >
        <WaitlistSignup source="create-signup" />
      </AuthFlowShell>
    );
  }

  const handleRegister = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      // Senha em texto puro sob TLS; o hash é feito só no servidor (ADR 0025).
      const { data: registerData } = await api.post<{ mode?: string }>("/auth/register", {
        email,
        username,
        password,
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
      });

      if (registerData?.mode && registerData.mode !== "registered") {
        throw new Error("Novos cadastros estão temporariamente indisponíveis. Fale com o suporte do My Urban.");
      }

      // A sessão fica só nos cookies httpOnly definidos pela resposta.
      await api.post("/auth/login", {
        email,
        password,
      });

      toast("Conta criada! Falta confirmar seu e-mail para continuar.", {
        type: "success",
      });
      trackAnalyticsEvent(
        "sign_up",
        { method: "email", ...attributionEventParams(captureAttribution()) },
        { metaEventName: "CompleteRegistration" },
      );

      // E-mail precisa ser verificado antes do onboarding.
      setTimeout(() => {
        stashPendingEmail(email);
        router.push("/confirm-email");
      }, 1200);
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
      className={`urban-app ${styles.appBg}`}
    >
      {/* Painel esquerdo: fundo oficial da marca + lockup (mesmo split do login) */}
      <div
        className={`urban-create-side ${styles.createSide}`}
      >
        <BrandLogo variant="lockup" className={`${styles.sideLogo} urban-brand-logo--force-dark`} />
        <div
          className={styles.sideScrim}
        />
        <div
          className={styles.sideCaption}
        >
          <p
            className={`urban-app-eyebrow ${styles.appEyebrow}`}
          >
            BEM-VINDO AO MY URBAN
          </p>
          <p
            className={styles.sideCaptionText}
          >
            Sugestões de preço, anúncios organizados e resultados acompanhados
            em um só lugar.
          </p>
        </div>
      </div>

      {/* Painel direito: formulário */}
      <div
        className={`urban-create-form ${styles.createForm}`}
      >
        <div
          className={`urban-enter ${styles.enter}`}
        >
          <div
            className={styles.logoRow}
          >
            <BrandLogo variant="wordmark" className={styles.logoImage} priority />
          </div>

          <AppSectionHeader
            eyebrow="CADASTRO · MY URBAN"
            title="Criar conta"
            subtitle="Preencha seus dados para começar a usar o My Urban."
            size="sm"
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleRegister();
            }}
          >
          <AppCard variant="elevated" className={styles.registerCard}>
            <div
              className={styles.fieldGrid}
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
                leftAddon={<span className={styles.emailAddon}>@</span>}
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
              className={styles.passwordRulesPanel}
            >
              <p
                className={styles.passwordRulesTitle}
              >
                Regras da senha
              </p>
              <ul
                className={styles.passwordRulesList}
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
                className={styles.strengthLine}
              >
                Força:{" "}
                <strong
                  className={`${strength === "Forte" ? styles.strengthStrong : strength === "Média" ? styles.strengthMedium : styles.strengthWeak}`}
                >
                  {strength}
                </strong>
              </p>
            </div>

            <label className="funnel-terms">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                aria-required="true"
              />
              <span>
                Li e aceito os{" "}
                <a
                  href={marketingUrl("/termos")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a
                  href={marketingUrl("/privacidade")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Política de Privacidade
                </a>
                .
              </span>
            </label>

            <AppButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!canSubmit}
              loading={loading}
              rightIcon={<Icons.ArrowRight size={14} />}
              className={styles.submitButton}
            >
              {loading ? "Criando…" : "Criar conta"}
            </AppButton>

            <div
              className={styles.loginLinkRow}
            >
              <Link
                href="/login"
                className={styles.loginLink}
              >
                Já tem conta? Entrar
              </Link>
            </div>
          </AppCard>
          </form>
        </div>
      </div>
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
      className={`${styles.ruleRowItem} ${ok ? styles.ruleRowItemOk : styles.ruleRowItemPending}`}
    >
      <span
        aria-hidden
        className={`${styles.ruleRowLabel} ${ok ? styles.ruleRowLabelOk : styles.ruleRowLabelPending}`}
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
    <div className={styles.passwordFieldBox}>
      <AppInput
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        helper={helper}
        error={error}
        className={styles.passwordInput}
      />
      <button
        type="button"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        onClick={onToggle}
        className={styles.passwordFieldButton}
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
