'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { api } from '../service/api'

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
  login: () => void
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
  const pathname = usePathname()
  const { data: session } = useSession()

  useEffect(() => {
    let cancelled = false
    const publicPrefixes = [
      '/',
      '/login',
      '/create',
      '/request-reset-password',
      '/reset-password',
      '/confirm-email',
      '/waitlist',
      '/privacidade',
      '/termos',
      '/contato',
      '/sobre',
      '/lancamento',
      '/precos',
      '/landing',
    ]

    const checkSession = async () => {
      const isPublicPath =
        publicPrefixes.includes(pathname) ||
        publicPrefixes.some((path) => path !== '/' && pathname.startsWith(`${path}/`))

      if (isPublicPath) {
        if (!cancelled) setIsAuthenticated(false)
        return
      }

      if (session?.user) {
        setIsAuthenticated(true)
        return
      }

      try {
        await api.get('/auth/me')
        if (!cancelled) setIsAuthenticated(true)
      } catch {
        if (!cancelled) setIsAuthenticated(false)
      }
    }

    checkSession()

    return () => {
      cancelled = true
    }
  }, [session, pathname])

  const login = () => {
    setIsAuthenticated(true)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Erro ao encerrar sessao no backend:', error)
    }
    localStorage.removeItem('accessToken')
    setIsAuthenticated(false)

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
