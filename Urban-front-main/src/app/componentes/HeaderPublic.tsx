"use client";

import React, { useState } from "react";
import NextLink from "next/link";
import NextImage from "next/image";

/**
 * Header do site PÚBLICO (myurbanai.com).
 *
 * Diferente do Header do app: não tem links para /dashboard, /plans, etc.
 * Os CTAs Entrar / Criar conta apontam pro subdomínio do app
 * (`app.myurbanai.com/`).
 *
 * Em ambiente de produção, o app vive em outro subdomínio. Em dev local
 * tudo está no mesmo host (localhost:3000), então o link aponta pra rota
 * absoluta `/` que serve o login.
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "/"
    : "https://app.myurbanai.com/");

const NAV = [
  { label: "Sobre", href: "/sobre" },
  { label: "Preços", href: "/precos" },
  { label: "Lançamento", href: "/lancamento" },
  { label: "Contato", href: "/contato" },
];

export default function HeaderPublic() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="
        sticky top-0 z-40
        flex items-center justify-between
        h-16 md:h-20 px-4 md:px-10
        bg-white/80 backdrop-blur
        border-b border-[#e8eef3]
      "
    >
      {/* Logo */}
      <NextLink href="/" className="flex items-center gap-2 shrink-0">
        <NextImage
          src="/urban-logo-transparent-soft.png"
          alt="Urban AI"
          width={130}
          height={36}
          priority
        />
      </NextLink>

      {/* Nav desktop */}
      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
        {NAV.map((item) => (
          <NextLink
            key={item.href}
            href={item.href}
            className="hover:text-blue-600 transition-colors"
          >
            {item.label}
          </NextLink>
        ))}
      </nav>

      {/* CTAs desktop */}
      <div className="hidden md:flex items-center gap-3">
        <a
          href={APP_URL}
          className="text-sm font-semibold text-slate-700 hover:text-blue-600 px-3 py-2"
        >
          Entrar
        </a>
        <a
          href={`${APP_URL}create`.replace(/\/+create/, "/create")}
          className="text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Criar conta
        </a>
      </div>

      {/* Mobile menu toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"
        aria-label="Abrir menu"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          {open ? (
            <path
              d="M5 5L15 15M5 15L15 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <>
              <path d="M3 6H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M3 10H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M3 14H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile menu */}
      {open && (
        <div
          className="
            absolute top-16 left-0 right-0
            bg-white border-b border-slate-200
            shadow-lg
            md:hidden
            flex flex-col gap-1 py-3 px-4
          "
        >
          {NAV.map((item) => (
            <NextLink
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded"
            >
              {item.label}
            </NextLink>
          ))}
          <hr className="my-2 border-slate-200" />
          <a
            href={APP_URL}
            className="px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded"
          >
            Entrar
          </a>
          <a
            href={`${APP_URL}create`.replace(/\/+create/, "/create")}
            className="mt-1 px-3 py-2 text-sm font-bold text-center bg-blue-600 text-white rounded-lg"
          >
            Criar conta
          </a>
        </div>
      )}
    </header>
  );
}
