"use client";

import { useEffect, useState } from "react";
import { signupWaitlist, type WaitlistSignupResult } from "../service/api";
import {
  attributionEventParams,
  captureAttribution,
  compactWaitlistSource,
  getReferralCode,
  trackWaitlistSignup,
  type MarketingAttribution,
} from "./Analytics";

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
 * botão laranja #E8500A. Usado em /lancamento.
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

    setStatus("loading");
    setErrorMessage(null);

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
            attribution: attributionParams,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } else {
        signupResult = await signupWaitlist({
          email: trimmed,
          source: waitlistSource,
          referredBy,
        });
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
      <div
        role="status"
        style={{
          width: "100%",
          padding: "24px 0",
          borderTop: "1px solid #E8500A",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#E8500A",
            fontWeight: 600,
            margin: 0,
          }}
        >
          REGISTRADO
        </p>
        <p
          style={{
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1.5,
            color: "#FFFFFF",
            margin: "12px 0 0",
            letterSpacing: "-0.3px",
          }}
        >
          Você está na lista. Entraremos em contato quando a plataforma abrir
          para novos anfitriões.
        </p>
        {result && (
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.62)",
              margin: "16px 0 0",
            }}
          >
            Sua posicao na fila: #{result.position}. Guarde seu link de
            indicacao quando ele aparecer no e-mail de confirmacao.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ width: "100%" }}>
      <label
        htmlFor="waitlist-email"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        E-mail
      </label>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
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
          style={{
            width: "100%",
            padding: "20px 0",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.20)",
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: 300,
            outline: "none",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = "#E8500A";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.20)";
          }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            alignSelf: "flex-start",
            padding: "22px 40px",
            background: "#E8500A",
            color: "#080A0F",
            border: "none",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 3,
            textTransform: "uppercase",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.5 : 1,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {status === "loading" ? "Enviando…" : buttonLabel}
        </button>
        {errorMessage && (
          <p
            role="alert"
            style={{
              color: "#E8500A",
              fontSize: 14,
              fontWeight: 500,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </p>
        )}
      </div>
    </form>
  );
}
