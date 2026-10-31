import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { JsonLd, buildSeoMetadata, faqPageJsonLd, offerJsonLd } from "../../lib/seo";
import { formatPublicPrice, getPublicPricing, jsonLdPrice, type PublicPricing } from "../../lib/publicPlans";
import styles from "./page.module.css";
import {
  CheckList,
  FinalCommercialCta,
  PublicButton,
  PUBLIC_SIGNUP_URL,
  SectionHeading,
} from "../../componentes/PublicMarketing";

export const metadata: Metadata = buildSeoMetadata({
  title: "Preços | My Urban AI",
  description: "Planos por imóvel para anfitriões e gestoras, sem comissão sobre receita e com ciclos flexíveis.",
  path: "/precos",
});

const FAQ = [
  { question: "Como funciona a cobrança por imóvel?", answer: "O valor considera o plano, a quantidade de imóveis e o ciclo escolhido. A faixa aplicável é mostrada antes da contratação." },
  { question: "Posso mudar de plano?", answer: "Sim. A operação pode evoluir de Starter para Profissional quando precisar de mais imóveis ou de recursos adicionais." },
  { question: "O My Urban cobra comissão sobre as reservas?", answer: "Não. A cobrança é por imóvel no ciclo contratado; o My Urban não recebe percentual da sua receita." },
  { question: "Preciso contratar a integração Stays?", answer: "Não. O modo de recomendação funciona sem integração. A integração Stays está em beta fechado, sob convite, e é incluída no plano Profissional quando liberada para a sua conta." },
  { question: "Tenho mais de 500 imóveis. Como funciona?", answer: "Operações maiores recebem uma proposta adequada a volume, contas, integração e necessidades de atendimento." },
];

const buildPlans = (pricing: PublicPricing) => [
  {
    name: "Starter",
    audience: "Para anfitriões com 1 a 3 imóveis.",
    price: formatPublicPrice(pricing.starter.monthly),
    note: "por imóvel/mês no ciclo mensal",
    features: [
      "Painel e recomendações por data",
      "Leitura de eventos e contexto local",
      "Histórico de recomendações",
      "Aplicação manual com controle total",
      "Suporte por e-mail",
    ],
  },
  {
    name: "Profissional",
    audience: "Para operações com 4 a 500 imóveis.",
    price: formatPublicPrice(pricing.profissional.monthly),
    note: "por imóvel/mês no ciclo mensal",
    featured: true,
    features: [
      "Tudo do Starter",
      "Integração Stays (beta fechado, sob convite)",
      "Regras e limites por imóvel",
      "Visão consolidada da operação",
      "Suporte prioritário",
    ],
  },
  {
    name: "Escala",
    audience: "Para gestoras com mais de 500 imóveis.",
    price: "Sob medida",
    note: "proposta conforme a operação",
    features: [
      "Onboarding e desenho operacional",
      "Requisitos operacionais específicos",
      "Governança para múltiplas contas",
      "Acompanhamento comercial dedicado",
      "Condições por volume",
    ],
  },
];

export default async function PrecosPage() {
  // Mesma fonte do checkout (GET /plans); fallback nos valores de referência.
  const pricing = await getPublicPricing();
  const plans = buildPlans(pricing);
  const ladder = pricing.profissional;

  return (
    <main className="urban-manifesto urban-public-page">
      <JsonLd id="pricing-jsonld" data={[
        offerJsonLd("Starter", jsonLdPrice(pricing.starter.monthly), "/precos"),
        offerJsonLd("Profissional", jsonLdPrice(pricing.profissional.monthly), "/precos"),
        faqPageJsonLd(FAQ, "/precos"),
      ]} />

      <section className="public-page-hero">
        <div className="public-container public-page-hero__grid">
          <div>
            <p className="public-kicker">Preços transparentes</p>
            <h1>Um plano para cada fase da sua <em>operação.</em></h1>
            <p className="public-page-hero__lead">Cobrança por imóvel, sem comissão sobre receita. Comece com recomendações; a integração Stays está em beta fechado, sob convite.</p>
            <div className="public-page-hero__actions">
              <PublicButton href={PUBLIC_SIGNUP_URL}>Criar minha conta</PublicButton>
              <PublicButton href="#comparar" variant="secondary">Comparar recursos</PublicButton>
            </div>
          </div>
          <aside className="public-page-hero__aside">
            <p><strong className={styles.strongLead}>Ciclos disponíveis</strong><br />Mensal, trimestral, semestral e anual. O valor por imóvel diminui nos ciclos mais longos.</p>
          </aside>
        </div>
      </section>

      <section className="public-section public-pricing-section">
        <div className="public-container">
          <div className="public-pricing-grid">
            {plans.map((plan) => (
              <article className={`public-price-card ${plan.featured ? "is-featured" : ""}`} key={plan.name}>
                {plan.featured ? <span className="public-price-card__tag">Mais escolhido</span> : null}
                <h2>{plan.name}</h2>
                <p className="public-price-card__audience">{plan.audience}</p>
                <p className="public-price-card__price">
                  {plan.price === "Sob medida" ? <strong className={styles.priceCustom}>{plan.price}</strong> : <><span>R$</span><strong>{plan.price}</strong></>}
                </p>
                <p className="public-price-card__billing">{plan.note}</p>
                <PublicButton href={plan.name === "Escala" ? "mailto:comercial@myurbanai.com" : PUBLIC_SIGNUP_URL} variant={plan.featured ? "primary" : "secondary"}>
                  {plan.name === "Escala" ? "Falar com comercial" : "Escolher plano"}
                </PublicButton>
                <CheckList items={plan.features} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="comparar" className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading
            eyebrow="Comparação"
            title={<>Veja o que entra em <em>cada plano.</em></>}
            description="Escolha pelo tamanho da operação — não por uma lista artificial de limitações."
          />
          <div className="public-comparison-wrap" role="region" tabIndex={0} aria-label="Comparação de planos">
            <table className="public-comparison">
              <thead><tr><th>Recurso</th><th>Starter</th><th>Profissional</th><th>Escala</th></tr></thead>
              <tbody>
                <ComparisonRow name="Recomendações explicadas" values={[true, true, true]} />
                <ComparisonRow name="Eventos e contexto local" values={[true, true, true]} />
                <ComparisonRow name="Histórico de decisões" values={[true, true, true]} />
                <ComparisonRow name="Integração Stays (beta fechado, sob convite)" values={[false, true, true]} />
                <ComparisonRow name="Regras e limites por imóvel" values={[false, true, true]} />
                <ComparisonRow name="Operação multi-conta" values={[false, false, true]} />
                <ComparisonRow name="Requisitos específicos (sob proposta)" values={[false, false, true]} />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-split">
          <div>
            <SectionHeading
              eyebrow="Ciclos de contratação"
              title={<>Quanto maior o ciclo, menor o <em>valor mensal.</em></>}
              description="Os descontos são aplicados por ciclo e exibidos na contratação antes da confirmação."
            />
          </div>
          <div className="public-content-card">
            <h3>Referência do plano Profissional</h3>
            <CheckList items={[
              `Mensal: R$ ${formatPublicPrice(ladder.monthly)} por imóvel/mês`,
              `Trimestral: R$ ${formatPublicPrice(ladder.quarterly)} por imóvel/mês`,
              `Semestral: R$ ${formatPublicPrice(ladder.semestral)} por imóvel/mês`,
              `Anual: R$ ${formatPublicPrice(ladder.annual)} por imóvel/mês`,
            ]} />
          </div>
        </div>
      </section>

      <section className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading eyebrow="Dúvidas de contratação" title={<>Respostas <em>diretas.</em></>} />
          <div className="public-faq">
            {FAQ.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </div>
        </div>
      </section>

      <FinalCommercialCta title={<>Escolha o plano e comece a ler seu calendário com <em className={styles.accentEm}>mais contexto.</em></>} />
    </main>
  );
}

function ComparisonRow({ name, values }: { name: string; values: boolean[] }) {
  return (
    <tr>
      <td>{name}</td>
      {values.map((value, index) => <td key={`${name}-${index}`} aria-label={value ? "Incluído" : "Não incluído"}>{value ? <Check aria-hidden size={18} /> : <Minus aria-hidden size={18} />}</td>)}
    </tr>
  );
}
