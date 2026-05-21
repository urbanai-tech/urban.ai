"use client";

import React, { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { Copy, Linkedin, Mail, MessageCircle, Phone, RotateCcw, User } from "lucide-react";
import {
  signupWaitlist,
  fetchWaitlistStatus,
  type WaitlistSignupResult,
} from "../service/api";
import {
  attributionEventParams,
  captureAttribution,
  compactWaitlistSource,
  getReferralCode,
  trackAnalyticsEvent,
  trackWaitlistSignup,
  type MarketingAttribution,
} from "./Analytics";
import { AppBadge, AppButton, AppCard, AppInput, Icons } from "./ui";

const STORAGE_KEY = "urban-ai-waitlist-code-v1";

export function WaitlistSignup({
  source = "create-signup",
  defaultEmail = "",
  defaultName = "",
}: {
  source?: string;
  defaultEmail?: string;
  defaultName?: string;
}) {
  const [phase, setPhase] = useState<"form" | "loading-existing" | "status">("form");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<WaitlistSignupResult | null>(null);
  const [statusReferrals, setStatusReferrals] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [attribution, setAttribution] = useState<MarketingAttribution>({
    firstTouch: null,
    lastTouch: null,
  });
  const [referredBy, setReferredBy] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextAttribution = captureAttribution();
    setAttribution(nextAttribution);

    const url = new URL(window.location.href);
    const refParam = url.searchParams.get("ref") || getReferralCode(nextAttribution);
    if (refParam) setReferredBy(refParam);

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPhase("loading-existing");
      fetchWaitlistStatus(saved)
        .then((s) => {
          setResult({
            position: s.position,
            referralCode: saved,
            aheadOfYou: s.aheadOfYou,
            totalSignups: s.totalSignups,
          });
          setStatusReferrals(s.referralsCount);
          setPhase("status");
        })
        .catch(() => {
          window.localStorage.removeItem(STORAGE_KEY);
          setPhase("form");
        });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Use um e-mail valido para continuar.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const attributionParams = attributionEventParams(attribution);
      const waitlistSource = compactWaitlistSource(source, attribution);
      const referralCode = referredBy ?? getReferralCode(attribution);
      const r = await signupWaitlist({
        email: trimmedEmail,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        source: waitlistSource,
        referredBy: referralCode ?? undefined,
      });

      setResult(r);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, r.referralCode);
      }
      setPhase("status");

      trackWaitlistSignup({
        source: waitlistSource,
        position: r.position,
        total_signups: r.totalSignups,
        referred_by: referralCode,
        ...attributionParams,
      });
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Nao foi possivel registrar agora. Tente em instantes.";
      setErrorMessage(typeof message === "string" ? message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading-existing") {
    return (
      <AppCard variant="elevated" style={{ padding: 28, width: "100%", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Spinner />
          <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 14 }}>
            Carregando sua posicao na fila...
          </p>
        </div>
      </AppCard>
    );
  }

  if (phase === "status" && result) {
    return (
      <WaitlistStatusCard
        result={result}
        referralsCount={statusReferrals}
        onReset={() => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
          }
          setResult(null);
          setStatusReferrals(0);
          setPhase("form");
        }}
      />
    );
  }

  return (
    <AppCard variant="elevated" style={{ padding: 28, width: "100%", maxWidth: 520 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AppBadge kind="accent">Acesso por convite</AppBadge>
          <div>
            <h2 style={{ margin: 0, color: "var(--app-text)", fontSize: 22, lineHeight: 1.25 }}>
              Garanta seu lugar antes da abertura
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                color: "var(--app-text-muted)",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              Cadastre-se na lista de espera e receba o convite quando seu acesso for liberado.
            </p>
          </div>
        </div>

        {referredBy && (
          <InlineNotice kind="success">
            Voce chegou por indicacao. Seu cadastro ja preserva essa origem.
          </InlineNotice>
        )}

        <AppInput
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          required
          autoComplete="email"
          disabled={submitting}
          leftAddon={<Mail size={14} />}
        />

        <AppInput
          label="Nome"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          autoComplete="name"
          disabled={submitting}
          leftAddon={<User size={14} />}
        />

        <AppInput
          label="WhatsApp"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(11) 99999-9999"
          autoComplete="tel"
          disabled={submitting}
          helper="Opcional"
          leftAddon={<Phone size={14} />}
        />

        {errorMessage && <InlineNotice kind="error">{errorMessage}</InlineNotice>}

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          rightIcon={<Icons.ArrowRight size={14} />}
        >
          Entrar na lista
        </AppButton>

        <p
          style={{
            margin: 0,
            textAlign: "center",
            color: "var(--app-text-muted)",
            fontSize: 13,
          }}
        >
          Ja tem convite?{" "}
          <NextLink
            href="/"
            style={{
              color: "var(--app-accent)",
              fontWeight: 650,
              textDecoration: "none",
            }}
          >
            Fazer login
          </NextLink>
        </p>
      </form>
    </AppCard>
  );
}

function WaitlistStatusCard({
  result,
  referralsCount,
  onReset,
}: {
  result: WaitlistSignupResult;
  referralsCount: number;
  onReset: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const referralUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/lancamento?ref=${result.referralCode}`;
  }, [result.referralCode]);

  const shareText =
    "Acabei de garantir meu acesso antecipado a Urban AI, uma IA que precifica Airbnb cruzando eventos e mercado.";

  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      trackAnalyticsEvent("waitlist_referral_copy", {
        source: "waitlist-status",
      });
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    });
  }

  function shareWhatsApp() {
    trackAnalyticsEvent("waitlist_referral_share", {
      source: "waitlist-status",
      channel: "whatsapp",
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralUrl}`)}`, "_blank");
  }

  function shareLinkedIn() {
    trackAnalyticsEvent("waitlist_referral_share", {
      source: "waitlist-status",
      channel: "linkedin",
    });
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,
      "_blank",
    );
  }

  return (
    <AppCard variant="elevated" style={{ padding: 28, width: "100%", maxWidth: 560 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span
            aria-hidden
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(22, 160, 107, 0.10)",
              color: "var(--app-success)",
              flexShrink: 0,
            }}
          >
            <Icons.Check size={20} />
          </span>
          <div>
            <AppBadge kind="success">Cadastro recebido</AppBadge>
            <h2 style={{ margin: "10px 0 0", fontSize: 22, lineHeight: 1.25 }}>
              Voce esta na fila
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                color: "var(--app-text-muted)",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              Avisaremos por e-mail assim que seu acesso for liberado.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          <StatusMetric label="Posicao" value={`#${result.position}`} />
          <StatusMetric label="Na frente" value={result.aheadOfYou.toLocaleString("pt-BR")} />
          <StatusMetric label="Indicacoes" value={referralsCount.toLocaleString("pt-BR")} />
        </div>

        <div
          style={{
            padding: 16,
            background: "var(--app-surface-muted)",
            border: "1px solid var(--app-divider)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>Link de indicacao</p>
              <p style={{ margin: "4px 0 0", color: "var(--app-text-muted)", fontSize: 12 }}>
                Cada cadastro pelo seu link melhora sua posicao.
              </p>
            </div>
            <AppBadge kind="accent">+1</AppBadge>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                minWidth: 0,
                flex: 1,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                minHeight: 40,
                borderRadius: 8,
                border: "1px solid var(--app-divider-strong)",
                background: "var(--app-surface)",
                color: "var(--app-text-muted)",
                fontSize: 12,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {referralUrl}
            </div>
            <AppButton type="button" variant="secondary" size="md" onClick={copyLink} leftIcon={<Copy size={14} />}>
              {copyState === "copied" ? "Copiado" : "Copiar"}
            </AppButton>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <AppButton type="button" variant="secondary" size="sm" onClick={shareWhatsApp} leftIcon={<MessageCircle size={13} />}>
              WhatsApp
            </AppButton>
            <AppButton type="button" variant="secondary" size="sm" onClick={shareLinkedIn} leftIcon={<Linkedin size={13} />}>
              LinkedIn
            </AppButton>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: "transparent",
            color: "var(--app-text-muted)",
            fontSize: 13,
            fontWeight: 650,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <RotateCcw size={13} />
          Cadastrar outro e-mail
        </button>
      </div>
    </AppCard>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "14px 12px",
        border: "1px solid var(--app-divider)",
        borderRadius: 10,
        background: "var(--app-surface)",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--app-text-muted)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <strong style={{ display: "block", marginTop: 6, fontSize: 20, lineHeight: 1 }}>
        {value}
      </strong>
    </div>
  );
}

function InlineNotice({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  const color = kind === "success" ? "var(--app-success)" : "var(--app-danger)";
  const bg = kind === "success" ? "rgba(22, 160, 107, 0.08)" : "rgba(194, 52, 46, 0.08)";
  const border =
    kind === "success" ? "rgba(22, 160, 107, 0.22)" : "rgba(194, 52, 46, 0.22)";

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {kind === "success" ? <Icons.Check size={14} /> : <Icons.AlertCircle size={14} />}
      <span>{children}</span>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`
        @keyframes urban-spin { to { transform: rotate(360deg); } }
      `}</style>
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "3px solid var(--app-accent-soft)",
          borderTopColor: "var(--app-accent)",
          animation: "urban-spin 0.9s linear infinite",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    </>
  );
}
