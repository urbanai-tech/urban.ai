"use client";

import Link from "next/link";
import { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { Mail } from "lucide-react";
import { AuthFlowShell } from "@/app/componentes/AuthFlowShell";
import { AppButton, AppCard, AppInput, Icons } from "@/app/componentes/ui";
import { forgotPassword } from "@/app/service/api";

export default function PasswordResetRequest() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Informe um e-mail valido.");
      return;
    }

    try {
      setLoading(true);
      const res = await forgotPassword(trimmedEmail);

      if (res.status !== 201 || !res.data?.enviado) {
        throw new Error(res.data?.motivo || "Nao foi possivel enviar o e-mail.");
      }

      setSentTo(trimmedEmail);
      toast("E-mail enviado.", { type: "success" });
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Erro ao enviar o e-mail de redefinicao.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFlowShell
      eyebrow="ACESSO"
      title={
        <>
          Redefinir{" "}
          <br />
          senha.
        </>
      }
      subtitle="Digite o e-mail da sua conta para receber um link seguro de redefinicao."
      asideEyebrow="SEGURANCA"
      asideTitle={
        <>
          Seu acesso{" "}
          <br />
          protegido.
        </>
      }
      asideSubtitle="Links temporarios, validacao por token e uma experiencia visual alinhada ao novo produto."
    >
      <AppCard variant="elevated" style={{ padding: 28 }}>
        {sentTo ? (
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
              <h2
                style={{
                  margin: 0,
                  color: "var(--app-text)",
                  fontSize: 18,
                  lineHeight: 1.35,
                  fontWeight: 650,
                }}
              >
                E-mail enviado
              </h2>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--app-text-muted)",
                  fontSize: 14,
                  lineHeight: 1.65,
                }}
              >
                Enviamos o link para <strong>{sentTo}</strong>. Ele expira em 30
                minutos.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <AppButton
                variant="secondary"
                size="md"
                type="button"
                onClick={() => {
                  setSentTo("");
                  setEmail("");
                }}
              >
                Enviar novamente
              </AppButton>
              <AppButton
                as="a"
                href="/"
                variant="primary"
                size="md"
                rightIcon={<Icons.ArrowRight size={14} />}
              >
                Ir para login
              </AppButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <AppInput
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              disabled={loading}
              leftAddon={<Mail size={14} />}
            />

            <AppButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              rightIcon={<Icons.ArrowRight size={14} />}
            >
              Enviar link
            </AppButton>

            <p
              style={{
                margin: 0,
                textAlign: "center",
                color: "var(--app-text-muted)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Lembrou a senha?{" "}
              <Link
                href="/"
                style={{
                  color: "var(--app-accent)",
                  fontWeight: 650,
                  textDecoration: "none",
                }}
              >
                Fazer login
              </Link>
            </p>
          </form>
        )}
      </AppCard>

      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar
        closeOnClick
        pauseOnHover
        theme="light"
      />
    </AuthFlowShell>
  );
}
