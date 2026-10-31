import type { NextRequest } from "next/server";
import { createUrbanSeoImage, OG_DEFAULT_SUBTITLE, OG_DEFAULT_TITLE } from "../lib/seo-og-image";

// Imagem OG/Twitter por página: título e resumo vêm da query (montada por
// buildSeoMetadata) e são limitados para nunca estourar o quadro.
const clamp = (value: string | null, fallback: string, max: number) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return createUrbanSeoImage({
    width: 1200,
    height: 630,
    title: clamp(params.get("title"), OG_DEFAULT_TITLE, 70),
    subtitle: clamp(params.get("subtitle"), OG_DEFAULT_SUBTITLE, 150),
    eyebrow: clamp(params.get("eyebrow"), "My Urban", 32),
  });
}
