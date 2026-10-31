import "../app.css";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Meu plano");

export default function MyPlanLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
