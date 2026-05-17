import HostShell from "../componentes/HostShell";

export default function MapsBkpLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
