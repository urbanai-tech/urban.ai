import dynamic from "next/dynamic";

const WaitlistForm = dynamic(() => import("../../componentes/WaitlistForm").then(mod => mod.WaitlistForm), {
  loading: () => <div style={{ height: "100px", width: "100%", opacity: 0.5, background: "rgba(255,255,255,0.05)" }} />
});

/**
 * /lancamento — pré-lançamento Urban AI · waitlist.
 *
 * Estilo manifesto editorial: dark, Bebas Neue gigante, accent #E8500A.
 * Vide globals.css → .urban-manifesto / .urban-grain / .urban-glow / .urban-pull.
 *
 * Não é uma "página de produto" — é uma declaração. Energia de manifesto,
 * não de SaaS landing.
 */
export default function LancamentoPage() {
  return (
    <main
      className="urban-manifesto"
      style={{ background: "#080A0F", color: "#FFFFFF", minHeight: "100vh" }}
    >
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
              fontSize: "clamp(72px, 14vw, 220px)",
              lineHeight: 0.88,
              letterSpacing: "-2px",
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            ESGOTAR RÁPIDO
            <br />
            NÃO É TROFÉU.
            <br />
            <span style={{ color: "#E8500A" }}>É PREÇO ERRADO.</span>
          </h1>
          <p
            style={{
              fontSize: 22,
              fontWeight: 300,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 720,
              marginTop: 56,
            }}
          >
            Quando finais de semana e feriados esgotam em horas, na maioria das
            vezes significa que você fixou o preço cedo demais. A Urban AI
            protege a sua margem enquanto você dorme.
          </p>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

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
                color: "#FFFFFF",
                margin: 0,
              }}
            >
              30% da receita anual fica na mesa porque o preço foi fixado
              <span style={{ color: "#E8500A" }}> antes </span>
              do mercado se mover.
            </p>
            <p
              style={{
                marginTop: 24,
                fontSize: 13,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)",
                fontWeight: 600,
              }}
            >
              — A CONTA QUE NINGUÉM FAZ
            </p>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== O QUE FAZEMOS ============== */}
      <section style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            O QUE FAZEMOS
          </p>
          <h2
            className="urban-display"
            style={{
              fontSize: "clamp(64px, 11vw, 180px)",
              lineHeight: 0.88,
              letterSpacing: "-1.5px",
              fontWeight: 400,
              margin: "0 0 96px",
              textTransform: "uppercase",
            }}
          >
            ANTECIPAMOS
            <br />
            <span style={{ color: "#E8500A" }}>O MERCADO.</span>
            <br />
            VOCÊ CAPTURA.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              borderTop: "1px solid rgba(255,255,255,0.08)",
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
              body="A tarifa reage cirurgicamente quando demanda oculta começa a esmagar oferta. Reajustes impossíveis para a mente humana."
              borderLeft
            />
            <Step
              num="03"
              title="BLINDAGEM"
              body="Sem planilha. Sem checagem manual. Limites e tetos definidos por você. Rentabilidade diária protegida no automático."
              borderLeft
            />
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

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
              fontSize: "clamp(64px, 12vw, 200px)",
              lineHeight: 0.88,
              letterSpacing: "-2px",
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            LISTA DE
            <br />
            <span style={{ color: "#E8500A" }}>ACESSO ANTECIPADO.</span>
          </h2>
          <p
            style={{
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.65)",
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
              color: "rgba(255,255,255,0.45)",
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
        borderLeft: borderLeft ? "1px solid rgba(255,255,255,0.08)" : "none",
      }}
    >
      <p
        className="urban-display"
        style={{
          fontSize: 64,
          lineHeight: 1,
          fontWeight: 400,
          color: "#E8500A",
          margin: 0,
        }}
      >
        {num}
      </p>
      <h3
        className="urban-display"
        style={{
          fontSize: 32,
          letterSpacing: "-0.5px",
          fontWeight: 400,
          textTransform: "uppercase",
          margin: "32px 0 20px",
          color: "#FFFFFF",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 17,
          fontWeight: 300,
          lineHeight: 1.7,
          color: "rgba(255,255,255,0.65)",
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}
