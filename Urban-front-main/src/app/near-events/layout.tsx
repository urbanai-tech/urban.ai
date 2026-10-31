import "../app.css";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Eventos próximos");

export default function NearEventsLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
