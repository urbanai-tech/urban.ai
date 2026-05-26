import HostShell from "../componentes/HostShell";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
