"use client";

import React, { useEffect, useState } from "react";
import * as Icons from "../Icons";

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
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: 20,
        color: "var(--app-text-muted)",
        background:
          "radial-gradient(circle at 18% 20%, var(--app-accent-soft), transparent 42%), var(--app-surface-muted)",
        textAlign: "center",
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 8, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            color: "var(--app-accent)",
            background: "var(--app-accent-soft)",
          }}
        >
          <Icons.Calendar size={19} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 750, letterSpacing: 1.1, textTransform: "uppercase" }}>
          Evento monitorado
        </span>
        {venue && (
          <span
            style={{
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 11,
              color: "var(--app-text-dim)",
            }}
          >
            {venue}
          </span>
        )}
      </div>
    </div>
  );
}
