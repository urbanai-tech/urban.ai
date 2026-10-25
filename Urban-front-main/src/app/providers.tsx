'use client'

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
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
            </AppToastProvider>
          </LanguageProvider>
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
