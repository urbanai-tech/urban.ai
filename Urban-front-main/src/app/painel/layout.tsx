import "../app.css";
import React from "react";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Hoje");

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return <HostShell>{children}</HostShell>;
}
