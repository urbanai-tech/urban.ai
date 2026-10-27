"use client";

import React from "react";
import { BrandLogo } from "./ui/BrandLogo";

type AuthFlowShellProps = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  asideEyebrow?: string;
  asideTitle?: React.ReactNode;
  asideSubtitle?: React.ReactNode;
};

/**
 * Casca dos fluxos de autenticação (criar conta, confirmar e-mail, senha).
 *
 * Desktop: painel da marca à esquerda sobre o fundo oficial (Backgrounds_04,
 * preto + brilho teal) com scrim tokenizado; formulário à direita.
 * Mobile (<=1180px): só o formulário, com o logo oficial no topo.
 * Estilos em `ui/host-mobile.css` (seção Auth), só tokens.
 */
export function AuthFlowShell({
  eyebrow,
  title,
  subtitle,
  children,
  asideEyebrow = "Precificação inteligente",
  asideTitle = (
    <>
      A cidade se movimenta, <br />
      seu lucro aumenta.
    </>
  ),
  asideSubtitle = "Você decide se aceita. Nada muda sem a sua aprovação.",
}: AuthFlowShellProps) {
  return (
    <main className="urban-app urban-auth" data-auth-shell>
      <section data-auth-aside aria-hidden="true" className="urban-auth__aside">
        <div className="urban-auth__aside-inner">
          <BrandLogo variant="lockup" className="urban-auth__aside-logo urban-brand-logo--force-dark" />
          <div>
            <p className="urban-auth__aside-eyebrow">{asideEyebrow}</p>
            <h2 className="urban-auth__aside-title">{asideTitle}</h2>
            <p className="urban-auth__aside-subtitle">{asideSubtitle}</p>
          </div>
          <div className="urban-auth__aside-footer">
            <span>Acesso seguro</span>
            <span>São Paulo</span>
          </div>
        </div>
      </section>

      <section data-auth-content className="urban-auth__content">
        <div className="urban-auth__column">
          <div data-auth-mobile-brand className="urban-auth__mobile-brand">
            <BrandLogo variant="wordmark" priority />
          </div>

          <p className="urban-app-eyebrow urban-auth__eyebrow">{eyebrow}</p>
          <h1 className="urban-app-display-md urban-auth__title">{title}</h1>
          {subtitle && <p className="urban-auth__subtitle">{subtitle}</p>}

          {children}
        </div>
      </section>
    </main>
  );
}
