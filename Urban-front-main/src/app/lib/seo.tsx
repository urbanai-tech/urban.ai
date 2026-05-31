import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://myurbanai.com";
const DEFAULT_APP_URL = "https://app.myurbanai.com";
const DEFAULT_LOGO_IMAGE = "/pwa-icon-512.png";
export const DEFAULT_OG_IMAGE = "/opengraph-image";
export const DEFAULT_TWITTER_IMAGE = "/twitter-image";

export const siteConfig = {
  name: "Urban AI",
  legalName: "MP IA Tecnologia Ltda",
  url: normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL),
  appUrl: normalizeUrl(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL),
  description:
    "Precificação dinâmica para anfitriões com IA, calendário urbano e operação assistida.",
  locale: "pt_BR",
  email: "contato@myurbanai.com",
  privacyEmail: "privacidade@myurbanai.com",
  sameAs: [] as string[],
};

export type JsonLdSchema = Record<string, unknown>;

type SeoMetadataInput = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  twitterImage?: string;
  imageAlt?: string;
  type?: "website" | "article";
  noIndex?: boolean;
};

export function buildCanonical(path = "/") {
  return new URL(path, siteConfig.url).toString();
}

export function buildSeoMetadata({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  twitterImage = DEFAULT_TWITTER_IMAGE,
  imageAlt = "Urban AI - Precificação dinâmica para Airbnb",
  type = "website",
  noIndex = false,
}: SeoMetadataInput): Metadata {
  const canonical = buildCanonical(path);
  const imageUrl = new URL(image, siteConfig.url).toString();
  const twitterImageUrl = new URL(twitterImage, siteConfig.url).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      type,
      locale: siteConfig.locale,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImageUrl],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
  };
}

export function JsonLd({
  data,
  id,
}: {
  data: JsonLdSchema | JsonLdSchema[];
  id?: string;
}) {
  const graph = Array.isArray(data) ? data : [data];

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph.map(withoutContext),
        }).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function organizationJsonLd(): JsonLdSchema {
  return {
    "@type": "Organization",
    "@id": `${siteConfig.url}#organization`,
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: siteConfig.url,
    logo: new URL(DEFAULT_LOGO_IMAGE, siteConfig.url).toString(),
    email: siteConfig.email,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: siteConfig.email,
        availableLanguage: ["Portuguese", "Portuguese (Brazil)"],
      },
      {
        "@type": "ContactPoint",
        contactType: "privacy",
        email: siteConfig.privacyEmail,
        availableLanguage: ["Portuguese", "Portuguese (Brazil)"],
      },
    ],
    taxID: "62.497.936/0001-27",
    address: {
      "@type": "PostalAddress",
      addressLocality: "São Paulo",
      addressRegion: "SP",
      addressCountry: "BR",
    },
    sameAs: siteConfig.sameAs,
  };
}

export function websiteJsonLd(): JsonLdSchema {
  return {
    "@type": "WebSite",
    "@id": `${siteConfig.url}#website`,
    name: siteConfig.name,
    url: siteConfig.url,
    publisher: { "@id": `${siteConfig.url}#organization` },
    inLanguage: "pt-BR",
  };
}

export function softwareApplicationJsonLd(): JsonLdSchema {
  return {
    "@type": "SoftwareApplication",
    "@id": `${siteConfig.url}#software`,
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteConfig.url,
    description: siteConfig.description,
    offers: [
      offerJsonLd("Starter", "97", "/precos", "imóvel por mês no ciclo anual"),
      offerJsonLd("Profissional", "67", "/precos", "imóvel por mês no ciclo anual"),
    ],
    publisher: { "@id": `${siteConfig.url}#organization` },
  };
}

export function offerJsonLd(
  name: string,
  price: string,
  path = "/precos",
  unitText = "imóvel por mês",
): JsonLdSchema {
  return {
    "@type": "Offer",
    name,
    price,
    priceCurrency: "BRL",
    unitText,
    url: buildCanonical(path),
    availability: "https://schema.org/PreOrder",
    seller: { "@id": `${siteConfig.url}#organization` },
  };
}

export function contactPageJsonLd(path = "/contato"): JsonLdSchema {
  return {
    "@type": "ContactPage",
    "@id": `${buildCanonical(path)}#contact`,
    url: buildCanonical(path),
    name: "Contato Urban AI",
    about: { "@id": `${siteConfig.url}#organization` },
  };
}

export function aboutPageJsonLd(path = "/sobre"): JsonLdSchema {
  return {
    "@type": "AboutPage",
    "@id": `${buildCanonical(path)}#about`,
    url: buildCanonical(path),
    name: "Sobre a Urban AI",
    about: { "@id": `${siteConfig.url}#organization` },
  };
}

export function webPageJsonLd({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}): JsonLdSchema {
  return {
    "@type": "WebPage",
    "@id": `${buildCanonical(path)}#webpage`,
    url: buildCanonical(path),
    name,
    description,
    inLanguage: "pt-BR",
    isPartOf: { "@id": `${siteConfig.url}#website` },
    publisher: { "@id": `${siteConfig.url}#organization` },
  };
}

export function faqPageJsonLd(
  items: Array<{ question: string; answer: string }>,
  path: string,
): JsonLdSchema {
  return {
    "@type": "FAQPage",
    "@id": `${buildCanonical(path)}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function publicBaseJsonLd() {
  return [organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()];
}

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function withoutContext(schema: JsonLdSchema) {
  const { "@context": _context, ...rest } = schema;
  return rest;
}
