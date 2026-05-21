"use client"
import React from 'react'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFB', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '32px 0' }} className="urban-app">
        <img
          src="/urban-logo-transparent-soft.png"
          alt="Urban AI Logo"
          style={{ display: 'block', height: 40, margin: '0 auto 16px' }}
        />
        {children}
      </main>
    </div>
  )
}
