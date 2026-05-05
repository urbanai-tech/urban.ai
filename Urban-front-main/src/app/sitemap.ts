import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * sitemap.xml host-aware.
 *
 * Só publicamos sitemap em myurbanai.com (apex). app.myurbanai.com retorna
 * vazio — o app não deve aparecer em busca orgânica.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const cleanHost = host.split(":")[0];

  if (cleanHost !== "myurbanai.com" && cleanHost !== "www.myurbanai.com") {
    return [];
  }

  const base = "https://myurbanai.com";
  const lastModified = new Date();

  return [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/precos`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/lancamento`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/sobre`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/contato`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/termos`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/privacidade`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
