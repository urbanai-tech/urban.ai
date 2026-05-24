"use client"
import React from 'react'
import Image from 'next/image'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '32px 0' }} className="urban-app">
        <Image
          src="/urban-logo-transparent-soft.png"
          alt="Urban AI Logo"
          width={160}
          height={40}
          priority
          style={{ display: 'block', height: 40, width: 'auto', margin: '0 auto 16px' }}
        />
        {children}
      </main>
    </div>
  )
}
