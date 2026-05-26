"use client";

import React from "react";
import { BellOff, BellRing, Send, X } from "lucide-react";
import { AppBadge, AppButton } from "./ui";
import {
  getPwaPushSnapshot,
  PwaPushSnapshot,
  sendPwaPushTest,
  subscribeToPwaPush,
  unsubscribeFromPwaPush,
} from "../service/pwaPush";

const DISMISS_KEY = "urban_ai_push_invite_dismissed";

type PushNotificationOptInProps = {
  variant?: "full" | "compact";
};

function getDismissedInvite() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function saveDismissedInvite() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // The browser can block localStorage in stricter privacy modes.
  }
}

export function PushNotificationOptIn({ variant = "full" }: PushNotificationOptInProps) {
  const [snapshot, setSnapshot] = React.useState<PwaPushSnapshot | null>(null);
  const [busy, setBusy] = React.useState<"subscribe" | "unsubscribe" | "test" | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const isCompact = variant === "compact";

  const refresh = React.useCallback(async () => {
    const next = await getPwaPushSnapshot();
    setSnapshot(next);
  }, []);

  React.useEffect(() => {
    refresh().catch(() => {
      setSnapshot({
        supported: false,
        enabled: false,
        permission: "unsupported",
        subscribed: false,
        reason: "snapshot_failed",
      });
    });
    if (variant === "compact") setDismissed(getDismissedInvite());
  }, [refresh, variant]);

  const activate = async () => {
    setBusy("subscribe");
    setMessage(null);
    try {
      const next = await subscribeToPwaPush();
      setSnapshot(next);
      if (variant === "compact" && (next.subscribed || next.permission === "denied")) {
        saveDismissedInvite();
        setDismissed(true);
      }
      setMessage(
        next.subscribed
          ? "Pronto. Vamos te avisar quando surgir algo importante."
          : "Tudo bem. Você pode ativar os avisos depois.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não conseguimos ativar os avisos agora.");
    } finally {
      setBusy(null);
    }
  };

  const deactivate = async () => {
    setBusy("unsubscribe");
    setMessage(null);
    try {
      const next = await unsubscribeFromPwaPush();
      setSnapshot(next);
      setMessage("Avisos desativados neste dispositivo.");
    } catch {
      setMessage("Não conseguimos desativar agora.");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setMessage(null);
    try {
      await sendPwaPushTest();
      setMessage("Teste enviado. Confira as notificações do seu aparelho.");
    } catch {
      setMessage("Não foi possível enviar o teste.");
    } finally {
      setBusy(null);
    }
  };

  if (!snapshot) return null;
  if (!snapshot.supported) return null;
  if (isCompact && (snapshot.subscribed || dismissed || snapshot.permission === "denied")) return null;

  const dismissCompact = () => {
    saveDismissedInvite();
    setDismissed(true);
  };

  const badge = snapshot.subscribed
    ? <AppBadge kind="success">ATIVO</AppBadge>
    : snapshot.permission === "denied"
      ? <AppBadge kind="error">BLOQUEADO</AppBadge>
      : snapshot.enabled
        ? <AppBadge kind="accent">DISPONÍVEL</AppBadge>
        : <AppBadge kind="neutral">INDISPONÍVEL</AppBadge>;
  const title = snapshot.subscribed
    ? "Avisos ativados"
    : "Receber avisos importantes";
  const helperText =
    snapshot.permission === "denied"
      ? "Os avisos estão bloqueados no navegador. Clique no cadeado ao lado do endereço do site para liberar."
      : snapshot.enabled
        ? "A Urban AI avisa quando houver nova sugestão de preço ou evento importante. Quando o navegador perguntar, toque em Permitir."
        : "Avisos ainda não estão liberados neste ambiente.";

  return (
    <section
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        padding: isCompact ? "14px 16px" : "16px 18px",
        marginBottom: isCompact ? 24 : 20,
        border: "1px solid var(--app-divider)",
        borderRadius: "var(--app-radius-card)",
        background: isCompact ? "var(--app-accent-soft)" : "var(--app-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            color: "var(--app-accent)",
            background: isCompact ? "var(--app-surface)" : "var(--app-accent-soft)",
          }}
        >
          <BellRing size={18} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--app-text)" }}>
              {title}
            </p>
            {badge}
          </div>
          <p
            aria-live="polite"
            style={{ margin: "4px 0 0", fontSize: 13, color: "var(--app-text-muted)", lineHeight: 1.45 }}
          >
            {message || helperText}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {snapshot.subscribed ? (
          <>
            <AppButton
              size="sm"
              variant="secondary"
              leftIcon={<Send size={14} />}
              loading={busy === "test"}
              onClick={test}
            >
              Enviar teste
            </AppButton>
            <AppButton
              size="sm"
              variant="ghost"
              leftIcon={<BellOff size={14} />}
              loading={busy === "unsubscribe"}
              onClick={deactivate}
            >
              Desativar
            </AppButton>
          </>
        ) : (
          <AppButton
            size="sm"
            variant="primary"
            leftIcon={<BellRing size={14} />}
            loading={busy === "subscribe"}
            disabled={!snapshot.enabled || snapshot.permission === "denied"}
            onClick={activate}
          >
            Ativar avisos
          </AppButton>
        )}
        {isCompact && (
          <AppButton
            size="sm"
            variant="ghost"
            leftIcon={<X size={14} />}
            onClick={dismissCompact}
          >
            Agora não
          </AppButton>
        )}
      </div>
    </section>
  );
}
