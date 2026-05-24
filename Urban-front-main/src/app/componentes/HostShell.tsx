"use client";

import React from "react";
import SideBar from "./SideBar";
import PaymentCheckGuard from "../context/PaymentCheckGuard";
import { AppFooter, AskUrbanProvider } from "./ui";

/**
 * HostShell - layout shell unificado para rotas autenticadas do anfitriao.
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
      <div
        data-host-shell
        className="urban-app"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--app-bg)",
          color: "var(--app-text)",
        }}
      >
        <SideBar />

        <div
          style={{
            minWidth: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "var(--app-bg)",
          }}
        >
          <main
            className="urban-app"
            style={{
              flex: 1,
              minHeight: 0,
              padding: noPadding ? 0 : "24px 16px 96px",
              background: "var(--app-bg)",
            }}
          >
            {content}
          </main>
          <AppFooter />
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          [data-host-shell] {
            flex-direction: row !important;
          }
          [data-host-shell] > div:last-of-type > main {
            padding: ${noPadding ? "0" : "32px 32px 80px"} !important;
          }
        }
      `}</style>
    </AskUrbanProvider>
  );
}
