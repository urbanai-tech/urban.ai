"use client";

import React from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { AppBadge, AppButton } from "./ui";
import {
  getPwaPushSnapshot,
  PwaPushSnapshot,
  sendPwaPushTest,
  subscribeToPwaPush,
  unsubscribeFromPwaPush,
} from "../service/pwaPush";

export function PushNotificationOptIn() {
  const [snapshot, setSnapshot] = React.useState<PwaPushSnapshot | null>(null);
  const [busy, setBusy] = React.useState<"subscribe" | "unsubscribe" | "test" | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

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
  }, [refresh]);

  const activate = async () => {
    setBusy("subscribe");
    setMessage(null);
    try {
      const next = await subscribeToPwaPush();
      setSnapshot(next);
      setMessage(next.subscribed ? "Push ativo neste dispositivo." : "Permissao nao concedida.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel ativar o push.");
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
      setMessage("Push desativado neste dispositivo.");
    } catch {
      setMessage("Nao foi possivel desativar agora.");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setMessage(null);
    try {
      await sendPwaPushTest();
      setMessage("Teste enviado.");
    } catch {
      setMessage("Nao foi possivel enviar o teste.");
    } finally {
      setBusy(null);
    }
  };

  if (!snapshot) return null;
  if (!snapshot.supported) return null;

  const badge = snapshot.subscribed
    ? <AppBadge kind="success">ATIVO</AppBadge>
    : snapshot.permission === "denied"
      ? <AppBadge kind="error">BLOQUEADO</AppBadge>
      : snapshot.enabled
        ? <AppBadge kind="accent">DISPONIVEL</AppBadge>
        : <AppBadge kind="neutral">INDISPONIVEL</AppBadge>;

  return (
    <section
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        padding: "16px 18px",
        marginBottom: 20,
        border: "1px solid var(--app-divider)",
        borderRadius: "var(--app-radius-card)",
        background: "var(--app-surface)",
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
            background: "var(--app-accent-soft)",
          }}
        >
          <BellRing size={18} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--app-text)" }}>
              Push PWA
            </p>
            {badge}
          </div>
          {message && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--app-text-muted)" }}>
              {message}
            </p>
          )}
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
              Testar
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
            Ativar
          </AppButton>
        )}
      </div>
    </section>
  );
}
