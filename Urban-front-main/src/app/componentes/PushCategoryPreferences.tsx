"use client";

import React from "react";
import {
  fetchPushCategoryPrefs,
  PUSH_CATEGORIES,
  updatePushCategoryPrefs,
  type PushCategoryKey,
  type PushCategoryPrefs,
} from "../service/pwaPreferences";
import styles from "./Pwa.module.css";

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
    <div role="group" aria-labelledby="push-categories-title" className={styles.prefs}>
      <p id="push-categories-title" className={styles.prefsTitle}>
        O que você quer receber
      </p>
      {prefs && (
        <ul className={styles.prefsList}>
          {PUSH_CATEGORIES.map(({ key, label, description }) => {
            const labelId = `push-category-${key}`;
            return (
              <li key={key} className={styles.prefsItem}>
                <div>
                  <p id={labelId} className={styles.prefsLabel}>
                    {label}
                  </p>
                  <p className={styles.prefsDescription}>{description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  aria-labelledby={labelId}
                  disabled={pending !== null}
                  onClick={() => toggle(key)}
                  className={styles.switch}
                >
                  <span aria-hidden className={styles.switchTrack} />
                  <span aria-hidden className={styles.switchKnob} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.prefsNote}>
        Entre 22h e 8h (horário de São Paulo) não enviamos avisos ao celular; o que chegar continua na sua central de
        notificações.
      </p>
      <p aria-live="polite" className={styles.prefsMessage}>
        {message}
      </p>
    </div>
  );
}
