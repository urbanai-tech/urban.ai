"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";
import { AuthFlowShell } from "@/app/componentes/AuthFlowShell";
import { AppButton, AppCard, AppInput, Icons, useToastCompat } from "@/app/componentes/ui";
import { forgotPassword } from "@/app/service/api";
import styles from "./page.module.css";

export default function PasswordResetRequest() {
  const toast = useToastCompat();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    try {
      setLoading(true);
      const res = await forgotPassword(trimmedEmail);

      if (res.status !== 201 || !res.data?.enviado) {
        throw new Error(res.data?.motivo || "Não foi possível enviar o e-mail.");
      }

      setSentTo(trimmedEmail);
      toast("E-mail enviado.", { type: "success" });
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Erro ao enviar o e-mail de redefinição.",
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
      subtitle="Digite o e-mail da sua conta para receber um link seguro de redefinição."
      asideEyebrow="SEGURANÇA"
      asideTitle={
        <>
          Seu acesso{" "}
          <br />
          protegido.
        </>
      }
      asideSubtitle="Links temporários, validação por token e uma experiência visual alinhada ao novo produto."
    >
      <AppCard variant="elevated" className={styles.formCard}>
        {sentTo ? (
          <div className={styles.stack}>
            <div className={styles.successIcon}>
              <Icons.Check size={20} />
            </div>
            <div>
              <h2 className={styles.successTitle}>
                E-mail enviado
              </h2>
              <p className={styles.successText}>
                Enviamos o link para <strong>{sentTo}</strong>. Ele expira em 30
                minutos.
              </p>
            </div>
            <div className={styles.successActions}>
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
          <form onSubmit={handleSubmit} className={styles.stack}>
            <AppInput
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="você@email.com"
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

            <p className={styles.loginHint}>
              Lembrou a senha?{" "}
              <Link href="/" className={styles.loginLink}>
                Fazer login
              </Link>
            </p>
          </form>
        )}
      </AppCard>
    </AuthFlowShell>
  );
}
