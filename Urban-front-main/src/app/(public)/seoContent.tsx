import NextLink from "next/link";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { JsonLd, buildSeoMetadata, faqPageJsonLd, webPageJsonLd } from "../lib/seo";
import { FinalCommercialCta, ProductPreview, PublicButton, SectionHeading } from "../componentes/PublicMarketing";
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

export function contentMetadata(content: SeoContent): Metadata {
  return buildSeoMetadata({ title: content.title, description: content.description, path: content.path });
}

export function SeoContentPage({ content }: { content: SeoContent }) {
  const faqItems = [...content.directAnswers, ...content.faq];
  const isComparison = content.path === "/urban-ai-vs-planilha-de-precificacao";

  return (
    <main className="urban-manifesto urban-public-page">
      <JsonLd
        id={`${content.path.replace(/\W+/g, "-")}-jsonld`}
        data={[
          webPageJsonLd({ path: content.path, name: content.title, description: content.description }),
          faqPageJsonLd(faqItems, content.path),
        ]}
      />

      <section className="public-article-hero">
        <div className="public-container public-article-hero__grid">
          <div>
            <p className="public-kicker">{content.eyebrow}</p>
            <h1>{content.h1}</h1>
            <p className="public-article-hero__lead">{content.lead}</p>
          </div>
          <nav className="public-article-nav" aria-label="Nesta página">
            <p>Nesta página</p>
            <a href="#resposta-direta">Resposta direta</a>
            <a href="#pontos-chave">Pontos-chave</a>
            <a href="#metodologia">Como avaliar</a>
            {isComparison ? <a href="#comparacao">Comparação</a> : null}
            <a href="#perguntas">Perguntas frequentes</a>
          </nav>
        </div>
      </section>

      <section id="resposta-direta" className="public-section">
        <div className="public-container">
          <blockquote className="public-quote" style={{ maxWidth: 980 }}>{content.answer}</blockquote>
          <div className="public-article-grid" style={{ marginTop: 54 }}>
            {content.directAnswers.map((item) => (
              <article className="public-content-card" key={item.question}>
                <h2>{item.question}</h2>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pontos-chave" className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading
            eyebrow="Pontos-chave"
            title={<>O que você precisa <em>considerar.</em></>}
            description="Conceitos práticos para transformar o tema em uma decisão de preço mais consistente."
          />
          <div className="public-article-grid">
            {content.sections.map((section) => <ContentCard key={section.title} item={section} />)}
          </div>
        </div>
      </section>

      <section id="metodologia" className="public-section">
        <div className="public-container public-split">
          <div>
            <SectionHeading
              eyebrow="Como avaliar"
              title={<>Use sinais verificáveis, não <em>promessas prontas.</em></>}
              description="A boa decisão combina contexto externo, regra comercial e acompanhamento do que foi aplicado."
            />
            <div className="public-article-grid" style={{ gridTemplateColumns: "1fr" }}>
              {content.evidence.map((item) => <ContentCard key={item.title} item={item} />)}
            </div>
          </div>
          <div>
            <p className="public-kicker">Método recomendado</p>
            <div className="public-process" style={{ gridTemplateColumns: "1fr" }}>
              {content.methodology.map((item, index) => (
                <article key={item.title} style={{ minHeight: 0 }}>
                  <span style={{ fontSize: 44 }}>{String(index + 1).padStart(2, "0")}</span>
                  <h3 style={{ marginTop: 30 }}>{item.title.replace(/^\d+\.\s*/, "")}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isComparison ? <ComparisonSection /> : (
        <section className="public-section public-section--soft">
          <div className="public-container public-split">
            <div>
              <SectionHeading
                eyebrow="Na prática"
                title={<>Transforme contexto em uma recomendação <em>explicável.</em></>}
                description="A Urban AI reúne o sinal, a data afetada, o preço atual e o recomendado na mesma decisão."
              />
              <PublicButton href="/precos">Conhecer os planos</PublicButton>
            </div>
            <ProductPreview compact />
          </div>
        </section>
      )}

      <SeoOrganicCtaSection
        id="proximos-passos"
        className="public-section"
        ctaContext="seo_internal_hub"
        ctaCount={content.internalCtas.length}
        pagePath={content.path}
        pageTitle={content.title}
      >
        <div className="public-container">
          <SectionHeading eyebrow="Continue explorando" title={<>Próximos <em>passos.</em></>} />
          <div className="public-article-grid">
            {content.internalCtas.map((cta, index) => (
              <NextLink
                className="public-content-card"
                style={{ textDecoration: "none" }}
                key={cta.href}
                href={cta.href}
                data-urban-analytics="hub-cta"
                data-analytics-href={cta.href}
                data-analytics-label={cta.label}
                data-analytics-position={index + 1}
              >
                <h3>{cta.label}</h3><p>{cta.description}</p>
              </NextLink>
            ))}
          </div>
        </div>
      </SeoOrganicCtaSection>

      <section id="perguntas" className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading eyebrow="Perguntas frequentes" title={<>Respostas para decidir com <em>clareza.</em></>} />
          <div className="public-faq">
            {content.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </div>
        </div>
      </section>

      <FinalCommercialCta />
    </main>
  );
}

function ContentCard({ item }: { item: SeoBlock }) {
  return <article className="public-content-card"><h2>{item.title}</h2><p>{item.body}</p></article>;
}

function ComparisonSection() {
  const rows = [
    ["Custos e metas internas", true, true],
    ["Atualização manual", true, false],
    ["Eventos e contexto local", false, true],
    ["Recomendação por data", false, true],
    ["Motivo da recomendação", false, true],
    ["Histórico operacional", "Parcial", true],
  ] as const;
  return (
    <section id="comparacao" className="public-section public-section--soft">
      <div className="public-container">
        <SectionHeading eyebrow="Comparação direta" title={<>Planilha e Urban AI cumprem <em>papéis diferentes.</em></>} description="A planilha continua útil para regras financeiras. A Urban AI adiciona leitura contínua de contexto e exceções." />
        <div className="public-comparison-wrap"><table className="public-comparison"><thead><tr><th>Capacidade</th><th>Planilha</th><th>Urban AI</th></tr></thead><tbody>
          {rows.map(([name, sheet, urban]) => <tr key={name}><td>{name}</td><td>{typeof sheet === "string" ? sheet : sheet ? <Check aria-hidden size={18} /> : <Minus aria-hidden size={18} />}</td><td>{urban ? <Check aria-hidden size={18} /> : <Minus aria-hidden size={18} />}</td></tr>)}
        </tbody></table></div>
      </div>
    </section>
  );
}
