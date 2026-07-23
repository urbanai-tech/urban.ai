"use client";

import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { PUBLIC_LOGIN_URL, PUBLIC_SIGNUP_URL } from "./PublicMarketing";

const NAV = [
  { label: "Produto", href: "/#produto" },
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Preços", href: "/precos" },
  { label: "Conteúdo", href: "/precificacao-dinamica-airbnb" },
  { label: "Empresa", href: "/sobre" },
];

export default function HeaderPublic() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => toggleRef.current?.focus());
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <header className="public-header">
      <div className="public-header__inner">
        <NextLink href="/" className="public-wordmark" aria-label="Urban AI — página inicial">
          <span>URBAN</span><i>AI</i>
        </NextLink>

        <nav className="public-header__nav" aria-label="Navegação principal">
          {NAV.map((item) => <NextLink key={item.href} href={item.href}>{item.label}</NextLink>)}
        </nav>

        <div className="public-header__actions">
          <a href={PUBLIC_LOGIN_URL}>Entrar</a>
          <a href={PUBLIC_SIGNUP_URL} className="public-header__cta">
            Começar agora <ArrowRight aria-hidden size={16} />
          </a>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="public-header__toggle"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
        </button>
      </div>

      <div
        id="public-mobile-menu"
        className={`public-mobile-menu ${open ? "is-open" : ""}`}
        aria-hidden={!open}
      >
        <nav aria-label="Navegação móvel">
          {NAV.map((item, index) => (
            <NextLink
              ref={index === 0 ? firstLinkRef : undefined}
              tabIndex={open ? 0 : -1}
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>{item.label}
            </NextLink>
          ))}
        </nav>
        <div className="public-mobile-menu__actions">
          <a tabIndex={open ? 0 : -1} href={PUBLIC_LOGIN_URL}>Entrar</a>
          <a tabIndex={open ? 0 : -1} href={PUBLIC_SIGNUP_URL} className="public-header__cta">
            Começar agora <ArrowRight aria-hidden size={16} />
          </a>
        </div>
      </div>
    </header>
  );
}
