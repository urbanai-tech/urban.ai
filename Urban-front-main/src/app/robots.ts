import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * robots.txt host-aware.
 *
 * Next 15 chama esta função no request-time. Lemos o `host` do request:
 *  - myurbanai.com (apex) → permitir tudo público; bloquear só rotas de app
 *  - app.myurbanai.com → Disallow: / (não queremos app indexado)
 *  - localhost / preview → Disallow: / (zero indexação)
 *
 * Isso evita o problema clássico de servir o mesmo robots.txt em ambos os
 * subdomains e contradizer o middleware.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const cleanHost = host.split(":")[0];

  // Site público — indexar landing, sobre, lancamento, etc.
  if (cleanHost === "myurbanai.com" || cleanHost === "www.myurbanai.com") {
    return {
      rules: [
        {
          userAgent: "*",
          allow: "/",
          // Rotas de app que migraram pra app.subdomain (middleware faz 301,
          // mas avisamos crawlers só por garantia)
          disallow: [
            "/dashboard",
            "/painel",
            "/admin",
            "/onboarding",
            "/plans",
            "/my-plan",
            "/properties",
            "/maps",
            "/event-log",
            "/near-events",
            "/notificacao",
            "/price",
            "/post-login",
            "/create",
            "/waitlist",
            "/request-reset-password",
            "/reset-password",
            "/confirm-email",
            "/api",
          ],
        },
      ],
      sitemap: "https://myurbanai.com/sitemap.xml",
    };
  }

  // App ou qualquer outro host — não indexar
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
