import { redirect } from "next/navigation";

/**
 * /price — placeholder com mock data foi REMOVIDO (auditoria UI/UX 2026-05-16).
 *
 * A tela antiga renderizava `mockProperty = 'Apartamento charmoso perto do centro'`
 * e `mockEvent = 'The Town Music Festival'` com `onBack={() => alert('Voltar')}`
 * — dead code que vazou para produção.
 *
 * Rota redireciona para o painel autenticado. Quem precisar comparar preços
 * passa por `/painel` ou `/dashboard` (calendário).
 */
export default function PriceRedirectPage() {
  redirect("/painel");
}
