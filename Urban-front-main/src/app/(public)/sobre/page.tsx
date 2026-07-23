import type { Metadata } from "next";
import { Building2, Eye, MapPinned, ShieldCheck, type LucideIcon } from "lucide-react";
import { JsonLd, aboutPageJsonLd, buildSeoMetadata } from "../../lib/seo";
import { FinalCommercialCta, SectionHeading } from "../../componentes/PublicMarketing";

export const metadata: Metadata = buildSeoMetadata({
  title: "Sobre a Urban AI",
  description: "Conheça a visão, o produto e os princípios da Urban AI para decisões de preço em aluguel por temporada.",
  path: "/sobre",
});

export default function SobrePage() {
  return (
    <main className="urban-manifesto urban-public-page">
      <JsonLd id="about-jsonld" data={aboutPageJsonLd("/sobre")} />
      <section className="public-page-hero">
        <div className="public-container public-page-hero__grid">
          <div>
            <p className="public-kicker">Sobre a Urban AI</p>
            <h1>A cidade muda. A estratégia de preço precisa <em>acompanhar.</em></h1>
            <p className="public-page-hero__lead">A Urban AI transforma sinais urbanos dispersos em recomendações de preço compreensíveis para quem administra aluguel por temporada como negócio.</p>
          </div>
          <aside className="public-page-hero__aside"><p><strong style={{ color: "var(--theme-public-text)" }}>Feita em São Paulo.</strong><br />Uma plataforma brasileira, criada a partir da complexidade real das cidades e das operações de temporada.</p></aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-split">
          <SectionHeading
            eyebrow="Por que existimos"
            title={<>Tirar a decisão de preço do <em>piloto automático.</em></>}
            description="Planilhas e regras fixas continuam úteis para custos e metas, mas não acompanham sozinhas eventos, mudanças de bairro e janelas de demanda. A Urban AI existe para organizar esse contexto e colocá-lo na rotina de decisão."
          />
          <blockquote className="public-quote">Tecnologia de preço só cria confiança quando explica o sinal, respeita os limites e deixa a decisão rastreável.</blockquote>
        </div>
      </section>

      <section className="public-section public-section--soft">
        <div className="public-container">
          <SectionHeading eyebrow="Princípios" title={<>O que guia o <em>produto.</em></>} />
          <div className="public-article-grid">
            <Principle icon={Eye} title="Clareza antes de automação" body="Cada recomendação deve ser compreendida antes de ser aplicada em escala." />
            <Principle icon={ShieldCheck} title="Controle continua com o usuário" body="Limites, consentimento e pausas fazem parte da experiência, não de uma configuração escondida." />
            <Principle icon={MapPinned} title="Contexto local importa" body="A mesma data não tem o mesmo efeito em todos os bairros, imóveis e perfis de hóspede." />
            <Principle icon={Building2} title="Produto para operação real" body="A plataforma precisa funcionar para um imóvel e continuar coerente quando a gestão cresce." />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <SectionHeading
            eyebrow="Como construímos"
            title={<>Produto, dados e operação no <em>mesmo sistema.</em></>}
            description="A Urban AI combina uma camada de leitura urbana, um motor de recomendação e uma experiência operacional para revisar, aplicar e acompanhar decisões."
          />
          <div className="public-process">
            <article><span>01</span><h3>Observamos a cidade</h3><p>Eventos, calendário e sinais geográficos entram como contexto para datas relevantes.</p></article>
            <article><span>02</span><h3>Explicamos a recomendação</h3><p>Preço e motivo aparecem juntos para permitir julgamento comercial.</p></article>
            <article><span>03</span><h3>Aprendemos com a operação</h3><p>Histórico, aplicação e limites ajudam a manter decisões consistentes ao longo do tempo.</p></article>
          </div>
        </div>
      </section>

      <FinalCommercialCta eyebrow="Conheça na prática" title={<>Veja como a Urban AI organiza a próxima decisão do seu <em style={{ color: "var(--theme-public-accent)" }}>calendário.</em></>} />
    </main>
  );
}

function Principle({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return <article className="public-content-card"><Icon aria-hidden size={22} /><h3 style={{ marginTop: 28 }}>{title}</h3><p>{body}</p></article>;
}
