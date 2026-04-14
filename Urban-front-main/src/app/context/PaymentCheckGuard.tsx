'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fetchSubscription, getPagamentosDoUsuario } from '../service/api' // <-- ajusta o path conforme sua estrutura
import { GlobalPaywallModal } from '../componentes/GlobalPaywallModal'

interface PaymentCheckGuardProps {
  children: React.ReactNode
}

const PaymentCheckGuard = ({ children }: PaymentCheckGuardProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isAllowed, setIsAllowed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!pathname) return // espera o pathname estar definido
    const verifyPayment = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          router.push('/')
          return
        }

        let subscription = null
        try {
          subscription = await fetchSubscription()
        } catch {
          // Usuário sem customer no Stripe ainda — não é erro
        }

        const isSubscriptionActive =
          subscription?.status === 'active' || subscription?.status === 'trialing'

        if (!isSubscriptionActive) {
          setIsAllowed(false);
        } else {
          setIsAllowed(true);
        }
      } catch (error) {
        console.error('Erro ao verificar pagamentos:', error)
        setIsAllowed(false);
      } finally {
        setIsLoading(false)
      }
    }

    verifyPayment()
  }, [router, pathname])


  if (isLoading) {
    return null // pode trocar por spinner se quiser
  }

  return (
    <>
      {children}
      <GlobalPaywallModal isOpen={!isAllowed} />
    </>
  )
}

export default PaymentCheckGuard
