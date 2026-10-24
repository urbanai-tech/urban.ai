'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSubscription } from '../service/api'
import { GlobalPaywallModal } from '../componentes/GlobalPaywallModal'
import { AppButton } from '../componentes/ui'
import {
  classifySubscription,
  classifySubscriptionError,
  getCachedSubscriptionVerdict,
  setCachedSubscriptionVerdict,
  type SubscriptionVerdict,
} from './subscription-status'

interface PaymentCheckGuardProps {
  children: React.ReactNode
}

// Consulta única em andamento: várias montagens/navegações compartilham a promessa.
let inflight: Promise<SubscriptionVerdict> | null = null

async function resolveVerdict(force: boolean): Promise<SubscriptionVerdict> {
  if (!force) {
    const cached = getCachedSubscriptionVerdict()
    if (cached) return cached
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const subscription = await fetchSubscription()
        const verdict = classifySubscription(subscription)
        setCachedSubscriptionVerdict(verdict)
        return verdict
      } catch (error) {
        // Erro de rede/5xx NÃO é "sem assinatura": não cacheia e não mostra paywall.
        return classifySubscriptionError(error)
      } finally {
        inflight = null
      }
    })()
  }
  return inflight
}

/**
 * Guard de assinatura do anfitrião.
 *
 * - Nunca devolve tela em branco: o conteúdo é renderizado enquanto o veredito
 *   carrega (o paywall só entra por cima quando a resposta é definitiva).
 * - O veredito fica em cache curto (subscription-status.ts), então navegar
 *   entre páginas não refaz a chamada nem pisca.
 * - Falha ao consultar (rede/5xx) = fail-open para exibição, com aviso discreto
 *   e botão de tentar de novo. Paywall só com "sem assinatura ativa" definitivo.
 */
const PaymentCheckGuard = ({ children }: PaymentCheckGuardProps) => {
  const [verdict, setVerdict] = useState<SubscriptionVerdict | 'loading'>(
    () => getCachedSubscriptionVerdict() ?? 'loading',
  )
  const [retrying, setRetrying] = useState(false)
  const mounted = useRef(true)

  const check = useCallback(async (force: boolean) => {
    const next = await resolveVerdict(force)
    if (mounted.current) setVerdict(next)
  }, [])

  useEffect(() => {
    mounted.current = true
    void check(false)
    return () => {
      mounted.current = false
    }
  }, [check])

  const handleRetry = async () => {
    setRetrying(true)
    await check(true)
    if (mounted.current) setRetrying(false)
  }

  return (
    <>
      {verdict === 'unknown' && (
        <div
          role="status"
          data-testid="subscription-check-error"
          className="funnel-banner"
        >
          <span>
            Não conseguimos confirmar seu plano agora. Você pode continuar usando a Urban AI normalmente.
          </span>
          <AppButton size="sm" variant="secondary" onClick={handleRetry} disabled={retrying}>
            {retrying ? 'Verificando…' : 'Tentar de novo'}
          </AppButton>
        </div>
      )}
      {children}
      <GlobalPaywallModal isOpen={verdict === 'inactive'} />
    </>
  )
}

export default PaymentCheckGuard
