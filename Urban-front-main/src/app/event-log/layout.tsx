import HostShell from "../componentes/HostShell";

export default function EventLogLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
