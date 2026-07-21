import type { Metadata } from "next";
import { JsonLd, buildSeoMetadata, faqPageJsonLd } from "../../lib/seo";
import {
  CheckList,
  FinalCommercialCta,
  ProductPreview,
  PublicButton,
  PUBLIC_SIGNUP_URL,
  SectionHeading,
} from "../../componentes/PublicMarketing";

export const metadata: Metadata = buildSeoMetadata({
  title: "Comece agora | Urban AI",
  description: "Crie sua conta Urban AI, cadastre seu imóvel e comece a receber recomendações de preço com contexto urbano.",
  path: "/lancamento",
});

const FAQ = [
  { question: "A conta é liberada na hora?", answer: "Sim. O cadastro leva você ao onboarding para configurar sua operação e o primeiro imóvel." },
  { question: "Preciso integrar um canal para começar?", answer: "Não. Você pode usar o modo de recomendação e aplicar preços manualmente antes de conectar qualquer integração." },
  { question: "Posso começar com um imóvel?", answer: "Sim. O plano Starter foi desenhado para operações de 1 a 3 imóveis." },
  { question: "Consigo falar com alguém antes de contratar?", answer: "Sim. Use a página de contato para conversar sobre operação, planos ou integração." },
];

export default function ComeceAgoraPage() {
  return (
    <main className="urban-manifesto urban-public-page">
      <JsonLd id="start-jsonld" data={faqPageJsonLd(FAQ, "/lancamento")} />
      <section className="public-page-hero">
        <div className="public-container public-page-hero__grid">
          <div>
            <p className="public-kicker">Urban AI disponível</p>
            <h1>Comece com um imóvel. Evolua com a sua <em>operação.</em></h1>
            <p className="public-page-hero__lead">Crie sua conta, configure o primeiro imóvel e use a Urban AI no modo que fizer sentido: recomendação manual ou automação com limites.</p>
            <div className="public-page-hero__actions">
              <PublicButton href={PUBLIC_SIGNUP_URL}>Criar minha conta</PublicButton>
              <PublicButton href="/precos" variant="secondary">Ver planos</PublicButton>
            </div>
          </div>
          <aside className="public-page-hero__aside"><p><strong style={{ color: "var(--theme-public-text)" }}>Sem fila de espera.</strong><br />O produto está disponível para cadastro e onboarding.</p></aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <SectionHeading eyebrow="Primeiros passos" title={<>Do cadastro à primeira recomendação, <em>sem rodeios.</em></>} />
          <div className="public-process">
            <article><span>01</span><h3>Crie sua conta</h3><p>Cadastre seus dados e acesse o onboarding da Urban AI.</p></article>
            <article><span>02</span><h3>Configure a operação</h3><p>Informe o perfil da sua operação e cadastre o imóvel que será acompanhado.</p></article>
            <article><span>03</span><h3>Revise com contexto</h3><p>Acompanhe datas, motivos e preços recomendados no painel.</p></article>
          </div>
        </div>
      </section>

      <section className="public-section public-section--soft">
        <div className="public-container public-split">
          <div>
            <SectionHeading
              eyebrow="Você escolhe o ritmo"
              title={<>Comece no controle. Automatize <em>quando quiser.</em></>}
              description="A experiência não exige integração para gerar valor. Primeiro entenda as recomendações; depois conecte o fluxo se isso simplificar sua operação."
            />
            <CheckList items={["Modo de recomendação manual", "Motivo de cada sugestão", "Limites por operação", "Integração Stays no plano Profissional"]} />
          </div>
          <ProductPreview compact />
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <SectionHeading eyebrow="Antes de começar" title={<>Perguntas <em>frequentes.</em></>} />
          <div className="public-faq">{FAQ.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
        </div>
      </section>

      <FinalCommercialCta eyebrow="Produto disponível" title={<>Abra sua conta e leve mais contexto para o seu <em style={{ color: "var(--theme-public-accent)" }}>calendário.</em></>} />
    </main>
  );
}
