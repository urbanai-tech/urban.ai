"use client";

import React from "react";
import HostShell from "../componentes/HostShell";

export default function EventRadarLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={true}>{children}</HostShell>;
}
