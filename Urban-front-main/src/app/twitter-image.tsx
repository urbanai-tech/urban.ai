import { createUrbanSeoImage } from "./lib/seo-og-image";

export const alt =
  "Urban AI - Precificacao dinamica para anfitrioes de curta temporada";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return createUrbanSeoImage({
    width: size.width,
    height: size.height,
    eyebrow: "Urban AI para anfitrioes",
    subtitle:
      "Recomendacoes de diaria com eventos urbanos, demanda local e contexto de bairro.",
  });
}
