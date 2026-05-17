"use client";

import React from "react";
import HostShell from "../componentes/HostShell";

export default function NotificacaoLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
