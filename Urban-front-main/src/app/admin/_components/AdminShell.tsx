"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDialogFocus } from "../../componentes/ui/useDialogFocus";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/app/componentes/theme/ThemeToggle";
import { SkipLink } from "@/app/componentes/ui/SkipLink";
import { BrandLogo } from "@/app/componentes/ui/BrandLogo";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Calendar,
  ChevronRight,
  Database,
  DollarSign,
  Inbox,
  Layers,
  Mail,
  MapPin,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from "./Icons";
import styles from "./AdminShell.module.css";

/**
 * AdminShell — layout-wrapper para todas as rotas /admin/*.
 *
 * Substitui o grid de 17 NavCards no /admin antigo. Estrutura:
 *  - Sidebar fixa 240px à esquerda, agrupada em 4 seções (Negócio, Motor de
 *    eventos, Operações, Sistema).
 *  - Topbar 56px com breadcrumb dinâmico (path → labels) + badge ambiente +
 *    avatar admin (placeholder).
 *  - Main area com max-width 1400px + padding consistente.
 *
 * Em mobile <768px: sidebar vira drawer hamburger.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV: NavSection[] = [
  {
    title: "Negócio",
    items: [
      { href: "/admin", label: "Resumo", icon: <Layers size={16} /> },
      { href: "/admin/dashboard", label: "Painel executivo", icon: <Activity size={16} /> },
      { href: "/admin/finance", label: "Financeiro", icon: <DollarSign size={16} /> },
      { href: "/admin/funnel", label: "Funil", icon: <TrendingUp size={16} /> },
      { href: "/admin/roi", label: "ROI", icon: <Briefcase size={16} /> },
      { href: "/admin/alpha", label: "Alpha", icon: <Zap size={16} /> },
      { href: "/admin/contacts", label: "Contatos", icon: <Inbox size={16} /> },
      { href: "/admin/waitlist", label: "Lista de espera", icon: <Users size={16} /> },
    ],
  },
  {
    title: "Motor de eventos",
    items: [
      { href: "/admin/event-radar", label: "Radar de demanda", icon: <Activity size={16} /> },
      { href: "/admin/events", label: "Eventos", icon: <Calendar size={16} /> },
      { href: "/admin/events/dedup", label: "Deduplicação", icon: <Shield size={16} /> },
      { href: "/admin/events/new", label: "Cadastrar evento", icon: <Plus size={16} /> },
      { href: "/admin/events/import", label: "Importar CSV", icon: <Upload size={16} /> },
      { href: "/admin/event-coverage", label: "Cobertura de eventos", icon: <Calendar size={16} /> },
      { href: "/admin/coverage", label: "Regiões de cobertura", icon: <MapPin size={16} /> },
      { href: "/admin/collectors-health", label: "Coletores", icon: <Activity size={16} /> },
    ],
  },
  {
    title: "Operações",
    items: [
      { href: "/admin/properties", label: "Imóveis detalhados", icon: <Briefcase size={16} /> },
      { href: "/admin/jobs", label: "Tarefas do sistema", icon: <Server size={16} /> },
      { href: "/admin/stays", label: "Stays", icon: <Database size={16} /> },
      { href: "/admin/users", label: "Usuários", icon: <Users size={16} /> },
      { href: "/admin/billing-hosts", label: "Cobrança dos anfitriões", icon: <DollarSign size={16} /> },
      { href: "/admin/outcomes", label: "Resultados v1 × v2", icon: <TrendingUp size={16} /> },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/audit-logs", label: "Auditoria", icon: <Shield size={16} /> },
      { href: "/admin/pricing-config", label: "Config. de preços", icon: <Settings size={16} /> },
      { href: "/admin/price-intelligence", label: "Price Intelligence", icon: <DollarSign size={16} /> },
      { href: "/admin/seo", label: "SEO / GEO", icon: <Search size={16} /> },
      { href: "/admin/quality", label: "Qualidade", icon: <AlertCircle size={16} /> },
      { href: "/admin/communications", label: "Comunicações", icon: <Mail size={16} /> },
      { href: "/admin/onboarding-drip", label: "E-mails de boas-vindas", icon: <Mail size={16} /> },
    ],
  },
];

const FLAT_ITEMS: NavItem[] = NAV.flatMap((s) => s.items);

function getBreadcrumb(pathname: string): string {
  // Mais específico primeiro (ex: /admin/events/new antes de /admin/events)
  const sorted = [...FLAT_ITEMS].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match?.label ?? "Operação";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Fecha mobile drawer ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Foco inicial no drawer, Tab preso, Esc fecha e o foco volta ao botão de menu.
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeDrawer = useCallback(() => setMobileOpen(false), []);
  useDialogFocus({ open: mobileOpen, containerRef: drawerRef, onClose: closeDrawer });

  const env =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_ENV ||
        (process.env.NODE_ENV === "production" ? "prod" : "local")
      : "local";

  const filteredNav = search.trim()
    ? NAV.map((s) => ({
        ...s,
        items: s.items.filter((it) =>
          it.label.toLowerCase().includes(search.toLowerCase()),
        ),
      })).filter((s) => s.items.length > 0)
    : NAV;

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));

  return (
    <div
      className={`urban-admin ${styles.adminRoot}`}
    >
      <SkipLink targetId="admin-main-content" />
      {/* Sidebar desktop */}
      <aside
        className={`urban-admin-sidebar ${styles.sidebar}`}
        data-mobile-hidden
      >
        <SidebarContent
          NAV={filteredNav}
          search={search}
          setSearch={setSearch}
          isActive={isActive}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu de operação"
          className={styles.drawerOverlay}
        >
          <div
            className={`urban-admin-backdrop ${styles.drawerBackdrop}`}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className={`urban-admin-sidebar urban-admin-drawer-panel ${styles.drawerPanel}`}
          >
            <SidebarContent
              NAV={filteredNav}
              search={search}
              setSearch={setSearch}
              isActive={isActive}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className={styles.mainColumn}>
        {/* Topbar */}
        <header
          className={styles.topBar}
        >
          <div className={styles.topBarStart}>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              data-mobile-only
              className={styles.menuButton}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </svg>
            </button>
            <Breadcrumb pathname={pathname} />
          </div>
          <div className={styles.topBarEnd}>
            <ThemeToggle compact />
            <EnvBadge env={env} />
            <AdminAvatar />
          </div>
        </header>

        {/* Conteúdo da rota */}
        <main
          id="admin-main-content"
          tabIndex={-1}
          className={`urban-admin-main ${styles.mainContent}`}
        >
          {children}
        </main>
      </div>

      {/* Responsividade — mobile vs desktop */}
      <style jsx global>{`
        @media (max-width: 767px) {
          .urban-admin [data-mobile-hidden] {
            display: none !important;
          }
          .urban-admin [data-mobile-only] {
            display: inline-flex !important;
          }
        }
        @media (min-width: 768px) {
          .urban-admin [data-mobile-only] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function SidebarContent({
  NAV,
  search,
  setSearch,
  isActive,
}: {
  NAV: NavSection[];
  search: string;
  setSearch: (v: string) => void;
  isActive: (href: string) => boolean;
}) {
  return (
    <>
      {/* Wordmark */}
      <div
        className={styles.wordmarkRow}
      >
        <BrandLogo variant="wordmark" alt="My Urban" className="urban-admin-logo" />
        <span
          className={styles.wordmarkSuffix}
        >
          / suporte
        </span>
      </div>

      {/* Switch operação -> anfitrião (volta para o painel do anfitrião) */}
      <NextLink
        href="/painel"
        title="Voltar para painel do anfitrião"
        className={styles.switchLink}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background =
            "var(--admin-accent-soft)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background =
            "var(--admin-accent-soft)";
        }}
      >
        <span className={styles.switchLinkInner}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9.5Z" />
          </svg>
          Painel anfitrião
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14" />
          <path d="m13 5 7 7-7 7" />
        </svg>
      </NextLink>

      {/* Busca */}
      <div className={styles.searchWrap}>
        <div className={styles.searchField}>
          <span
            className={styles.searchIcon}
          >
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Buscar seção…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.navList}>
        {NAV.map((section) => (
          <div key={section.title}>
            <p className="urban-admin-sidebar-section">{section.title}</p>
            {section.items.map((item) => (
              <NextLink
                key={item.href}
                href={item.href}
                className="urban-admin-sidebar-item"
                data-active={isActive(item.href)}
              >
                <span className={styles.navItemInner}>
                  {item.icon}
                </span>
                {item.label}
              </NextLink>
            ))}
          </div>
        ))}
        {NAV.length === 0 && (
          <p
            className={styles.navEmpty}
          >
            Nenhuma seção encontrada.
          </p>
        )}
      </nav>
    </>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const current = getBreadcrumb(pathname);
  const isRoot = pathname === "/admin" || pathname === "/admin/";
  return (
    <nav
      aria-label="Breadcrumb"
      className={styles.breadcrumb}
    >
      <NextLink
        href="/admin"
        className={styles.breadcrumbLink}
      >
        OPERAÇÃO
      </NextLink>
      {!isRoot && (
        <>
          <ChevronRight size={12} />
          <span
            className={styles.breadcrumbCurrent}
          >
            {current}
          </span>
        </>
      )}
    </nav>
  );
}

function EnvBadge({ env }: { env: string }) {
  const kindMap: Record<string, { label: string; color: string }> = {
    prod: { label: "PROD", color: "var(--admin-success)" },
    production: { label: "PROD", color: "var(--admin-success)" },
    staging: { label: "STAGING", color: "var(--admin-warning)" },
    local: { label: "LOCAL", color: "var(--admin-text-muted)" },
    development: { label: "DEV", color: "var(--admin-text-muted)" },
  };
  const it = kindMap[env] ?? { label: env.toUpperCase(), color: "var(--admin-text-muted)" };
  return (
    <span
      className={styles.envBadge}
      style={{ "--env-color": it.color } as React.CSSProperties}
    >
      <span className={styles.envBadgeDot} />
      {it.label}
    </span>
  );
}

function AdminAvatar() {
  return (
    <div
      aria-label="Conta de operação"
      className={styles.avatar}
    >
      AD
    </div>
  );
}
