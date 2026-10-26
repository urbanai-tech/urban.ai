"use client";

import React from "react";
import {
  fetchPushCategoryPrefs,
  PUSH_CATEGORIES,
  updatePushCategoryPrefs,
  type PushCategoryKey,
  type PushCategoryPrefs,
} from "../service/pwaPreferences";

/**
 * Escolha de quais avisos o anfitrião quer receber neste app. Cada opção é um interruptor
 * (role="switch") ligado a communication-preferences; salva na hora e desfaz se falhar.
 */
export function PushCategoryPreferences() {
  const [prefs, setPrefs] = React.useState<PushCategoryPrefs | null>(null);
  const [pending, setPending] = React.useState<PushCategoryKey | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetchPushCategoryPrefs()
      .then((next) => active && setPrefs(next))
      .catch(() => active && setMessage("Não conseguimos carregar suas preferências agora."));
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (key: PushCategoryKey) => {
    if (!prefs || pending) return;
    const previous = prefs;
    const nextValue = !prefs[key];
    setPrefs({ ...prefs, [key]: nextValue });
    setPending(key);
    setMessage(null);
    try {
      setPrefs(await updatePushCategoryPrefs({ [key]: nextValue }));
    } catch {
      setPrefs(previous);
      setMessage("Não foi possível salvar. Tente de novo.");
    } finally {
      setPending(null);
    }
  };

  if (!prefs && !message) return null;

  return (
    <div
      role="group"
      aria-labelledby="push-categories-title"
      style={{ flexBasis: "100%", borderTop: "1px solid var(--app-divider)", paddingTop: 14, marginTop: 4 }}
    >
      <p id="push-categories-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--app-text)" }}>
        O que você quer receber
      </p>
      {prefs && (
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 4 }}>
          {PUSH_CATEGORIES.map(({ key, label, description }) => {
            const on = prefs[key];
            const labelId = `push-category-${key}`;
            return (
              <li
                key={key}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 }}
              >
                <div style={{ minWidth: 0 }}>
                  <p id={labelId} style={{ margin: 0, fontSize: 14, color: "var(--app-text)" }}>
                    {label}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--app-text-muted)", lineHeight: 1.4 }}>
                    {description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-labelledby={labelId}
                  disabled={pending !== null}
                  onClick={() => toggle(key)}
                  style={{
                    flex: "none",
                    position: "relative",
                    width: 48,
                    minHeight: 44,
                    border: 0,
                    padding: 0,
                    background: "transparent",
                    cursor: pending ? "progress" : "pointer",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      width: 44,
                      height: 24,
                      marginTop: -12,
                      borderRadius: 12,
                      background: on ? "var(--app-accent)" : "var(--app-divider)",
                      transition: "background 0.15s",
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: on ? 22 : 2,
                      width: 20,
                      height: 20,
                      marginTop: -10,
                      borderRadius: 10,
                      background: "#fff",
                      transition: "left 0.15s",
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--app-text-muted)" }}>
        Entre 22h e 8h (horário de São Paulo) não enviamos avisos ao celular; o que chegar continua na sua central de notificações.
      </p>
      <p aria-live="polite" style={{ margin: message ? "6px 0 0" : 0, fontSize: 12, color: "var(--app-text-muted)" }}>
        {message}
      </p>
    </div>
  );
}
