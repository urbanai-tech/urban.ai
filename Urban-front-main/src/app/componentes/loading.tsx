'use client';

import React, { memo } from 'react';
import Image from 'next/image';

type Props = {
  fullscreen?: boolean;
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  overlayBg?: string;
  orbitColor?: string;
  title?: string;
  subtitle?: string;
};

function Inner({
  fullscreen,
  src,
  alt,
  width,
  height,
  overlayBg,
  orbitColor,
  title,
  subtitle,
}: Required<Omit<Props, 'overlayBg' | 'orbitColor' | 'title' | 'subtitle'>> & {
  overlayBg: string;
  orbitColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      style={{
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: fullscreen ? overlayBg : 'transparent',
        backdropFilter: fullscreen ? 'saturate(140%) blur(8px)' : undefined,
        zIndex: fullscreen ? 9999 : 'auto',
        color: 'var(--theme-page-text)',
      }}
    >
      <div
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 22,
          width: 'min(420px, 100%)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 'min(260px, 72vw)',
            animation: 'urban-loader-float 2.4s ease-in-out infinite',
          }}
        >
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              filter: 'drop-shadow(0 18px 36px rgba(0,0,0,0.26))',
            }}
          />

          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: '-22px',
              border: `1px solid ${orbitColor}`,
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
              borderRadius: '999px',
              opacity: 0.8,
              animation: 'urban-loader-spin 1.8s linear infinite',
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: '12%',
              right: '12%',
              bottom: -18,
              height: 1,
              background:
                'linear-gradient(90deg, transparent, rgba(232,80,10,0.72), transparent)',
              animation: 'urban-loader-line 1.4s ease-in-out infinite',
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <p
            style={{
              margin: 0,
              color: 'var(--theme-app-accent)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </p>
          <p
            style={{
              margin: 0,
              color: 'var(--theme-app-text-muted)',
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>
      <style>{`
        @keyframes urban-loader-float {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 8px 20px rgba(0,0,0,0.24)); }
          50% { transform: scale(1.018) translateY(-2px); filter: drop-shadow(0 12px 32px rgba(0,0,0,0.32)); }
        }
        @keyframes urban-loader-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes urban-loader-line {
          0%, 100% { opacity: 0.35; transform: scaleX(0.72); }
          50% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}

const UrbanAiLoader = memo(function UrbanAiLoader({
  fullscreen = true,
  src = '/urban-logo-transparent-soft.png',
  alt = 'UrbanAI',
  width = 360,
  height = 120,
  overlayBg = 'rgba(8,10,15,0.94)',
  orbitColor = 'rgba(232,80,10,0.62)',
  title = 'Entrando na Urban AI',
  subtitle = 'Preparando seu painel',
}: Props) {
  return (
    <Inner
      fullscreen={fullscreen}
      src={src}
      alt={alt}
      width={width}
      height={height}
      overlayBg={overlayBg}
      orbitColor={orbitColor}
      title={title}
      subtitle={subtitle}
    />
  );
});

export default UrbanAiLoader;
