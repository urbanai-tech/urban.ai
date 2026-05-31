import NextLink from "next/link";
import type { Metadata } from "next";
import {
  JsonLd,
  buildSeoMetadata,
  faqPageJsonLd,
} from "../../lib/seo";

/**
 * Landing institucional — manifesto editorial.
 *
 * Design system Urban AI aplicado:
 *  - Background var(--theme-public-bg) com grain overlay obrigatório (SVG fractalNoise)
 *  - Bebas Neue gigante (120-220px) nos headlines, line-height 0.88-0.92
 *  - Inter 300 no body
 *  - Accent único var(--theme-public-accent) (laranja), usado com parcimônia
 *  - Sem cards rounded, sem badges coloridos, sem gradientes saturados
 *  - Pull quotes com border-left laranja
 *  - Tom: declarações manifesto, não SaaS
 */
export const metadata: Metadata = buildSeoMetadata({
  title: "Urban AI - Precificação dinâmica para anfitriões",
  description:
    "A IA da Urban cruza agenda da cidade, eventos locais e demanda real para sugerir preços melhores para alugueis de curta temporada.",
  path: "/",
});

const LANDING_FAQ_SCHEMA = [
  {
    question: "A Urban AI precifica para todo o Brasil?",
    answer:
      "A cobertura inicial prioriza São Paulo capital e Grande SP. Outras capitais entram conforme o pipeline de eventos amadurecer.",
  },
  {
    question: "Preciso integrar com Stays para usar?",
    answer:
      "Não. No modo recomendação, você recebe sugestões e aplica manualmente. A integração Stays e para quem quer automação.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. Não há fidelidade; o cancelamento pode ser feito no painel, com acesso mantido até o fim do ciclo pago.",
  },
];

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.myurbanai.com";
const WAITLIST_URL = `${APP_URL.replace(/\/$/, "")}/create`;

export default function LandingPage() {
  return (
    <div
      className="urban-manifesto"
      style={{
        background: "var(--theme-public-bg)",
        color: "var(--theme-public-text)",
        minHeight: "100vh",
      }}
    >
      <JsonLd
        id="landing-jsonld"
        data={faqPageJsonLd(LANDING_FAQ_SCHEMA, "/")}
      />
      <Hero />
      <ManifestoCost />
      <FourSteps />
      <Differentiators />
      <Numbers />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ============================================================
   HERO — Manifesto declarativo
   ============================================================ */
function Hero() {
  return (
    <section
      className="urban-grain"
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "8vh 6vw",
        overflow: "hidden",
      }}
    >
      {/* Glow radial discreto atrás do título */}
      <div
        className="urban-glow"
        style={{
          width: "60vw",
          height: "60vw",
          left: "-10vw",
          top: "-10vw",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1400px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <p className="urban-eyebrow" style={{ marginBottom: 56 }}>
          Pré-lançamento aberto
        </p>

        <h1
          className="urban-display"
          style={{
            fontSize: "clamp(48px, 14vw, 140px)",
            lineHeight: 0.88,
            letterSpacing: 0,
            margin: 0,
            color: "var(--theme-public-text)",
            overflowWrap: "normal",
            textWrap: "balance",
          }}
        >
          CADA NOITE VAZIA<br />
          É R$ 600 QUE<br />
          <span style={{ color: "var(--theme-public-accent)" }}>NUNCA VOLTA.</span>
        </h1>

        <p
          style={{
            marginTop: 56,
            maxWidth: 640,
            fontSize: 22,
            fontWeight: 300,
            lineHeight: 1.7,
            color: "var(--theme-public-muted)",
          }}
        >
          A Urban AI cruza a agenda da cidade com sinais de demanda do bairro
          e entrega recomendações de preço para você decidir com mais clareza,
          sem depender de planilha.
        </p>

        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 64,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <a
            href={WAITLIST_URL}
            style={{
              padding: "18px 24px",
              background: "var(--theme-public-accent)",
              color: "var(--theme-public-text)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              textDecoration: "none",
              maxWidth: "100%",
              textAlign: "center",
              whiteSpace: "normal",
              transition: "transform 0.15s ease",
            }}
          >
            Garantir meu acesso  →
          </a>
          <NextLink
            href="/precos"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--theme-public-muted)",
              textDecoration: "none",
              borderBottom: "1px solid var(--theme-public-strong)",
              paddingBottom: 4,
            }}
          >
            Ver planos
          </NextLink>
        </div>

        <p
          style={{
            marginTop: 80,
            fontSize: 12,
            letterSpacing: "0.3em",
            color: "var(--theme-public-strong)",
            textTransform: "uppercase",
          }}
        >
          Cobrança por imóvel · Cancele quando quiser · Setup em minutos
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   MANIFESTO COST — pull quote sobre a dor
   ============================================================ */
function ManifestoCost() {
  return (
    <section
      className="urban-grain"
      style={{
        position: "relative",
        padding: "20vh 6vw",
        borderTop: "1px solid var(--theme-public-soft)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <p className="urban-eyebrow" style={{ marginBottom: 40 }}>
          O custo invisível
        </p>

        <h2
          className="urban-display"
          style={{
            fontSize: "clamp(44px, 9vw, 140px)",
            lineHeight: 0.92,
            letterSpacing: 0,
            margin: 0,
            maxWidth: 1100,
            textWrap: "balance",
          }}
        >
          O PREÇO ERRADO TEM<br />
          TRÊS SINTOMAS.<br />
          <span style={{ color: "var(--theme-public-muted)" }}>
            ALGUM É FAMILIAR?
          </span>
        </h2>

        <div
          style={{
            marginTop: 100,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 64,
          }}
        >
          <Symptom
            number="01"
            title="Lota cedo demais."
            desc="Os finais de semana de feriado esgotaram em janeiro? Você precificou antes dos eventos serem anunciados. Alguém pagaria 60% a mais."
          />
          <Symptom
            number="02"
            title="Preço estático em mercado dinâmico."
            desc="A média do bairro varia 3 a 4 vezes por mês conforme show, congresso, feriado. Você não consegue acompanhar manualmente — e nem deveria."
          />
          <Symptom
            number="03"
            title="Concorrência invisível."
            desc="Imóvel novo na sua rua, mais barato e melhor avaliado, ofusca o seu nas buscas. Você só descobre quando o calendário já está vazio."
          />
        </div>
      </div>
    </section>
  );
}

function Symptom({
  number,
  title,
  desc,
}: {
  number: string;
  title: string;
  desc: string;
}) {
  return (
    <div>
      <p
        className="urban-display"
        style={{
          fontSize: 64,
          lineHeight: 1,
          color: "var(--theme-public-accent)",
          margin: 0,
          marginBottom: 24,
        }}
      >
        {number}
      </p>
      <h3
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          fontWeight: 500,
          lineHeight: 1.3,
          margin: 0,
          marginBottom: 16,
          color: "var(--theme-public-text)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 16,
          fontWeight: 300,
          lineHeight: 1.7,
          color: "var(--theme-public-muted)",
          margin: 0,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

/* ============================================================
   FOUR STEPS — Como funciona, manifesto numerado gigante
   ============================================================ */
function FourSteps() {
  const steps = [
    {
      n: "01",
      title: "CONECTA.",
      desc: "Cadastro assistido para seus imóveis. Durante o beta, revisamos os dados principais antes de liberar recomendações.",
    },
    {
      n: "02",
      title: "MAPEIA.",
      desc: "Shows, congressos, feriados, jogos, festivais, formaturas. Calculamos travel time real (não distância em linha reta) pra entender quem é vizinho de fato do evento.",
    },
    {
      n: "03",
      title: "CRUZA.",
      desc: "Modelo proprietário aprende a cada análise: comparáveis na sua faixa, sazonalidade do bairro, quanto seu imóvel especificamente respondeu a aumentos passados.",
    },
    {
      n: "04",
      title: "APLICA.",
      desc: "Recomendação no painel: você decide. Ou modo automático via Stays: a IA aplica respeitando os tetos que você define. Você dorme tranquilo.",
    },
  ];

  return (
    <section
      style={{
        position: "relative",
        padding: "20vh 6vw",
        background: "var(--theme-public-bg)",
        borderTop: "1px solid var(--theme-public-soft)",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <p className="urban-eyebrow" style={{ marginBottom: 40 }}>
          Como funciona
        </p>

        <h2
          className="urban-display"
          style={{
            fontSize: "clamp(44px, 9vw, 140px)",
            lineHeight: 0.92,
            letterSpacing: 0,
            margin: 0,
            marginBottom: 120,
            maxWidth: 1100,
            textWrap: "balance",
          }}
        >
          A IA OLHA PRA<br />
          CIDADE INTEIRA<br />
          POR VOCÊ.
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {steps.map((s, i) => (
            <Step key={s.n} {...s} last={i === steps.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  desc,
  last,
}: {
  n: string;
  title: string;
  desc: string;
  last: boolean;
}) {
  return (
    <div
      className="urban-step-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 200px) 1fr",
        gap: "8vw",
        alignItems: "start",
        padding: "60px 0",
        borderBottom: last ? "none" : "1px solid var(--theme-public-soft)",
      }}
    >
      <div
        className="urban-display"
        style={{
          fontSize: "clamp(56px, 9vw, 140px)",
          lineHeight: 0.85,
          color: "var(--theme-public-accent)",
          margin: 0,
        }}
      >
        {n}
      </div>
      <div>
        <h3
          className="urban-display"
          style={{
            fontSize: "clamp(40px, 5vw, 72px)",
            lineHeight: 1,
            margin: 0,
            marginBottom: 24,
            letterSpacing: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 20,
            fontWeight: 300,
            lineHeight: 1.7,
            color: "var(--theme-public-muted)",
            margin: 0,
            maxWidth: 720,
          }}
        >
          {desc}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   DIFFERENTIATORS — declarações manifesto, não cards
   ============================================================ */
function Differentiators() {
  const items = [
    {
      label: "Dataset proprietário",
      headline: "NÃO RASPAMOS. CONSTRUÍMOS.",
      body: "A cada análise gerada, alimentamos nosso próprio histórico de preços, ocupação e eventos. Em meses, isso vira um motor que ninguém consegue reproduzir copiando produto.",
    },
    {
      label: "Modelo escala com você",
      headline: "REGRAS HOJE. NEURAL DEPOIS.",
      body: "Começamos com regras inteligentes. Evoluímos pra XGBoost quando temos dados. Depois pra modelo neural híbrido. Você só vê o preço melhorando — sem migração de plataforma.",
    },
    {
      label: "Stays Preferred+",
      headline: "INTEGRAÇÃO NATIVA. NÃO SCRAPING.",
      body: "Somos parceiros do canal Preferred+ da Stays. Pushar preço pro Airbnb é nativo, não scraping nem hack. Mesma confiabilidade da própria Stays.",
    },
    {
      label: "Foco no Brasil",
      headline: "BRASIL TEM PARTICULARIDADES.",
      body: "Eventos brasileiros (Sympla, Eventbrite, prefeituras), feriados regionais, peculiaridades de Carnaval, Réveillon, festivais e religiosos. Concorrentes globais ignoram tudo isso.",
    },
  ];

  return (
    <section
      style={{
        position: "relative",
        padding: "20vh 6vw",
        background: "var(--theme-public-bg)",
        borderTop: "1px solid var(--theme-public-soft)",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <p className="urban-eyebrow" style={{ marginBottom: 40 }}>
          Por que somos diferentes
        </p>

        <h2
          className="urban-display"
          style={{
            fontSize: "clamp(44px, 9vw, 140px)",
            lineHeight: 0.92,
            letterSpacing: 0,
            margin: 0,
            marginBottom: 100,
            maxWidth: 1100,
            textWrap: "balance",
          }}
        >
          NÃO É MAIS UMA<br />
          EXTENSÃO DO AIRBNB.
        </h2>

        <div
          className="urban-differentiators-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 0,
          }}
        >
          {items.map((d, i) => (
            <div
              key={d.label}
              className="urban-differentiator"
              style={{
                padding: "48px 32px",
                borderTop:
                  i < 2 ? "1px solid var(--theme-public-soft)" : "none",
                borderLeft:
                  i % 2 === 1
                    ? "1px solid var(--theme-public-soft)"
                    : "none",
              }}
            >
              <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
                {d.label}
              </p>
              <h3
                className="urban-display"
                style={{
                  fontSize: "clamp(32px, 3.5vw, 48px)",
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                  margin: 0,
                  marginBottom: 24,
                  color: "var(--theme-public-text)",
                }}
              >
                {d.headline}
              </h3>
              <p
                style={{
                  fontSize: 17,
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: "var(--theme-public-muted)",
                  margin: 0,
                }}
              >
                {d.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   NUMBERS — 3 grandes statements numéricos (tipografia gigante)
   ============================================================ */
function Numbers() {
  return (
    <section
      className="urban-grain"
      style={{
        position: "relative",
        padding: "20vh 6vw",
        background: "var(--theme-public-bg)",
        borderTop: "1px solid var(--theme-public-soft)",
        overflow: "hidden",
      }}
    >
      <div
        className="urban-glow"
        style={{
          width: "70vw",
          height: "70vw",
          right: "-20vw",
          top: "10vh",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <div
          className="urban-pull"
          style={{
            maxWidth: 900,
            marginBottom: 80,
          }}
        >
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.45,
              color: "var(--theme-public-text)",
              margin: 0,
              letterSpacing: "-0.005em",
            }}
          >
            &ldquo;Comemorar que seus finais de semana esgotaram cedo
            não é um troféu. Significa que você fixou os preços antes
            do mercado mostrar a cara dele.&rdquo;
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 80,
            marginTop: 100,
          }}
        >
          <BigNumber
            value="20–40%"
            label="da receita perdida silenciosamente por subprecificação"
          />
          <BigNumber
            value="5K+"
            label="eventos mapeados em SP atualmente, atualizados todo dia"
          />
          <BigNumber
            value="3min"
            label="de setup até a primeira recomendação"
          />
        </div>
      </div>
    </section>
  );
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p
        className="urban-display"
        style={{
          fontSize: "clamp(48px, 8vw, 130px)",
          lineHeight: 1,
          color: "var(--theme-public-text)",
          margin: 0,
          letterSpacing: 0,
        }}
      >
        {value}
      </p>
      <p
        style={{
          marginTop: 24,
          fontSize: 16,
          fontWeight: 300,
          lineHeight: 1.55,
          color: "var(--theme-public-muted)",
          maxWidth: 320,
        }}
      >
        {label}
      </p>
    </div>
  );
}

/* ============================================================
   PRICING TEASER — minimal, tipografia gigante
   ============================================================ */
function PricingTeaser() {
  return (
    <section
      style={{
        position: "relative",
        padding: "20vh 6vw",
        background: "var(--theme-public-bg)",
        borderTop: "1px solid var(--theme-public-soft)",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <p className="urban-eyebrow" style={{ marginBottom: 40 }}>
          Cobrança por imóvel
        </p>

        <h2
          className="urban-display"
          style={{
            fontSize: "clamp(44px, 9vw, 140px)",
            lineHeight: 0.92,
            letterSpacing: 0,
            margin: 0,
            marginBottom: 100,
            maxWidth: 1100,
            textWrap: "balance",
          }}
        >
          VOCÊ SÓ PAGA<br />
          PELO QUE USA.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 0,
            border: "1px solid var(--theme-public-soft)",
          }}
        >
          <PriceColumn
            name="Starter"
            price="R$ 97"
            suffix="/imóvel/mês no anual"
            tagline="1 a 3 imóveis"
            features={[
              "Análises ilimitadas",
              "Recomendações por evento",
              "Painel completo",
              "E-mail de oportunidade",
            ]}
          />
          <PriceColumn
            name="Profissional"
            price="R$ 67"
            suffix="/imóvel/mês no anual"
            tagline="4 a 500 imóveis self-service"
            highlight
            features={[
              "Tudo do Starter",
              "Integração Stays (auto)",
              "API/webhooks",
              "Suporte prioritário",
            ]}
          />
          <PriceColumn
            name="Escala"
            price="Sob consulta"
            suffix=""
            tagline="501+ imóveis ou rede"
            features={[
              "Onboarding dedicado",
              "SLA personalizado",
              "Relatórios executivos",
              "Multi-conta",
            ]}
          />
        </div>

        <div style={{ marginTop: 56, textAlign: "center" }}>
          <NextLink
            href="/precos"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--theme-public-accent)",
              textDecoration: "none",
              borderBottom: "1px solid var(--theme-public-accent)",
              paddingBottom: 4,
            }}
          >
            Ver tabela completa com 4 ciclos →
          </NextLink>
        </div>
      </div>
    </section>
  );
}

function PriceColumn({
  name,
  price,
  suffix,
  tagline,
  features,
  highlight,
}: {
  name: string;
  price: string;
  suffix: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "48px 36px",
        position: "relative",
        background: highlight ? "rgba(232,80,10,0.04)" : "transparent",
        borderRight: "1px solid var(--theme-public-soft)",
      }}
    >
      {highlight && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 6,
            height: "100%",
            background: "var(--theme-public-accent)",
          }}
        />
      )}
      <p className="urban-eyebrow" style={{ marginBottom: 16 }}>
        {name}
      </p>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          color: "var(--theme-public-muted)",
          margin: 0,
          marginBottom: 32,
        }}
      >
        {tagline}
      </p>
      <p
        className="urban-display"
        style={{
          fontSize: "clamp(56px, 5vw, 84px)",
          lineHeight: 1,
          letterSpacing: "-0.015em",
          margin: 0,
          color: "var(--theme-public-text)",
        }}
      >
        {price}
      </p>
      {suffix && (
        <p
          style={{
            fontSize: 13,
            color: "var(--theme-public-muted)",
            marginTop: 8,
            marginBottom: 40,
          }}
        >
          {suffix}
        </p>
      )}
      {!suffix && <div style={{ height: 40 }} />}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontFamily: "Inter, sans-serif" }}>
        {features.map((f) => (
          <li
            key={f}
            style={{
              fontSize: 15,
              fontWeight: 300,
              color: "var(--theme-public-muted)",
              padding: "12px 0",
              borderBottom: "1px solid var(--theme-public-soft)",
            }}
          >
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   FAQ — minimal accordion (details/summary nativo)
   ============================================================ */
function Faq() {
  const items = [
    {
      q: "Vocês precificam pra todo o Brasil?",
      a: "Hoje cobrimos São Paulo capital e Grande SP com profundidade total. Outras capitais entram conforme o pipeline de eventos amadurecer (RJ, BH, Curitiba, Porto Alegre são os próximos). Se seu imóvel está fora dessa lista, entre na lista de espera — avisamos quando abrir.",
    },
    {
      q: "Preciso integrar com Stays para usar?",
      a: "Não. No modo Recomendação você recebe sugestões e aplica manualmente no Airbnb. A Stays é só pra quem quer modo Automático — onde a Urban aplica o preço sem você abrir nada.",
    },
    {
      q: "Como vocês garantem que o preço não fica errado?",
      a: "No modo Automático você define tetos de variação (ex.: nunca subir mais que 25% num único dia). Toda mudança é logada — você vê histórico completo de cada decisão da IA. Se algo parecer estranho, basta pausar com um clique.",
    },
    {
      q: "Os meus dados ficam seguros?",
      a: "Sim. Não vendemos dados, nunca. Senhas em bcrypt, tráfego TLS 1.3, banco criptografado em repouso, backup off-site diário. LGPD com DPO designado e processo de exclusão de conta documentado.",
    },
    {
      q: "Posso cancelar quando quiser?",
      a: "Sim. Sem fidelidade, sem ligação. Cancela direto no painel. Acesso até o fim do ciclo já pago, depois vira read-only (não perde histórico).",
    },
    {
      q: "O que vocês NÃO fazem?",
      a: "Não somos OTA, corretora nem hospedagem — não vendemos diárias nem captamos hóspedes. Só ajudamos a precificar melhor os anúncios que você já tem. Promessa simples, escopo focado.",
    },
  ];

  return (
    <section
      style={{
        position: "relative",
        padding: "20vh 6vw",
        background: "var(--theme-public-bg)",
        borderTop: "1px solid var(--theme-public-soft)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p className="urban-eyebrow" style={{ marginBottom: 40 }}>
          Dúvidas comuns
        </p>

        <h2
          className="urban-display"
          style={{
          fontSize: "clamp(44px, 8vw, 120px)",
          lineHeight: 0.92,
          letterSpacing: 0,
          margin: 0,
          marginBottom: 80,
          textWrap: "balance",
          }}
        >
          PERGUNTAS<br />
          DIRETAS.
        </h2>

        <div>
          {items.map((it, i) => (
            <details
              key={i}
              style={{
                borderTop: "1px solid var(--theme-public-soft)",
                borderBottom:
                  i === items.length - 1
                    ? "1px solid var(--theme-public-soft)"
                    : "none",
                padding: "32px 0",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 22,
                  fontWeight: 400,
                  color: "var(--theme-public-text)",
                  letterSpacing: "-0.005em",
                }}
              >
                <span style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
                  {it.q}
                </span>
                <span
                  style={{
                    fontSize: 24,
                    color: "var(--theme-public-accent)",
                    marginLeft: 32,
                    flexShrink: 0,
                  }}
                >
                  +
                </span>
              </summary>
              <p
                style={{
                  marginTop: 24,
                  fontSize: 17,
                  fontWeight: 300,
                  lineHeight: 1.75,
                  color: "var(--theme-public-muted)",
                  maxWidth: 800,
                }}
              >
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FINAL CTA — manifesto closing
   ============================================================ */
function FinalCta() {
  return (
    <section
      className="urban-grain"
      style={{
        position: "relative",
        padding: "30vh 6vw",
        background: "var(--theme-public-bg)",
        borderTop: "1px solid var(--theme-public-soft)",
        overflow: "hidden",
      }}
    >
      <div
        className="urban-glow"
        style={{
          width: "80vw",
          height: "80vw",
          left: "10vw",
          top: "-30vw",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1400,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <p className="urban-eyebrow" style={{ marginBottom: 56 }}>
          Pré-lançamento aberto
        </p>

        <h2
          className="urban-display"
          style={{
            fontSize: "clamp(46px, 12vw, 140px)",
            lineHeight: 0.88,
            letterSpacing: 0,
            margin: 0,
            textWrap: "balance",
          }}
        >
          GARANTE SEU LUGAR<br />
          ANTES DA<br />
          <span style={{ color: "var(--theme-public-accent)" }}>ABERTURA GERAL.</span>
        </h2>

        <p
          style={{
            marginTop: 56,
            fontSize: 20,
            fontWeight: 300,
            lineHeight: 1.7,
            color: "var(--theme-public-muted)",
            maxWidth: 720,
            margin: "56px auto 0",
          }}
        >
          Estamos abrindo acesso por convite, na ordem da lista. Quem entra
          agora também ganha posições subindo a cada indicação.
        </p>

        <div style={{ marginTop: 80 }}>
          <a
            href={WAITLIST_URL}
            style={{
              padding: "20px 24px",
              background: "var(--theme-public-accent)",
              color: "var(--theme-public-text)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: 18,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              textDecoration: "none",
              display: "inline-block",
              maxWidth: "100%",
              textAlign: "center",
              whiteSpace: "normal",
            }}
          >
            Entrar na lista  →
          </a>
        </div>

        <p
          style={{
            marginTop: 56,
            fontSize: 12,
            letterSpacing: "0.3em",
            color: "var(--theme-public-strong)",
            textTransform: "uppercase",
          }}
        >
          Sem compromisso · 100% gratuito · Você só vê preço no convite
        </p>
      </div>
    </section>
  );
}
