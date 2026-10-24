import HostShell from "../../componentes/HostShell";

/**
 * /settings/privacy — direitos do titular (LGPD). Sem PaymentCheckGuard de
 * propósito: exportar/excluir dados não pode depender de assinatura ativa.
 */
export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <HostShell guard={false}>{children}</HostShell>;
}
