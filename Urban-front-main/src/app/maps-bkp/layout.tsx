// app/(interno)/layout.tsx
import { Box, Flex } from '@chakra-ui/react'
import Footer from '../componentes/Footer'
import Header from '../componentes/header'
import SideBar from '../componentes/SideBar'

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return (

        <Flex minH="100vh" bg="#f8f8f8ff">
          {/* Sidebar */}
          <SideBar />
    
          {/* Conteúdo principal */}
          <Flex direction="column" flex="1">
            <Header />
            <Box   mb={10}  as="main" p="0" flex="1">
           
              {children}
           
            </Box>
            <Footer />
          </Flex>
        </Flex>
  )
}
