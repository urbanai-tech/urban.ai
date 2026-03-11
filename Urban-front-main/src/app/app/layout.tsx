"use client"
import { Box, Flex } from '@chakra-ui/react'
import React from 'react'
import Footer from '../componentes/Footer'
import Header from '../componentes/header'
import SideBar from '../componentes/SideBar'
import PaymentCheckGuard from '../context/PaymentCheckGuard'

export default function InternoLayout({ children }: { children: React.ReactNode }) {


  return (
    <Flex minH="100vh" bg="#f8fafb">
      {/* Sidebar */}
      <SideBar />

      {/* Conteúdo principal */}
      <Flex direction="column" flex="1">
        <Header />
        <Box as="main" p="0" flex="1">
     <PaymentCheckGuard>
          {children}
          </PaymentCheckGuard>
        </Box>
        <Footer />
      </Flex>
    </Flex>
  )
}
