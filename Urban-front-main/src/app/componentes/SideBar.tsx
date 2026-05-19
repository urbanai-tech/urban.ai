'use client';

import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../service/api';
import { setSentryUser, clearSentryUser, trackEvent } from '../service/tracking';
import '../../../i18n';

/**
 * Shell de navegação do app autenticado — sprint design premium 2026-05-16.
 *
 * Repaginado de Chakra light para DARK premium (estilo Stripe Dashboard /
 * Linear / Vercel Analytics). Objetivos:
 *  - Sidebar dark `#0E1117` (mesma família do .urban-admin) — anfitriao
 *    sente continuidade com a marca da landing.
 *  - SVG inline (não react-icons) para zero variacao por OS.
 *  - Microinteracoes: hover slide accent, active border-left orange.
 *  - Switch admin↔host na sidebar quando user.role === 'admin' (item #2 do
 *    requerimento).
 *  - Mobile: top bar + bottom-nav 4 itens + drawer "Mais".
 *  - O wrapper Flex/Box do layout `app/<rota>/layout.tsx` continua sendo
 *    quem segura o conteudo da pagina.
 */

type Me = {
  username: string;
  role?: string;
};

const PRIMARY_NAV = [
  { path: '/painel', label: 'Painel', icon: 'bar-chart' as const },
  { path: '/dashboard', label: 'Calendário', icon: 'calendar' as const },
  { path: '/portfolio', label: 'Portfólio', icon: 'layers' as const },
  { path: '/maps', label: 'Mapa', icon: 'map-pin' as const },
  { path: '/properties', label: 'Imóveis', icon: 'home' as const },
];

const SECONDARY_NAV = [
  { path: '/notificacao', label: 'Notificações', icon: 'bell' as const },
  { path: '/my-roi', label: 'Meu ROI', icon: 'trending-up' as const },
  { path: '/my-plan', label: 'Meu plano', icon: 'dollar' as const },
  { path: '/settings/integrations', label: 'Integrações', icon: 'plug' as const },
  { path: '/event-log', label: 'Ajustes', icon: 'settings' as const },
];

const HOST_SIDEBAR_COLLAPSED_KEY = 'urban-host-sidebar-collapsed';

export default function SideBar() {
  const { t: _t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname() || '';
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    try {
      const savedCollapsed = window.localStorage.getItem(HOST_SIDEBAR_COLLAPSED_KEY);
      if (savedCollapsed === 'true') {
        setCollapsed(true);
      } else if (savedCollapsed === 'false') {
        setCollapsed(false);
      }
    } catch {
      /* keep the default expanded state */
    }
  }, []);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => {
        const data = res.data;
        setMe(data);
        // Sentry user context (gap J7) — falha silenciosa se Sentry nao carregar.
        if (data?.id) {
          void setSentryUser({
            id: data.id,
            email: data.email,
            role: data.role,
            plan: data.plan ?? data.activePlan ?? undefined,
          });
        }
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        router.push('/');
      });
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
    }
    try {
      void trackEvent('logout');
      void clearSentryUser();
    } catch {
      /* never block logout */
    }
    localStorage.removeItem('accessToken');
    router.push('/');
  }

  const isActive = (route: string) => pathname === route;
  const isAdmin = (me?.role || '').toLowerCase() === 'admin';
  const displayName = me?.username || 'Anfitrião';
  const initial = displayName.charAt(0).toUpperCase();

  function handleSidebarToggle() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(HOST_SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* preference persistence is best-effort */
      }
      return next;
    });
  }

  return (
    <>
      {/* ============================ DESKTOP SIDEBAR ============================ */}
      <aside
        data-host-sidebar
        style={{
          display: 'none',
          width: collapsed ? 76 : 248,
          flexShrink: 0,
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: '#0E1117',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          transition: 'width 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          flexDirection: 'column',
          color: 'rgba(255, 255, 255, 0.92)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header: wordmark + toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '20px 0' : '20px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            height: 64,
          }}
        >
          {!collapsed && (
            <NextLink
              href="/painel"
              style={{ display: 'flex', alignItems: 'baseline', gap: 6, textDecoration: 'none' }}
            >
              <span
                style={{
                  fontFamily: "'Bebas Neue', Inter, sans-serif",
                  fontSize: 22,
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  lineHeight: 1,
                  letterSpacing: 0,
                }}
              >
                URBAN
              </span>
              <span
                style={{
                  fontFamily: "'Bebas Neue', Inter, sans-serif",
                  fontSize: 22,
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  color: '#E8500A',
                  lineHeight: 1,
                  letterSpacing: 0,
                }}
              >
                AI
              </span>
            </NextLink>
          )}
          <button
            type="button"
            onClick={handleSidebarToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.10)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.65)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms, color 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
            }}
          >
            {collapsed ? <MenuIcon /> : <CollapseIcon />}
          </button>
        </div>

        {/* Switch admin↔host (apenas para admins) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => router.push('/admin/dashboard')}
            title="Trocar para painel admin"
            style={{
              margin: collapsed ? '16px 12px 0' : '16px 16px 0',
              padding: collapsed ? '10px 0' : '10px 14px',
              background: 'rgba(232, 80, 10, 0.10)',
              border: '1px solid rgba(232, 80, 10, 0.30)',
              borderRadius: 10,
              color: '#E8500A',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              gap: 8,
              transition: 'background 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(232, 80, 10, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(232, 80, 10, 0.10)';
            }}
          >
            {collapsed ? (
              <ShieldIcon />
            ) : (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ShieldIcon /> Painel admin
                </span>
                <ArrowRightIcon size={12} />
              </>
            )}
          </button>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {!collapsed && <SectionLabel label="Principal" />}
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.path}
              path={item.path}
              icon={item.icon}
              label={item.label}
              active={isActive(item.path)}
              collapsed={collapsed}
              onSelect={() => {
                router.push(item.path);
                setMobileOpen(false);
              }}
            />
          ))}

          {!collapsed && <SectionLabel label="Conta" />}
          {SECONDARY_NAV.map((item) => (
            <NavLink
              key={item.path}
              path={item.path}
              icon={item.icon}
              label={item.label}
              active={isActive(item.path)}
              collapsed={collapsed}
              onSelect={() => {
                router.push(item.path);
                setMobileOpen(false);
              }}
            />
          ))}
        </nav>

        {/* Account block + logout */}
        <div
          style={{
            padding: collapsed ? 12 : 14,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: collapsed ? 'column' : 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              color: '#FFFFFF',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.45)',
                  fontWeight: 500,
                }}
              >
                {isAdmin ? 'Admin' : 'Anfitrião'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.10)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.65)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 120ms, border-color 120ms, background 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.20)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.10)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ============================ MOBILE TOP BAR ============================ */}
      <header
        data-host-mobile-topbar
        style={{
          display: 'flex',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          height: 56,
          padding: '0 16px',
          background: '#0E1117',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <NextLink
          href="/painel"
          style={{ display: 'flex', alignItems: 'baseline', gap: 6, textDecoration: 'none' }}
        >
          <span
            style={{
              fontFamily: "'Bebas Neue', Inter, sans-serif",
              fontSize: 20,
              fontWeight: 400,
              textTransform: 'uppercase',
              color: '#FFFFFF',
              lineHeight: 1,
            }}
          >
            URBAN
          </span>
          <span
            style={{
              fontFamily: "'Bebas Neue', Inter, sans-serif",
              fontSize: 20,
              fontWeight: 400,
              textTransform: 'uppercase',
              color: '#E8500A',
              lineHeight: 1,
            }}
          >
            AI
          </span>
        </NextLink>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.10)',
            background: 'transparent',
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MenuIcon />
        </button>
      </header>

      {/* ============================ MOBILE BOTTOM NAV ============================ */}
      <nav
        data-host-bottom-nav
        style={{
          display: 'flex',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: 64,
          background: '#0E1117',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          justifyContent: 'space-around',
          alignItems: 'stretch',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {PRIMARY_NAV.map((item) => (
          <BottomNavItem
            key={item.path}
            path={item.path}
            icon={item.icon}
            label={item.label}
            active={isActive(item.path)}
            onSelect={() => router.push(item.path)}
          />
        ))}
        <BottomNavItem
          path="__more"
          icon="more"
          label="Mais"
          active={mobileOpen}
          onSelect={() => setMobileOpen(true)}
        />
      </nav>

      {/* Spacer */}
      <div data-host-bottom-spacer style={{ height: 64 }} />

      {/* ============================ MOBILE DRAWER MAIS ============================ */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
            }}
          />
          <aside
            style={{
              position: 'relative',
              width: '85%',
              maxWidth: 320,
              height: '100%',
              background: '#0E1117',
              borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              color: 'rgba(255, 255, 255, 0.92)',
              animation: 'urban-app-drawer-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <header
              style={{
                padding: 16,
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.45)',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Mais opções
              </p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  background: 'transparent',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CloseIcon />
              </button>
            </header>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  router.push('/admin/dashboard');
                  setMobileOpen(false);
                }}
                style={{
                  margin: '16px',
                  padding: '12px 16px',
                  background: 'rgba(232, 80, 10, 0.12)',
                  border: '1px solid rgba(232, 80, 10, 0.30)',
                  borderRadius: 10,
                  color: '#E8500A',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ShieldIcon /> Painel admin
                </span>
                <ArrowRightIcon size={12} />
              </button>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              <SectionLabel label="Conta" />
              {SECONDARY_NAV.map((item) => (
                <NavLink
                  key={item.path}
                  path={item.path}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.path)}
                  onSelect={() => {
                    router.push(item.path);
                    setMobileOpen(false);
                  }}
                />
              ))}
            </div>

            <div
              style={{
                padding: 16,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </p>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 11,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.45)',
                    fontWeight: 500,
                  }}
                >
                  {isAdmin ? 'Admin' : 'Anfitrião'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  background: 'transparent',
                  color: 'rgba(255, 255, 255, 0.85)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LogoutIcon />
              </button>
            </div>
          </aside>
        </div>
      )}

      <style jsx global>{`
        @keyframes urban-app-drawer-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @media (min-width: 768px) {
          [data-host-sidebar] {
            display: flex !important;
          }
          [data-host-mobile-topbar],
          [data-host-bottom-nav],
          [data-host-bottom-spacer] {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          [data-host-mobile-topbar] {
            display: flex !important;
          }
          [data-host-bottom-nav] {
            display: flex !important;
          }
          [data-host-bottom-spacer] {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}

// =================== Sub-components ===================

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      style={{
        margin: 0,
        padding: '20px 18px 8px',
        fontSize: 10,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.35)',
        fontWeight: 600,
      }}
    >
      {label}
    </p>
  );
}

type IconKey =
  | 'bar-chart'
  | 'calendar'
  | 'map-pin'
  | 'home'
  | 'layers'
  | 'bell'
  | 'trending-up'
  | 'dollar'
  | 'plug'
  | 'settings'
  | 'more';

function NavLink({
  path: _path,
  icon,
  label,
  active,
  collapsed,
  onSelect,
}: {
  path: string;
  icon: IconKey;
  label: string;
  active: boolean;
  collapsed?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        height: 40,
        padding: collapsed ? '0' : '0 18px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        border: 'none',
        borderLeft: active
          ? '2px solid #E8500A'
          : '2px solid transparent',
        background: active ? 'rgba(232, 80, 10, 0.06)' : 'transparent',
        color: active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: 0.2,
        cursor: 'pointer',
        transition: 'color 120ms, background 120ms',
        textAlign: 'left',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#FFFFFF';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ display: 'inline-flex', lineHeight: 0 }}>
        <NavIcon name={icon} />
      </span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function BottomNavItem({
  path: _path,
  icon,
  label,
  active,
  onSelect,
}: {
  path: string;
  icon: IconKey;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '8px 0 6px',
        color: active ? '#E8500A' : 'rgba(255, 255, 255, 0.55)',
        fontSize: 10,
        fontWeight: active ? 600 : 500,
        letterSpacing: 0.5,
        cursor: 'pointer',
        transition: 'color 120ms',
        fontFamily: 'Inter, system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {active && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 24,
            height: 2,
            background: '#E8500A',
            borderRadius: '0 0 4px 4px',
          }}
        />
      )}
      <NavIcon name={icon} />
      {label}
    </button>
  );
}

// =================== SVG icons inline (monocromático, herdam currentColor) ===================
function NavIcon({ name }: { name: IconKey }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'bar-chart':
      return (
        <svg {...props}>
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...props}>
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9.5Z" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...props}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...props}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'trending-up':
      return (
        <svg {...props}>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case 'dollar':
      return (
        <svg {...props}>
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'plug':
      return (
        <svg {...props}>
          <path d="M9 2v6" />
          <path d="M15 2v6" />
          <path d="M5 8h14v4a7 7 0 0 1-14 0V8Z" />
          <path d="M12 19v3" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );
    case 'more':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" />
          <circle cx="5" cy="12" r="1.4" fill="currentColor" />
        </svg>
      );
  }
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  );
}
function CollapseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function ArrowRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
