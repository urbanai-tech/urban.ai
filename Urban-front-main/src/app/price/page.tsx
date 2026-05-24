import { redirect } from "next/navigation";

/**
 * Rota legada: pricing publico canonico.
 */
export default function PriceRedirectPage() {
  redirect("/precos");
}
