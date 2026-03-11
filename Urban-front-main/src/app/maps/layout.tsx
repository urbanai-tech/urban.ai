// app/(interno)/layout.tsx
"use client";

import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import SideBar from "../componentes/SideBar";

import Footer from "../componentes/Footer";
import Header from "../componentes/header";
import PaymentCheckGuard from "../context/PaymentCheckGuard";

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100vh" bg="#f8fafb">
      {/* Sidebar */}
      <SideBar />

      {/* Conteúdo principal */}
      <Flex direction="column" flex="1">
        <Header />
        <Box as="main" flex="1" mt={10} mb={10} mx={6} p={0}>
          <PaymentCheckGuard>
          {children}
          </PaymentCheckGuard>
        </Box>
        <Footer />
      </Flex>
    </Flex>
  );
}
