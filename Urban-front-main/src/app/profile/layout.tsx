import "../app.css";
import HostShell from "../componentes/HostShell";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Perfil");

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
