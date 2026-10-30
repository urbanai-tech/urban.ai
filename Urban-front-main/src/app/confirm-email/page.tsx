'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { AuthFlowShell } from '@/app/componentes/AuthFlowShell';
import { AppButton, AppCard, AppInput, AppStack, Icons, useToastCompat } from '@/app/componentes/ui';
import { maskEmail, readPendingEmail, scrubCurrentUrl, stashPendingEmail, CONFIRM_EMAIL_PATH } from '@/app/lib/auth-links';
import { marketingUrl } from '@/app/lib/marketing-url';
import { confirmarEmail, enviarCodigo, getProfile } from '@/app/service/api';
import styles from "./page.module.css";

const CODE_LENGTH = 6;

export default function EmailConfirmation() {
  const router = useRouter();
  const toast = useToastCompat();
  // O e-mail NÃO viaja na URL (PII em histórico/logs/Referer/analytics): vem do
  // sessionStorage, gravado logo antes da navegação. Sem ele, o usuário digita.
  const [email, setEmail] = useState('');
  const [emailChecked, setEmailChecked] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const validTypedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail.trim());

  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string>('');
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const isCodeValid = useMemo(() => /^\d{6}$/.test(code), [code]);

  useEffect(() => {
    setEmail(readPendingEmail());
    setEmailChecked(true);
    if (window.location.search || window.location.hash) scrubCurrentUrl(CONFIRM_EMAIL_PATH);
  }, []);

  useEffect(() => {
    if (!email) return;

    enviarCodigo(email)
      .catch((err) => console.error('Erro ao enviar código:', err));
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
    if (email) inputsRef.current[0]?.focus();
  }, [email]);

  const handleTypedEmail = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validTypedEmail) return;
    const value = typedEmail.trim();
    stashPendingEmail(value);
    setEmail(value);
  };

  const decideRedirect = async () => {
    try {
      const { data: profile } = await getProfile();

      const notFirstTime =
        profile?.onboardingCompleted === true ||
        (typeof profile?.loginCount === "number" && profile.loginCount > 1);

      router.replace(notFirstTime ? "/dashboard" : "/onboarding");
    } catch (error) {
      console.error("Erro na verificação/criacao:", error);
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

      await enviarCodigo(email);
      toast("Verifique seu e-mail para obter o novo código.", { type: "success" });
    } catch (err) {
      console.error('Erro ao enviar código:', err);
      toast.error('Erro ao reenviar código. Tente novamente mais tarde.');
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
      subtitle="Digite o código de 6 dígitos enviado para concluir a ativação da sua conta."
      asideEyebrow="ACESSO MY URBAN"
      asideTitle={
        <>
          Ative sua{" "}
          <br />
          conta.
        </>
      }
      asideSubtitle="Uma etapa rápida de segurança antes de liberar seu painel e onboarding."
    >
      {emailChecked && !email ? (
        <AppCard variant="elevated">
          <form onSubmit={handleTypedEmail}>
            <AppStack gap="lg">
              <p>
                Por segurança, o endereço não fica no link. Digite o e-mail da sua conta para
                receber o código de confirmação.
              </p>
              <AppInput
                label="E-mail da conta"
                type="email"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
              />
              <AppButton type="submit" size="lg" fullWidth disabled={!validTypedEmail}>
                Enviar código
              </AppButton>
            </AppStack>
          </form>
        </AppCard>
      ) : (
      <AppCard variant="elevated" className={styles.statusCard}>
        <div className={styles.statusStack}>
          <div className={styles.statusHeader}>
            <div className={styles.statusIcon}>
              <Mail size={30} strokeWidth={1.8} />
            </div>
            <p className={styles.sentLabel}>
              Código enviado para
            </p>
            <strong className={styles.sentEmail}>
              {maskEmail(email)}
            </strong>
          </div>

          <div>
            <label className={styles.codeLabel}>
              Código de 6 dígitos
            </label>

            <div className={styles.codeGrid}>
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
                  className={`${styles.codeInput} ${code[index] ? styles.codeInputFilled : ""}`}
                />
              ))}
            </div>

            <div className={styles.resendRow}>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendDisabled || isResending}
                className={`${styles.resendButton} ${resendDisabled ? styles.resendButtonWaiting : ""} ${
                  resendDisabled || isResending ? styles.resendButtonBlocked : ""
                }`}
              >
                <RefreshCw size={16} strokeWidth={1.8} />
                {resendDisabled ? `Reenviar código em ${countdown}s` : 'Reenviar código'}
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

          <p className={styles.supportNote}>
            Não recebeu o código? Verifique sua pasta de spam ou{" "}
            <button
              type="button"
              onClick={() => window.location.assign(marketingUrl('/contato'))}
              className={styles.supportLink}
            >
              contate o suporte
            </button>
            .
          </p>
        </div>
      </AppCard>
      )}
    </AuthFlowShell>
  );
}
