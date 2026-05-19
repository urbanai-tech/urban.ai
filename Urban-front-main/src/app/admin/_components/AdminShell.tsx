"use client";

import React, { useState, useEffect } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Calendar,
  ChevronRight,
  Database,
  DollarSign,
  FileText,
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
      { href: "/admin", label: "Overview", icon: <Layers size={16} /> },
      { href: "/admin/dashboard", label: "Dashboard", icon: <Activity size={16} /> },
      { href: "/admin/finance", label: "Financeiro", icon: <DollarSign size={16} /> },
      { href: "/admin/funnel", label: "Funil", icon: <TrendingUp size={16} /> },
      { href: "/admin/roi", label: "ROI", icon: <Briefcase size={16} /> },
      { href: "/admin/alpha", label: "Alpha", icon: <Zap size={16} /> },
      { href: "/admin/contacts", label: "Contatos", icon: <Inbox size={16} /> },
      { href: "/admin/waitlist", label: "Waitlist", icon: <Users size={16} /> },
    ],
  },
  {
    title: "Motor de eventos",
    items: [
      { href: "/admin/events", label: "Eventos", icon: <Calendar size={16} /> },
      { href: "/admin/events/new", label: "Cadastrar evento", icon: <Plus size={16} /> },
      { href: "/admin/events/import", label: "Importar CSV", icon: <Upload size={16} /> },
      { href: "/admin/coverage", label: "Cobertura", icon: <MapPin size={16} /> },
      { href: "/admin/collectors-health", label: "Coletores", icon: <Activity size={16} /> },
    ],
  },
  {
    title: "Operações",
    items: [
      { href: "/admin/properties", label: "Imóveis (drill-down)", icon: <Briefcase size={16} /> },
      { href: "/admin/jobs", label: "Jobs", icon: <Server size={16} /> },
      { href: "/admin/stays", label: "Stays", icon: <Database size={16} /> },
      { href: "/admin/users", label: "Usuários", icon: <Users size={16} /> },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/audit-logs", label: "Auditoria", icon: <Shield size={16} /> },
      { href: "/admin/pricing-config", label: "Pricing config", icon: <Settings size={16} /> },
      { href: "/admin/quality", label: "Qualidade", icon: <AlertCircle size={16} /> },
      { href: "/admin/onboarding-drip", label: "Onboarding drip", icon: <Mail size={16} /> },
    ],
  },
];

const FLAT_ITEMS: NavItem[] = NAV.flatMap((s) => s.items);

function getBreadcrumb(pathname: string): string {
  // Mais específico primeiro (ex: /admin/events/new antes de /admin/events)
  const sorted = [...FLAT_ITEMS].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  return match?.label ?? "Admin";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Fecha mobile drawer ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ESC fecha mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

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
      className="urban-admin"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--admin-bg)",
        color: "var(--admin-text)",
      }}
    >
      {/* Sidebar desktop */}
      <aside
        className="urban-admin-sidebar"
        style={{
          width: 240,
          flexShrink: 0,
          height: "100vh",
          position: "sticky",
          top: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
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
          aria-label="Menu admin"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            display: "flex",
          }}
        >
          <div
            className="urban-admin-backdrop"
            onClick={() => setMobileOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(2px)",
            }}
          />
          <aside
            className="urban-admin-sidebar urban-admin-drawer-panel"
            style={{
              position: "relative",
              width: 280,
              maxWidth: "85vw",
              height: "100vh",
              overflowY: "auto",
            }}
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
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            height: 56,
            padding: "0 24px",
            background: "rgba(8, 10, 15, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--admin-divider)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              data-mobile-only
              style={{
                display: "none",
                background: "transparent",
                border: "1px solid var(--admin-divider-strong)",
                borderRadius: 2,
                color: "var(--admin-text)",
                padding: "6px 8px",
                cursor: "pointer",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </svg>
            </button>
            <Breadcrumb pathname={pathname} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <EnvBadge env={env} />
            <AdminAvatar />
          </div>
        </header>

        {/* Conteúdo da rota */}
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
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
        style={{
          padding: "20px 16px",
          borderBottom: "1px solid var(--admin-divider)",
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span
          className="urban-admin-display"
          style={{
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: 0,
            color: "var(--admin-text)",
            textTransform: "uppercase",
          }}
        >
          URBAN
        </span>
        <span
          className="urban-admin-display"
          style={{
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: 0,
            color: "var(--admin-accent)",
            textTransform: "uppercase",
          }}
        >
          AI
        </span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--admin-text-dim)",
          }}
        >
          / admin
        </span>
      </div>

      {/* Switch admin → anfitriao (volta pro painel do anfitriao) */}
      <NextLink
        href="/painel"
        title="Voltar para painel do anfitrião"
        style={{
          margin: "12px 12px 0",
          padding: "10px 14px",
          background: "rgba(232, 80, 10, 0.10)",
          border: "1px solid rgba(232, 80, 10, 0.30)",
          borderRadius: 2,
          color: "var(--admin-accent)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          transition: "background 120ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background =
            "rgba(232, 80, 10, 0.18)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background =
            "rgba(232, 80, 10, 0.10)";
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
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
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--admin-text-dim)",
              pointerEvents: "none",
              display: "flex",
            }}
          >
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Buscar seção…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              height: 32,
              padding: "0 10px 0 32px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
              color: "var(--admin-text)",
              fontSize: 12,
              outline: "none",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "8px 0 24px" }}>
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
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  {item.icon}
                </span>
                {item.label}
              </NextLink>
            ))}
          </div>
        ))}
        {NAV.length === 0 && (
          <p
            style={{
              padding: "12px 16px",
              fontSize: 12,
              color: "var(--admin-text-dim)",
            }}
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 500,
        color: "var(--admin-text-muted)",
        minWidth: 0,
      }}
    >
      <NextLink
        href="/admin"
        style={{
          color: "var(--admin-text-muted)",
          textDecoration: "none",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        ADMIN
      </NextLink>
      {!isRoot && (
        <>
          <ChevronRight size={12} />
          <span
            style={{
              color: "var(--admin-text)",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 0,
              textTransform: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        border: "1px solid var(--admin-divider-strong)",
        borderRadius: 2,
        color: it.color,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          background: it.color,
          borderRadius: "50%",
        }}
      />
      {it.label}
    </span>
  );
}

function AdminAvatar() {
  return (
    <div
      aria-label="Conta admin"
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "1px solid var(--admin-divider-strong)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--admin-text)",
        background: "rgba(255, 255, 255, 0.03)",
      }}
    >
      AD
    </div>
  );
}
