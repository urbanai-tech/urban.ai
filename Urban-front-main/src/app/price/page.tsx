import { redirect } from "next/navigation";

/**
 * Rota legada: redireciona para o painel autenticado.
 */
export default function PriceRedirectPage() {
  redirect("/painel");
}
