'use client'

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import ChainlitCopilot from './componentes/ChainlitCopilot'
import { AppToastProvider } from './componentes/ui';
import '../../i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <LanguageProvider>
          <AppToastProvider>
            {children}
            {/* Chainlit Copilot widget (loads floating copilot from Chainlit server) */}
            {/* The component injects the copilot script and mounts the floating widget. */}
            {/* Ensure NEXT_PUBLIC_CHAINLIT_URL is set (e.g. http://localhost:8000) */}
            <ChainlitCopilot />
          </AppToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
