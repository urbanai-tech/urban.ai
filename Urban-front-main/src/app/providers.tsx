'use client'

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import ChainlitCopilot from './componentes/ChainlitCopilot'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <LanguageProvider>
          {children}
          {/* Chainlit Copilot widget (loads floating copilot from Chainlit server) */}
          {/* The component injects the copilot script and mounts the floating widget. */}
          {/* Ensure NEXT_PUBLIC_CHAINLIT_URL is set (e.g. http://localhost:8000) */}
          <ChainlitCopilot />
          <ToastContainer />
        </LanguageProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
