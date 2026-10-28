"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, getPropertyPricingInputHistory, type PricingInputHistory } from "../../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminMetricCard,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminPageLoading,
  AdminTable,
  type AdminTableColumn,
  AdminStatusDot,
  Icons,
} from "../../_components";
import type { AdminBadgeKind } from "../../_components";
import styles from "./page.module.css";

/**
 * /admin/properties/[id] — detalhe consolidado de um imóvel (gap I5 do roadmap).
 *
 * Tudo o que suporte precisa saber sobre um imóvel, sem SQL. Combina:
 *  - Cabeçalho com host, localidade, status, badges de saúde
 *  - 4 KPIs (diária base, receita média, recomendações futuras, última análise)
 *  - Card "Saúde do imóvel" com checks de geo, localidade, preço base, recomendação
 *  - Tabela de análises recentes (sugerido vs aplicado)
 *  - Tabela de eventos próximos
 *  - Histórico de input de pricing (campo do anfitrião)
 *  - Ações: editar localidade, reprocessar recomendação, ver no painel host
 *
 * Usa apenas endpoints administrativos autenticados para evitar dados parciais
 * ou fallbacks públicos no painel operacional.
 */

type AdminPropertyDetail = {
  id: string;
  propertyName: string;
  userId: string;
  userEmail?: string;
  city?: string | null;
  state?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  manualDailyPrice?: number | null;
  averageMonthlyRevenue?: number | null;
  active?: boolean;
  createdAt: string;
  lastAnalysisAt: string | null;
  futureRecommendationsCount?: number;
  appliedRecommendationsCount?: number;
  recentAnalyses?: AnalysisRow[];
  nearbyEvents?: EventRow[];
  image_url?: string;
};

type AnalysisRow = {
  id: string;
  eventoNome?: string;
  dataInicio?: string;
  precoAtual?: number;
  precoSugerido?: number;
  precoAplicado?: number | null;
  diferencaPercentual?: number;
  status?: string;
  aceito?: boolean;
  criadoEm?: string;
};

type EventRow = {
  id: string;
  nome: string;
  dataInicio: string;
  cidade?: string;
  estado?: string;
  distanciaMetros?: number;
  relevancia?: number | null;
  hasCoords?: boolean;
};

export default function AdminPropertyDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<AdminPropertyDetail | null>(null);
  const [pricingHistory, setPricingHistory] = useState<PricingInputHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await api.get(`/admin/properties/${id}`);
        const detail: AdminPropertyDetail | null = r.data;
        setData(detail);

        // Histórico de pricing inputs sempre busca o endpoint dedicado (existe)
        try {
          const history = await getPropertyPricingInputHistory(id, 20);
          setPricingHistory(history);
        } catch {
          /* não crítico */
        }
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; message?: string };
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          setError("Acesso negado. Você precisa ser admin.");
        } else if (e?.response?.status === 404) {
          setError("Imóvel não encontrado.");
        } else {
          setError(e?.message || "Erro ao carregar imóvel.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleReprocess() {
    setReprocessing(true);
    setReprocessResult(null);
    try {
      const r = await api.post(`/admin/properties/${id}/reprocess`);
      const result = r?.data;
      setReprocessResult(
        result?.created != null
          ? `Reprocessamento OK — ${result.created} criadas, ${result.updated ?? 0} atualizadas.`
          : "Reprocessamento disparado com sucesso.",
      );
    } catch (err: unknown) {
      const e = err as { message?: string };
      setReprocessResult("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setReprocessing(false);
    }
  }

  if (loading) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <div className={styles.boxM0xautoP40x32}>
        <AdminEmptyState
          eyebrow="ERRO"
          title="Falha ao carregar imóvel"
          body={error ?? "Resposta vazia."}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton
              variant="secondary"
              as="a"
              href="/admin/properties"
              leftIcon={<Icons.ArrowLeft size={12} />}
            >
              Voltar para lista
            </AdminButton>
          }
        />
      </div>
    );
  }

  // Diagnóstico de saúde
  const hasCoords =
    data.latitude != null && data.longitude != null && Number(data.latitude) !== 0;
  const hasValidLocality =
    data.city && !/^a\s*definir$/i.test(data.city.trim()) && data.state;
  const hasPriceBase = (data.manualDailyPrice ?? 0) > 0;
  const hasFutureRecs = (data.futureRecommendationsCount ?? 0) > 0;
  const healthIssues = [
    !hasCoords && "Sem coordenadas",
    !hasValidLocality && "Localidade inválida",
    !hasPriceBase && "Sem diária base configurada",
    !hasFutureRecs && "Sem recomendações futuras",
  ].filter(Boolean) as string[];

  const fullAddress =
    [data.street, data.neighborhood, data.city, data.state].filter(Boolean).join(", ") ||
    "Endereço não informado";

  return (
    <div className={styles.boxM0xautoP40x32}>
      {/* === Breadcrumb + nome === */}
      <AdminSectionHeader
        eyebrow={`ADMIN · IMÓVEL · ${data.id.slice(0, 8)}…`}
        title={data.propertyName || "(sem nome)"}
        subtitle={
          <>
            {fullAddress} · Host:{" "}
            <strong className={styles.strongText}>
              {data.userEmail || data.userId?.slice(0, 8) + "…"}
            </strong>
            {data.createdAt && (
              <>
                {" · "}cadastrado em{" "}
                <strong className={styles.strongText}>
                  {new Date(data.createdAt).toLocaleDateString("pt-BR")}
                </strong>
              </>
            )}
          </>
        }
        actions={
          <div className={styles.rowWrapGap8}>
            <AdminButton
              variant="secondary"
              as="a"
              href="/admin/properties"
              leftIcon={<Icons.ArrowLeft size={12} />}
            >
              Voltar
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={handleReprocess}
              loading={reprocessing}
              leftIcon={<Icons.RefreshCw size={12} />}
            >
              Reprocessar
            </AdminButton>
          </div>
        }
      />

      {/* === Resultado do reprocessamento === */}
      {reprocessResult && (
        <AdminCard variant="accent" className={styles.noticeCard}>
          <p
            className={styles.rowCenteredText}
          >
            <Icons.Check size={14} className={styles.accentIcon} />
            {reprocessResult}
          </p>
        </AdminCard>
      )}

      {/* === KPIs === */}
      <section className={styles.sectionMb32}>
        <div
          className={styles.gridColsAuto180Gap32}
        >
          <AdminMetricCard
            label="Diária base"
            value={
              hasPriceBase
                ? `R$ ${Number(data.manualDailyPrice).toLocaleString("pt-BR")}`
                : "—"
            }
            sub={hasPriceBase ? undefined : "Anfitrião precisa cadastrar"}
            status={hasPriceBase ? "success" : "warn"}
          />
          <AdminMetricCard
            label="Receita média / mês"
            value={
              data.averageMonthlyRevenue
                ? `R$ ${Number(data.averageMonthlyRevenue).toLocaleString("pt-BR")}`
                : "—"
            }
          />
          <AdminMetricCard
            label="Recomendações futuras"
            value={data.futureRecommendationsCount ?? 0}
            accent={hasFutureRecs}
            sub={hasFutureRecs ? undefined : "Reprocessar para gerar"}
          />
          <AdminMetricCard
            label="Última análise"
            value={
              data.lastAnalysisAt
                ? new Date(data.lastAnalysisAt).toLocaleDateString("pt-BR")
                : "—"
            }
            sub={
              data.appliedRecommendationsCount != null
                ? `${data.appliedRecommendationsCount} aplicadas até hoje`
                : undefined
            }
          />
        </div>
      </section>

      {/* === Diagnóstico de saúde === */}
      <section className={styles.sectionMb32}>
        <AdminCard variant={healthIssues.length === 0 ? "subtle" : "accent"}>
          <AdminCardHeader
            title={
              <span className={styles.stackGap4}>
                <span>Saúde do imóvel</span>
                <span className={styles.labelTextMutedFs12}>
                  {healthIssues.length === 0
                    ? "Tudo certo. Imóvel está apto a receber recomendações automaticamente."
                    : `${healthIssues.length} item(ns) bloqueando recomendação automática.`}
                </span>
              </span>
            }
            actions={
              <AdminBadge kind={healthIssues.length === 0 ? "success" : "warn"}>
                {healthIssues.length === 0 ? "Saudável" : `${healthIssues.length} alerta(s)`}
              </AdminBadge>
            }
          />
          <div className={styles.gridColsAuto220Gap12}>
            <HealthCheck
              label="Coordenadas geográficas"
              ok={!!hasCoords}
              hint={hasCoords ? `lat ${data.latitude}, lng ${data.longitude}` : "Geocoder pendente — confirmar que Geocoding API GCP está ativa."}
            />
            <HealthCheck
              label="Localidade válida (cidade/UF)"
              ok={!!hasValidLocality}
              hint={hasValidLocality ? `${data.city}/${data.state}` : 'Cidade aparece como "A definir" — rodar backfill.'}
            />
            <HealthCheck
              label="Diária base configurada"
              ok={hasPriceBase}
              hint={hasPriceBase ? `R$ ${Number(data.manualDailyPrice).toLocaleString("pt-BR")}` : "Anfitrião precisa informar no /properties"}
            />
            <HealthCheck
              label="Recomendações futuras geradas"
              ok={hasFutureRecs}
              hint={hasFutureRecs ? `${data.futureRecommendationsCount} ativas` : "Reprocessar imóvel (botão acima)"}
            />
          </div>
        </AdminCard>
      </section>

      {/* === Análises recentes === */}
      <section className={styles.sectionMb32}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb16}`}>
          ANÁLISES RECENTES
        </p>
        <RecentAnalysesTable rows={data.recentAnalyses ?? []} />
      </section>

      {/* === Eventos próximos === */}
      <section className={styles.sectionMb32}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb16}`}>
          EVENTOS PRÓXIMOS DETECTADOS
        </p>
        <NearbyEventsTable rows={data.nearbyEvents ?? []} />
      </section>

      {/* === Histórico de pricing inputs === */}
      <section className={styles.sectionMb32}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb16}`}>
          HISTÓRICO DE PREÇO BASE (INFORMADO PELO ANFITRIÃO)
        </p>
        <PricingHistoryTable rows={pricingHistory} />
      </section>

      {/* === Ações operacionais === */}
      <section className={styles.sectionMt48Bordered}>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Atalhos" />
          <div className={styles.rowWrapGap10}>
            <AdminButton variant="secondary" as="a" href="/painel" leftIcon={<Icons.ArrowRight size={11} />}>
              Ver no painel do anfitrião
            </AdminButton>
            <AdminButton variant="ghost" as="a" href={`/admin/audit-logs?entityId=${id}`} leftIcon={<Icons.Shield size={11} />}>
              Ver audit log deste imóvel
            </AdminButton>
            <AdminButton variant="ghost" as="a" href="/admin/jobs" leftIcon={<Icons.Server size={11} />}>
              Rodar jobs admin
            </AdminButton>
          </div>
        </AdminCard>
      </section>
    </div>
  );
}

function HealthCheck({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        background: ok ? "color-mix(in srgb, var(--admin-success) 4%, transparent)" : "color-mix(in srgb, var(--admin-warning) 4%, transparent)",
      }}
    >
      <div className={styles.rowCenteredGap8}>
        <AdminStatusDot kind={ok ? "success" : "warn"} size={7} />
        <p
          className={styles.textTextFs12}
        >
          {label}
        </p>
      </div>
      {hint && (
        <p
          className={styles.textTextMutedFs11}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function RecentAnalysesTable({ rows }: { rows: AnalysisRow[] }) {
  const cols: AdminTableColumn<AnalysisRow>[] = [
    {
      key: "evento",
      header: "Evento",
      render: (r) => (
        <span className={styles.labelTextFs13}>
          {r.eventoNome ?? "—"}
        </span>
      ),
    },
    {
      key: "data",
      header: "Data evento",
      width: 110,
      render: (r) =>
        r.dataInicio ? (
          <span className={styles.labelTextMutedFs12Mono}>
            {new Date(r.dataInicio).toLocaleDateString("pt-BR")}
          </span>
        ) : (
          <span className={styles.labelTextDim}>—</span>
        ),
    },
    {
      key: "atual",
      header: "Atual",
      align: "right",
      width: 100,
      render: (r) =>
        r.precoAtual ? (
          <span className={styles.labelTextMutedMono}>
            R$ {Number(r.precoAtual).toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className={styles.labelTextDim}>—</span>
        ),
    },
    {
      key: "sugerido",
      header: "Sugerido",
      align: "right",
      width: 110,
      render: (r) =>
        r.precoSugerido ? (
          <span className={styles.labelAccentW600}>
            R$ {Number(r.precoSugerido).toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className={styles.labelTextDim}>—</span>
        ),
    },
    {
      key: "delta",
      header: "Δ%",
      align: "right",
      width: 80,
      render: (r) => {
        if (r.diferencaPercentual == null) return <span className={styles.labelTextDim}>—</span>;
        const d = Number(r.diferencaPercentual);
        return (
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: 600,
              color: d >= 0 ? "var(--admin-success)" : "var(--admin-danger)",
            }}
          >
            {d > 0 ? "+" : ""}
            {d.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: "aplicado",
      header: "Aplicado",
      align: "right",
      width: 110,
      render: (r) =>
        r.precoAplicado ? (
          <span className={styles.labelSuccessW600}>
            R$ {Number(r.precoAplicado).toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className={styles.labelTextDim}>—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (r) => {
        if (r.precoAplicado) return <AdminBadge kind="success">Aplicada</AdminBadge>;
        if (r.aceito) return <AdminBadge kind="accent">Aceita</AdminBadge>;
        if (r.status === "rejected") return <AdminBadge kind="error">Rejeitada</AdminBadge>;
        if (r.status === "expired") return <AdminBadge kind="neutral">Expirada</AdminBadge>;
        return <AdminBadge kind="neutral">Sugerida</AdminBadge>;
      },
    },
  ];
  return (
    <AdminTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.id}
      empty={
        <AdminEmptyState
          title="Sem análises ainda"
          body="Quando houver evento relevante e preço base configurado, as análises aparecem aqui."
        />
      }
    />
  );
}

function NearbyEventsTable({ rows }: { rows: EventRow[] }) {
  const cols: AdminTableColumn<EventRow>[] = [
    {
      key: "nome",
      header: "Evento",
      render: (e) => (
        <span className={styles.labelFs13W500}>{e.nome}</span>
      ),
    },
    {
      key: "data",
      header: "Data",
      width: 110,
      render: (e) => (
        <span className={styles.labelTextMutedFs12Mono}>
          {new Date(e.dataInicio).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
    {
      key: "cidade",
      header: "Cidade",
      width: 120,
      render: (e) => (
        <span className={styles.labelTextMutedFs122}>
          {e.cidade ? `${e.cidade}/${e.estado ?? ""}` : "—"}
        </span>
      ),
    },
    {
      key: "dist",
      header: "Distância",
      align: "right",
      width: 100,
      render: (e) =>
        e.distanciaMetros != null ? (
          <span className={styles.labelTextMono}>
            {(Number(e.distanciaMetros) / 1000).toFixed(1)} km
          </span>
        ) : (
          <span className={styles.labelTextDim}>—</span>
        ),
    },
    {
      key: "rel",
      header: "Relevância",
      align: "center",
      width: 110,
      render: (e) => {
        if (e.relevancia == null) return <span className={styles.labelTextDim}>—</span>;
        const r = Number(e.relevancia);
        let kind: AdminBadgeKind = "neutral";
        if (r >= 80) kind = "accent";
        else if (r >= 60) kind = "warn";
        return <AdminBadge kind={kind}>{r}</AdminBadge>;
      },
    },
  ];
  return (
    <AdminTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.id}
      empty={
        <AdminEmptyState
          title="Nenhum evento no raio"
          body="O motor procura eventos a até 8km. Verifique se há coordenadas configuradas + cobertura geográfica ativa."
        />
      }
    />
  );
}

function PricingHistoryTable({ rows }: { rows: PricingInputHistory[] }) {
  const cols: AdminTableColumn<PricingInputHistory>[] = [
    {
      key: "data",
      header: "Quando",
      width: 160,
      render: (r) => (
        <span className={styles.labelTextMutedFs12Mono}>
          {new Date(r.createdAt).toLocaleString("pt-BR")}
        </span>
      ),
    },
    {
      key: "diária",
      header: "Diária base",
      align: "right",
      width: 220,
      render: (r) => (
        <span className={styles.labelFs12}>
          <span className={styles.labelTextDim}>
            {r.previousManualDailyPrice
              ? `R$ ${Number(r.previousManualDailyPrice).toLocaleString("pt-BR")}`
              : "—"}
          </span>
          <span className={styles.labelTextDimM0x8}>→</span>
          <span className={styles.labelAccentW6002}>
            {r.newManualDailyPrice
              ? `R$ ${Number(r.newManualDailyPrice).toLocaleString("pt-BR")}`
              : "—"}
          </span>
        </span>
      ),
    },
    {
      key: "receita",
      header: "Receita média/mês",
      align: "right",
      width: 240,
      render: (r) => (
        <span className={styles.labelFs12}>
          <span className={styles.labelTextDim}>
            {r.previousAverageMonthlyRevenue
              ? `R$ ${Number(r.previousAverageMonthlyRevenue).toLocaleString("pt-BR")}`
              : "—"}
          </span>
          <span className={styles.labelTextDimM0x8}>→</span>
          <span className={styles.labelTextW500}>
            {r.newAverageMonthlyRevenue
              ? `R$ ${Number(r.newAverageMonthlyRevenue).toLocaleString("pt-BR")}`
              : "—"}
          </span>
        </span>
      ),
    },
  ];
  return (
    <AdminTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.id}
      empty={
        <AdminEmptyState
          title="Sem histórico de alteração"
          body="Quando o anfitrião alterar diária base ou receita média, fica registrado aqui."
        />
      }
    />
  );
}
