'use client'

import { useEffect } from 'react';
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { AppToastProvider } from './componentes/ui';
import { ThemeProvider } from './componentes/theme';
import { purgeLegacyAuthStorage } from './lib/legacy-session-cleanup';
import '../../i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  // Token antigo no localStorage (pré-migração) não deve sobreviver: só o cookie httpOnly vale.
  useEffect(() => {
    purgeLegacyAuthStorage();
  }, []);

  return (
    <ThemeProvider>
      <SessionProvider>
        <AuthProvider>
          <LanguageProvider>
            <AppToastProvider>
              {children}
            </AppToastProvider>
          </LanguageProvider>
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
