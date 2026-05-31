'use client';

import React, { useEffect, useState } from "react";
import {
  getPlans,
  getPropriedadesDropdownList,
  Plan,
} from "../service/api";
import { Icons } from "./ui";
import { PricingSelfServiceCalculator } from "./PricingCalculatorV2";
import { selectPlanForQuantity } from "../lib/pricingSelfService";

interface GlobalPaywallModalProps {
  isOpen: boolean;
}

function LoadingSpinner() {
  return <span className="global-paywall-spinner" aria-label="Carregando" />;
}

export function GlobalPaywallModal({ isOpen }: GlobalPaywallModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyCount, setPropertyCount] = useState<number>(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setCheckoutError(null);
    Promise.all([
      getPlans(),
      getPropriedadesDropdownList().catch(() => []),
    ])
      .then(([plansData, propsData]) => {
        setPlans(plansData);
        const count = propsData?.length || 0;
        setPropertyCount(count);
      })
      .catch((err) => {
        console.error("Erro ao buscar planos/propriedades:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const activePlans = plans.filter((plan) => plan.isActive);
  const recommendedPlan = selectPlanForQuantity(activePlans, Math.max(1, propertyCount || 1));
  const recommendedLabel = recommendedPlan?.title ?? "a faixa correta";

  return (
    <div className="global-paywall-overlay" role="dialog" aria-modal="true">
      <section className="global-paywall-modal">
        <h2>Escolha seu plano para continuar</h2>

        {checkoutError && (
          <div className="global-paywall-error" role="alert">
            <Icons.Info size={18} />
            <p>{checkoutError}</p>
          </div>
        )}

        {propertyCount > 0 && (
          <div className="global-paywall-alert">
            <Icons.Info size={18} />
            <p>
              <strong>Você possui {propertyCount} imóveis sincronizados.</strong>{" "}
              A faixa <strong>{recommendedLabel}</strong> será aplicada automaticamente
              no checkout self-service.
            </p>
          </div>
        )}

        {loading ? (
          <div className="global-paywall-loading">
            <LoadingSpinner />
          </div>
        ) : (
          <PricingSelfServiceCalculator
            plans={activePlans}
            initialQuantity={Math.max(1, propertyCount || 1)}
            surface="light"
            compact
            title="Ajuste sua assinatura"
            subtitle="Escolha a quantidade de imóveis e o período. O plano certo entra sozinho."
          />
        )}
      </section>

      <style jsx>{`
        .global-paywall-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(18, 24, 38, 0.58);
          backdrop-filter: blur(8px);
        }

        .global-paywall-modal {
          width: min(1120px, 100%);
          max-height: calc(100vh - 48px);
          overflow: auto;
          padding: clamp(24px, 4vw, 36px);
          border: 1px solid var(--app-divider);
          border-radius: 18px;
          background: var(--app-surface);
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
        }

        .global-paywall-modal h2 {
          margin: 0 0 18px;
          color: var(--app-text);
          font-size: clamp(24px, 3vw, 32px);
          line-height: 1.1;
          text-align: center;
        }

        .global-paywall-alert {
          display: flex;
          gap: 12px;
          max-width: 760px;
          margin: 0 auto 20px;
          padding: 12px 14px;
          color: var(--app-info);
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.18);
          border-radius: 12px;
        }

        .global-paywall-error {
          display: flex;
          gap: 12px;
          max-width: 760px;
          margin: 0 auto 20px;
          padding: 12px 14px;
          color: var(--app-danger);
          background: rgba(194, 52, 46, 0.08);
          border: 1px solid rgba(194, 52, 46, 0.22);
          border-radius: 12px;
        }

        .global-paywall-error p {
          margin: 0;
          color: var(--app-text);
          font-size: 14px;
          line-height: 1.5;
        }

        .global-paywall-alert p {
          margin: 0;
          color: var(--app-text);
          font-size: 14px;
          line-height: 1.5;
        }

        .global-paywall-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: fit-content;
          max-width: 100%;
          margin: 0 auto 28px;
          padding: 8px 12px;
          color: var(--app-text-muted);
          background: var(--app-surface-muted);
          border: 1px solid var(--app-divider);
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
          flex-wrap: wrap;
        }

        .global-paywall-toggle .active {
          color: var(--app-text);
        }

        .global-paywall-switch {
          position: relative;
          width: 44px;
          height: 24px;
          cursor: pointer;
        }

        .global-paywall-switch input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .global-paywall-switch span {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: var(--app-divider-strong);
          transition: background 140ms ease;
        }

        .global-paywall-switch span::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
          transition: transform 140ms ease;
        }

        .global-paywall-switch input:checked + span {
          background: var(--app-accent);
        }

        .global-paywall-switch input:checked + span::after {
          transform: translateX(20px);
        }

        .global-paywall-loading {
          display: grid;
          min-height: 180px;
          place-items: center;
        }

        .global-paywall-spinner {
          width: 42px;
          height: 42px;
          border: 3px solid var(--app-divider);
          border-top-color: var(--app-accent);
          border-radius: 50%;
          animation: global-paywall-spin 800ms linear infinite;
        }

        .global-paywall-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 22px;
        }

        .global-paywall-grid[data-count="1"] {
          grid-template-columns: minmax(240px, 360px);
          justify-content: center;
        }

        .global-paywall-grid[data-count="2"] {
          grid-template-columns: repeat(2, minmax(240px, 360px));
          justify-content: center;
        }

        .global-paywall-plan {
          position: relative;
          min-width: 0;
          padding: 1px;
          border-radius: 16px;
          background: var(--app-divider);
          transition: transform 140ms ease, box-shadow 140ms ease;
        }

        .global-paywall-plan:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 46px rgba(15, 23, 42, 0.12);
        }

        .global-paywall-plan.is-highlighted {
          background: linear-gradient(180deg, var(--app-accent), rgba(232, 80, 10, 0.32));
        }

        .global-paywall-plan-body {
          display: flex;
          min-height: 100%;
          flex-direction: column;
          padding: 26px 22px;
          text-align: center;
          background: var(--app-surface);
          border-radius: 15px;
        }

        .global-paywall-ribbon {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          max-width: calc(100% - 32px);
          padding: 5px 14px;
          color: #ffffff;
          background: var(--app-accent);
          border: 2px solid #ffffff;
          border-radius: 999px;
          box-shadow: 0 8px 18px rgba(232, 80, 10, 0.22);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.2;
          white-space: nowrap;
        }

        .global-paywall-plan h3 {
          margin: 0;
          color: var(--app-text);
          font-size: 20px;
          line-height: 1.2;
        }

        .global-paywall-price {
          display: flex;
          min-height: 86px;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          margin: 18px 0;
        }

        .global-paywall-original {
          color: var(--app-text-muted);
          font-size: 13px;
          text-decoration: line-through;
        }

        .global-paywall-current {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .global-paywall-current strong,
        .global-paywall-consult {
          color: var(--app-text);
          font-size: clamp(26px, 3vw, 34px);
          line-height: 1;
        }

        .global-paywall-current span {
          color: var(--app-text-muted);
          font-size: 13px;
        }

        .global-paywall-features {
          display: grid;
          gap: 10px;
          margin: 24px 0 0;
          padding: 0;
          text-align: left;
          list-style: none;
        }

        .global-paywall-features li {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          color: var(--app-text-muted);
          font-size: 14px;
          line-height: 1.35;
        }

        .global-paywall-features svg {
          flex: 0 0 auto;
          color: var(--app-success);
          margin-top: 1px;
        }

        @keyframes global-paywall-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 720px) {
          .global-paywall-overlay {
            padding: 12px;
          }

          .global-paywall-modal {
            max-height: calc(100vh - 24px);
            border-radius: 14px;
          }

          .global-paywall-grid,
          .global-paywall-grid[data-count="2"] {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
