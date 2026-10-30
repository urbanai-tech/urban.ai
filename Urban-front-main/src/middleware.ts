import { NextResponse, type NextRequest } from "next/server";
import {
  CSP_ENFORCE_HEADER,
  CSP_REPORT_ONLY_HEADER,
  NONCE_HEADER,
  generateNonce,
  resolveCsp,
} from "./app/lib/csp";

/**
 * Middleware do Next.js para roteamento por host (Opção B — subdomain split).
 *
 * Topologia alvo:
 *   myurbanai.com       →  site público canônico (landing, lançamento, etc.)
 *   www.myurbanai.com   →  alias público, redireciona para myurbanai.com
 *   *.com.br público    →  alias público, redireciona para myurbanai.com
 *   app.myurbanai.com   →  app autenticado (login, dashboard, admin, etc.)
 *
 * Estado atual: redirects ativos para separar site público, aliases e app.
 *
 * Em ambiente local (`localhost` / `127.0.0.1` / `*.vercel.app`), o middleware
 * NÃO redireciona — preserva o fluxo de dev/preview.
 */

// ===== Listas que serão usadas no Chunk 4 =====

/**
 * Rotas que SÓ existem no site público (myurbanai.com).
 * Se acessadas em app.myurbanai.com, redirecionam pro apex.
 */
const PUBLIC_ONLY_PATHS = [
  "/landing",
  "/sobre",
  "/termos",
  "/privacidade",
  "/contato",
  "/precos",
  "/lancamento",
  "/precificacao-dinamica-airbnb",
  "/como-precificar-airbnb-em-dias-de-eventos",
  "/precificacao-por-eventos-sao-paulo",
  "/integracao-stays-precificacao-automatica",
  "/urban-ai-vs-planilha-de-precificacao",
  "/seguranca-lgpd-ia-precificacao",
];

/**
 * Rotas que SÓ existem no app (app.myurbanai.com).
 * Se acessadas em myurbanai.com, redirecionam pro subdomain do app.
 *
 * Inclui prefixos — qualquer path que comece com um destes.
 */
const APP_ONLY_PREFIXES = [
  "/dashboard",
  "/painel",
  "/admin",
  "/onboarding",
  "/plans",
  "/my-plan",
  "/properties",
  "/maps",
  "/event-log",
  "/near-events",
  "/notificacao",
  "/price",
  "/post-login",
  "/login",
  "/create",
  "/waitlist",
  "/request-reset-password",
  "/reset-password",
  "/confirm-email",
  "/address-verification",
  "/settings",
  "/my-roi",
  "/portfolio",
  "/profile",
  "/event-radar",
  "/events",
  "/forbidden",
  "/auth",
];

// ===== Helpers =====

function isLocalDev(host: string | null): boolean {
  if (!host) return true;
  const cleanHost = host.split(":")[0];
  return (
    cleanHost === "localhost" ||
    cleanHost === "127.0.0.1" ||
    cleanHost.endsWith(".local")
  );
}

function isPreviewHost(host: string): boolean {
  const clean = host.split(":")[0];
  return clean.endsWith(".vercel.app");
}

function isStagingHost(host: string): boolean {
  const clean = host.split(":")[0];
  return (
    clean === "staging.myurbanai.com" ||
    clean === "urban-ai-frontend-staging-staging.up.railway.app"
  );
}

function isPublicHost(host: string): boolean {
  const clean = host.split(":")[0];
  return (
    clean === "myurbanai.com" ||
    clean === "www.myurbanai.com" ||
    clean === "myurbanai.com.br" ||
    clean === "www.myurbanai.com.br"
  );
}

function isPublicAliasHost(host: string): boolean {
  const clean = host.split(":")[0];
  return (
    clean === "www.myurbanai.com" ||
    clean === "myurbanai.com.br" ||
    clean === "www.myurbanai.com.br"
  );
}

function isAppHost(host: string): boolean {
  const clean = host.split(":")[0];
  return clean === "app.myurbanai.com";
}

function pathMatchesAppOnly(pathname: string): boolean {
  return APP_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function pathMatchesPublicOnly(pathname: string): boolean {
  return PUBLIC_ONLY_PATHS.includes(pathname);
}

function withNoIndex(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

// ===== Middleware principal =====

// Skip rotas internas do Next/static — não fazemos host routing nem CSP aqui.
function isAssetOrInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  );
}

type ForwardInit = { request: { headers: Headers } };

/**
 * Roteamento por host. Toda resposta que segue para o app (next/rewrite)
 * carrega os headers de request com o nonce, para o layout e o Next lerem.
 */
function routeRequest(request: NextRequest, forward: ForwardInit): NextResponse {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  if (pathname === "/plans/v2") {
    const target = new URL(request.url);
    target.pathname = "/plans";
    return NextResponse.redirect(target, 308);
  }

  // Em dev local, passa direto sem nenhum gating.
  if (isLocalDev(host)) {
    return NextResponse.next(forward);
  }

  // Preview fica aberto para QA, mas nunca indexavel.
  if (isPreviewHost(host)) {
    return withNoIndex(NextResponse.next(forward));
  }

  // Staging espelha a vitrine pública na raiz para revisão e E2E, mas nunca
  // deve competir com o domínio canônico nos mecanismos de busca. As rotas do
  // app continuam acessíveis diretamente para validar cadastro e autenticação.
  if (isStagingHost(host)) {
    if (pathname === "/") {
      return withNoIndex(NextResponse.rewrite(new URL("/landing", request.url), forward));
    }
    return withNoIndex(NextResponse.next(forward));
  }

  // ============== Redirects ativos ==============

  // 1. Domínio público/alias pedindo rota que SÓ existe no app → 301 direto
  //    para app.myurbanai.com. Isso evita cadeia dupla em aliases como
  //    www.myurbanai.com/dashboard ou myurbanai.com.br/admin.
  if (isPublicHost(host) && pathMatchesAppOnly(pathname)) {
    const target = new URL(request.url);
    target.hostname = "app.myurbanai.com";
    target.port = "";
    target.protocol = "https:";
    return NextResponse.redirect(target, 301);
  }

  // 2. Aliases públicos → apex canônico, preservando path e query string.
  if (isPublicAliasHost(host)) {
    const target = new URL(request.url);
    target.hostname = "myurbanai.com";
    target.port = "";
    target.protocol = "https:";
    return NextResponse.redirect(target, 301);
  }

  // 3. Apex (myurbanai.com) na raiz → rewrite interno para servir a landing
  //    institucional. URL no browser permanece "/". Esse rewrite é silencioso
  //    (status 200), diferente dos 301 abaixo.
  // /landing existe internamente para o rewrite da raiz. A URL publica
  // canonica e "/" para evitar duplicidade.
  if (isPublicHost(host) && pathname === "/landing") {
    const target = new URL(request.url);
    target.hostname = "myurbanai.com";
    target.port = "";
    target.protocol = "https:";
    target.pathname = "/";
    return NextResponse.redirect(target, 301);
  }

  if (isPublicHost(host) && pathname === "/") {
    return NextResponse.rewrite(new URL("/landing", request.url), forward);
  }

  // 4. App subdomain pedindo rota PÚBLICA → 301 para apex
  //    Quem clica em "Sobre" estando logado vai pra myurbanai.com/sobre,
  //    sem deixar página pública indexável também em app.subdomain (evita
  //    duplicate content pro SEO).
  if (isAppHost(host) && pathMatchesPublicOnly(pathname)) {
    const target = new URL(request.url);
    target.hostname = "myurbanai.com";
    target.port = "";
    target.protocol = "https:";
    if (pathname === "/landing") {
      target.pathname = "/";
    }
    return NextResponse.redirect(target, 301);
  }

  // 4. App subdomain na raiz → renderiza login normal (page.tsx atual de
  //    (home)). Nada a fazer; passa direto.

  // 5. Apex em qualquer outro path (ex: /lancamento, /sobre, /precos) →
  //    serve normalmente. As páginas existem em (public)/ e o layout
  //    público é aplicado.

  if (isAppHost(host)) {
    return withNoIndex(NextResponse.next(forward));
  }

  // Qualquer host nao reconhecido nao deve ser indexado por acidente.
  if (!isPublicHost(host)) {
    return withNoIndex(NextResponse.next(forward));
  }

  return NextResponse.next(forward);
}

/**
 * CSP com nonce por requisição (ver src/app/lib/csp.ts). Assets e rotas
 * internas/API passam direto, sem CSP: só documentos HTML precisam dela.
 * `CSP_ENFORCE=true` troca o header Report-Only pelo bloqueante.
 */
export function middleware(request: NextRequest) {
  if (isAssetOrInternalPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const nonce = generateNonce();
  const csp = resolveCsp({
    nonce,
    enforce: process.env.CSP_ENFORCE,
    isDev: process.env.NODE_ENV === "development",
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  const requestHeaders = new Headers(request.headers);
  // Nunca confiar em nonce/CSP vindos do cliente: o Next lê o nonce do header
  // CSP da request e o layout lê x-nonce.
  requestHeaders.delete(CSP_ENFORCE_HEADER);
  requestHeaders.delete(CSP_REPORT_ONLY_HEADER);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(csp.headerName, csp.value);

  const response = routeRequest(request, { request: { headers: requestHeaders } });
  response.headers.set(csp.headerName, csp.value);
  response.headers.set("Reporting-Endpoints", csp.reportingEndpoints);
  return response;
}

/**
 * Matcher: rodar em todas as rotas exceto static/api/_next.
 * O filtro fino é feito dentro da função (skip logic acima) — matcher só
 * evita overhead em assets.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
