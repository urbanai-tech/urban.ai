'use client';

import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../service/api';
import { shouldRedirectToLogin } from '../lib/sidebar-auth';
import { invalidateAuthCache, invalidateSubscriptionCache } from '../context/subscription-status';
import { setSentryUser, clearSentryUser, trackEvent } from '../service/tracking';
import { ThemeToggle } from './theme/ThemeToggle';
import { useDialogFocus } from './ui/useDialogFocus';
import { BrandLogo } from './ui/BrandLogo';
import '../../../i18n';
import styles from './SideBar.module.css';

/**
 * Shell de navegação do app autenticado — sprint design premium 2026-05-16.
 *
 * Repaginado de Chakra light para DARK premium (estilo Stripe Dashboard /
 * Linear / Vercel Analytics). Objetivos:
 *  - Sidebar dark `#0E1117` (mesma família do .urban-admin) — anfitrião
 *    sente continuidade com a marca da landing.
 *  - SVG inline (não react-icons) para zero variação por OS.
 *  - Microinteracoes: hover slide accent, active border-left orange.
 *  - Switch admin↔host na sidebar quando user.role === 'admin' (item #2 do
 *    requerimento).
 *  - Mobile (2026-10-26): top bar de vidro compacta (título colapsa ao rolar),
 *    tab bar de vidro com 4 abas + "Mais" em bottom sheet, safe areas e
 *    alvos de 44px. Estilo em `ui/host-mobile.css`, só tokens.
 *  - O wrapper Flex/Box do layout `app/<rota>/layout.tsx` continua sendo
 *    quem segura o conteúdo da página.
 */

type Me = {
  username: string;
  role?: string;
};

// Prioridade de navegação (marca My Urban, 26/10): Hoje, Calendário, Imóveis e
// Avisos são as quatro abas da tab bar mobile e o topo da sidebar desktop.
// As rotas não mudam; só os rótulos (Hoje = /painel, Avisos = /notificacao).
const PRIMARY_NAV = [
  { path: '/painel', label: 'Hoje', icon: 'bar-chart' as const },
  { path: '/dashboard', label: 'Calendário', icon: 'calendar' as const },
  { path: '/properties', label: 'Imóveis', icon: 'home' as const },
  { path: '/notificacao', label: 'Avisos', icon: 'bell' as const },
];

// Desktop: grupo "Explorar" logo abaixo do principal.
const EXPLORE_NAV = [
  { path: '/event-radar', label: 'Radar', icon: 'trending-up' as const },
  { path: '/events', label: 'Eventos', icon: 'calendar' as const },
  { path: '/portfolio', label: 'Portfólio', icon: 'layers' as const },
  { path: '/maps', label: 'Mapa', icon: 'map-pin' as const },
];

// Desktop: grupo "Conta".
const ACCOUNT_NAV = [
  { path: '/my-roi', label: 'Ganhos', icon: 'trending-up' as const },
  { path: '/my-plan', label: 'Meu plano', icon: 'dollar' as const },
  { path: '/profile', label: 'Perfil', icon: 'user' as const },
  { path: '/settings/integrations', label: 'Integrações', icon: 'plug' as const },
  { path: '/settings/communications', label: 'Comunicações', icon: 'bell' as const },
  { path: '/settings/pricing', label: 'Precificação', icon: 'settings' as const },
];

const MOBILE_PRIMARY_NAV = PRIMARY_NAV;
// Sheet "Mais": Radar/Eventos, Portfólio, Ganhos, Plano, Perfil, Integrações,
// Comunicações, Precificação e, por último, Mapa.
const MOBILE_MORE_NAV = [
  ...EXPLORE_NAV.filter((item) => item.path !== '/maps'),
  ...ACCOUNT_NAV,
  ...EXPLORE_NAV.filter((item) => item.path === '/maps'),
];
const ALL_NAV = [...PRIMARY_NAV, ...EXPLORE_NAV, ...ACCOUNT_NAV];

const HOST_SIDEBAR_COLLAPSED_KEY = 'urban-host-sidebar-collapsed';
const TOPBAR_COLLAPSE_OFFSET = 24;

/** Micro-feedback tátil no Android (iOS ignora). Respeita reduced-motion. */
function tapFeedback() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate?.(8);
  } catch {
    /* feedback é opcional */
  }
}

export default function SideBar() {
  const { t: _t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname() || '';
  const [me, setMe] = useState<Me | null>(null);
  const [authRetry, setAuthRetry] = useState(false);
  const closeMore = useCallback(() => setMobileOpen(false), []);

  useDialogFocus({
    open: mobileOpen,
    containerRef: sheetRef,
    onClose: closeMore,
  });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > TOPBAR_COLLAPSE_OFFSET);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let savedCollapsed: string | null = null;
    try {
      savedCollapsed = window.localStorage.getItem(HOST_SIDEBAR_COLLAPSED_KEY);
    } catch {
      /* keep the default state */
    }
    if (savedCollapsed === 'true') {
      setCollapsed(true);
      return;
    }
    if (savedCollapsed === 'false') {
      setCollapsed(false);
      return;
    }
    // Sem preferência salva: em tablet (768-1180px) a sidebar de 247px espremia o
    // conteúdo; começa recolhida (trilho de ícones) e acompanha a largura (DS-05).
    const upToTablet = window.matchMedia('(max-width: 1180px)');
    const mobile = window.matchMedia('(max-width: 767px)');
    const sync = () => setCollapsed(upToTablet.matches && !mobile.matches);
    sync();
    upToTablet.addEventListener('change', sync);
    mobile.addEventListener('change', sync);
    return () => {
      upToTablet.removeEventListener('change', sync);
      mobile.removeEventListener('change', sync);
    };
  }, []);

  const loadMe = useCallback(() => {
    setAuthRetry(false);
    api
      .get('/auth/me')
      .then((res) => {
        const data = res.data;
        setMe(data);
        // Sentry user context (gap J7) — falha silenciosa se Sentry não carregar.
        if (data?.id) {
          void setSentryUser({
            id: data.id,
            email: data.email,
            role: data.role,
            plan: data.plan ?? data.activePlan ?? undefined,
          });
        }
      })
      .catch((error: { response?: { status?: number } }) => {
        if (shouldRedirectToLogin(error?.response?.status)) {
          // Sessão inválida (401): volta ao login.
          router.push('/');
          return;
        }
        // Rede/5xx: a pessoa segue na página e pode tentar de novo.
        setAuthRetry(true);
      });
  }, [router]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // O sheet vive dentro do shell (contexto de empilhamento próprio) e o FAB do
  // Ask Urban é irmão do shell: com o sheet aberto, o FAB sai de cena.
  useEffect(() => {
    const root = document.documentElement;
    if (mobileOpen) root.setAttribute('data-sheet-open', '');
    else root.removeAttribute('data-sheet-open');
    return () => root.removeAttribute('data-sheet-open');
  }, [mobileOpen]);

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
    invalidateAuthCache();
    invalidateSubscriptionCache();
    router.push('/');
  }

  const isActive = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  const isAdmin = (me?.role || '').toLowerCase() === 'admin';
  const displayName = me?.username || 'Anfitrião';
  const initial = displayName.charAt(0).toUpperCase();
  const currentTitle = ALL_NAV.find((item) => isActive(item.path))?.label ?? 'My Urban';
  const moreActive = MOBILE_MORE_NAV.some((item) => isActive(item.path));

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
      {authRetry && (
        <div role="alert" className="funnel-gate funnel-gate--inline">
          <div>
            <p>Não conseguimos carregar sua conta agora.</p>
            <button type="button" onClick={() => loadMe()}>
              Tentar de novo
            </button>
          </div>
        </div>
      )}
      {/* ============================ DESKTOP SIDEBAR ============================ */}
      <aside
        data-host-sidebar
        className={`urban-host-sidebar ${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
      >
        {/* Header: wordmark + toggle */}
        <div className={`${styles.sidebarHeader} ${collapsed ? styles.sidebarHeaderCollapsed : ''}`}>
          {!collapsed && (
            <NextLink
              href="/painel"
              className="urban-sidebar-brand"
              aria-label="My Urban, ir para o painel"
            >
              <BrandLogo variant="wordmark" priority />
            </NextLink>
          )}
          <button
            type="button"
            onClick={handleSidebarToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
            className={styles.sidebarToggle}
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
            className={`${styles.adminSwitch} ${collapsed ? styles.adminSwitchCollapsed : ''}`}
          >
            {collapsed ? (
              <ShieldIcon />
            ) : (
              <>
                <span className={styles.adminSwitchLabel}>
                  <ShieldIcon /> Painel admin
                </span>
                <ArrowRightIcon size={12} />
              </>
            )}
          </button>
        )}

        {/* Nav */}
        <nav className={styles.sidebarNav}>
          {!collapsed && <SectionLabel label="Principal" />}
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.path}
              path={item.path}
              icon={item.icon}
              label={item.label}
              active={isActive(item.path)}
              collapsed={collapsed}
              onSelect={() => setMobileOpen(false)}
            />
          ))}

          {!collapsed && <SectionLabel label="Explorar" />}
          {EXPLORE_NAV.map((item) => (
            <NavLink
              key={item.path}
              path={item.path}
              icon={item.icon}
              label={item.label}
              active={isActive(item.path)}
              collapsed={collapsed}
              onSelect={() => setMobileOpen(false)}
            />
          ))}

          {!collapsed && <SectionLabel label="Conta" />}
          {ACCOUNT_NAV.map((item) => (
            <NavLink
              key={item.path}
              path={item.path}
              icon={item.icon}
              label={item.label}
              active={isActive(item.path)}
              collapsed={collapsed}
              onSelect={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <div className={`${styles.sidebarThemeRow} ${collapsed ? styles.sidebarThemeRowCollapsed : ''}`}>
          <ThemeToggle
            compact={collapsed}
            showLabels={false}
            style={
              collapsed
                ? { justifyContent: 'center' }
                : { width: '100%', justifyContent: 'center' }
            }
          />
        </div>

        {/* Account block + logout */}
        <div className={`${styles.accountBlock} ${collapsed ? styles.accountBlockCollapsed : ''}`}>
          <div aria-hidden className={styles.accountAvatar}>
            {initial}
          </div>
          {!collapsed && (
            <div className={styles.accountText}>
              <p className={styles.accountName}>
                {displayName}
              </p>
              <p className={styles.accountRole}>
                {isAdmin ? 'Admin' : 'Anfitrião'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair"
            className={styles.logoutButton}
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ============================ MOBILE TOP BAR ============================ */}
      <header
        data-host-mobile-topbar
        data-scrolled={scrolled ? 'true' : 'false'}
        className="urban-topbar urban-glass"
      >
        <div className="urban-topbar__inner">
          <NextLink href="/painel" className="urban-topbar__brand" aria-label="My Urban, ir para o painel">
            <BrandLogo variant="wordmark" priority />
          </NextLink>
          <p className="urban-topbar__title" aria-hidden="true">
            {currentTitle}
          </p>
        </div>
      </header>

      {/* ============================ MOBILE TAB BAR ============================ */}
      <nav data-host-bottom-nav aria-label="Navegação principal" className="urban-tabbar urban-glass">
        <ul className="urban-tabbar__list">
          {MOBILE_PRIMARY_NAV.map((item) => (
            <li key={item.path} className="urban-tabbar__item">
              <NextLink
                href={item.path}
                className="urban-tabbar__link"
                aria-current={isActive(item.path) ? 'page' : undefined}
                onClick={tapFeedback}
              >
                <span className="urban-tabbar__icon">
                  <NavIcon name={item.icon} />
                </span>
                <span className="urban-tabbar__label">{item.label}</span>
              </NextLink>
            </li>
          ))}
          <li className="urban-tabbar__item">
            <button
              ref={moreButtonRef}
              type="button"
              className="urban-tabbar__link"
              aria-haspopup="dialog"
              aria-expanded={mobileOpen}
              aria-controls="host-more-sheet"
              data-section-active={moreActive ? 'true' : undefined}
              onClick={() => {
                tapFeedback();
                setMobileOpen(true);
              }}
            >
              <span className="urban-tabbar__icon">
                <NavIcon name="more" />
              </span>
              <span className="urban-tabbar__label">Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ============================ MOBILE SHEET "MAIS" ============================ */}
      {mobileOpen && (
        <div className="urban-sheet-root">
          <button
            type="button"
            className="urban-sheet-scrim"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={closeMore}
          />
          <div
            ref={sheetRef}
            id="host-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="host-more-sheet-title"
            tabIndex={-1}
            className="urban-sheet"
          >
            <div className="urban-sheet__grabber" aria-hidden="true" />
            <div className="urban-sheet__header">
              <h2 id="host-more-sheet-title" className="urban-sheet__title">
                Mais
              </h2>
              <button
                type="button"
                onClick={closeMore}
                aria-label="Fechar"
                className="urban-icon-btn"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="urban-sheet__body">
              {isAdmin && (
                <button
                  type="button"
                  className="urban-sheet__admin"
                  onClick={() => {
                    router.push('/admin/dashboard');
                    closeMore();
                  }}
                >
                  <span className="urban-sheet__admin-label">
                    <ShieldIcon /> Painel admin
                  </span>
                  <ArrowRightIcon size={12} />
                </button>
              )}

              <p className="urban-sheet__section-label">Menu</p>
              <ul className="urban-sheet__grid">
                {MOBILE_MORE_NAV.map((item) => (
                  <li key={item.path}>
                    <NextLink
                      href={item.path}
                      className="urban-sheet__tile"
                      aria-current={isActive(item.path) ? 'page' : undefined}
                      onClick={closeMore}
                    >
                      <NavIcon name={item.icon} />
                      <span>{item.label}</span>
                    </NextLink>
                  </li>
                ))}
              </ul>

              <p className="urban-sheet__section-label">Aparência</p>
              <div className="urban-sheet__theme">
                <ThemeToggle />
              </div>

              <p className="urban-sheet__section-label">Conta</p>
              <div className="urban-sheet__row">
                <div aria-hidden="true" className="urban-avatar">
                  {initial}
                </div>
                <div className="urban-account">
                  <p className="urban-account__name">{displayName}</p>
                  <p className="urban-account__role">{isAdmin ? 'Admin' : 'Anfitrião'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sair"
                  className="urban-icon-btn urban-icon-btn--bordered"
                >
                  <LogoutIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =================== Sub-components ===================

function SectionLabel({ label }: { label: string }) {
  return (
    <p className={styles.sectionLabel}>
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
  | 'user'
  | 'plug'
  | 'settings'
  | 'more';

function NavLink({
  path,
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
  // Link real (abrir em nova aba, semântica de navegação) com aria-current no ativo.
  return (
    <NextLink
      href={path}
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={`${styles.navLink} ${collapsed ? styles.navLinkCollapsed : ''} ${active ? styles.navLinkActive : ''}`}
    >
      <span className={styles.navLinkIcon}>
        <NavIcon name={icon} />
      </span>
      {!collapsed && <span>{label}</span>}
    </NextLink>
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
    case 'user':
      return (
        <svg {...props}>
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
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
