'use client';

import React, { memo } from 'react';
import { BrandLogo } from './ui/BrandLogo';
import styles from './loading.module.css';

type Props = {
  fullscreen?: boolean;
  alt?: string;
  overlayBg?: string;
  orbitColor?: string;
  title?: string;
  subtitle?: string;
};

function Inner({
  fullscreen,
  alt,
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
        } as React.CSSProperties
      }
    >
      <div className={styles.content}>
        <div className={styles.logoWrap}>
          <BrandLogo variant="wordmark" alt={alt} className={styles.logo} priority />

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
  alt = 'My Urban',
  overlayBg = 'color-mix(in srgb, var(--theme-app-bg) 94%, transparent)',
  orbitColor = 'color-mix(in srgb, var(--theme-app-accent) 62%, transparent)',
  title = 'Entrando no My Urban',
  subtitle = 'Preparando seu painel',
}: Props) {
  return (
    <Inner
      fullscreen={fullscreen}
      alt={alt}
      overlayBg={overlayBg}
      orbitColor={orbitColor}
      title={title}
      subtitle={subtitle}
    />
  );
});

export default UrbanAiLoader;
