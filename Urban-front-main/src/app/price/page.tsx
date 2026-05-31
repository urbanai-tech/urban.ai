import { redirect } from "next/navigation";

/**
 * Rota legada: pricing público canônico.
 */
export default function PriceRedirectPage() {
  redirect("/precos");
}
