'use client'

import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import ChainlitCopilot from './componentes/ChainlitCopilot'

const theme = extendTheme({
  colors: {
    brand: {
      50: '#fbe1d1',
      100: '#f7c2a3',
      200: '#f59b75',
      300: '#f47858',
      400: '#e5644f',
      500: '#d74f44',
      600: '#b13d34',
      700: '#8c2a24',
      800: '#67191a',
      900: '#430b12',
    },
    custom: {
      50: '#e3e9f5',
      100: '#b0bdd9',
      200: '#7d92c0',
      300: '#5b73a9',
      400: '#3d5685',
      500: '#232f53', // Azul marinho principal
      600: '#1d2643',
      700: '#162036',
      800: '#10162b',
      900: '#0b0e20', // Azul marinho mais escuro
      orange: '#ef7d5a', // Laranja como cor secundária
    },
  },
  components: {

    Input: {
      baseStyle: {
        field: {
          borderColor: 'custom.orange',  // Borda laranja
          _focus: {
            borderColor: 'custom.orange',  // Laranja no foco
            boxShadow: '0 0 0 1px #ef7d5a',  // Box shadow no foco
          },
        },
      },
    },
    // Outros componentes que você quiser customizar, como Toggle, Select, etc.
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <LanguageProvider>
          <ChakraProvider theme={theme}>
            {children}
            {/* Chainlit Copilot widget (loads floating copilot from Chainlit server) */}
            {/* The component injects the copilot script and mounts the floating widget. */}
            {/* Ensure NEXT_PUBLIC_CHAINLIT_URL is set (e.g. http://localhost:8000) */}
            <ChainlitCopilot />
          </ChakraProvider>
        </LanguageProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
