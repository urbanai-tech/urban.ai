import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { JsonLd, buildSeoMetadata, faqPageJsonLd } from "../../lib/seo";

const WaitlistForm = dynamic(() => import("../../componentes/WaitlistForm").then(mod => mod.WaitlistForm), {
  loading: () => <div style={{ height: "100px", width: "100%", opacity: 0.5, background: "var(--theme-public-surface)" }} />
});

export const metadata: Metadata = buildSeoMetadata({
  title: "Pré-lançamento Urban AI",
  description:
    "Entre na lista de acesso antecipado da Urban AI para receber recomendações de preço baseadas em eventos, bairro e demanda local.",
  path: "/lancamento",
});

const LAUNCH_FAQ_SCHEMA = [
  {
    question: "A Urban AI muda meu preço automaticamente?",
    answer:
      "No pré-lançamento, o fluxo principal é recomendação. A automação via Stays fica em beta privado, com consentimento e limites.",
  },
  {
    question: "De onde vem a recomendação?",
    answer:
      "A recomendação combina eventos futuros, distância do imóvel, janela de antecedência, dados do anúncio e histórico da plataforma.",
  },
  {
    question: "Qual região está mais pronta?",
    answer:
      "A operação prioriza São Paulo e Grande SP, onde o calendário de eventos e a cobertura inicial fazem mais sentido para o beta assistido.",
  },
];

/**
 * /lancamento — pré-lançamento Urban AI · waitlist.
 *
 * Estilo manifesto editorial: dark, Bebas Neue gigante, accent var(--theme-public-accent).
 * Vide globals.css → .urban-manifesto / .urban-grain / .urban-glow / .urban-pull.
 *
 * Não é uma "página de produto" — é uma declaração. Energia de manifesto,
 * não de SaaS landing.
 */
export default function LancamentoPage() {
  return (
    <main
      className="urban-manifesto"
      style={{ background: "var(--theme-public-bg)", color: "var(--theme-public-text)", minHeight: "100vh" }}
    >
      <JsonLd id="launch-jsonld" data={faqPageJsonLd(LAUNCH_FAQ_SCHEMA, "/lancamento")} />
      {/* ============== HERO ============== */}
      <section
        className="urban-grain"
        style={{ position: "relative", padding: "140px 24px 100px", overflow: "hidden" }}
      >
        <div
          className="urban-glow"
          style={{ width: 800, height: 800, top: -200, left: "50%", transform: "translateX(-50%)" }}
        />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            PRÉ-LANÇAMENTO · ACESSO POR CONVITE
          </p>
          <h1
            className="urban-display"
            style={{
              fontSize: "clamp(48px, 14vw, 140px)",
              lineHeight: 0.88,
              letterSpacing: 0,
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
              textWrap: "balance",
            }}
          >
            ESGOTAR RÁPIDO
            <br />
            NÃO É TROFÉU.
            <br />
            <span style={{ color: "var(--theme-public-accent)" }}>É PREÇO ERRADO.</span>
          </h1>
          <p
            style={{
              fontSize: 22,
              fontWeight: 300,
              lineHeight: 1.7,
              color: "var(--theme-public-muted)",
              maxWidth: 720,
              marginTop: 56,
            }}
          >
            Quando finais de semana e feriados esgotam em horas, na maioria das
            vezes significa que você fixou o preço cedo demais. A Urban AI
            ajuda você a revisar a tarifa antes da demanda aparecer no calendário.
          </p>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--theme-public-soft)" }} />

      {/* ============== PULL QUOTE ============== */}
      <section style={{ padding: "120px 24px", position: "relative" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div className="urban-pull">
            <p
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 500,
                lineHeight: 1.35,
                letterSpacing: "-0.5px",
                color: "var(--theme-public-text)",
                margin: 0,
              }}
            >
              Dias de alta demanda escapam quando o preço foi fixado
              <span style={{ color: "var(--theme-public-accent)" }}> antes </span>
              da cidade se mover.
            </p>
            <p
              style={{
                marginTop: 24,
                fontSize: 13,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "var(--theme-public-muted)",
                fontWeight: 600,
              }}
            >
              — A CONTA QUE NINGUÉM FAZ
            </p>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--theme-public-soft)" }} />

      {/* ============== O QUE FAZEMOS ============== */}
      <section style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            O QUE FAZEMOS
          </p>
          <h2
            className="urban-display"
            style={{
              fontSize: "clamp(46px, 11vw, 140px)",
              lineHeight: 0.88,
              letterSpacing: 0,
              fontWeight: 400,
              margin: "0 0 96px",
              textTransform: "uppercase",
              textWrap: "balance",
            }}
          >
            ANTECIPAMOS
            <br />
            <span style={{ color: "var(--theme-public-accent)" }}>O MERCADO.</span>
            <br />
            VOCÊ CAPTURA.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              borderTop: "1px solid var(--theme-public-soft)",
            }}
          >
            <Step
              num="01"
              title="VARREDURA"
              body="Eventos, shows, feriados, congressos. A IA detecta quando o bairro aquece silenciosamente — antes do mercado se mover."
            />
            <Step
              num="02"
              title="CALIBRAGEM"
              body="A recomendação cruza evento, distância, janela e perfil do imóvel para sugerir um ajuste defensável antes do pico de procura."
              borderLeft
            />
            <Step
              num="03"
              title="BLINDAGEM"
              body="Você decide se aplica manualmente ou se testa automação em beta privado. Tetos e limites ficam definidos por você."
              borderLeft
            />
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--theme-public-soft)" }} />

      {/* ============== FAQ ============== */}
      <section style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            COMO FUNCIONA
          </p>
          <h2
            className="urban-display"
            style={{
            fontSize: "clamp(44px, 10vw, 140px)",
              lineHeight: 0.9,
              fontWeight: 400,
              margin: "0 0 80px",
              textTransform: "uppercase",
            }}
          >
            PERGUNTAS
            <br />
            <span style={{ color: "var(--theme-public-accent)" }}>DIRETAS.</span>
          </h2>
          <div>
            <LaunchFaq
              q="A Urban AI muda meu preço automaticamente?"
              a="No pré-lançamento, o fluxo principal é recomendação: você recebe a sugestão, entende o motivo e decide se aplica. Automação via Stays fica em beta privado, com consentimento, limites e rollback."
            />
            <LaunchFaq
              q="De onde vem a recomendação?"
              a="A recomendação combina eventos futuros, distância do imóvel, janela de antecedência, dados do anúncio e histórico capturado pela plataforma. O objetivo é sinalizar dias em que a demanda pode mudar antes do calendário mostrar."
            />
            <LaunchFaq
              q="Vocês prometem aumento fixo de receita?"
              a="Não. Antes de cases auditados, tratamos a Urban AI como uma ferramenta de decisão e aprendizado. O beta fechado serve justamente para medir cobertura, preço aplicado e resultado real com anfitriões."
            />
            <LaunchFaq
              q="E se a sugestão parecer agressiva?"
              a="Você pode ignorar, aplicar outro valor ou registrar o preço realmente usado. Esse retorno melhora o dataset e ajuda a calibrar próximas recomendações."
            />
            <LaunchFaq
              q="Qual região está mais pronta?"
              a="A operação está priorizando São Paulo e Grande SP, onde o calendário de eventos e a cobertura inicial fazem mais sentido para o beta assistido."
            />
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--theme-public-soft)" }} />

      {/* ============== WAITLIST ============== */}
      <section
        id="waitlist"
        className="urban-grain"
        style={{ position: "relative", padding: "140px 24px", overflow: "hidden" }}
      >
        <div
          className="urban-glow"
          style={{ width: 700, height: 700, bottom: -200, left: -200 }}
        />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 980, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            ENTRAR ANTES — VAGAS LIMITADAS
          </p>
          <h2
            className="urban-display"
            style={{
              fontSize: "clamp(46px, 12vw, 140px)",
              lineHeight: 0.88,
              letterSpacing: 0,
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
              textWrap: "balance",
            }}
          >
            LISTA DE
            <br />
            <span style={{ color: "var(--theme-public-accent)" }}>ACESSO ANTECIPADO.</span>
          </h2>
          <p
            style={{
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "var(--theme-public-muted)",
              maxWidth: 640,
              marginTop: 48,
              marginBottom: 56,
            }}
          >
            Estamos abrindo vagas em lotes pequenos para anfitriões profissionais
            em São Paulo. Deixe seu e-mail abaixo. Você é avisado antes da abertura
            geral.
          </p>

          <div style={{ maxWidth: 640 }}>
            <WaitlistForm
              buttonLabel="Quero acesso antecipado →"
              source="lancamento"
            />
          </div>

          <p
            style={{
              marginTop: 56,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--theme-public-muted)",
              fontWeight: 500,
            }}
          >
            Sem spam · sem cartão · cancela quando quiser
          </p>
        </div>
      </section>
    </main>
  );
}

function LaunchFaq({ q, a }: { q: string; a: string }) {
  return (
    <details
      style={{
        borderTop: "1px solid var(--theme-public-soft)",
        padding: "28px 0",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--theme-public-text)",
          overflowWrap: "anywhere",
        }}
      >
        {q}
      </summary>
      <p
        style={{
          marginTop: 20,
          maxWidth: 760,
          fontSize: 17,
          fontWeight: 300,
          lineHeight: 1.75,
          color: "var(--theme-public-muted)",
        }}
      >
        {a}
      </p>
    </details>
  );
}

function Step({
  num,
  title,
  body,
  borderLeft = false,
}: {
  num: string;
  title: string;
  body: string;
  borderLeft?: boolean;
}) {
  return (
    <div
      style={{
        padding: "56px 32px",
        borderLeft: borderLeft ? "1px solid var(--theme-public-soft)" : "none",
      }}
    >
      <p
        className="urban-display"
        style={{
          fontSize: 64,
          lineHeight: 1,
          fontWeight: 400,
          color: "var(--theme-public-accent)",
          margin: 0,
        }}
      >
        {num}
      </p>
      <h3
        className="urban-display"
        style={{
          fontSize: 32,
          letterSpacing: 0,
          fontWeight: 400,
          textTransform: "uppercase",
          margin: "32px 0 20px",
          color: "var(--theme-public-text)",
        }}
      >
        {title}
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
        {body}
      </p>
    </div>
  );
}
