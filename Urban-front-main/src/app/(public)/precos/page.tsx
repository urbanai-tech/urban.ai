import NextLink from "next/link";
import { Metadata } from "next";

/**
 * /precos — pricing pública (visão resumida).
 *
 * Estilo manifesto editorial Urban AI: Bebas Neue gigante, Inter body,
 * fundo #080A0F, accent #E8500A (única cor), zero rounded cards coloridos.
 * Vide globals.css → .urban-manifesto, .urban-grain, .urban-pull, .urban-eyebrow
 *
 * Checkout vive em app.myurbanai.com/plans — aqui é vitrine pública.
 */
export const metadata: Metadata = {
  title: "Preços · Urban AI",
  description:
    "Cobrança por imóvel, 4 ciclos com desconto progressivo. Sem fidelidade, cancele quando quiser.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.myurbanai.com";
const SIGNUP_URL = `${APP_URL.replace(/\/$/, "")}/create`;
const WAITLIST_URL = "/lancamento";

const STARTER_TIERS = [
  { cycle: "Mensal", price: "149", note: null },
  { cycle: "Trimestral", price: "129", note: "−13%" },
  { cycle: "Semestral", price: "109", note: "−27%" },
  { cycle: "Anual", price: "97", note: "−35%" },
];

const PROFISSIONAL_TIERS = [
  { cycle: "Mensal", price: "99", note: null },
  { cycle: "Trimestral", price: "85", note: "−14%" },
  { cycle: "Semestral", price: "72", note: "−27%" },
  { cycle: "Anual", price: "67", note: "−32%" },
];

export default function PrecosPage() {
  return (
    <div
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
          style={{ width: 700, height: 700, top: -200, left: "50%", transform: "translateX(-50%)" }}
        />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            PRICING — TRANSPARENTE
          </p>
          <h1
            className="urban-display"
            style={{
              fontSize: "clamp(72px, 13vw, 200px)",
              lineHeight: 0.88,
              letterSpacing: "-2px",
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            VOCÊ PAGA
            <br />
            POR IMÓVEL.
            <br />
            <span style={{ color: "#E8500A" }}>NADA MAIS.</span>
          </h1>
          <p
            style={{
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 680,
              marginTop: 48,
            }}
          >
            Sem comissão sobre receita. Sem taxa de implantação. Sem fidelidade.
            Quanto mais longo o ciclo, menor o preço por unidade.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== STARTER ============== */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <PlanBlock
            eyebrow="01 — STARTER"
            tagline="1 a 3 imóveis"
            description="Comece a usar o motor de eventos sem complicação. Recomendações chegam por e-mail e painel. Você aplica manualmente no Airbnb."
            tiers={STARTER_TIERS}
            features={[
              "Análises ilimitadas em imóveis cadastrados",
              "Recomendações por evento próximo",
              "Painel de imóvel + cálculo de uplift",
              "E-mail de oportunidade quando demanda muda",
              "Histórico completo de recomendações",
              "Suporte por e-mail",
            ]}
          />
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== PROFISSIONAL — destaque ============== */}
      <section style={{ padding: "100px 24px", position: "relative" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
          {/* Vertical accent bar */}
          <div
            style={{
              position: "absolute",
              left: -2,
              top: 0,
              width: 2,
              height: 80,
              background: "#E8500A",
            }}
          />
          <PlanBlock
            eyebrow="02 — PROFISSIONAL"
            tagline="4 a 19 imóveis · mais escolhido"
            description="Desbloqueia o modo Automático via Stays — a Urban AI aplica o preço sem você abrir nada. Para quem leva como negócio."
            tiers={PROFISSIONAL_TIERS}
            highlight
            features={[
              "Tudo do Starter, e mais —",
              "Integração Stays (push automático de preço)",
              "Modo Automático com tetos de variação",
              "Webhooks e API para integrações próprias",
              "Suporte prioritário (resposta em 4h úteis)",
              "Relatório mensal consolidado",
            ]}
          />
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== ESCALA ============== */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
            03 — ESCALA
          </p>
          <h2
            className="urban-display"
            style={{
              fontSize: "clamp(56px, 9vw, 140px)",
              lineHeight: 0.9,
              letterSpacing: "-1px",
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            20+ IMÓVEIS,
            <br />
            <span style={{ color: "#E8500A" }}>FALA COM A GENTE.</span>
          </h2>
          <p
            style={{
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 680,
              marginTop: 40,
            }}
          >
            Para redes, gestoras multi-conta e operações com integração customizada.
            Onboarding dedicado, SLA contratual, suporte WhatsApp dedicado, relatórios
            executivos personalizados.
          </p>
          <div style={{ marginTop: 56 }}>
            <a
              href="https://wa.me/seunumerodevendas"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "20px 36px",
                background: "#E8500A",
                color: "#080A0F",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Falar com consultor →
            </a>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== FAQ ============== */}
      <section style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
            DÚVIDAS DE COBRANÇA
          </p>
          <h2
            className="urban-display"
            style={{
              fontSize: "clamp(56px, 10vw, 160px)",
              lineHeight: 0.9,
              letterSpacing: "-1px",
              fontWeight: 400,
              margin: "0 0 80px",
              textTransform: "uppercase",
            }}
          >
            RESPOSTAS
            <br />
            <span style={{ color: "#E8500A" }}>CURTAS.</span>
          </h2>
          <div>
            <Faq
              q="Como funciona a cobrança por imóvel?"
              a="Você escolhe um plano e o ciclo. Multiplica preço × imóveis × ciclo. Profissional anual com 5 imóveis = R$ 67 × 5 × 12 = R$ 4.020 cobrados de uma vez (32% off vs. mensal)."
            />
            <Faq
              q="E se eu adicionar imóveis no meio do ciclo?"
              a="Atualiza no painel. Cobrança proporcional automática para o restante do ciclo. Sem reiniciar assinatura."
            />
            <Faq
              q="E se eu remover imóveis?"
              a="Mantém a quota até o fim do ciclo. Sem crédito retroativo. No próximo ciclo a cobrança ajusta para o número atual."
            />
            <Faq
              q="Posso pagar mensal e mudar para anual?"
              a="Sim. Troca de ciclo a qualquer momento. O valor já pago vira crédito proporcional no novo ciclo."
            />
            <Faq
              q="Posso cancelar?"
              a="Sim, sem fidelidade. Cancela direto no painel. Acesso mantido até o fim do ciclo já pago. Sem reembolso proporcional para ciclo iniciado, exceto onde a lei exigir."
            />
            <Faq
              q="Tem teste gratuito?"
              a="No pré-lançamento, trials individuais por convite. No go-live oficial: 7 a 14 dias gratuitos sem cartão."
            />
            <Faq
              q="Pix? Boleto?"
              a="Sim. Processamento via Stripe — cartão, débito, Pix e boleto (2 dias úteis)."
            />
            <Faq
              q="Nota fiscal?"
              a="Emitida automaticamente após cada cobrança. Você baixa pelo painel."
            />
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== FINAL CTA ============== */}
      <section
        className="urban-grain"
        style={{ position: "relative", padding: "140px 24px", overflow: "hidden" }}
      >
        <div
          className="urban-glow"
          style={{ width: 600, height: 600, top: -100, right: -100 }}
        />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto" }}>
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
            COMEÇAR
            <br />
            <span style={{ color: "#E8500A" }}>É RÁPIDO.</span>
          </h2>
          <p
            style={{
              fontSize: 20,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 580,
              marginTop: 48,
              marginBottom: 56,
            }}
          >
            No pré-lançamento o acesso é por convite. Entre na lista e libere
            antes da abertura geral.
          </p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
            <NextLink
              href={WAITLIST_URL}
              style={{
                display: "inline-block",
                padding: "22px 40px",
                background: "#E8500A",
                color: "#080A0F",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Garantir meu acesso →
            </NextLink>
            <a
              href={SIGNUP_URL}
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 13,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 500,
                textDecoration: "none",
                borderBottom: "1px solid rgba(255,255,255,0.20)",
                paddingBottom: 4,
              }}
            >
              Já tem convite? Entrar
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

// =================== Subcomponents ===================

function PlanBlock({
  eyebrow,
  tagline,
  description,
  tiers,
  features,
  highlight = false,
}: {
  eyebrow: string;
  tagline: string;
  description: string;
  tiers: { cycle: string; price: string; note: string | null }[];
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="urban-eyebrow" style={{ marginBottom: 24 }}>
        {eyebrow}
      </p>
      <h2
        className="urban-display"
        style={{
          fontSize: "clamp(56px, 9vw, 140px)",
          lineHeight: 0.9,
          letterSpacing: "-1px",
          fontWeight: 400,
          margin: 0,
          textTransform: "uppercase",
        }}
      >
        {tagline.split(" · ").map((part, i) =>
          i === 0 ? (
            <span key={i}>{part}</span>
          ) : (
            <span key={i} style={{ color: "#E8500A" }}>
              {" · "}
              {part}
            </span>
          ),
        )}
      </h2>
      <p
        style={{
          fontSize: 20,
          fontWeight: 300,
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.65)",
          maxWidth: 680,
          marginTop: 40,
        }}
      >
        {description}
      </p>

      {/* Tiers row — sem rounded cards. Linhas finas. */}
      <div
        style={{
          marginTop: 64,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {tiers.map((t, i) => (
          <div
            key={t.cycle}
            style={{
              padding: "32px 24px",
              borderRight:
                i < tiers.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            <p
              style={{
                fontSize: 11,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)",
                fontWeight: 600,
                margin: 0,
              }}
            >
              {t.cycle}
            </p>
            <p
              className="urban-display"
              style={{
                fontSize: 56,
                lineHeight: 1,
                fontWeight: 400,
                margin: "16px 0 4px",
                color: highlight ? "#FFFFFF" : "rgba(255,255,255,0.92)",
              }}
            >
              R${t.price}
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>
              /imóvel/mês
            </p>
            {t.note && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#E8500A",
                  fontWeight: 600,
                }}
              >
                {t.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Features */}
      <div
        style={{
          marginTop: 56,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px 48px",
        }}
      >
        {features.map((f) => (
          <div
            key={f}
            style={{
              display: "flex",
              gap: 16,
              alignItems: "baseline",
              fontSize: 16,
              fontWeight: 300,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <span style={{ color: "#E8500A", fontWeight: 600, fontSize: 12 }}>—</span>
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "28px 0",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.3px",
          color: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <span>{q}</span>
        <span
          style={{
            color: "#E8500A",
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          +
        </span>
      </summary>
      <div
        style={{
          marginTop: 20,
          fontSize: 17,
          fontWeight: 300,
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.65)",
          maxWidth: 720,
        }}
      >
        {a}
      </div>
    </details>
  );
}
