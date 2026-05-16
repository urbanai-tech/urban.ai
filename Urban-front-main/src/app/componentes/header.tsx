'use client';

/**
 * Header redundante DESATIVADO (auditoria UI/UX 2026-05-16).
 *
 * Esse header só tinha "Iniciar" e "Pagamentos" no desktop e duplicava o
 * hamburger da SideBar no mobile (3 headers diferentes coexistindo no app
 * autenticado). A SideBar agora cria seu próprio top bar no mobile + nav
 * lateral no desktop, então este header virou ruído.
 *
 * Mantido como `null` para não exigir refactor em ~14 layouts. No Sprint 2
 * do plano de redesign do anfitrião (AppShell unificado), o componente é
 * apagado de todos os layouts.
 */
export default function Header() {
  return null;
}
