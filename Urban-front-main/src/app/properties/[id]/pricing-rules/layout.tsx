"use client";

import React from "react";
import HostShell from "../../../componentes/HostShell";

/**
 * Layout `/properties/:id/pricing-rules` (Gap 2 — Track 2, semana 5-6).
 *
 * Reusa o shell padrão de anfitrião com guard de billing ligado.
 */
export default function PricingRulesLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={true}>{children}</HostShell>;
}
