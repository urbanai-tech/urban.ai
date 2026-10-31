import "../app.css";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Ganhos");

export default function RoiLayout({ children }: { children: React.ReactNode }) {
  return <HostShell>{children}</HostShell>;
}
