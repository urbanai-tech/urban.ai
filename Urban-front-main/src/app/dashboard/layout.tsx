import "../app.css";
import React from "react";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Calendário");

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <HostShell>{children}</HostShell>;
}
