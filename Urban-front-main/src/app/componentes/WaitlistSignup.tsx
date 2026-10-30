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
import { WaitlistTermsConsent } from "./WaitlistTermsConsent";
import { AppBadge, AppButton, AppCard, AppInput, Icons } from "./ui";
import styles from "./WaitlistSignup.module.css";

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
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
      setErrorMessage("Use um e-mail válido para continuar.");
      return;
    }

    if (!acceptedTerms) {
      setTermsError(true);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setTermsError(false);

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
        acceptedTerms: true,
      });

      if (r.alreadyRegistered) {
        setErrorMessage(
          "Este e-mail já está na lista. Procure o e-mail de confirmação que enviamos: ele traz sua posição e seu link de indicação.",
        );
        return;
      }

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
        "Não foi possível registrar agora. Tente em instantes.";
      setErrorMessage(typeof message === "string" ? message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading-existing") {
    return (
      <AppCard variant="elevated" className={styles.signupCard}>
        <div className={styles.loadingRow}>
          <Spinner />
          <p className={styles.loadingText}>Carregando sua posição na fila…</p>
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
    <AppCard variant="elevated" className={styles.signupCard}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formHeader}>
          <AppBadge kind="accent">Acesso por convite</AppBadge>
          <div>
            <h2 className={styles.formTitle}>Garanta seu lugar antes da abertura</h2>
            <p className={styles.subtitle}>
              Cadastre-se na lista de espera e receba o convite quando seu acesso for liberado.
            </p>
          </div>
        </div>

        {referredBy && (
          <InlineNotice kind="success">
            Você chegou por indicacao. Seu cadastro já preserva essa origem.
          </InlineNotice>
        )}

        <AppInput
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="você@email.com"
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

        <WaitlistTermsConsent
          checked={acceptedTerms}
          onChange={(next) => {
            setAcceptedTerms(next);
            if (next) setTermsError(false);
          }}
          invalid={termsError}
          disabled={submitting}
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

        <p className={styles.loginPrompt}>
          Já tem convite?{" "}
          <NextLink href="/" className={styles.loginLink}>
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
    "Acabei de garantir meu acesso antecipado ao My Urban, uma IA que precifica Airbnb cruzando eventos e mercado.";

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
    <AppCard variant="elevated" className={styles.statusCard}>
      <div className={styles.statusContent}>
        <div className={styles.statusHeader}>
          <span aria-hidden className={styles.statusIcon}>
            <Icons.Check size={20} />
          </span>
          <div>
            <AppBadge kind="success">Cadastro recebido</AppBadge>
            <h2 className={styles.statusTitle}>Você está na fila</h2>
            <p className={styles.subtitle}>
              Avisaremos por e-mail assim que seu acesso for liberado.
            </p>
          </div>
        </div>

        <div className={styles.metricsGrid}>
          <StatusMetric label="Posição" value={`#${result.position}`} />
          <StatusMetric label="Na frente" value={result.aheadOfYou.toLocaleString("pt-BR")} />
          <StatusMetric label="Indicações" value={referralsCount.toLocaleString("pt-BR")} />
        </div>

        <div className={styles.referralBox}>
          <div className={styles.referralHeader}>
            <div>
              <p className={styles.referralTitle}>Link de indicação</p>
              <p className={styles.referralHint}>
                Cada cadastro pelo seu link melhora sua posição.
              </p>
            </div>
            <AppBadge kind="accent">+1</AppBadge>
          </div>

          <div className={styles.referralRow}>
            <div className={styles.referralUrl}>{referralUrl}</div>
            <AppButton type="button" variant="secondary" size="md" onClick={copyLink} leftIcon={<Copy size={14} />}>
              {copyState === "copied" ? "Copiado" : "Copiar"}
            </AppButton>
          </div>

          <div className={styles.shareRow}>
            <AppButton type="button" variant="secondary" size="sm" onClick={shareWhatsApp} leftIcon={<MessageCircle size={13} />}>
              WhatsApp
            </AppButton>
            <AppButton type="button" variant="secondary" size="sm" onClick={shareLinkedIn} leftIcon={<Linkedin size={13} />}>
              LinkedIn
            </AppButton>
          </div>
        </div>

        <button type="button" onClick={onReset} className={styles.resetButton}>
          <RotateCcw size={13} />
          Cadastrar outro e-mail
        </button>
      </div>
    </AppCard>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <p className={styles.metricLabel}>{label}</p>
      <strong className={styles.metricValue}>{value}</strong>
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
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`${styles.notice} ${kind === "success" ? styles.noticeSuccess : styles.noticeError}`}
      // Sem token de mesmo valor para a borda de sucesso (verde a 22%): fica inline.
      style={kind === "success" ? { borderColor: "rgba(22, 160, 107, 0.22)" } : undefined}
    >
      {kind === "success" ? <Icons.Check size={14} /> : <Icons.AlertCircle size={14} />}
      <span>{children}</span>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className={styles.spinner} />;
}
