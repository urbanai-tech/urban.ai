'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { AuthFlowShell } from '@/app/componentes/AuthFlowShell';
import { AppButton, AppCard, Icons, useToastCompat } from '@/app/componentes/ui';
import { confirmarEmail, enviarCodigo, getProfile } from '@/app/service/api';

const CODE_LENGTH = 6;

export default function EmailConfirmation() {
  const params = useParams();
  const router = useRouter();
  const toast = useToastCompat();
  const email = params.id && !Array.isArray(params.id) ? decodeURIComponent(params.id) : '';

  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string>('');
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const isCodeValid = useMemo(() => /^\d{6}$/.test(code), [code]);

  useEffect(() => {
    if (!email) return;

    enviarCodigo(email)
      .then((result) => console.log('Codigo enviado com sucesso:', result))
      .catch((err) => console.error('Erro ao enviar codigo:', err));
  }, [email]);

  useEffect(() => {
    if (!resendDisabled) return;

    if (countdown <= 0) {
      setResendDisabled(false);
      return;
    }

    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, resendDisabled]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const decideRedirect = async () => {
    try {
      const { data: profile } = await getProfile();

      const notFirstTime =
        profile?.onboardingCompleted === true ||
        (typeof profile?.loginCount === "number" && profile.loginCount > 1);

      router.replace(notFirstTime ? "/dashboard" : "/onboarding");
    } catch (error) {
      console.error("Erro na verificacao/criacao:", error);
      router.replace("/onboarding");
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d$/.test(value) && value !== '') return;

    const newCode = code.split('');
    while (newCode.length < CODE_LENGTH) newCode.push('');
    newCode[index] = value;
    setCode(newCode.join(''));

    if (value && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pastedData.length === CODE_LENGTH) {
      setCode(pastedData);
      window.setTimeout(() => inputsRef.current[CODE_LENGTH - 1]?.focus(), 10);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!isCodeValid) return;

    try {
      setLoading(true);
      const result = await confirmarEmail(email, code);

      if (result.data.ok) {
        toast("Sua conta foi ativada com sucesso.", { type: "success" });
        await decideRedirect();
      } else {
        toast.error(result.data.motivo || 'Erro ao confirmar e-mail.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setIsResending(true);
      setResendDisabled(true);
      setCountdown(60);

      const result = await enviarCodigo(email);
      toast("Verifique seu e-mail para obter o novo codigo.", { type: "success" });
      console.log('Codigo enviado com sucesso:', result);
    } catch (err) {
      console.error('Erro ao enviar codigo:', err);
      toast.error('Erro ao reenviar codigo. Tente novamente mais tarde.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthFlowShell
      eyebrow="CONFIRMACAO"
      title={
        <>
          Confirme seu{" "}
          <br />
          e-mail.
        </>
      }
      subtitle="Digite o codigo de 6 digitos enviado para concluir a ativacao da sua conta."
      asideEyebrow="ACESSO URBAN AI"
      asideTitle={
        <>
          Ative sua{" "}
          <br />
          conta.
        </>
      }
      asideSubtitle="Uma etapa rapida de seguranca antes de liberar seu painel e onboarding."
    >
      <AppCard variant="elevated" style={{ padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 58,
                height: 58,
                margin: "0 auto 16px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                background: "var(--app-accent-soft)",
                color: "var(--app-accent)",
              }}
            >
              <Mail size={30} strokeWidth={1.8} />
            </div>
            <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 14 }}>
              Codigo enviado para
            </p>
            <strong style={{ display: "block", marginTop: 4, color: "var(--app-text)", wordBreak: "break-word" }}>
              {email}
            </strong>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: 14,
                textAlign: "center",
                color: "var(--app-text-muted)",
                fontSize: 12,
                fontWeight: 650,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Codigo de 6 digitos
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
              {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el;
                  }}
                  value={code[index] || ''}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Digito ${index + 1}`}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    minHeight: 48,
                    textAlign: "center",
                    fontSize: 24,
                    fontWeight: 750,
                    borderRadius: 10,
                    border: `1px solid ${code[index] ? "var(--app-accent)" : "var(--app-divider-strong)"}`,
                    color: "var(--app-text)",
                    outline: "none",
                  }}
                />
              ))}
            </div>

            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendDisabled || isResending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: "none",
                  background: "transparent",
                  color: resendDisabled ? "var(--app-text-muted)" : "var(--app-accent)",
                  fontWeight: 650,
                  cursor: resendDisabled || isResending ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={16} strokeWidth={1.8} />
                {resendDisabled ? `Reenviar codigo em ${countdown}s` : 'Reenviar codigo'}
              </button>
            </div>
          </div>

          <AppButton
            type="button"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!isCodeValid}
            onClick={handleSubmit}
            rightIcon={<Icons.ArrowRight size={14} />}
          >
            Confirmar e-mail
          </AppButton>

          <p
            style={{
              margin: 0,
              paddingTop: 18,
              borderTop: "1px solid var(--app-divider)",
              textAlign: "center",
              color: "var(--app-text-muted)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Nao recebeu o codigo? Verifique sua pasta de spam ou{" "}
            <button
              type="button"
              onClick={() => router.push('/suporte')}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--app-accent)",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              contate o suporte
            </button>
            .
          </p>
        </div>
      </AppCard>
    </AuthFlowShell>
  );
}
