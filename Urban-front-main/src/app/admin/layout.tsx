import "../app.css";
import React from "react";
import type { Metadata } from "next";
import { AdminGate } from "./_components/AdminGate";
import { AdminShell } from "./_components/AdminShell";
import { AdminToastProvider } from "./_components/AdminToast";
import { adminTitle } from "../lib/pageTitle";

export const metadata: Metadata = {
  title: adminTitle(),
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/**
 * Layout admin — aplicado a TODAS as rotas /admin/*.
 *
 * Envolve com:
 *  - AdminGate (confirma role=admin em /auth/me antes de montar o shell;
 *    não-admin vai para /forbidden)
 *  - AdminShell (sidebar fixa + topbar + breadcrumb + busca seções + badge env)
 *  - AdminToastProvider (toast manager dark, substitui alert() nativo)
 *
 * Classe `.urban-admin` está no AdminShell — ativa os tokens CSS definidos em
 * globals.css (bg da marca, accent da marca, divider por token).
 *
 * Páginas filhas (`/admin/page.tsx`, `/admin/dashboard/page.tsx` etc.) recebem
 * o conteúdo dentro do <main> do shell — não precisam mais de `<main className="min-h-screen bg-slate-950">`.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminToastProvider>
      <AdminGate>
        <AdminShell>{children}</AdminShell>
      </AdminGate>
    </AdminToastProvider>
  );
}
