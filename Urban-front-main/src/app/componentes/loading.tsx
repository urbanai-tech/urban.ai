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
};

function Inner({
  fullscreen,
  src,
  alt,
  width,
  height,
  overlayBg,
  orbitColor,
}: Required<Omit<Props, 'overlayBg' | 'orbitColor'>> & {
  overlayBg: string;
  orbitColor: string;
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
        background: fullscreen ? overlayBg : 'transparent',
        backdropFilter: fullscreen ? 'saturate(140%) blur(6px)' : undefined,
        zIndex: fullscreen ? 9999 : 'auto',
      }}
    >
      <div style={{ position: 'relative', animation: 'urban-loader-pulse 2.4s ease-in-out infinite' }}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority
          style={{ display: 'block', height: 'auto' }}
        />

        <span
          aria-hidden
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '30%',
              transform: 'translateX(-150%)',
              background:
                'linear-gradient(110deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0) 100%)',
              animation: 'urban-loader-shine 1.35s ease-in-out infinite',
            }}
          />
        </span>

        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `${Math.max(width, height) * 0.9}px`,
            height: `${Math.max(width, height) * 0.9}px`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '999px',
            animation: 'urban-loader-spin 1.75s linear infinite',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 12,
              height: 12,
              borderRadius: '999px',
              background: orbitColor,
              boxShadow: '0 0 0 0 rgba(228,110,46,0.75)',
            }}
          />
        </span>
      </div>
      <style>{`
        @keyframes urban-loader-shine {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(150%); }
        }
        @keyframes urban-loader-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 8px 20px rgba(0,0,0,0.24)); }
          50% { transform: scale(1.02); filter: drop-shadow(0 10px 28px rgba(0,0,0,0.28)); }
        }
        @keyframes urban-loader-spin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const UrbanAiLoader = memo(function UrbanAiLoader({
  fullscreen = true,
  src = '/urban-logo.png',
  alt = 'UrbanAI',
  width = 360,
  height = 120,
  overlayBg = 'rgba(10,12,24,0.76)',
  orbitColor = '#E46E2E',
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
    />
  );
});

export default UrbanAiLoader;
