"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Formulário de pré-cadastro / lista de interesse.
 *
 * Faz POST para NEXT_PUBLIC_WAITLIST_ENDPOINT, que pode ser:
 *  - um endpoint Formspark/Formspree/Getform (zero backend)
 *  - ou um endpoint próprio /waitlist no backend quando for criado
 *
 * Se a env var estiver vazia, o form mostra uma mensagem de config pendente
 * ao invés de falhar silenciosamente em prod.
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

  const endpoint = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!endpoint) {
      setStatus("error");
      setErrorMessage(
        "Formulário ainda não está conectado ao backend. Volte em breve."
      );
      return;
    }

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrorMessage("E-mail inválido.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setStatus("success");
      setEmail("");

      if (typeof window !== "undefined") {
        const w = window as unknown as {
          gtag?: (...args: unknown[]) => void;
          fbq?: (...args: unknown[]) => void;
        };
        w.gtag?.("event", "sign_up", { method: "waitlist", source });
        w.fbq?.("track", "Lead", { content_name: source });
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? `Não foi possível registrar agora: ${err.message}. Tente de novo em instantes.`
          : "Não foi possível registrar agora."
      );
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="w-full max-w-md rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-4 py-3 text-emerald-200"
      >
        Obrigado — e-mail registrado. Entraremos em contato quando a plataforma abrir para novos anfitriões.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md flex flex-col sm:flex-row gap-3"
      noValidate
    >
      <label className="sr-only" htmlFor="waitlist-email">
        E-mail
      </label>
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
        className="flex-1 px-4 py-3 rounded-lg bg-slate-900/70 border border-slate-700 text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "loading" ? "Enviando…" : buttonLabel}
      </button>
      {errorMessage && (
        <p role="alert" className="text-red-400 text-sm sm:col-span-2">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
