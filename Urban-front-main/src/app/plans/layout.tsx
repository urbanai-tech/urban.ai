"use client";

import AuthGuard from "../context/AuthGuard";

/**
 * /plans — checkout pos-login em manifesto editorial dark.
 *
 * NÃO usa HostShell (sidebar light premium do anfitrião) — a tela é
 * continuação direta da landing pública (`/precos`) e deve ocupar viewport
 * inteiro em fundo dark `#080A0F`. Sidebar apareceria estranha sobre o
 * manifesto. Anfitrião volta ao app pelos links pós-checkout.
 */
export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
