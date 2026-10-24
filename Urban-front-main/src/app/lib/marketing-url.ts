/**
 * URL do site institucional (domínio de marketing) — contato, termos, privacidade.
 * Mesma ordem de fallback do AppFooter.
 */
export const MARKETING_URL = (
  process.env.NEXT_PUBLIC_MARKETING_URL ||
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ||
  "https://myurbanai.com"
).replace(/\/$/, "");

export function marketingUrl(path: string): string {
  return `${MARKETING_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
