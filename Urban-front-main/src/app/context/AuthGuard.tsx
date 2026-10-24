'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { api } from '../service/api'
import {
  isAuthRecentlyVerified,
  isDefinitiveAuthFailure,
  markAuthVerified,
} from './subscription-status'

interface AuthGuardProps {
  children: React.ReactNode
}

type AuthState = 'checking' | 'authenticated' | 'unreachable'

const PUBLIC_PATHS = ['/', '/login', '/create']

/**
 * Guard de sessão.
 *
 * - Não refaz /auth/me a cada troca de pathname (cache curto em memória).
 * - Enquanto verifica, mostra um estado de carregamento (nunca tela em branco).
 * - Só redireciona para login quando a API responde 401/403. Erro de rede/5xx
 *   mantém o usuário na página com aviso e "tentar de novo".
 */
const AuthGuard = ({ children }: AuthGuardProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<AuthState>(() =>
    isAuthRecentlyVerified() ? 'authenticated' : 'checking',
  )

  const isPublicPath = useCallback((path: string) => PUBLIC_PATHS.includes(path), [])

  const check = useCallback(async () => {
    try {
      await api.get('/auth/me')
      markAuthVerified()
      setState('authenticated')
    } catch (error) {
      if (isDefinitiveAuthFailure(error)) {
        router.push('/')
        return
      }
      setState('unreachable')
    }
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isPublicPath(pathname)) return
    if (isAuthRecentlyVerified()) {
      setState('authenticated')
      return
    }
    void check()
  }, [pathname, isPublicPath, check])

  if (isPublicPath(pathname) || state === 'authenticated') {
    return <>{children}</>
  }

  if (state === 'unreachable') {
    return (
      <div role="alert" className="funnel-gate funnel-gate--inline">
        <div>
          <p>
            Não conseguimos confirmar sua sessão agora. Verifique sua conexão e tente novamente.
          </p>
          <button
            type="button"
            onClick={() => {
              setState('checking')
              void check()
            }}
          >
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div role="status" aria-live="polite" className="funnel-gate funnel-gate--inline">
      <span>Carregando…</span>
    </div>
  )
}

export default AuthGuard
