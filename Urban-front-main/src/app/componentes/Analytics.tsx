"use client";

import Script from "next/script";

/**
 * GA4 + Meta Pixel.
 *
 * Controlado por env vars:
 *   NEXT_PUBLIC_GA4_ID        — "G-XXXXXXXXXX" (desabilitado se vazio)
 *   NEXT_PUBLIC_META_PIXEL_ID — "1234567890123456" (desabilitado se vazio)
 *
 * Em ambientes staging e development, só ativa se NEXT_PUBLIC_APP_ENV="production"
 * para evitar poluir os relatórios com tráfego sintético.
 */
export function Analytics() {
  const appEnv =
    process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
  const isProd = appEnv === "production";

  const gaId = process.env.NEXT_PUBLIC_GA4_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  if (!isProd) return null;

  return (
    <>
      {gaId && (
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

      {pixelId && (
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
