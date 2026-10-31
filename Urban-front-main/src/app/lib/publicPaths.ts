// Páginas do site de marketing (sem sessão, i18n, toasts ou contexto de
// autenticação). "/" entra porque, no domínio público, o middleware reescreve
// a raiz para /landing; o login servido em "/" no app recebe os providers via
// (home)/layout. Manter alinhado com PUBLIC_ONLY_PATHS de src/middleware.ts.
const LIGHT_PATHS = new Set([
  "/",
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
  "/cobertura-de-eventos",
]);

export function isLightPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return LIGHT_PATHS.has(clean);
}

/**
 * Executa `task` na primeira interação do visitante (ou após o limite
 * de tempo). Usado para tirar telemetria e PWA do
 * caminho crítico das páginas públicas, sem perder eventos: erros ficam em
 * buffer até a inicialização.
 */
export function runOnFirstInteraction(task: () => void, fallbackMs = 15000): () => void {
  if (typeof window === "undefined") return () => {};
  let done = false;
  const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    task();
  };
  const timer = window.setTimeout(run, fallbackMs);
  function cleanup() {
    window.clearTimeout(timer);
    events.forEach((e) => window.removeEventListener(e, run));
  }
  events.forEach((e) => window.addEventListener(e, run, { once: true, passive: true }));
  return () => {
    done = true;
    cleanup();
  };
}
