import "../app.css";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Imóveis");

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return <HostShell>{children}</HostShell>;
}
