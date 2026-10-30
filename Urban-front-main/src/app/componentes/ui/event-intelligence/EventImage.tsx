"use client";

import React, { useEffect, useState } from "react";
import * as Icons from "../Icons";
import styles from "./EventImage.module.css";

const DEFAULT_LOAD_TIMEOUT_MS = 8_000;

export function EventImage({
  src,
  alt,
  venue,
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
}: {
  src?: string | null;
  alt: string;
  venue?: string | null;
  loadTimeoutMs?: number;
}) {
  const [failed, setFailed] = useState(!src);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(!src);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    if (!src || failed || loaded) return;

    const timeout = window.setTimeout(() => setFailed(true), loadTimeoutMs);
    return () => window.clearTimeout(timeout);
  }, [failed, loadTimeoutMs, loaded, src]);

  if (failed || !src) {
    return <EventImageFallback eventName={alt} venue={venue} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      data-testid="event-image"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={styles.image}
    />
  );
}

function EventImageFallback({
  eventName,
  venue,
}: {
  eventName: string;
  venue?: string | null;
}) {
  return (
    <div
      data-testid="event-image-fallback"
      role="img"
      aria-label={`Imagem indisponível para ${eventName}`}
      className={styles.fallback}
    >
      <div className={styles.fallbackContent}>
        <span
          aria-hidden
          className={styles.fallbackIcon}
        >
          <Icons.Calendar size={19} />
        </span>
        <span className={styles.fallbackLabel}>
          Evento monitorado
        </span>
        {venue && (
          <span
            className={styles.fallbackVenue}
          >
            {venue}
          </span>
        )}
      </div>
    </div>
  );
}
