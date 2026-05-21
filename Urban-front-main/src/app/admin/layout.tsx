import React from "react";
import type { Metadata } from "next";
import { AdminShell } from "./_components/AdminShell";
import { AdminToastProvider } from "./_components/AdminToast";

export const metadata: Metadata = {
  title: "Admin - Urban AI",
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
 *  - AdminShell (sidebar fixa + topbar + breadcrumb + busca seções + badge env)
 *  - AdminToastProvider (toast manager dark, substitui alert() nativo)
 *
 * Classe `.urban-admin` está no AdminShell — ativa os tokens CSS definidos em
 * globals.css (bg #080A0F, accent #E8500A, divider rgba(255,255,255,0.08)).
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
      <AdminShell>{children}</AdminShell>
    </AdminToastProvider>
  );
}
