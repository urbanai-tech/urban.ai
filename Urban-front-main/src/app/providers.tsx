'use client'

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import ChainlitCopilot from './componentes/ChainlitCopilot'
import { AppToastProvider } from './componentes/ui';
import { ThemeProvider } from './componentes/theme';
import '../../i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AuthProvider>
          <LanguageProvider>
            <AppToastProvider>
              {children}
              {/* Chainlit Copilot widget (loads floating copilot from Chainlit server) */}
              {/* The component injects the copilot script and mounts the floating widget. */}
              {/* Ensure NEXT_PUBLIC_CHAINLIT_URL points to the Chainlit server for the current environment. */}
              <ChainlitCopilot />
            </AppToastProvider>
          </LanguageProvider>
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
