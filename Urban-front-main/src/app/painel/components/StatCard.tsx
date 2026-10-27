'use client';

import React, { useEffect, useState } from 'react';
import { getPropertyData } from '@/app/service/api';

type MetricStripProps = {
  propertyId: string | undefined;
};

type PropertyData = Awaited<ReturnType<typeof getPropertyData>>;

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/**
 * Faixa compacta de métricas do Hoje (chips). Antes eram 4 cards altos no topo
 * da página; agora os números vêm depois da decisão e cabem numa linha (rolagem
 * horizontal no celular). Cada chip tem um `title` com a explicação completa.
 */
export default function MetricStrip({ propertyId }: MetricStripProps) {
  const [data, setData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setFailed(false);
        const result = await getPropertyData(propertyId);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error('Erro ao carregar dados do painel:', err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
  const value = (render: (d: PropertyData) => string) => (loading ? '…' : data ? render(data) : '--');
  const pct = data?.receitaProjetada?.diferencaPercentual;

  const chips = [
    {
      id: 'opportunities',
      label: 'oportunidades futuras',
      value: value((d) => String(d.quantidadeEventos ?? 0)),
      help: 'Linhas de recomendação futuras (não eventos únicos).',
    },
    {
      id: 'lift',
      label: `a mais aceito em ${month}`,
      value: value((d) =>
        `${formatCurrency(d.lucroProjetadoGeradoPeloUrban ?? 0)}${typeof pct === 'number' && pct > 0 ? ` (+${pct.toFixed(0)}%)` : ''}`,
      ),
      help: 'Diferença entre o seu preço e as sugestões que você aceitou neste mês.',
    },
    {
      id: 'revenue',
      label: `em diárias aceitas em ${month}`,
      value: value((d) => formatCurrency(d.receitaProjetada?.receitaProjetada ?? 0)),
      help: 'Soma das diárias sugeridas que você aceitou no mês atual.',
    },
    {
      id: 'properties',
      label: 'imóveis com aceite',
      value: value((d) => String(d.quantidadePropriedadesAtivas ?? 0)),
      help: 'Imóveis que já tiveram pelo menos uma sugestão aceita.',
    },
  ];

  return (
    <>
      <ul className="urban-metric-strip" aria-label="Indicadores" aria-busy={loading || undefined}>
        {chips.map((chip) => (
          <li key={chip.id} className="urban-metric-chip" title={chip.help} data-loading={loading || undefined} data-metric={chip.id}>
            <strong>{chip.value}</strong>
            <span>{chip.label}</span>
          </li>
        ))}
      </ul>
      {failed && <p className="urban-metric-strip__note">Não foi possível carregar os números agora.</p>}
    </>
  );
}
