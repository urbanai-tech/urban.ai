import HostShell from "../../componentes/HostShell";

export default function PricingSettingsLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
