'use client';

import React, { useEffect, useState } from 'react';
import { getPropertyData } from '@/app/service/api';
import { AppCard, Icons } from '@/app/componentes/ui';

type DashboardCardsProps = {
  propertyId: string | undefined;
};

const StatCard = ({
  title,
  value,
  subtitle,
  help,
  isLoading,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  help?: string;
  isLoading?: boolean;
}) => {
  return (
    <AppCard
      as="article"
      variant="default"
      style={{
        minWidth: 220,
        flex: 1,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 150,
      }}
    >
      {isLoading ? (
        <div style={{ height: 3, marginBottom: 16, overflow: "hidden", borderRadius: 999, background: "rgba(232,80,10,0.12)" }}>
          <span
            style={{
              display: "block",
              width: "35%",
              height: "100%",
              borderRadius: 999,
              background: "var(--app-accent)",
              animation: "stat-card-progress 1s ease-in-out infinite",
            }}
          />
        </div>
      ) : null}
      <p className="urban-app-eyebrow-muted" style={{ margin: 0 }}>
        {title}
      </p>
      <h3 style={{ margin: 0, color: "var(--app-text)", fontSize: 30, lineHeight: 1.05, fontWeight: 750 }}>
        {value ?? '--'}
      </h3>
      {subtitle && (
        <p style={{ margin: 0, color: "var(--app-success)", fontSize: 13, fontWeight: 650 }}>
          {subtitle}
        </p>
      )}
      {help && (
        <p style={{ margin: "auto 0 0", color: "var(--app-text-muted)", fontSize: 12, lineHeight: 1.35 }}>
          {help}
        </p>
      )}
    </AppCard>
  );
};

export default function DashboardCards({ propertyId }: DashboardCardsProps) {
  const [data, setData] = useState<null | {
    quantidadePropriedadesAtivas: number;
    lucroProjetadoGeradoPeloUrban: number;
    receitaProjetada: {
      receitaProjetada: number;
      diferencaPercentual: number;
    };
    quantidadeEventos: number;
  }>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const result = await getPropertyData(propertyId);
        setData(result);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [propertyId]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icons.Info size={14} style={{ color: "var(--app-text-muted)" }} />
        <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 12, lineHeight: 1.4 }}>
          Estes indicadores usam sugestoes e eventos futuros ja calculados para os seus imoveis.
        </p>
      </div>
      <div className="painel-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
        <StatCard
          title="Imoveis com aceite"
          value={data?.quantidadePropriedadesAtivas}
          help="Imoveis que ja tiveram pelo menos uma sugestao aceita."
          isLoading={loading}
        />
        <StatCard
          title="Oportunidades futuras"
          value={data?.quantidadeEventos}
          help="Linhas de recomendacao futuras, nao eventos unicos."
          isLoading={loading}
        />
        <StatCard
          title="Receita sugerida aceita"
          value={data ? formatCurrency(data.receitaProjetada.receitaProjetada) : undefined}
          subtitle={new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date())}
          help="Soma das diarias sugeridas aceitas no mes atual."
          isLoading={loading}
        />
        <StatCard
          title="Lift aceito no mes"
          value={data ? formatCurrency(data.lucroProjetadoGeradoPeloUrban) : undefined}
          subtitle={data ? `+${data.receitaProjetada.diferencaPercentual.toFixed(2)}%` : undefined}
          help="Diferenca entre preco atual e sugestao aceita."
          isLoading={loading}
        />
      </div>
      <style>{`
        @media (max-width: 1100px) {
          .painel-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 620px) {
          .painel-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes stat-card-progress {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </section>
  );
}
