import { redirect } from "next/navigation";

/**
 * /admin/coverage foi unificada em /admin/event-coverage (aba "Regiões").
 * A rota antiga segue viva só como redirect, para links e favoritos existentes.
 */
export default function CoverageRedirectPage() {
  redirect("/admin/event-coverage?tab=regioes");
}
