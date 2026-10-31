import "../app.css";
import React from "react";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Proprietários");

/** Layout `/proprietarios` (ADR 0027): shell padrão do anfitrião, com guard de assinatura. */
export default function OwnersLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={true}>{children}</HostShell>;
}
