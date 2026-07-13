import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const PUBLIC_HOSTS = new Set([
  "myurbanai.com",
  "www.myurbanai.com",
  "myurbanai.com.br",
  "www.myurbanai.com.br",
]);

const PRIVATE_DISALLOW = [
  "/dashboard",
  "/painel",
  "/admin",
  "/onboarding",
  "/plans",
  "/my-plan",
  "/my-roi",
  "/portfolio",
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
  "/address-verification",
  "/settings",
  "/api",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const cleanHost = host.split(":")[0];

  if (PUBLIC_HOSTS.has(cleanHost)) {
    return {
      rules: [
        {
          userAgent: [
            "Googlebot",
            "Bingbot",
            "OAI-SearchBot",
            "PerplexityBot",
            "GPTBot",
          ],
          allow: "/",
          disallow: PRIVATE_DISALLOW,
        },
        {
          userAgent: "*",
          allow: "/",
          disallow: PRIVATE_DISALLOW,
        },
      ],
      sitemap: "https://myurbanai.com/sitemap.xml",
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
