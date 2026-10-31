"use client";

import { useEffect, useState } from "react";
import { signupWaitlist, type WaitlistSignupResult } from "../service/api";
import { WaitlistTermsConsent } from "./WaitlistTermsConsent";
import { TURNSTILE_SITE_KEY, TurnstileWidget } from "./TurnstileWidget";
import {
  attributionEventParams,
  captureAttribution,
  compactWaitlistSource,
  getReferralCode,
  trackWaitlistSignup,
  type MarketingAttribution,
} from "./Analytics";
import styles from "./WaitlistForm.module.css";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Formulário de pré-cadastro / lista de interesse.
 *
 * Faz POST para NEXT_PUBLIC_WAITLIST_ENDPOINT, que pode ser:
 *  - um endpoint Formspark/Formspree/Getform (zero backend)
 *  - ou um endpoint próprio /waitlist no backend quando for criado
 *
 * Se a env var estiver vazia, o form usa o backend principal via `/waitlist`.
 * Isso deixa a landing funcional sem depender de um provedor externo de forms.
 *
 * Visual: tema manifesto Urban AI — input minimalista (border-bottom),
 * botão laranja var(--theme-public-accent). Usado em /lancamento.
 *
 * Dispara eventos:
 *  - gtag('event', 'sign_up', { method: 'waitlist' })  — se GA4 ativo
 *  - fbq('track', 'Lead')                              — se Pixel ativo
 */
export function WaitlistForm({
  buttonLabel = "Entrar na lista",
  placeholder = "seu@email.com",
  source = "landing",
}: {
  buttonLabel?: string;
  placeholder?: string;
  source?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [result, setResult] = useState<WaitlistSignupResult | null>(null);
  const [attribution, setAttribution] = useState<MarketingAttribution>({
    firstTouch: null,
    lastTouch: null,
  });

  const endpoint = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT?.trim();

  useEffect(() => {
    setAttribution(captureAttribution());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrorMessage("E-mail inválido.");
      return;
    }

    if (!acceptedTerms) {
      setTermsError(true);
      return;
    }

    // O captcha só vale para o backend próprio (endpoint externo não o verifica).
    const captchaRequired = Boolean(TURNSTILE_SITE_KEY) && !endpoint;
    if (captchaRequired && !captchaToken) {
      setStatus("error");
      setErrorMessage("Confirme a verificação de segurança para continuar.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);
    setTermsError(false);

    try {
      const attributionParams = attributionEventParams(attribution);
      const waitlistSource = compactWaitlistSource(source, attribution);
      const referredBy = getReferralCode(attribution);
      let signupResult: WaitlistSignupResult | null = null;

      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            email: trimmed,
            source: waitlistSource,
            referredBy,
            acceptedTerms: true,
            attribution: attributionParams,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } else {
        const response = await signupWaitlist({
          email: trimmed,
          source: waitlistSource,
          referredBy,
          acceptedTerms: true,
          captchaToken: captchaToken ?? undefined,
        });
        // E-mail já cadastrado: resposta genérica, sem posição.
        signupResult = response.alreadyRegistered ? null : response;
      }

      setResult(signupResult);
      setStatus("success");
      setEmail("");

      trackWaitlistSignup({
        source: waitlistSource,
        position: signupResult?.position,
        total_signups: signupResult?.totalSignups,
        referred_by: referredBy,
        ...attributionParams,
      });
    } catch (err) {
      setCaptchaReset((n) => n + 1);
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? `Não foi possível registrar agora: ${err.message}. Tente de novo em instantes.`
          : "Não foi possível registrar agora.",
      );
    }
  }

  if (status === "success") {
    return (
      <div role="status" className={styles.successBox}>
        <p className={styles.successEyebrow}>REGISTRADO</p>
        <p className={styles.successTitle}>
          Você está na lista. Entraremos em contato quando a plataforma abrir
          para novos anfitriões.
        </p>
        {result && (
          <p className={styles.successPosition}>
            Sua posição na fila: #{result.position}. Guarde seu link de
            indicacao quando ele aparecer no e-mail de confirmação.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      <label htmlFor="waitlist-email" className={styles.srOnlyLabel}>
        E-mail
      </label>
      <div className={styles.fields}>
        <input
          id="waitlist-email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete="email"
          disabled={status === "loading"}
          aria-invalid={status === "error"}
          className={styles.emailInput}
        />
        <WaitlistTermsConsent
          checked={acceptedTerms}
          onChange={(next) => {
            setAcceptedTerms(next);
            if (next) setTermsError(false);
          }}
          invalid={termsError}
          disabled={status === "loading"}
        />
        {!endpoint && <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />}
        <button
          type="submit"
          disabled={status === "loading"}
          className={`${styles.submitButton} ${status === "loading" ? styles.submitButtonLoading : ""}`}
        >
          {status === "loading" ? "Enviando…" : buttonLabel}
        </button>
        {errorMessage && (
          <p role="alert" className={styles.errorText}>
            {errorMessage}
          </p>
        )}
      </div>
    </form>
  );
}
