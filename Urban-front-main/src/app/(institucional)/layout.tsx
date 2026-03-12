import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import Footer from "../componentes/Footer";
import Header from "../componentes/header";

export default function InstitucionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100vh" bg="#f8fafb" direction="column">
      {/* Header Público */}
      <Header />

      {/* Conteúdo principal centralizado */}
      <Box as="main" flex="1" py={10}>
        {children}
      </Box>

      {/* Footer Público */}
      <Footer />
    </Flex>
  );
}
