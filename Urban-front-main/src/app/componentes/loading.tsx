'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import styles from './loading.module.css';

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
      className={`${styles.root} ${fullscreen ? styles.rootFullscreen : ""}`}
      style={
        {
          "--loader-overlay": overlayBg,
          "--loader-orbit": orbitColor,
          "--loader-shadow-rest": "rgba(0,0,0,0.24)",
          "--loader-shadow-lift": "rgba(0,0,0,0.32)",
        } as React.CSSProperties
      }
    >
      <div className={styles.content}>
        <div className={styles.logoWrap}>
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority
            className={styles.logo}
            style={{ filter: 'drop-shadow(0 18px 36px rgba(0,0,0,0.26))' }}
          />

          <span aria-hidden className={styles.orbit} />
          <span aria-hidden className={styles.line} />
        </div>

        <div className={styles.texts}>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

const UrbanAiLoader = memo(function UrbanAiLoader({
  fullscreen = true,
  src = '/urban-logo-transparent-soft.png',
  alt = 'My Urban',
  width = 360,
  height = 120,
  overlayBg = 'color-mix(in srgb, var(--theme-app-bg) 94%, transparent)',
  orbitColor = 'color-mix(in srgb, var(--theme-app-accent) 62%, transparent)',
  title = 'Entrando no My Urban',
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
