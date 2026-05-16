"use client";

/**
 * /plans — pagina oficial de planos da Urban AI (checkout pos-login).
 *
 * Mesma estetica do manifesto editorial em `/(public)/precos/page.tsx`:
 * Bebas Neue gigante, fundo #080A0F, accent #E8500A, vertical accent bar.
 * Esta tela e a continuacao direta do que o anfitriao viu na landing.
 *
 * Renderiza PricingCalculatorV2 (matriz F6.5: cobranca por imovel x 4 ciclos
 * com desconto progressivo) — usuarios pre-migracao mantem grandfathering.
 */

import { useEffect, useState } from "react";
import { getPlans, type Plan } from "../service/api";
import { PricingCalculatorV2 } from "../componentes/PricingCalculatorV2";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="urban-manifesto"
        style={{
          background: "#080A0F",
          color: "#FFFFFF",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
          Carregando planos...
        </p>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.isActive);

  return (
    <div
      className="urban-manifesto"
      style={{ background: "#080A0F", color: "#FFFFFF", minHeight: "100vh" }}
    >
      {/* ============== HERO ============== */}
      <section
        className="urban-grain"
        style={{
          position: "relative",
          padding: "120px 24px 80px",
          overflow: "hidden",
        }}
      >
        <div
          className="urban-glow"
          style={{
            width: 700,
            height: 700,
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 1280,
            margin: "0 auto",
          }}
        >
          <p
            className="urban-eyebrow"
            style={{ marginBottom: 32 }}
          >
            CHECKOUT — ESCOLHA SEU PLANO
          </p>
          <h1
            className="urban-display"
            style={{
              fontSize: "clamp(64px, 11vw, 160px)",
              lineHeight: 0.9,
              letterSpacing: "-2px",
              fontWeight: 400,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            VOCE PAGA
            <br />
            POR IMOVEL.
            <br />
            <span style={{ color: "#E8500A" }}>NADA MAIS.</span>
          </h1>
          <p
            style={{
              fontSize: 18,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 680,
              marginTop: 40,
            }}
          >
            Comece com 1 imovel ou comece com 10 — voce so paga pelo que conecta.
            Ciclos longos tem desconto progressivo.
          </p>
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== PLANOS ============== */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ position: "relative", marginBottom: 56 }}>
            <div
              style={{
                position: "absolute",
                left: -2,
                top: 0,
                width: 2,
                height: 56,
                background: "#E8500A",
              }}
            />
            <p
              className="urban-eyebrow"
              style={{ marginBottom: 16 }}
            >
              CALCULE O SEU
            </p>
            <h2
              className="urban-display"
              style={{
                fontSize: "clamp(40px, 6vw, 72px)",
                lineHeight: 0.95,
                letterSpacing: "-1px",
                fontWeight: 400,
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Selecione plano,
              <br />
              <span style={{ color: "#E8500A" }}>
                ciclo e quantidade.
              </span>
            </h2>
          </div>

          {activePlans.length === 0 ? (
            <p
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.55)",
                maxWidth: 580,
              }}
            >
              Nenhum plano disponivel no momento. Fale com a equipe comercial
              para opcoes personalizadas.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 24,
              }}
            >
              {activePlans.map((plan) => (
                <PricingCalculatorV2 key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      </section>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

      {/* ============== FOOTER ============== */}
      <section style={{ padding: "60px 24px 100px" }}>
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.55)",
              maxWidth: 640,
              margin: "0 auto",
            }}
          >
            Pagamento seguro via Stripe. Cancele a qualquer momento — sem
            contrato. Mensal e flexibilidade pura, anual e o melhor
            custo-beneficio.
          </p>
        </div>
      </section>
    </div>
  );
}
