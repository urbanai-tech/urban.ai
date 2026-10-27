"use client";

import "../app.css";
import React from "react";
import HostShell from "../componentes/HostShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <HostShell>{children}</HostShell>;
}
