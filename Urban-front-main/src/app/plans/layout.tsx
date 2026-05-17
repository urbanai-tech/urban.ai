"use client";

import AuthGuard from "../context/AuthGuard";

/**
 * /plans — checkout pos-login em manifesto editorial dark.
 *
 * NAO usa HostShell (sidebar light premium do anfitriao) — a tela e
 * continuacao direta da landing publica (`/precos`) e deve ocupar viewport
 * inteiro em fundo dark `#080A0F`. Sidebar apareceria estranha sobre o
 * manifesto. Anfitriao volta ao app pelos links pos-checkout.
 */
export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
