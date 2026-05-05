import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware do Next.js para roteamento por host (Opção B — subdomain split).
 *
 * Topologia alvo:
 *   myurbanai.com       →  site público (landing, lançamento, sobre, etc.)
 *   app.myurbanai.com   →  app autenticado (login, dashboard, admin, etc.)
 *
 * Estado atual: **log-only**. Está apenas registrando o host de cada request
 * para validarmos que o middleware está rodando. Quando ativarmos os redirects
 * (Chunk 4), as TODOs marcadas abaixo viram código real.
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
  "/maps-bkp",
  "/event-log",
  "/near-events",
  "/notificacao",
  "/price",
  "/post-login",
  "/create",
  "/waitlist",
  "/request-reset-password",
  "/reset-password",
  "/confirm-email",
  "/address-verification",
  "/settings",
];

// ===== Helpers =====

function isLocalDev(host: string | null): boolean {
  if (!host) return true;
  const cleanHost = host.split(":")[0];
  return (
    cleanHost === "localhost" ||
    cleanHost === "127.0.0.1" ||
    cleanHost.endsWith(".vercel.app") ||
    cleanHost.endsWith(".local")
  );
}

function isPublicHost(host: string): boolean {
  const clean = host.split(":")[0];
  return clean === "myurbanai.com" || clean === "www.myurbanai.com";
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

// ===== Middleware principal =====

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Skip rotas internas do Next/static — não fazemos host routing aqui
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Em dev / preview, passa direto sem nenhum gating
  if (isLocalDev(host)) {
    return NextResponse.next();
  }

  // ============== LOG-ONLY mode ==============
  // Esta versão apenas registra o que o Chunk 4 fará. Não redireciona ainda.
  // Quando estivermos prontos para ativar:
  //   1. Comentar/remover este bloco de log e early return.
  //   2. Descomentar os blocos "TODO Chunk 4" abaixo.

  // (em produção, console.log vai pro stdout do Vercel/Railway)
  console.log(
    `[middleware] host=${host} path=${pathname} ` +
      `publicHost=${isPublicHost(host)} appHost=${isAppHost(host)} ` +
      `appOnlyMatch=${pathMatchesAppOnly(pathname)} publicOnlyMatch=${pathMatchesPublicOnly(pathname)}`,
  );

  return NextResponse.next();

  // ============== TODO Chunk 4 — ATIVAR REDIRECTS ==============
  // // 1. Apex (myurbanai.com) → rewrite "/" para servir a landing institucional
  // if (isPublicHost(host) && pathname === "/") {
  //   return NextResponse.rewrite(new URL("/landing", request.url));
  // }
  //
  // // 2. Apex pedindo rota de app → 301 para app.subdomain
  // if (isPublicHost(host) && pathMatchesAppOnly(pathname)) {
  //   const target = new URL(request.url);
  //   target.host = "app.myurbanai.com";
  //   return NextResponse.redirect(target, 301);
  // }
  //
  // // 3. App subdomain pedindo rota pública → 301 para apex
  // if (isAppHost(host) && pathMatchesPublicOnly(pathname)) {
  //   const target = new URL(request.url);
  //   target.host = "myurbanai.com";
  //   return NextResponse.redirect(target, 301);
  // }
  //
  // return NextResponse.next();
}

/**
 * Matcher: rodar em todas as rotas exceto static/api/_next.
 * O filtro fino é feito dentro da função (skip logic acima) — matcher só
 * evita overhead em assets.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
