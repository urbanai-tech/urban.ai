'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fetchSubscription, getPagamentosDoUsuario } from '../service/api' // <-- ajusta o path conforme sua estrutura

interface PaymentCheckGuardProps {
  children: React.ReactNode
}

const PaymentCheckGuard = ({ children }: PaymentCheckGuardProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isAllowed, setIsAllowed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!pathname) return; // espera o pathname estar definido
    const verifyPayment = async () => {
      console.log('🔍 Executando PaymentCheckGuard')
      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          router.push('/')
          return
        } else {
          console.log("nao ta caindo")
        }

        const subscription = await fetchSubscription();
        const isSubscriptionActive = subscription?.status === 'active' || subscription?.status === 'trialing';

        console.log('Status da assinatura:', subscription?.status);


        if (!isSubscriptionActive && pathname !== '/plans') {
          router.push('/plans');
          return;
        }

        setIsAllowed(true)
      } catch (error) {
        console.error('Erro ao verificar pagamentos:', error)
        router.push('/plans')
      } finally {
        setIsLoading(false)
      }
    }

    verifyPayment()
  }, [router, pathname])


  if (isLoading) {
    return null // pode trocar por spinner se quiser
  }

  return isAllowed ? <>{children}</> : null
}

export default PaymentCheckGuard
