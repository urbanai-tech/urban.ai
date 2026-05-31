import { redirect } from "next/navigation";

/**
 * Rota legada: redireciona para o checkout canônico de planos.
 */
export default function OnboardingPaymentPriceRedirectPage() {
  redirect("/plans?source=onboarding");
}
