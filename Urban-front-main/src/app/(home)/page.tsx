'use client';

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { useToastCompat } from "../componentes/ui";
import { api, verificarUsuarioState } from "../service/api";
import { trackEvent } from "../service/tracking";
import { stashPendingEmail } from "@/app/lib/auth-links";
import styles from "./page.module.css";

/**
 * /(home) — Tela de login.
 *
 * Reescrita 2026-05-16 (sprint design premium):
 *  - Split 50/50 cinematic: esquerda manifesto editorial dark (Bebas Neue
 *    220px, grain, glow accent), direita form light premium com inputs
 *    border-bottom only e CTA var(--theme-public-accent).
 *  - Substituido bg="#1C1D3B" (azul escuro hex) por accent oficial var(--theme-public-accent).
 *  - Eliminado Chakra UI dessa tela — Inter + Bebas Neue inline, tokens
 *    do design system .urban-app.
 *  - Primeira impressao do produto = manifesto direto, sem SaaS genérico.
 */

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToastCompat();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPwd, setFocusPwd] = useState(false);
  // Erro de login também inline (o toast some sozinho): ligado aos campos por
  // aria-describedby; aria-invalid só nos campos que o erro realmente envolve.
  const [loginError, setLoginError] = useState<{
    message: string;
    email: boolean;
    password: boolean;
  } | null>(null);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoginError(null);
    if (!email.trim() || !password) {
      const message = "Preencha e-mail e senha.";
      setLoginError({ message, email: !email.trim(), password: !password });
      toast(message, { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      // Senha em texto puro sob TLS; o hash é feito só no servidor (ADR 0025).
      // A sessão fica só nos cookies httpOnly definidos pela resposta.
      await api.post("/auth/login", {
        email,
        password,
      });

      try {
        const { data } = await verificarUsuarioState(email);
        toast("Autenticação concluída.", { type: "success" });
        void trackEvent("login_success", {
          method: "password",
          user_active: !!data?.ativo,
        });
        if (data.ativo) router.replace("/post-login");
        else {
          stashPendingEmail(email);
          router.replace("/confirm-email");
        }
      } catch (err) {
        const message = "Não foi possível concluir a autenticação.";
        setLoginError({ message, email: false, password: false });
        toast(message, { type: "error" });
        console.error("Erro ao verificar usuário:", err);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        const message = t("error.invalidCredentials");
        setLoginError({ message, email: true, password: true });
        toast.error(message);
      } else {
        const message = t("error.unknown");
        setLoginError({ message, email: false, password: false });
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`urban-app ${styles.loginRoot}`}>
      {/* ============== ESQUERDA — manifesto editorial dark ============== */}
      <div
        className={`urban-manifesto urban-grain ${styles.manifestoPanel}`}
        data-login-side
      >
        <div className={`urban-glow ${styles.glowTopLeft}`} />
        <div className={`urban-glow ${styles.glowBottomRight}`} />

        {/* Wordmark URBAN AI no topo */}
        <div className={styles.wordmark}>
          <span className={`urban-display ${styles.wordmarkPart} ${styles.wordmarkBrand}`}>
            URBAN
          </span>
          <span className={`urban-display ${styles.wordmarkPart} ${styles.wordmarkAccent}`}>
            AI
          </span>
        </div>

        {/* Hero text vertical center */}
        <div className={styles.hero}>
          <p className={styles.heroEyebrow}>
            PRECIFICAÇÃO POR EVENTOS
          </p>
          <div className={`urban-enter ${styles.heroTitleEnter}`}>
            <h1 className={`urban-display ${styles.heroTitle}`}>
              CADA NOITE
              <br />
              QUE A CIDADE
              <br />
              <span className={styles.heroTitleAccent}>SE MEXE,</span>
              <br />
              VOCÊ GANHA.
            </h1>
          </div>
          <div className={`urban-enter ${styles.heroLeadEnter}`}>
            <p className={styles.heroLead}>
              O My Urban acompanha eventos na sua região e recomenda quando revisar o preço
              das suas diárias. Você só precisa entrar.
            </p>
          </div>
        </div>

        {/* Pull-quote rodapé */}
        <div className={styles.panelFooter}>
          <span>PRECIFICAÇÃO INTELIGENTE · BRASIL</span>
          <span>PRODUTO DISPONÍVEL</span>
        </div>
      </div>

      {/* ============== DIREITA — form light premium ============== */}
      <div className={styles.formPane}>
        <div className={`urban-enter ${styles.formEnter}`}>
          {/* Mobile-only logo */}
          <div className={styles.mobileLogo} data-mobile-only-logo>
            <div className={styles.mobileWordmark}>
              <span className={`urban-app-display ${styles.mobileWordmarkPart} ${styles.mobileWordmarkBrand}`}>
                URBAN
              </span>
              <span className={`urban-app-display ${styles.mobileWordmarkPart} ${styles.mobileWordmarkAccent}`}>
                AI
              </span>
            </div>
          </div>

          <p className={`urban-app-eyebrow ${styles.formEyebrow}`}>
            ENTRAR · ANFITRIÃO
          </p>
          <h2 className={`urban-app-display ${styles.formTitle}`}>
            Bem-vindo
            <br />
            <span className={styles.formTitleAccent}>de volta.</span>
          </h2>
          <p className={styles.formLead}>
            Entre com seu e-mail e senha para acessar suas recomendações.
          </p>

          <form onSubmit={handleLogin} className={styles.form}>
            {/* Email */}
            <label className={styles.field}>
              <span className={`${styles.fieldLabel} ${focusEmail ? styles.fieldLabelFocus : ""}`}>
                E-mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (loginError?.email) setLoginError(null);
                }}
                aria-invalid={loginError?.email ? true : undefined}
                aria-describedby={loginError ? "login-error" : undefined}
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
                placeholder="você@email.com"
                autoComplete="email"
                disabled={loading}
                className={`${styles.fieldInput} ${focusEmail ? styles.fieldInputFocus : ""}`}
              />
            </label>

            {/* Senha */}
            <label className={styles.field}>
              <span className={`${styles.fieldLabel} ${focusPwd ? styles.fieldLabelFocus : ""}`}>
                Senha
              </span>
              <div className={styles.passwordWrap}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError?.password) setLoginError(null);
                  }}
                  aria-invalid={loginError?.password ? true : undefined}
                  aria-describedby={loginError ? "login-error" : undefined}
                  onFocus={() => setFocusPwd(true)}
                  onBlur={() => setFocusPwd(false)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className={`${styles.fieldInput} ${styles.fieldInputPassword} ${focusPwd ? styles.fieldInputFocus : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className={styles.passwordToggle}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            {loginError && (
              <p
                id="login-error"
                role="alert"
                className="urban-form-error"
              >
                {loginError.message}
              </p>
            )}

            {/* Forgot + create */}
            <div className={styles.formLinks}>
              <NextLink
                href="/request-reset-password"
                className={styles.linkMuted}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--app-accent)";
                  e.currentTarget.style.borderBottomColor = "var(--app-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--app-text-muted)";
                  e.currentTarget.style.borderBottomColor = "transparent";
                }}
              >
                Esqueceu a senha?
              </NextLink>
              <NextLink
                href="/create"
                className={styles.linkAccent}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderBottomColor = "var(--app-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderBottomColor = "transparent";
                }}
              >
                Criar conta →
              </NextLink>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className={`${styles.submitButton} ${loading ? styles.submitButtonLoading : ""}`}
              style={loading ? undefined : { boxShadow: "0 8px 24px rgba(232, 80, 10, 0.20)" }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "var(--app-accent-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "var(--app-accent)";
                }
              }}
              onMouseDown={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(1px)";
                }
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {loading ? (
                <Spinner />
              ) : (
                <>
                  Entrar
                  <ArrowRight />
                </>
              )}
            </button>
          </form>

          <p className={styles.secureNote}>
            Acesso seguro · My Urban
          </p>
        </div>
      </div>

      {/* Responsive — só mostra split em desktop */}
      <style jsx global>{`
        @media (min-width: 900px) {
          [data-login-side] {
            display: block !important;
          }
          [data-mobile-only-logo] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// =================== inline icons ===================
function Eye() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a18.46 18.46 0 0 1 4.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a18.47 18.47 0 0 1-2.16 3.19" />
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}
function Spinner() {
  return <span className={styles.spinner} />;
}
