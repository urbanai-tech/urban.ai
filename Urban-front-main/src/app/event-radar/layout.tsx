import "../app.css";
import React from "react";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Radar de eventos");

export default function EventRadarLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={true}>{children}</HostShell>;
}
