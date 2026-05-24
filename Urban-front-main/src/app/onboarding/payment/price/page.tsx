import { redirect } from "next/navigation";

/**
 * Rota legada: redireciona para o checkout canonico de planos.
 */
export default function OnboardingPaymentPriceRedirectPage() {
  redirect("/plans?source=onboarding");
}
