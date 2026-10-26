"use client";

import React from "react";
import SideBar from "./SideBar";
import PaymentCheckGuard from "../context/PaymentCheckGuard";
import { AppFooter, AskUrbanProvider, SkipLink } from "./ui";

/**
 * HostShell - layout shell unificado para rotas autenticadas do anfitrião.
 *
 * Mobile: top bar + tab bar de vidro (SideBar), `100dvh`, safe areas.
 * Desktop (>767px): sidebar fixa à esquerda. Estilos em `ui/host-mobile.css`.
 */
export default function HostShell({
  children,
  guard = true,
  noPadding = false,
}: {
  children: React.ReactNode;
  guard?: boolean;
  noPadding?: boolean;
}) {
  const content = guard ? (
    <PaymentCheckGuard>{children}</PaymentCheckGuard>
  ) : (
    children
  );

  return (
    <AskUrbanProvider>
      <div data-host-shell className="urban-app urban-host-shell">
        <SkipLink targetId="host-main-content" />
        <SideBar />

        <div className="urban-host-shell__column">
          <main
            id="host-main-content"
            tabIndex={-1}
            className={`urban-app urban-host-shell__main${noPadding ? " urban-host-shell__main--flush" : ""}`}
          >
            {content}
          </main>
          <AppFooter />
        </div>
      </div>
    </AskUrbanProvider>
  );
}
