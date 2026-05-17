"use client";

import React from "react";
import HostShell from "../componentes/HostShell";

/**
 * Layout `/portfolio` (Gap 1 — Track 2 semana 3-4).
 *
 * Reusa o shell padrão de anfitrião com guard de billing ligado.
 */
export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={true}>{children}</HostShell>;
}
