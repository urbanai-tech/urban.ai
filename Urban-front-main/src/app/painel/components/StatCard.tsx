'use client';

import React, { useEffect, useState } from 'react';
import { getPropertyData } from '@/app/service/api';

type DashboardCardsProps = {
  propertyId: string | undefined;
};

const StatCard = ({
  title,
  value,
  subtitle,
  isLoading,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  isLoading?: boolean;
}) => {
  return (
    <article
      style={{
        minWidth: 220,
        flex: 1,
        padding: 24,
        border: "1px solid rgba(14,17,22,0.12)",
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 4px 12px rgba(14,17,22,0.08)",
        transition: "box-shadow 0.2s, transform 0.2s",
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
              background: "#E8500A",
              animation: "stat-card-progress 1s ease-in-out infinite",
            }}
          />
        </div>
      ) : null}
      <p style={{ margin: 0, color: "#6B7280", fontSize: 14, fontWeight: 650 }}>
        {title}
      </p>
      <h3 style={{ margin: "4px 0 0", color: "#1F2937", fontSize: 24, lineHeight: 1.2 }}>
        {value ?? '--'}
      </h3>
      {subtitle && (
        <p style={{ margin: "4px 0 0", color: "#16A06B", fontSize: 14, fontWeight: 650 }}>
          {subtitle}
        </p>
      )}
    </article>
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
    <div style={{ paddingTop: 40, background: "#F9FAFB" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <StatCard title="Propriedades Ativas" value={data?.quantidadePropriedadesAtivas} isLoading={loading} />
        <StatCard title="Eventos" value={data?.quantidadeEventos} isLoading={loading} />
        <StatCard
          title="Receita Projetada"
          value={data ? formatCurrency(data.receitaProjetada.receitaProjetada) : undefined}
          subtitle={new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date())}
          isLoading={loading}
        />
        <StatCard
          title="Lucro Projetado Urban AI"
          value={data ? formatCurrency(data.lucroProjetadoGeradoPeloUrban) : undefined}
          subtitle={data ? `+${data.receitaProjetada.diferencaPercentual.toFixed(2)}%` : undefined}
          isLoading={loading}
        />
      </div>
      <style>{`
        @keyframes stat-card-progress {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
