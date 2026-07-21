import type { Metadata } from "next";
import { Building2, Check, MapPinned, ShieldCheck } from "lucide-react";
import { JsonLd, buildSeoMetadata, faqPageJsonLd } from "../../lib/seo";
import {
  CheckList,
  FinalCommercialCta,
  PillarGrid,
  ProductPreview,
  PublicButton,
  PUBLIC_SIGNUP_URL,
  SectionHeading,
  TrustBar,
} from "../../componentes/PublicMarketing";

export const metadata: Metadata = buildSeoMetadata({
  title: "Urban AI | Precificação inteligente para aluguel por temporada",
  description:
    "Transforme eventos, sazonalidade e sinais do bairro em recomendações de preço explicáveis para seus imóveis de temporada.",
  path: "/",
});

const FAQ = [
  {
    question: "O que a Urban AI analisa?",
    answer: "A Urban AI combina eventos, calendário, localização, sazonalidade e informações operacionais do imóvel para destacar datas que merecem revisão de preço.",
  },
  {
    question: "A plataforma altera preços sem minha autorização?",
    answer: "Não. Você pode começar no modo de recomendação e aplicar cada sugestão manualmente. A automação é opcional e respeita os limites configurados.",
  },
  {
    question: "Preciso usar a integração Stays?",
    answer: "Não. O painel e as recomendações podem ser usados sem automação. A integração Stays atende operações que querem enviar preços para o canal com regras de controle.",
  },
  {
    question: "Para quem a Urban AI foi criada?",
    answer: "Para anfitriões profissionais, investidores e gestoras de aluguel por temporada que precisam revisar muitas datas com mais contexto e menos trabalho manual.",
  },
  {
    question: "A Urban AI garante aumento de receita?",
    answer: "Não. Resultado depende do imóvel, do mercado e da decisão comercial. A Urban AI melhora a leitura de contexto e a rastreabilidade da decisão, sem prometer retorno fixo.",
  },
];

export default function LandingPage() {
  return (
    <main className="urban-manifesto urban-public-page">
      <JsonLd id="landing-faq-jsonld" data={faqPageJsonLd(FAQ, "/")} />

      <section className="public-hero">
        <div className="public-container public-hero__grid">
          <div>
            <p className="public-kicker">Precificação inteligente para aluguel por temporada</p>
            <h1>Quando a cidade muda, seu <em>preço acompanha.</em></h1>
            <p className="public-hero__lead">
              A Urban AI conecta eventos, sazonalidade e contexto do bairro para recomendar
              preços explicáveis. Você entende o motivo, define os limites e mantém o controle.
            </p>
            <div className="public-hero__actions">
              <PublicButton href={PUBLIC_SIGNUP_URL}>Criar minha conta</PublicButton>
              <PublicButton href="#como-funciona" variant="secondary">Ver como funciona</PublicButton>
            </div>
            <p className="public-hero__microcopy">Cadastro direto · Controle por imóvel · Automação opcional</p>
          </div>
          <div className="public-hero__visual">
            <ProductPreview />
          </div>
        </div>
      </section>

      <div className="public-trust-wrap"><TrustBar /></div>

      <section id="produto" className="public-section">
        <div className="public-container">
          <SectionHeading
            eyebrow="O produto"
            title={<>Uma leitura de preço que começa <em>fora da planilha.</em></>}
            description="O calendário urbano muda antes da sua ocupação. A Urban AI organiza esses sinais e mostra onde vale revisar a estratégia."
          />
          <PillarGrid />
        </div>
      </section>

      <section id="como-funciona" className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading
            eyebrow="Como funciona"
            title={<>Da cidade para o seu calendário em <em>três passos.</em></>}
            description="Um fluxo simples para sair da revisão reativa e tomar decisões com antecedência."
          />
          <div className="public-process">
            <article>
              <span>01</span>
              <h3>Cadastre seu imóvel</h3>
              <p>Informe localização, características e regras de operação para dar contexto às recomendações.</p>
            </article>
            <article>
              <span>02</span>
              <h3>A Urban AI mapeia os sinais</h3>
              <p>Eventos, sazonalidade, proximidade e janelas de antecedência entram na análise de cada data.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Você decide como aplicar</h3>
              <p>Revise o motivo, aceite, ajuste ou ignore. Se quiser automação, configure limites antes de ativar.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-split">
          <div>
            <p className="public-kicker">Decisão explicável</p>
            <blockquote className="public-quote">
              “Não basta sugerir um número. A recomendação precisa mostrar por que aquela data merece atenção.”
            </blockquote>
            <CheckList items={[
              "Evento e janela de antecedência visíveis",
              "Relação geográfica com o imóvel",
              "Preço atual e recomendado lado a lado",
              "Histórico para revisar decisões anteriores",
            ]} />
          </div>
          <ProductPreview compact />
        </div>
      </section>

      <section className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading
            eyebrow="Para diferentes operações"
            title={<>Do primeiro imóvel à <em>gestão em escala.</em></>}
            description="A mesma clareza de decisão, adaptada ao volume e ao nível de automação que sua operação precisa."
          />
          <div className="public-article-grid">
            <article className="public-content-card">
              <MapPinned aria-hidden size={22} />
              <h3 style={{ marginTop: 28 }}>Anfitriões profissionais</h3>
              <p>Priorize datas importantes, entenda os sinais locais e aplique recomendações diretamente pelo painel.</p>
            </article>
            <article className="public-content-card">
              <Building2 aria-hidden size={22} />
              <h3 style={{ marginTop: 28 }}>Gestoras de temporada</h3>
              <p>Organize imóveis por operação, defina limites e reduza o trabalho repetitivo de revisar calendários.</p>
            </article>
            <article className="public-content-card">
              <ShieldCheck aria-hidden size={22} />
              <h3 style={{ marginTop: 28 }}>Operações com governança</h3>
              <p>Mantenha decisão humana, consentimento de integração e rastreabilidade das alterações de preço.</p>
            </article>
            <article className="public-content-card">
              <Check aria-hidden size={22} />
              <h3 style={{ marginTop: 28 }}>Quem já usa planilha</h3>
              <p>Preserve metas e custos internos, enquanto a Urban AI monitora exceções e contexto externo.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-split">
          <div>
            <SectionHeading
              eyebrow="Preço sem comissão"
              title={<>Planos por imóvel, <em>sem percentual sobre receita.</em></>}
              description="Escolha o nível de operação que faz sentido agora e evolua quando precisar de mais imóveis ou automação."
            />
            <CheckList items={[
              "Plano Starter para 1 a 3 imóveis",
              "Plano Profissional para operações de 4 a 500 imóveis",
              "Condição sob medida para operações maiores",
            ]} />
            <div className="public-hero__actions">
              <PublicButton href="/precos">Comparar planos</PublicButton>
            </div>
          </div>
          <div className="public-price-card is-featured">
            <span className="public-price-card__tag">Mais escolhido</span>
            <h2>Profissional</h2>
            <p className="public-price-card__audience">Para quem opera múltiplos imóveis e quer integrar o fluxo de preços.</p>
            <p className="public-price-card__price"><strong>R$ 99</strong><span>/ imóvel / mês</span></p>
            <p className="public-price-card__billing">No ciclo mensal. Ciclos mais longos têm valor reduzido por imóvel.</p>
            <PublicButton href={PUBLIC_SIGNUP_URL}>Começar agora</PublicButton>
          </div>
        </div>
      </section>

      <section className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading eyebrow="Perguntas frequentes" title={<>O essencial antes de <em>começar.</em></>} />
          <div className="public-faq">
            {FAQ.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <FinalCommercialCta />
    </main>
  );
}
