import type { Metadata } from "next";

/**
 * Padrão único de `<title>` do app e do admin (WCAG 2.4.2):
 *   app:   "Calendário · My Urban"
 *   admin: "Usuários · Admin · My Urban"
 * Separador único: " · ". Páginas públicas de SEO têm títulos próprios
 * (buildSeoMetadata) e não passam por aqui.
 */
export const TITLE_SEPARATOR = " · ";
export const TITLE_BRAND = "My Urban";

export function appTitle(page: string): string {
  return `${page}${TITLE_SEPARATOR}${TITLE_BRAND}`;
}

export function adminTitle(page?: string): string {
  const tail = `Admin${TITLE_SEPARATOR}${TITLE_BRAND}`;
  return page ? `${page}${TITLE_SEPARATOR}${tail}` : tail;
}

export function appMetadata(page: string): Metadata {
  return { title: appTitle(page) };
}

export function adminMetadata(page: string): Metadata {
  return { title: adminTitle(page) };
}
