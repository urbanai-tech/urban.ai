import { Box, Flex } from '@chakra-ui/react';
import Footer from '../componentes/Footer';
import Header from '../componentes/header';
import SideBar from '../componentes/SideBar';

export default function RoiLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100vh" bg="#f8fafb">
      <SideBar />
      <Flex direction="column" flex="1">
        <Header />
        <Box mt={10} mb={10} as="main" p="0" flex="1">
          {children}
        </Box>
        <Footer />
      </Flex>
    </Flex>
  );
}
