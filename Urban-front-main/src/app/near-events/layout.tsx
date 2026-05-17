import HostShell from "../componentes/HostShell";

export default function NearEventsLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
