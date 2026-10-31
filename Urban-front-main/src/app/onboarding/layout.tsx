import "../app.css";
import React from 'react'
import { BrandLogo } from '../componentes/ui/BrandLogo'
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Primeiros passos");

/**
 * Casca do onboarding: faixa com o fundo oficial da marca no topo (scrim
 * tokenizado garante AA), logo oficial com área de proteção, `100dvh` e
 * safe areas. Estilos em `componentes/ui/host-mobile.css`.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="urban-app urban-onboarding-layout urban-brand-band">
      <main className="urban-app urban-onboarding-layout__main">
        <div className="urban-onboarding-layout__brand">
          <BrandLogo variant="wordmark" priority />
        </div>
        {children}
      </main>
    </div>
  )
}
