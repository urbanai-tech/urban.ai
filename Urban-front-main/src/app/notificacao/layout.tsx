import "../app.css";
import React from "react";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Avisos");

export default function NotificacaoLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
