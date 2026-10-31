"use client";

import "../app.css";
import { usePathname } from "next/navigation";
import HostShell from "../componentes/HostShell";

/**
 * Rotas de /settings que NÃO passam pelo PaymentCheckGuard de propósito:
 *  - /settings/pricing: precisa abrir sem assinatura ativa;
 *  - /settings/privacy: direitos do titular (LGPD), exportar/excluir dados
 *    não pode depender de assinatura ativa.
 * Um único HostShell aqui evita a sidebar duplicada (DS-04).
 */
const UNGUARDED_PREFIXES = ["/settings/pricing", "/settings/privacy"];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const guard = !UNGUARDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return <HostShell guard={guard}>{children}</HostShell>;
}
