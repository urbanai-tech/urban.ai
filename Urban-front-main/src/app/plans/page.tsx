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
import Link from "next/link";
import { getPlans, type Plan } from "../service/api";
import { useCheckoutReturnNotice } from "../componentes/useCheckoutReturnNotice";
import { BrandLogo } from "../componentes/ui/BrandLogo";
import { PricingSelfServiceCalculator } from "../componentes/PricingCalculatorV2";
import styles from "./plans.module.css";

const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://myurbanai.com";

/** Cabeçalho mínimo do checkout: marca + volta ao app (sem a navegação do painel). */
function CheckoutHeader() {
  return (
    <header className={styles.checkoutHeader}>
      <div className={styles.checkoutHeaderInner}>
        <Link href="/dashboard" className={styles.checkoutBrand} aria-label="My Urban, ir para o painel">
          <BrandLogo variant="wordmark" priority />
        </Link>
        <Link href="/dashboard" className={styles.backLink}>
          <span aria-hidden="true">←</span> Voltar ao painel
        </Link>
      </div>
    </header>
  );
}

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
        className={`urban-app ${styles.mainContent}`}
      >
        <p
          className={styles.loadingText}
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
      className={`urban-app ${styles.mainContentText}`}
    >
      <CheckoutHeader />
      {/* ============== HERO ============== */}
      <section
        className={`urban-grain ${styles.grain}`}
      >
        <div
          className={`urban-glow ${styles.glow}`}
        />
        <div
          className={styles.heroInner}
        >
          <p
            className={`urban-eyebrow ${styles.eyebrow}`}
          >
            ESCOLHA SEU PLANO
          </p>
          <h1
            className={`urban-app-display ${styles.appDisplay}`}
          >
            VOCÊ PAGA
            <br />
            POR IMÓVEL.
            <br />
            <span className={styles.highlightText}>NADA MAIS.</span>
          </h1>
          <p
            className={styles.heroSubtitle}
          >
            Comece com 1 imóvel ou comece com 10 — você só paga pelo que conecta.
            Ciclos longos têm desconto progressivo.
          </p>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* ============== PLANOS ============== */}
      <section className={styles.catalogSection}>
        <div className={styles.catalogInner}>
          <div className={styles.catalogHeader}>
            <div className={styles.highlightBar} />
            <p
              className={`urban-eyebrow ${styles.accentEyebrow}`}
            >
              CALCULE O SEU
            </p>
            <h2
              className={`urban-app-display ${styles.appDisplayFluid}`}
            >
              Selecione plano,
              <br />
              <span className={styles.highlightText}>
                ciclo e quantidade.
              </span>
            </h2>
          </div>

          {activePlans.length === 0 ? (
            <p
              className={styles.emptyPlansText}
            >
              Nenhum plano disponível no momento. Fale com a equipe comercial
              para opções personalizadas.
            </p>
          ) : (
            <div
              className={styles.plansGrid}
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

      <div className={styles.sectionDivider} />

      {/* ============== FOOTER ============== */}
      <section className={styles.footerSection}>
        <div
          className={styles.footerInner}
        >
          <p
            className={styles.footerNote}
          >
            Pagamento seguro via Stripe. Cancele a qualquer momento, sem
            multa. Os valores são por imóvel; o total e a data da próxima
            cobrança aparecem no resumo do pedido.
          </p>
          <p className={styles.footerLinks}>
            <a href={`${PUBLIC_SITE_URL}/termos`} className={styles.footerLink}>
              Termos de uso
            </a>
            <a href={`${PUBLIC_SITE_URL}/privacidade`} className={styles.footerLink}>
              Política de privacidade
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
