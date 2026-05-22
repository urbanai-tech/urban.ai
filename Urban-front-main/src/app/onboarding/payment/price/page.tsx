import { redirect } from "next/navigation";

/**
 * Rota legada: redireciona para o onboarding canonico.
 */
export default function OnboardingPaymentPriceRedirectPage() {
  redirect("/onboarding");
}
