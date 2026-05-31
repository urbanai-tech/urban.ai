import { createUrbanSeoImage } from "./lib/seo-og-image";

export const alt =
  "Urban AI - Precificação dinâmica para Airbnb e aluguel por temporada";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createUrbanSeoImage({
    width: size.width,
    height: size.height,
  });
}
