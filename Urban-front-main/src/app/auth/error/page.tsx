"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthFlowShell } from "@/app/componentes/AuthFlowShell";
import { marketingUrl } from "@/app/lib/marketing-url";

/**
 * /auth/error — destino do `pages.error` do NextAuth.
 * Antes apontava para uma rota inexistente (404). Página mínima, sem detalhes
 * técnicos do provedor: o usuário volta ao login ou fala com a gente.
 */
function messageFor(code: string | null): string {
  switch (code) {
    case "AccessDenied":
      return "Não foi possível autorizar o acesso com essa conta. Tente outra conta ou entre com e-mail e senha.";
    case "Configuration":
      return "O login com esse provedor está indisponível no momento. Entre com e-mail e senha.";
    case "OAuthAccountNotLinked":
      return "Esse e-mail já está cadastrado com outro método de login. Entre com e-mail e senha.";
    default:
      return "Algo deu errado ao entrar. Tente novamente em instantes.";
  }
}

function AuthErrorContent() {
  const params = useSearchParams();
  const message = messageFor(params.get("error"));

  return (
    <AuthFlowShell
      eyebrow="LOGIN"
      title={
        <>
          Não foi possível
          <br />
          entrar.
        </>
      }
      subtitle={message}
    >
      <div style={{ display: "grid", gap: 12 }} role="alert">
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            justifyContent: "center",
            padding: "12px 18px",
            borderRadius: 10,
            background: "var(--app-accent)",
            color: "#fff",
            fontWeight: 650,
            textDecoration: "none",
          }}
        >
          Voltar para o login
        </Link>
        <a
          href={marketingUrl("/contato")}
          style={{ textAlign: "center", color: "var(--app-accent)", fontWeight: 600 }}
        >
          Falar com o suporte
        </a>
      </div>
    </AuthFlowShell>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
