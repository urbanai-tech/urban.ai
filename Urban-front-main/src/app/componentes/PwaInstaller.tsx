"use client";

import { useEffect } from "react";

export function PwaInstaller() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Urban AI service worker registration failed", error);
      });
    });
  }, []);

  return null;
}
