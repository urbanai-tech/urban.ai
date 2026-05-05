"use client";

import React from "react";
import NextLink from "next/link";

/**
 * Footer do site PÚBLICO. Mais completo que o Footer simples do app:
 * tem 4 colunas (Produto, Empresa, Legal, Contato) e copyright.
 *
 * Quando o link aponta pra rota do app (Dashboard / Login), usamos `<a>`
 * absoluto para o subdomain de produção. Em dev fica relativo via env var.
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "/"
    : "https://app.myurbanai.com/");

export default function FooterPublic() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 border-t border-slate-200 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        {/* Coluna 1 — Produto */}
        <div>
          <h3 className="font-bold text-slate-800 mb-3">Produto</h3>
          <ul className="space-y-2 text-slate-600">
            <li>
              <NextLink href="/precos" className="hover:text-blue-600">
                Preços
              </NextLink>
            </li>
            <li>
              <NextLink href="/lancamento" className="hover:text-blue-600">
                Pré-lançamento
              </NextLink>
            </li>
            <li>
              <a href={APP_URL} className="hover:text-blue-600">
                Entrar
              </a>
            </li>
          </ul>
        </div>

        {/* Coluna 2 — Empresa */}
        <div>
          <h3 className="font-bold text-slate-800 mb-3">Empresa</h3>
          <ul className="space-y-2 text-slate-600">
            <li>
              <NextLink href="/sobre" className="hover:text-blue-600">
                Sobre
              </NextLink>
            </li>
            <li>
              <NextLink href="/contato" className="hover:text-blue-600">
                Contato
              </NextLink>
            </li>
          </ul>
        </div>

        {/* Coluna 3 — Legal */}
        <div>
          <h3 className="font-bold text-slate-800 mb-3">Legal</h3>
          <ul className="space-y-2 text-slate-600">
            <li>
              <NextLink href="/termos" className="hover:text-blue-600">
                Termos de Uso
              </NextLink>
            </li>
            <li>
              <NextLink href="/privacidade" className="hover:text-blue-600">
                Privacidade (LGPD)
              </NextLink>
            </li>
          </ul>
        </div>

        {/* Coluna 4 — Contato */}
        <div>
          <h3 className="font-bold text-slate-800 mb-3">Fale com a gente</h3>
          <ul className="space-y-2 text-slate-600">
            <li>
              <a
                href="mailto:contato@myurbanai.com"
                className="hover:text-blue-600"
              >
                contato@myurbanai.com
              </a>
            </li>
            <li>
              <a
                href="mailto:privacidade@myurbanai.com"
                className="hover:text-blue-600"
              >
                privacidade@myurbanai.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {year} Urban AI · Todos os direitos reservados.</p>
          <p>
            Plataforma de precificação dinâmica para anfitriões de aluguel por
            temporada.
          </p>
        </div>
      </div>
    </footer>
  );
}
