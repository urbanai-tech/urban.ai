'use client';

import { motion } from "framer-motion";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import "../../../i18n";
import { api, verificarUsuarioState } from "../service/api";
import { trackEvent } from "../service/tracking";

/**
 * /(home) — Tela de login.
 *
 * Reescrita 2026-05-16 (sprint design premium):
 *  - Split 50/50 cinematic: esquerda manifesto editorial dark (Bebas Neue
 *    220px, grain, glow accent), direita form light premium com inputs
 *    border-bottom only e CTA #E8500A.
 *  - Substituido bg="#1C1D3B" (azul escuro hex) por accent oficial #E8500A.
 *  - Eliminado Chakra UI dessa tela — Inter + Bebas Neue inline, tokens
 *    do design system .urban-app.
 *  - Primeira impressao do produto = manifesto direto, sem SaaS genérico.
 */

const MotionDiv = motion.div;

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Login() {
  const router = useRouter();
  const { t, ready } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPwd, setFocusPwd] = useState(false);

  useEffect(() => {
    console.log(t("not_member"), ready);
  }, [t, ready]);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      toast("Preencha e-mail e senha.", { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      const hashedPassword = await sha256(password);
      await api.post("/auth/login", { email, password: hashedPassword });

      try {
        const { data } = await verificarUsuarioState(email);
        toast("Autenticação concluída.", { type: "success" });
        void trackEvent("login_success", {
          method: "password",
          user_active: !!data?.ativo,
        });
        if (data.ativo) router.replace("/post-login");
        else router.replace("/confirm-email/" + email);
      } catch (err) {
        toast("Não foi possível concluir a autenticação.", { type: "error" });
        console.error("Erro ao verificar usuário:", err);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        toast.error(t("error.invalidCredentials"));
      } else {
        toast.error(t("error.unknown"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="urban-app"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        background: "var(--app-bg)",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* ============== ESQUERDA — manifesto editorial dark ============== */}
      <div
        className="urban-manifesto urban-grain"
        style={{
          display: "none",
          position: "relative",
          width: "50%",
          minHeight: "100vh",
          background: "#080A0F",
          color: "#FFFFFF",
          overflow: "hidden",
        }}
        data-login-side
      >
        <div
          className="urban-glow"
          style={{
            width: 800,
            height: 800,
            top: "-15%",
            left: "-20%",
            position: "absolute",
          }}
        />
        <div
          className="urban-glow"
          style={{
            width: 600,
            height: 600,
            bottom: "-15%",
            right: "-15%",
            position: "absolute",
          }}
        />

        {/* Wordmark URBAN AI no topo */}
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 48,
            zIndex: 2,
            display: "flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <span
            className="urban-display"
            style={{
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: 0,
              textTransform: "uppercase",
              color: "#FFFFFF",
              lineHeight: 1,
            }}
          >
            URBAN
          </span>
          <span
            className="urban-display"
            style={{
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: 0,
              textTransform: "uppercase",
              color: "#E8500A",
              lineHeight: 1,
            }}
          >
            AI
          </span>
        </div>

        {/* Hero text vertical center */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 64px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#E8500A",
              fontWeight: 600,
              margin: 0,
              marginBottom: 28,
            }}
          >
            PRECIFICAÇÃO POR EVENTOS
          </p>
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h1
              className="urban-display"
              style={{
                fontSize: "clamp(64px, 8vw, 140px)",
                lineHeight: 0.88,
                letterSpacing: "-1.5px",
                fontWeight: 400,
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              CADA NOITE
              <br />
              QUE A CIDADE
              <br />
              <span style={{ color: "#E8500A" }}>SE MEXE,</span>
              <br />
              VOCÊ GANHA.
            </h1>
          </MotionDiv>
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            style={{ marginTop: 40, maxWidth: 480 }}
          >
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.65,
                fontWeight: 300,
                color: "rgba(255,255,255,0.65)",
                margin: 0,
              }}
            >
              A Urban AI monitora 5.000+ eventos na sua região e ajusta o preço
              das suas diárias no momento certo. Você só precisa entrar.
            </p>
          </MotionDiv>
        </div>

        {/* Pull-quote rodapé */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 64,
            right: 64,
            zIndex: 2,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
            fontWeight: 500,
          }}
        >
          <span>SÃO PAULO · BETA PRIVADO</span>
          <span>v.2026.05</span>
        </div>
      </div>

      {/* ============== DIREITA — form light premium ============== */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: "var(--app-bg)",
        }}
      >
        <MotionDiv
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          style={{ width: "100%", maxWidth: 420 }}
        >
          {/* Mobile-only logo */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 32,
            }}
            data-mobile-only-logo
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                className="urban-app-display"
                style={{
                  fontSize: 28,
                  fontWeight: 400,
                  textTransform: "uppercase",
                  color: "var(--app-text)",
                  lineHeight: 1,
                }}
              >
                URBAN
              </span>
              <span
                className="urban-app-display"
                style={{
                  fontSize: 28,
                  fontWeight: 400,
                  textTransform: "uppercase",
                  color: "var(--app-accent)",
                  lineHeight: 1,
                }}
              >
                AI
              </span>
            </div>
          </div>

          <p className="urban-app-eyebrow" style={{ marginBottom: 14 }}>
            ENTRAR · ANFITRIÃO
          </p>
          <h2
            className="urban-app-display"
            style={{
              fontSize: 48,
              lineHeight: 1,
              letterSpacing: "-0.5px",
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
              color: "var(--app-text)",
            }}
          >
            Bem-vindo
            <br />
            <span style={{ color: "var(--app-accent)" }}>de volta.</span>
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--app-text-muted)",
              lineHeight: 1.6,
              margin: "16px 0 36px",
            }}
          >
            Entre com seu e-mail e senha para acessar suas recomendações.
          </p>

          <form
            onSubmit={handleLogin}
            style={{ display: "flex", flexDirection: "column", gap: 24 }}
          >
            {/* Email */}
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: focusEmail
                    ? "var(--app-accent)"
                    : "var(--app-text-muted)",
                  marginBottom: 8,
                  transition: "color 120ms",
                }}
              >
                E-mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
                placeholder="voce@email.com"
                autoComplete="email"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  background: "transparent",
                  border: "none",
                  borderBottom: focusEmail
                    ? "1.5px solid var(--app-accent)"
                    : "1.5px solid var(--app-divider-strong)",
                  color: "var(--app-text)",
                  fontSize: 16,
                  fontWeight: 400,
                  outline: "none",
                  transition: "border-color 150ms",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              />
            </label>

            {/* Senha */}
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: focusPwd
                    ? "var(--app-accent)"
                    : "var(--app-text-muted)",
                  marginBottom: 8,
                  transition: "color 120ms",
                }}
              >
                Senha
              </span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusPwd(true)}
                  onBlur={() => setFocusPwd(false)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "14px 36px 14px 0",
                    background: "transparent",
                    border: "none",
                    borderBottom: focusPwd
                      ? "1.5px solid var(--app-accent)"
                      : "1.5px solid var(--app-divider-strong)",
                    color: "var(--app-text)",
                    fontSize: 16,
                    fontWeight: 400,
                    outline: "none",
                    transition: "border-color 150ms",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "var(--app-text-muted)",
                    cursor: "pointer",
                    padding: 8,
                    lineHeight: 0,
                  }}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            {/* Forgot + create */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                fontSize: 13,
              }}
            >
              <NextLink
                href="/request-reset-password"
                style={{
                  color: "var(--app-text-muted)",
                  textDecoration: "none",
                  fontWeight: 500,
                  borderBottom: "1px solid transparent",
                  transition: "color 120ms, border-color 120ms",
                }}
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
                style={{
                  color: "var(--app-accent)",
                  textDecoration: "none",
                  fontWeight: 600,
                  borderBottom: "1px solid transparent",
                  transition: "border-color 120ms",
                }}
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
              style={{
                marginTop: 12,
                height: 56,
                padding: "0 28px",
                background: "var(--app-accent)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 0.3,
                cursor: loading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                transition: "background 180ms, transform 80ms",
                fontFamily: "Inter, system-ui, sans-serif",
                boxShadow: loading
                  ? "none"
                  : "0 8px 24px rgba(232, 80, 10, 0.20)",
              }}
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

          <p
            style={{
              marginTop: 40,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--app-text-dim)",
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            Beta privado · São Paulo
          </p>
        </MotionDiv>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar
        closeOnClick
        pauseOnHover
        theme="light"
        toastStyle={{
          borderRadius: 10,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 500,
        }}
      />

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
  return (
    <span
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        border: "2px solid rgba(255,255,255,0.4)",
        borderTopColor: "#FFFFFF",
        borderRadius: "50%",
        animation: "urban-spin 0.7s linear infinite",
      }}
    >
      <style jsx>{`
        @keyframes urban-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </span>
  );
}
