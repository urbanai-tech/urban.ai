import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const PUBLIC_HOSTS = new Set([
  "myurbanai.com",
  "www.myurbanai.com",
  "myurbanai.com.br",
  "www.myurbanai.com.br",
]);

const base = "https://myurbanai.com";

const publicRoutes: Array<{
  path: string;
  lastModified: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", lastModified: "2026-05-19", changeFrequency: "weekly", priority: 1 },
  { path: "/precos", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.9 },
  { path: "/lancamento", lastModified: "2026-05-19", changeFrequency: "weekly", priority: 0.8 },
  { path: "/sobre", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contato", lastModified: "2026-05-19", changeFrequency: "yearly", priority: 0.5 },
  { path: "/precificacao-dinamica-airbnb", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.75 },
  { path: "/como-precificar-airbnb-em-dias-de-eventos", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.75 },
  { path: "/precificacao-por-eventos-sao-paulo", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.7 },
  { path: "/integracao-stays-precificacao-automatica", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.7 },
  { path: "/urban-ai-vs-planilha-de-precificacao", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.65 },
  { path: "/seguranca-lgpd-ia-precificacao", lastModified: "2026-05-19", changeFrequency: "monthly", priority: 0.65 },
  { path: "/termos", lastModified: "2026-05-11", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacidade", lastModified: "2026-05-11", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const cleanHost = host.split(":")[0];

  if (!PUBLIC_HOSTS.has(cleanHost)) {
    return [];
  }

  return publicRoutes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: new Date(`${route.lastModified}T00:00:00-03:00`),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
