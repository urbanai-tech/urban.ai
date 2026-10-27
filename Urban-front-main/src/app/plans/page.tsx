"use client";

/**
 * /plans — página oficial de planos da Urban AI (checkout pós-login).
 *
 * Segue o tema (claro/escuro) com os tokens da marca My Urban: fundo, texto
 * e acento vêm de `--app-*`; títulos em Archivo (fonte de marca). Continua a
 * landing pública (`/precos`) sem fundo fixo.
 *
 * Renderiza PricingCalculatorV2 (matriz F6.5: cobrança por imóvel x 4 ciclos
 * com desconto progressivo) — usuários pré-migração mantêm grandfathering.
 */

import { useEffect, useState } from "react";
import { getPlans, type Plan } from "../service/api";
import { useCheckoutReturnNotice } from "../componentes/useCheckoutReturnNotice";
import { PricingSelfServiceCalculator } from "../componentes/PricingCalculatorV2";

// Destaque da marca: deep no claro, mint no escuro (token do tema).
const PLANS_ACCENT = "var(--app-accent)";
// Só para títulos grandes (teal no claro tem 3,8:1; lima no escuro).
const PLANS_HIGHLIGHT = "var(--app-highlight)";

export default function PlansPage() {
  useCheckoutReturnNotice("canceled");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main
        id="main-content"
        className="urban-app"
        style={{
          background: "var(--app-bg)",
          color: "var(--app-text)",
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
            color: "var(--app-text-muted)",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Carregando planos…
        </p>
      </main>
    );
  }

  const activePlans = plans.filter((p) => p.isActive);

  return (
    <main
      id="main-content"
      className="urban-app"
      style={{ background: "var(--app-bg)", color: "var(--app-text)", minHeight: "100vh" }}
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
            style={{ marginBottom: 32, color: "var(--app-text-muted)" }}
          >
            CHECKOUT — ESCOLHA SEU PLANO
          </p>
          <h1
            className="urban-app-display"
            style={{
              fontSize: "clamp(36px, 7.5vw, 96px)",
              lineHeight: 0.98,
              letterSpacing: "-1.5px",
              fontWeight: 700,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            VOCÊ PAGA
            <br />
            POR IMÓVEL.
            <br />
            <span style={{ color: PLANS_HIGHLIGHT }}>NADA MAIS.</span>
          </h1>
          <p
            style={{
              fontSize: 18,
              fontWeight: 400,
              lineHeight: 1.75,
              color: "var(--app-text-muted)",
              maxWidth: 680,
              marginTop: 40,
            }}
          >
            Comece com 1 imóvel ou comece com 10 — você só paga pelo que conecta.
            Ciclos longos tem desconto progressivo.
          </p>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--app-divider)" }} />

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
                background: PLANS_HIGHLIGHT,
              }}
            />
            <p
              className="urban-eyebrow"
              style={{ marginBottom: 16, color: PLANS_ACCENT }}
            >
              CALCULE O SEU
            </p>
            <h2
              className="urban-app-display"
              style={{
                fontSize: "clamp(28px, 4.5vw, 52px)",
                lineHeight: 1,
                letterSpacing: "-1px",
                fontWeight: 700,
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Selecione plano,
              <br />
              <span style={{ color: PLANS_HIGHLIGHT }}>
                ciclo e quantidade.
              </span>
            </h2>
          </div>

          {activePlans.length === 0 ? (
            <p
              style={{
                fontSize: 16,
                color: "var(--app-text-muted)",
                maxWidth: 580,
              }}
            >
              Nenhum plano disponível no momento. Fale com a equipe comercial
              para opções personalizadas.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: 24,
              }}
            >
              <PricingSelfServiceCalculator
                plans={activePlans}
                surface="light"
                initialQuantity={5}
                title="Monte sua assinatura"
                subtitle="Escolha quantos imóveis quer contratar. A Urban aplica automaticamente a faixa correta e o desconto do período."
              />
            </div>
          )}
        </div>
      </section>

      <div style={{ height: 1, background: "var(--app-divider)" }} />

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
              fontWeight: 400,
              lineHeight: 1.75,
              color: "var(--app-text-muted)",
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
    </main>
  );
}
