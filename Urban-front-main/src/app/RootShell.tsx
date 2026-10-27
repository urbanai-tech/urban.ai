"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "./componentes/theme";
import { CookieConsent } from "./componentes/CookieConsent";
import { isLightPath, runOnFirstInteraction } from "./lib/publicPaths";

// Páginas do site de marketing não usam sessão, i18n, toasts nem contexto de
// autenticação, então não pagam o JS desses providers (ver lib/publicPaths).
const AppProviders = dynamic(() => import("./providers").then((m) => m.Providers));
// Analytics (já condicionado a consentimento) e PWA saem do caminho crítico.
const DeferredChrome = dynamic(() => import("./DeferredChrome"), { ssr: false });

function InteractionChrome() {
  const [ready, setReady] = useState(false);
  useEffect(() => runOnFirstInteraction(() => setReady(true)), []);
  return ready ? <DeferredChrome /> : null;
}

export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isLightPath(pathname)) {
    return (
      <ThemeProvider>
        {children}
        <CookieConsent />
        <InteractionChrome />
      </ThemeProvider>
    );
  }

  return (
    <AppProviders>
      {children}
      <CookieConsent />
      <DeferredChrome />
    </AppProviders>
  );
}
