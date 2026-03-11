// src/context/LanguageContext.tsx
'use client';

import React, { createContext, ReactNode, useEffect, useState } from 'react';
import i18n from 'i18next';

interface LanguageContextProps {
  language: string;
  changeLanguage: (lang: string) => void;
  isLoaded: boolean;
}

export const LanguageContext = createContext<LanguageContextProps>({
  language: 'pt',
  changeLanguage: () => {},
  isLoaded: false,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState('pt');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Garantir que estamos no lado do cliente antes de acessar localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('i18nextLng') || 'pt';
        
        // Só chamar changeLanguage se i18n estiver inicializado
        if (i18n.isInitialized) {
          i18n.changeLanguage(stored);
        } else {
          // Se não estiver inicializado, aguardar a inicialização
          i18n.on('initialized', () => {
            i18n.changeLanguage(stored);
          });
        }
        
        setLanguage(stored);
      } catch (error) {
        console.error('Erro ao carregar idioma do localStorage:', error);
        // Fallback para idioma padrão
        setLanguage('pt');
        
        if (i18n.isInitialized) {
          i18n.changeLanguage('pt');
        }
      } finally {
        setIsLoaded(true);
      }
    } else {
      // Se estivermos no servidor, usar idioma padrão
      setLanguage('pt');
      setIsLoaded(true);
    }
  }, []);

  const changeLanguage = (lang: string) => {
    try {
      // Verificar se i18n está inicializado antes de tentar mudar o idioma
      if (i18n.isInitialized) {
        i18n.changeLanguage(lang);
      }
      
      setLanguage(lang);
      
      // Salvar apenas se estivermos no cliente
      if (typeof window !== 'undefined') {
        localStorage.setItem('i18nextLng', lang);
      }
    } catch (error) {
      console.error('Erro ao alterar idioma:', error);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, isLoaded }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook personalizado para usar o contexto de linguagem
export const useLanguage = () => {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage deve ser usado dentro de um LanguageProvider');
  }
  return context;
};