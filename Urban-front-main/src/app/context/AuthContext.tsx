'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

// Estender a interface Session do NextAuth
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

interface AuthContextType {
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()
  const { data: session } = useSession() // Obtendo a sessão do NextAuth

  // Verifica se há um token no localStorage ao iniciar ou se há uma sessão do NextAuth
  useEffect(() => {
    // Verificar o token no localStorage
    const token = localStorage.getItem('accessToken')
    
    // Verificar se há uma sessão NextAuth ativa
    const hasSession = session && session.user
    
    if (token || hasSession) {
      // Se houver sessão do NextAuth, também podemos salvar no localStorage
      if (hasSession && !token && session.accessToken) {
        localStorage.setItem('accessToken', session.accessToken as string)
      }
      
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
  }, [session])

  const login = (token: string) => {
    localStorage.setItem('accessToken', token)
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    setIsAuthenticated(false)
    
    // Fazer logout do NextAuth também
    signOut({ redirect: false }).then(() => {
      router.push('/')
    })
  }

  const value = {
    isAuthenticated,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}