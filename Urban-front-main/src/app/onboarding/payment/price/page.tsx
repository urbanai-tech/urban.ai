import { redirect } from "next/navigation";

/**
 * /onboarding/payment/price — placeholder com mock data foi REMOVIDO
 * (auditoria UI/UX 2026-05-16).
 *
 * A rota se chamava /payment/price mas renderizava comparação de preços
 * com `mockProperty = 'Apartamento charmoso perto do centro'`,
 * `mockEvent = 'The Town Music Festival'` e `onBack={() => alert('Voltar')}`.
 * Função e nome do arquivo estavam desalinhados.
 *
 * Redireciona para o onboarding canonico. O checkout real fica em /plans
 * (assinatura) ou no fluxo do AdminPaymentCheckGuard.
 */
export default function OnboardingPaymentPriceRedirectPage() {
  redirect("/onboarding");
}
