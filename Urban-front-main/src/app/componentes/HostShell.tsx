"use client";

import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import SideBar from "./SideBar";
import PaymentCheckGuard from "../context/PaymentCheckGuard";
import { AppFooter, AppToastProvider } from "./ui";

/**
 * HostShell — layout shell unificado para todas as rotas autenticadas do
 * anfitrião.
 *
 * Substitui o pattern duplicado que existia em 14 layouts (`painel/`,
 * `dashboard/`, `properties/`, etc.), onde cada um repetia:
 *   <Flex minH="100vh" bg="#f8fafb">
 *     <SideBar />
 *     <Flex direction="column" flex="1">
 *       <Header />
 *       <Box as="main" mt={10} mb={10} mx={6}>...
 *       <Footer />
 *     </Flex>
 *   </Flex>
 *
 * Mudancas 2026-05-17 (sprint design premium):
 *  - Background `#FAFAFB` (var(--app-bg)) ao invés do `#f8fafb` azulado.
 *  - Removido `<Header />` (era null — herança do esvaziamento Sprint 1).
 *  - Padding consistente respira: `padding: 32px 32px 80px` em desktop,
 *    `padding: 24px 16px 96px` em mobile (margem pra bottom-nav).
 *  - Adiciona classe `urban-app` no main para ativar tokens do design system.
 *  - PaymentCheckGuard mantido — não toca em billing flow.
 *
 * Uso:
 *   export default function Layout({ children }) {
 *     return <HostShell>{children}</HostShell>;
 *   }
 *
 * Para rotas que NÃO precisam de PaymentCheckGuard (ex: onboarding inicial,
 * post-login), passar `guard={false}`.
 */
export default function HostShell({
  children,
  guard = true,
  noPadding = false,
}: {
  children: React.ReactNode;
  /** Se true, envolve com PaymentCheckGuard. Default true. */
  guard?: boolean;
  /** Se true, remove padding do main (pra paginas que controlam o proprio). */
  noPadding?: boolean;
}) {
  const content = guard ? (
    <PaymentCheckGuard>{children}</PaymentCheckGuard>
  ) : (
    children
  );

  return (
    <AppToastProvider>
      <Flex
        minH="100vh"
        bg="#FAFAFB"
        sx={{
          flexDirection: { base: "column", md: "row" },
        }}
      >
        <SideBar />

        <Flex direction="column" flex="1" minW={0} bg="#FAFAFB">
          <Box
            as="main"
            flex="1"
            className="urban-app"
            sx={{
              padding: noPadding
                ? "0"
                : { base: "24px 16px 96px", md: "32px 32px 80px" },
              background: "var(--app-bg, #FAFAFB)",
            }}
          >
            {content}
          </Box>
          <AppFooter />
        </Flex>
      </Flex>
    </AppToastProvider>
  );
}
