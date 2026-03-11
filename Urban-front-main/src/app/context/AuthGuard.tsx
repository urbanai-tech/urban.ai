'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // isPublicPath com publicPaths definido dentro para evitar warning
  const isPublicPath = useCallback((path: string) => {
    const publicPaths = ['/', '/login', '/create']
    return publicPaths.includes(path)
  }, [])

  useEffect(() => {
    const checkAuth = () => {
      if (typeof window === 'undefined') return
      
      const token = localStorage.getItem('accessToken')
      
      if (isPublicPath(pathname)) {
        setIsLoading(false)
        return
      }
      
      if (!token) {
        router.push('/')
        return
      }
      
      setIsAuthenticated(true)
      setIsLoading(false)
    }
    
    checkAuth()
  }, [router, pathname, isPublicPath])

  if (isLoading) {
    return null
  }

  if (isPublicPath(pathname) || isAuthenticated) {
    return <>{children}</>
  }

  return null
}

export default AuthGuard
