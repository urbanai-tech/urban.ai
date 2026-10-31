/**
 * Layout mínimo para a rota legada /onboarding/payment/price.
 */
import { appMetadata } from "../../../lib/pageTitle";

export const metadata = appMetadata("Escolher plano");

export default function PaymentPriceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
