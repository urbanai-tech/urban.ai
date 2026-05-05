"use client";

import Script from "next/script";
import { useConsent } from "./useConsent";

/**
 * GA4 + Meta Pixel — com gating LGPD via useConsent.
 *
 * Controlado por env vars:
 *   NEXT_PUBLIC_GA4_ID        — "G-XXXXXXXXXX" (desabilitado se vazio)
 *   NEXT_PUBLIC_META_PIXEL_ID — "1234567890123456" (desabilitado se vazio)
 *
 * Em ambientes staging e development, só ativa se NEXT_PUBLIC_APP_ENV="production"
 * para evitar poluir os relatórios com tráfego sintético.
 *
 * Gating de consent:
 *   - GA4 só carrega quando `state.analytics === true`
 *   - Meta Pixel só carrega quando `state.marketing === true`
 *
 * Antes do user consentir, NENHUM script de telemetria opcional é injetado
 * — alinhado à LGPD art. 7º (consentimento explícito para tratamento não
 * essencial).
 */
export function Analytics() {
  const appEnv =
    process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
  const isProd = appEnv === "production";

  const gaId = process.env.NEXT_PUBLIC_GA4_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  const { state, loaded } = useConsent();

  // Em dev/staging, ou enquanto consent ainda não carregou do localStorage,
  // não carrega nada. Após `loaded=true`, o gating por categoria toma efeito.
  if (!isProd) return null;
  if (!loaded) return null;

  return (
    <>
      {gaId && state.analytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {pixelId && state.marketing && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
