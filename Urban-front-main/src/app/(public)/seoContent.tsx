import NextLink from "next/link";
import type { Metadata } from "next";
import {
  JsonLd,
  buildCanonical,
  buildSeoMetadata,
  faqPageJsonLd,
  type JsonLdSchema,
  webPageJsonLd,
} from "../lib/seo";
import { SeoOrganicCtaSection } from "./SeoOrganicCtaSection";

type SeoQa = { question: string; answer: string };
type SeoBlock = { title: string; body: string };
type SeoInternalCta = { href: string; label: string; description: string };
export type SeoEvidenceStatus = "em_validacao" | "validado_interno" | "aprovado_publicacao" | "arquivado";

export type SeoCaseStudy = {
  title: string;
  summary: string;
  source: string;
  period: string;
  sample: string;
  status: SeoEvidenceStatus;
  validationNote: string;
};

export type SeoContent = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  answer: string;
  directAnswers: SeoQa[];
  sections: SeoBlock[];
  evidence: SeoBlock[];
  methodology: SeoBlock[];
  caseStudies: SeoCaseStudy[];
  internalCtas: SeoInternalCta[];
  faq: SeoQa[];
};

const caseStatusLabels: Record<SeoEvidenceStatus, string> = {
  em_validacao: "em validacao",
  validado_interno: "validado internamente",
  aprovado_publicacao: "aprovado para publicacao",
  arquivado: "arquivado",
};

export function contentMetadata(content: SeoContent): Metadata {
  return buildSeoMetadata({
    title: content.title,
    description: content.description,
    path: content.path,
  });
}

export function SeoContentPage({ content }: { content: SeoContent }) {
  const faqItems = [...content.directAnswers, ...content.faq];

  return (
    <main
      className="urban-manifesto urban-public-page"
      style={{ background: "#080A0F", color: "#FFFFFF" }}
    >
      <JsonLd
        id={`${content.path.replace(/\W+/g, "-")}-jsonld`}
        data={[
          webPageJsonLd({
            path: content.path,
            name: content.title,
            description: content.description,
          }),
          faqPageJsonLd(faqItems, content.path),
          itemListJsonLd(content, "evidence", "Evidencias rastreaveis", content.evidence),
          itemListJsonLd(content, "methodology", "Metodologia de leitura", content.methodology),
          caseStudyItemListJsonLd(content),
        ]}
      />

      <section className="urban-grain urban-public-section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="urban-glow" style={{ width: 720, height: 720, top: -220, right: -180 }} />
        <div className="urban-public-container" style={{ position: "relative", zIndex: 2 }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            {content.eyebrow}
          </p>
          <h1
            className="urban-display"
            style={{
              fontSize: "clamp(46px, 11vw, 130px)",
              lineHeight: 0.9,
              margin: 0,
              textTransform: "uppercase",
              overflowWrap: "break-word",
              hyphens: "auto",
              textWrap: "balance",
            }}
          >
            {content.h1}
          </h1>
          <p className="urban-public-copy" style={{ maxWidth: 820, marginTop: 48 }}>
            {content.lead}
          </p>
        </div>
      </section>

      <section className="urban-public-section" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="urban-public-container">
          <div className="urban-pull" style={{ maxWidth: 920 }}>
            <p style={{ margin: 0, fontSize: "clamp(24px, 3vw, 38px)", lineHeight: 1.35, color: "#FFFFFF" }}>
              {content.answer}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: 28,
              marginTop: 56,
            }}
          >
            {content.directAnswers.map((item) => (
              <article
                key={item.question}
                style={{
                  borderLeft: "3px solid #E8500A",
                  paddingLeft: 22,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, color: "#FFFFFF" }}>
                  {item.question}
                </h2>
                <p className="urban-public-copy" style={{ marginTop: 14, fontSize: 16 }}>
                  {item.answer}
                </p>
              </article>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
              gap: 32,
              marginTop: 72,
            }}
          >
            {content.sections.map((section) => (
              <article
                key={section.title}
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                  paddingTop: 24,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.25, color: "#FFFFFF" }}>
                  {section.title}
                </h2>
                <p className="urban-public-copy" style={{ marginTop: 16, fontSize: 16 }}>
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="evidencias-metodologia"
        className="urban-public-section"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          className="urban-public-container"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 48,
          }}
        >
          <div>
            <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
              Evidencias rastreaveis
            </p>
            {content.evidence.map((item) => (
              <article
                key={item.title}
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                  padding: "24px 0",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, color: "#FFFFFF" }}>
                  {item.title}
                </h2>
                <p className="urban-public-copy" style={{ marginTop: 14, fontSize: 16 }}>
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <div>
            <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
              Metodologia
            </p>
            {content.methodology.map((item) => (
              <article
                key={item.title}
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                  padding: "24px 0",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, color: "#FFFFFF" }}>
                  {item.title}
                </h2>
                <p className="urban-public-copy" style={{ marginTop: 14, fontSize: 16 }}>
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="estudos-de-caso"
        className="urban-public-section"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="urban-public-container">
          <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
            Estudos de caso
          </p>
          <div style={{ maxWidth: 920 }}>
            <h2
              style={{
                margin: 0,
                color: "#FFFFFF",
                fontSize: "clamp(30px, 5vw, 72px)",
                lineHeight: 1,
                textTransform: "uppercase",
                overflowWrap: "break-word",
                textWrap: "balance",
              }}
            >
              Evidencias em validacao
            </h2>
            <p className="urban-public-copy" style={{ marginTop: 22, fontSize: 18 }}>
              Estudos publicos so recebem metricas quando houver fonte, periodo, amostra e revisao
              registrados. Ate la, a Urban AI trata cada caso como em validacao.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: 24,
              marginTop: 48,
            }}
          >
            {content.caseStudies.map((study) => (
              <article
                key={study.title}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  padding: 24,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    color: "#E8500A",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  Status: {caseStatusLabels[study.status]}
                </span>
                <h3 style={{ margin: "18px 0 0", fontSize: 24, lineHeight: 1.2, color: "#FFFFFF" }}>
                  {study.title}
                </h3>
                <p className="urban-public-copy" style={{ marginTop: 14, fontSize: 16 }}>
                  {study.summary}
                </p>
                <dl
                  style={{
                    display: "grid",
                    gap: 14,
                    margin: "24px 0 0",
                  }}
                >
                  {[
                    ["Fonte", study.source],
                    ["Periodo", study.period],
                    ["Amostra", study.sample],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt
                        style={{
                          color: "rgba(255,255,255,0.48)",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </dt>
                      <dd className="urban-public-copy" style={{ margin: "6px 0 0", fontSize: 15 }}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p
                  className="urban-public-copy"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.10)",
                    marginTop: 24,
                    paddingTop: 18,
                    fontSize: 15,
                  }}
                >
                  {study.validationNote}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <SeoOrganicCtaSection
        id="links-internos"
        className="urban-public-section"
        ctaContext="seo_internal_hub"
        ctaCount={content.internalCtas.length}
        pagePath={content.path}
        pageTitle={content.title}
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="urban-public-container">
          <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
            Proximos passos
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 18,
            }}
          >
            {content.internalCtas.map((cta, index) => (
              <NextLink
                key={cta.href}
                href={cta.href}
                data-urban-analytics="hub-cta"
                data-analytics-href={cta.href}
                data-analytics-label={cta.label}
                data-analytics-position={index + 1}
                style={{
                  display: "block",
                  minHeight: 150,
                  border: "1px solid rgba(255,255,255,0.12)",
                  padding: 24,
                  color: "#FFFFFF",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    display: "block",
                    color: "#E8500A",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {cta.label}
                </span>
                <span
                  className="urban-public-copy"
                  style={{ display: "block", marginTop: 16, fontSize: 16 }}
                >
                  {cta.description}
                </span>
              </NextLink>
            ))}
          </div>
        </div>
      </SeoOrganicCtaSection>

      <section className="urban-public-section" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="urban-public-container" style={{ maxWidth: 980 }}>
          <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
            Perguntas frequentes
          </p>
          {content.faq.map((item) => (
            <details
              key={item.question}
              style={{
                borderTop: "1px solid rgba(255,255,255,0.10)",
                padding: "28px 0",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "#FFFFFF",
                  fontSize: 22,
                  fontWeight: 600,
                  overflowWrap: "anywhere",
                }}
              >
                {item.question}
              </summary>
              <p className="urban-public-copy" style={{ maxWidth: 760, marginTop: 18 }}>
                {item.answer}
              </p>
            </details>
          ))}

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 56 }}>
            <NextLink
              href="/precos"
              style={{
                padding: "16px 22px",
                background: "#E8500A",
                color: "#080A0F",
                textDecoration: "none",
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontSize: 12,
                textAlign: "center",
                whiteSpace: "normal",
              }}
            >
              Ver precos
            </NextLink>
            <NextLink
              href="/contato"
              style={{
                padding: "16px 22px",
                border: "1px solid rgba(255,255,255,0.20)",
                color: "#FFFFFF",
                textDecoration: "none",
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontSize: 12,
                textAlign: "center",
                whiteSpace: "normal",
              }}
            >
              Falar com a Urban
            </NextLink>
          </div>
        </div>
      </section>
    </main>
  );
}

function itemListJsonLd(
  content: SeoContent,
  slug: string,
  name: string,
  items: SeoBlock[],
): JsonLdSchema {
  return {
    "@type": "ItemList",
    "@id": `${buildCanonical(content.path)}#${slug}`,
    name: `${name} - ${content.title}`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      description: item.body,
      url: `${buildCanonical(content.path)}#evidencias-metodologia`,
    })),
  };
}

function caseStudyItemListJsonLd(content: SeoContent): JsonLdSchema {
  return {
    "@type": "ItemList",
    "@id": `${buildCanonical(content.path)}#estudos-de-caso`,
    name: `Estudos de caso - ${content.title}`,
    itemListElement: content.caseStudies.map((study, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: study.title,
      description: `${study.summary} Status: ${caseStatusLabels[study.status]}. Fonte: ${study.source}. Periodo: ${study.period}. Amostra: ${study.sample}.`,
      url: `${buildCanonical(content.path)}#estudos-de-caso`,
    })),
  };
}
