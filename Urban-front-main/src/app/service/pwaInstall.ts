/**
 * Lógica pura (sem React/DOM) da experiência de instalação do PWA.
 * Testada em scripts/pwa-install.test.mjs.
 *
 * Regras de produto:
 * - Android/desktop Chromium: usa o `beforeinstallprompt` guardado.
 * - iOS Safari: não existe prompt nativo; mostramos a instrução "Adicionar à Tela de Início".
 * - Já instalado (standalone): nunca mostra nada.
 * - Sem insistência: só depois de 2 dias distintos de uso, some após dispensar e volta com
 *   intervalos crescentes (14, 45 e 120 dias); a 4ª dispensa encerra para sempre.
 * - Push no iOS só faz sentido com o app instalado (iOS >= 16.4 e Tela de Início).
 */

export type InstallPlatform =
  | "ios-safari"
  | "ios-other-browser"
  | "android-chromium"
  | "desktop-chromium"
  | "other";

export type InstallState = {
  /** Quantas vezes o usuário dispensou o convite. */
  dismissCount: number;
  /** Quando dispensou pela última vez (ms epoch). */
  dismissedAt: number | null;
  /** Dias distintos (YYYY-MM-DD) em que o app foi aberto; guarda só os últimos. */
  visitDays: string[];
  /** Instalação confirmada (evento appinstalled ou standalone visto). */
  installed: boolean;
};

export type InstallDecision =
  | { kind: "hidden"; reason: HiddenReason }
  | { kind: "native-prompt" }
  | { kind: "ios-instructions" };

export type HiddenReason =
  | "standalone"
  | "installed"
  | "unsupported"
  | "route"
  | "not-enough-visits"
  | "cooldown"
  | "dismissed-forever"
  | "waiting-prompt";

export const INSTALL_STORAGE_KEY = "urban_ai_install_prompt_v1";
export const MIN_VISIT_DAYS = 2;
export const COOLDOWN_DAYS = [14, 45, 120] as const;
export const MAX_DISMISSALS = COOLDOWN_DAYS.length + 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_DAYS = 14;

export const EMPTY_INSTALL_STATE: InstallState = {
  dismissCount: 0,
  dismissedAt: null,
  visitDays: [],
  installed: false,
};

export type PlatformInput = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
};

export function detectInstallPlatform({ userAgent, platform = "", maxTouchPoints = 0 }: PlatformInput): InstallPlatform {
  const ua = userAgent || "";
  // iPadOS 13+ se apresenta como Mac; distingue pelo toque.
  const isIpadOs = /Macintosh/.test(ua) && maxTouchPoints > 1 && /Mac/.test(platform || "Mac");
  const isIos = /iPhone|iPad|iPod/.test(ua) || isIpadOs;
  if (isIos) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\//.test(ua);
    return otherBrowser ? "ios-other-browser" : "ios-safari";
  }
  if (/Android/.test(ua)) return /Chrome|SamsungBrowser|EdgA|OPR/.test(ua) ? "android-chromium" : "other";
  if (/Chrome|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua)) return "desktop-chromium";
  return "other";
}

export function isIosPlatform(platform: InstallPlatform): boolean {
  return platform === "ios-safari" || platform === "ios-other-browser";
}

/** "OS 16_4" no user agent do iOS; null quando não dá para saber. */
export function parseIosVersion(userAgent: string): { major: number; minor: number } | null {
  const match = /OS (\d+)[_.](\d+)/.exec(userAgent || "");
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export type PushEligibility =
  | "ready"
  | "needs-install"
  | "ios-too-old"
  | "unsupported";

/**
 * Web Push no iOS/iPadOS só funciona para o app adicionado à Tela de Início, a partir do 16.4.
 * Em Android e desktop basta o navegador expor Push API.
 */
export function getPushEligibility(input: {
  platform: InstallPlatform;
  standalone: boolean;
  userAgent: string;
  pushApiAvailable: boolean;
}): PushEligibility {
  if (isIosPlatform(input.platform)) {
    const version = parseIosVersion(input.userAgent);
    if (version && (version.major < 16 || (version.major === 16 && version.minor < 4))) return "ios-too-old";
    if (!input.standalone) return "needs-install";
    return input.pushApiAvailable ? "ready" : "unsupported";
  }
  return input.pushApiAvailable ? "ready" : "unsupported";
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function recordVisit(state: InstallState, now: number): InstallState {
  const today = dayKey(now);
  if (state.visitDays.includes(today)) return state;
  return { ...state, visitDays: [...state.visitDays, today].slice(-MAX_TRACKED_DAYS) };
}

export function recordDismissal(state: InstallState, now: number): InstallState {
  return { ...state, dismissCount: state.dismissCount + 1, dismissedAt: now };
}

export function recordInstalled(state: InstallState): InstallState {
  return { ...state, installed: true };
}

export function nextEligibleAt(state: InstallState): number | null {
  if (state.dismissCount === 0 || state.dismissedAt === null) return 0;
  if (state.dismissCount >= MAX_DISMISSALS) return null;
  return state.dismissedAt + COOLDOWN_DAYS[state.dismissCount - 1] * DAY_MS;
}

export type DecideInput = {
  platform: InstallPlatform;
  standalone: boolean;
  hasDeferredPrompt: boolean;
  routeEligible: boolean;
  state: InstallState;
  now: number;
};

export function decideInstallPrompt(input: DecideInput): InstallDecision {
  const { platform, standalone, hasDeferredPrompt, routeEligible, state, now } = input;
  if (standalone) return { kind: "hidden", reason: "standalone" };
  if (state.installed) return { kind: "hidden", reason: "installed" };
  if (platform === "other" || platform === "ios-other-browser") {
    // Outros navegadores no iOS e navegadores sem suporte: sem convite automático.
    return { kind: "hidden", reason: "unsupported" };
  }
  if (!routeEligible) return { kind: "hidden", reason: "route" };
  if (state.visitDays.length < MIN_VISIT_DAYS) return { kind: "hidden", reason: "not-enough-visits" };

  const eligibleAt = nextEligibleAt(state);
  if (eligibleAt === null) return { kind: "hidden", reason: "dismissed-forever" };
  if (now < eligibleAt) return { kind: "hidden", reason: "cooldown" };

  if (platform === "ios-safari") return { kind: "ios-instructions" };
  if (!hasDeferredPrompt) return { kind: "hidden", reason: "waiting-prompt" };
  return { kind: "native-prompt" };
}

export function parseInstallState(raw: string | null): InstallState {
  if (!raw) return EMPTY_INSTALL_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<InstallState>;
    return {
      dismissCount: Number.isFinite(parsed.dismissCount) ? Math.max(0, Number(parsed.dismissCount)) : 0,
      dismissedAt: Number.isFinite(parsed.dismissedAt) ? Number(parsed.dismissedAt) : null,
      visitDays: Array.isArray(parsed.visitDays)
        ? parsed.visitDays.filter((day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)).slice(-MAX_TRACKED_DAYS)
        : [],
      installed: parsed.installed === true,
    };
  } catch {
    return EMPTY_INSTALL_STATE;
  }
}

export function serializeInstallState(state: InstallState): string {
  return JSON.stringify(state);
}

/** Rotas do produto em que um convite de instalação não atrapalha (nada de login/checkout/onboarding). */
const INSTALL_FRIENDLY_ROUTES = ["/dashboard", "/painel", "/portfolio", "/properties", "/notificacao", "/my-roi"];

export function isInstallFriendlyRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return INSTALL_FRIENDLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Evento de janela para abrir a folha de instruções do iOS a partir de outros componentes (ex.: opt-in de push). */
export const OPEN_INSTALL_SHEET_EVENT = "urban:open-install-sheet";
