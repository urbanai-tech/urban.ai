import HostShell from "../componentes/HostShell";

export default function MyPlanLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
