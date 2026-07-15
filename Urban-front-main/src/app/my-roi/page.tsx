'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchMyRoi,
  getPropriedadesDropdownList,
  PropertyDropdown,
  RoiSummary,
} from '../service/api';
import PropertySelect from '../componentes/PropertySelect';
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppCardHeader,
  AppMetricCard,
  AppButton,
  AppBadge,
  AppEmptyState,
  AppSelect,
  Icons,
} from '../componentes/ui';
import type { AppBadgeKind } from '../componentes/ui';

const WINDOWS = [30, 90, 180, 365];

function LoadingSpinner() {
  return <span className="roi-spinner" role="status" aria-label="Carregando" />;
}

export default function MyRoiPage() {
  const [data, setData] = useState<RoiSummary | null>(null);
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextWindow = windowDays, nextProperty = propertyId) {
    setLoading(true);
    setError(null);
    try {
      const [roi, props] = await Promise.all([
        fetchMyRoi({ windowDays: nextWindow, propertyId: nextProperty }),
        properties.length === 0 ? getPropriedadesDropdownList() : Promise.resolve(properties),
      ]);
      setData(roi);
      setProperties(props);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(
        e?.response?.status === 401
          ? 'Faça login novamente para ver seus ganhos.'
          : e?.message || 'Erro ao carregar seus ganhos.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });

  const roiLabel = useMemo(() => {
    if (!data?.money.roiMultiple) return '-';
    return `${data.money.roiMultiple.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`;
  }, [data]);

  if (loading && !data) {
    return (
      <AppPageShell>
        <div className="roi-loading">
          <LoadingSpinner />
        </div>
        <style jsx>{styles}</style>
      </AppPageShell>
    );
  }

  if (error || !data) {
    return (
      <AppPageShell>
        <AppEmptyState
          eyebrow="ERRO"
          title="Não foi possível carregar"
          body={error ?? 'Não foi possível carregar seus ganhos.'}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AppButton variant="primary" onClick={() => load()}>
              Tentar de novo
            </AppButton>
          }
        />
      </AppPageShell>
    );
  }

  const acceptance = Math.min(100, data.activity.acceptanceRatePercent);
  const confidenceKind: AppBadgeKind =
    data.dataQuality.confidence === 'high'
      ? 'success'
      : data.dataQuality.confidence === 'medium'
        ? 'warn'
        : 'neutral';

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="GANHOS · IMPACTO DA URBAN AI"
        title="Impacto atribuído às sugestões"
        subtitle="Soma estimada das diárias em que a sugestão foi aceita ou aplicada. Separar confirmado de acompanhamento evita tratar potencial como dinheiro já recebido."
        actions={
          <div className="roi-actions">
            <div style={{ minWidth: 0, width: 320, maxWidth: "100%" }}>
              <PropertySelect
                value={propertyId}
                propsInfo={properties}
                setPropertyId={(nextPropertyId) => {
                  setPropertyId(nextPropertyId);
                  load(windowDays, nextPropertyId);
                }}
                includeAllOption
                allOptionValue=""
                allOptionLabel="Todos os imóveis"
                maxWidth="100%"
              />
            </div>
            <AppSelect
              value={windowDays}
              onChange={(event) => {
                const next = Number(event.target.value);
                setWindowDays(next);
                load(next, propertyId);
              }}
              shellStyle={{ minWidth: 160 }}
            >
              {WINDOWS.map((days) => (
                <option key={days} value={days}>
                  Últimos {days} dias
                </option>
              ))}
            </AppSelect>
            <AppButton variant="primary" onClick={() => load()} loading={loading} leftIcon={<Icons.Zap size={14} />}>
              Atualizar
            </AppButton>
          </div>
        }
      />

      <AppCard variant="accent" style={{ padding: '40px 40px 36px', marginBottom: 32 }}>
        <div className="roi-hero">
          <div>
            <p className="urban-app-eyebrow">IMPACTO ATRIBUÍDO À URBAN AI</p>
            <p className="urban-app-display-hero" style={{ marginTop: 12, color: 'var(--app-accent)' }}>
              {fmt(data.money.totalAttributedCents)}
            </p>
            <p className="roi-muted">
              <strong>{fmt(data.money.confirmedIncrementalCents)}</strong> confirmado
              {' · '}
              <span>{fmt(data.money.projectedIncrementalCents)} em acompanhamento</span>
            </p>
          </div>
          <div className="roi-subhero">
            <p className="urban-app-eyebrow-muted">Quanto voltou sobre o plano</p>
            <p className="urban-app-display-md" style={{ marginTop: 12 }}>
              {roiLabel}
            </p>
            <p className={data.money.netValueCents >= 0 ? 'roi-muted' : 'roi-danger'}>
              Valor líquido: <strong>{fmt(data.money.netValueCents)}</strong>
            </p>
          </div>
        </div>
      </AppCard>

      <div className="roi-kpis">
        <AppMetricCard
          label="Custo da Urban AI"
          value={fmt(data.subscription.monthlyCostCents)}
          sub={`${data.subscription.activePayments} assinatura(s) ativa(s)`}
        />
        <AppMetricCard
          label="Noites com sugestão"
          value={data.activity.impactedNights}
          sub="diárias com aceite, aplicação ou reserva"
        />
        <AppMetricCard
          label="Sugestões aceitas"
          value={`${data.activity.accepted}/${data.activity.recommendations}`}
          sub={`${data.activity.acceptanceRatePercent.toFixed(0)}% do total sugerido`}
        />
        <AppMetricCard
          label="Potencial não aceito"
          value={fmt(data.money.potentialLostCents)}
          sub="estimativa de sugestões recusadas ou ignoradas"
          accent={data.money.potentialLostCents > 0}
        />
      </div>

      <div className="roi-main-grid">
        <AppCard variant="default">
          <AppCardHeader
            title="Resultado por imóvel"
            subtitle={data.dataQuality.explanation}
            actions={<AppBadge kind={confidenceKind}>{data.dataQuality.label}</AppBadge>}
          />
          {data.perProperty.length === 0 ? (
            <AppEmptyState
            title="Nada aplicado neste período"
            body="Quando você aceitar, aplicar ou confirmar uma sugestão da Urban AI, os ganhos aparecem aqui."
            />
          ) : (
            <div className="roi-table-wrap">
              <table className="roi-table">
                <thead>
                  <tr>
                    <th>Imóvel</th>
                    <th className="numeric">Gerado</th>
                    <th className="numeric">Noites</th>
                    <th className="numeric">Usadas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perProperty.map((property) => (
                    <tr key={property.propertyId ?? property.propertyName}>
                      <td>
                        <p className="roi-property-name">{property.propertyName}</p>
                        <p className="roi-property-sub">{property.recommendations} sugestões</p>
                      </td>
                      <td className="numeric">
                        <strong className="roi-accent">{fmt(property.totalAttributedCents)}</strong>
                      </td>
                      <td className="numeric">{property.impactedNights}</td>
                      <td className="numeric">{property.applied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AppCard>

        <AppCard variant="default">
          <AppCardHeader title="Uso das sugestões" />
          <div className="roi-progress-label">
            <span>Sugestões aceitas</span>
            <strong>{acceptance.toFixed(0)}%</strong>
          </div>
          <div className="roi-progress" aria-label={`Sugestões aceitas ${acceptance.toFixed(0)}%`}>
            <span style={{ width: `${acceptance}%` }} />
          </div>
          <div className="roi-mini-grid">
            <AppMetricCard label="Aprovadas" value={data.activity.accepted} variant="sm" />
            <AppMetricCard label="Usadas" value={data.activity.applied} variant="sm" />
            <AppMetricCard label="Reservadas" value={data.activity.booked} variant="sm" />
            <AppMetricCard label="Rejeitadas" value={data.activity.rejected} variant="sm" />
          </div>
        </AppCard>
      </div>

      <AppCard variant="default">
        <AppCardHeader title="Ganhos recentes" subtitle="Últimas sugestões que viraram receita confirmada." />
        {data.recentWins.length === 0 ? (
          <AppEmptyState
            title="Sem ganhos confirmados ainda"
            body="As sugestões aceitas que viraram reservas aparecem aqui depois que as noites passam."
          />
        ) : (
          <div className="roi-wins">
            {data.recentWins.map((win) => (
              <article className="roi-win-card" key={win.id}>
                <div className="roi-win-row">
                  <div className="roi-win-copy">
                    <p className="roi-property-name">{win.propertyName}</p>
                    <p className="roi-property-sub">
                      {fmt(win.currentPriceCents)}
                      {' -> '}
                      {fmt(win.appliedPriceCents)} · {win.nights} noite(s)
                    </p>
                  </div>
                  <strong className="roi-accent">+{fmt(win.incrementalCents)}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </AppCard>

      <style jsx>{styles}</style>
    </AppPageShell>
  );
}

const styles = `
  .roi-loading {
    display: grid;
    min-height: 60vh;
    place-items: center;
  }

  .roi-spinner {
    width: 42px;
    height: 42px;
    border: 3px solid var(--app-divider);
    border-top-color: var(--app-accent);
    border-radius: 50%;
    animation: roi-spin 800ms linear infinite;
  }

  .roi-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: 100%;
    min-width: 0;
  }

  .roi-hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
  }

  .roi-muted,
  .roi-danger {
    margin: 12px 0 0;
    color: var(--app-text-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .roi-muted strong,
  .roi-danger strong {
    color: var(--app-text);
  }

  .roi-danger {
    color: var(--app-danger);
  }

  .roi-subhero {
    min-width: 240px;
    padding-left: 32px;
    text-align: right;
    border-left: 1px solid var(--app-divider);
  }

  .roi-kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 24px;
    margin-bottom: 32px;
    padding: 24px 0;
    border-top: 1px solid var(--app-divider);
    border-bottom: 1px solid var(--app-divider);
  }

  .roi-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
    gap: 24px;
    margin-bottom: 24px;
  }

  .roi-table-wrap {
    overflow-x: auto;
  }

  .roi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .roi-table th {
    padding: 10px 12px;
    color: var(--app-text-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-align: left;
    text-transform: uppercase;
    border-bottom: 1px solid var(--app-divider);
  }

  .roi-table td {
    padding: 14px 12px;
    color: var(--app-text);
    border-bottom: 1px solid var(--app-divider);
  }

  .roi-table tr:last-child td {
    border-bottom: 0;
  }

  .roi-table .numeric {
    text-align: right;
    white-space: nowrap;
  }

  .roi-property-name {
    max-width: 280px;
    margin: 0;
    overflow: hidden;
    color: var(--app-text);
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .roi-property-sub {
    margin: 4px 0 0;
    color: var(--app-text-muted);
    font-size: 12px;
  }

  .roi-accent {
    color: var(--app-accent);
    font-weight: 750;
  }

  .roi-progress-label {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    color: var(--app-text-muted);
    font-size: 14px;
  }

  .roi-progress-label strong {
    color: var(--app-text);
  }

  .roi-progress {
    height: 9px;
    overflow: hidden;
    background: var(--app-surface-muted);
    border-radius: 999px;
  }

  .roi-progress span {
    display: block;
    height: 100%;
    background: var(--app-accent);
    border-radius: inherit;
  }

  .roi-mini-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin-top: 24px;
  }

  .roi-wins {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .roi-win-card {
    padding: 16px;
    border: 1px solid var(--app-divider);
    border-radius: 8px;
    background: var(--app-surface);
    transition: border-color 120ms ease;
  }

  .roi-win-card:hover {
    border-color: var(--app-divider-strong);
  }

  .roi-win-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .roi-win-copy {
    min-width: 0;
  }

  @keyframes roi-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 900px) {
    .roi-hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .roi-subhero {
      min-width: 0;
      padding-left: 0;
      text-align: left;
      border-left: 0;
    }

    .roi-main-grid,
    .roi-wins {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .roi-actions {
      align-items: stretch;
      flex-direction: column;
      width: 100%;
    }

    .roi-mini-grid {
      grid-template-columns: 1fr;
    }

    .roi-win-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
