"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchAdminPricingQuality,
  fetchAdminOccupancy,
  fetchAdminOccupancyProperties,
  upsertAdminManualOccupancy,
  type AdminOccupancyProperty,
  type AdminPricingQuality,
  type AdminOccupancyCoverage,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminMetricCard,
  AdminBadge,
  AdminStatusDot,
  AdminInput,
  AdminSelect,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
  useAdminToast,
} from "../_components";

type OccupancyStatus = "booked" | "available" | "blocked" | "unknown";

const statusOptions: Array<{ value: OccupancyStatus; label: string }> = [
  { value: "available", label: "Disponivel" },
  { value: "booked", label: "Reservado" },
  { value: "blocked", label: "Bloqueado" },
  { value: "unknown", label: "Desconhecido" },
];

/**
 * /admin/quality — MAPE + cobertura de ocupacao.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero KPI: MAPE atual em Bebas Neue gigante com cor por threshold.
 *  - Sub-stats em grid (RMSE, mediana, amostras).
 *  - Gate de qualidade com AdminStatusDot.
 *  - BarList branco/orange para por status e por origem.
 *  - Form de apontamento manual com AdminInput/AdminSelect.
 *  - "← Voltar" removido (AdminShell tem breadcrumb).
 */
export default function AdminQualityPage() {
  const [quality, setQuality] = useState<AdminPricingQuality | null>(null);
  const [occupancy, setOccupancy] = useState<AdminOccupancyCoverage | null>(null);
  const [properties, setProperties] = useState<AdminOccupancyProperty[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordStatus, setRecordStatus] = useState<OccupancyStatus>("available");
  const [listedPrice, setListedPrice] = useState("");
  const [realRevenue, setRealRevenue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useAdminToast();

  const selectedProperty = useMemo(
    () => properties.find((property) => property.listId === selectedListId) ?? null,
    [properties, selectedListId],
  );

  useEffect(() => {
    Promise.all([
      fetchAdminPricingQuality(),
      fetchAdminOccupancy(),
      fetchAdminOccupancyProperties(),
    ])
      .then(([q, o, p]) => {
        setQuality(q);
        setOccupancy(o);
        setProperties(p);
        const first = p[0];
        if (first) {
          setSelectedListId(first.listId);
          setListedPrice(formatMoneyInput(first.manualDailyPrice ?? first.dailyPrice));
        }
      })
      .catch((err: unknown) => {
        const e = err as { response?: { status?: number }; message?: string };
        const status = e?.response?.status;
        setError(
          status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProperty) return;
    setListedPrice(formatMoneyInput(selectedProperty.manualDailyPrice ?? selectedProperty.dailyPrice));
  }, [selectedProperty]);

  async function refreshOccupancy() {
    const [coverage, propertyList] = await Promise.all([
      fetchAdminOccupancy(),
      fetchAdminOccupancyProperties(),
    ]);
    setOccupancy(coverage);
    setProperties(propertyList);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListId) {
      toast.error("Selecione um imovel.");
      return;
    }
    if (!recordDate) {
      toast.error("Informe a data observada.");
      return;
    }

    setSaving(true);
    try {
      const listedPriceCents = moneyToCents(listedPrice);
      const revenueCents = moneyToCents(realRevenue);
      const result = await upsertAdminManualOccupancy({
        listId: selectedListId,
        date: recordDate,
        status: recordStatus,
        listedPriceCents,
        revenueCents,
        currency: "BRL",
      });
      await refreshOccupancy();
      toast.success(
        `Registro ${result.status} salvo para ${recordDate}. Training: ${
          result.trainingReady ? "pronto" : "fora do treino"
        }.`,
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message || e?.message || "Erro ao salvar ocupacao.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminPageLoading />;

  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
        />
      </div>
    );
  }

  const mape = quality?.mapePercent ?? null;
  const mapeThreshold = quality?.qualityGate.threshold ?? 20;
  const mapeColor =
    mape == null
      ? "var(--admin-text)"
      : mape <= mapeThreshold
        ? "var(--admin-success)"
        : mape <= mapeThreshold * 1.5
          ? "var(--admin-warning)"
          : "var(--admin-danger)";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · QUALIDADE"
        title="Qualidade da IA + ocupacao"
        subtitle="MAPE sobre preco aplicado real e cobertura de historico de ocupacao."
      />

      {/* === Hero KPI: MAPE === */}
      {quality && (
        <section style={{ marginBottom: 56 }}>
          {quality.sampleSize === 0 ? (
            <div
              style={{
                padding: "20px 24px",
                borderLeft: "2px solid var(--admin-warning)",
                background: "rgba(245, 181, 71, 0.06)",
                fontSize: 14,
                color: "var(--admin-text-muted)",
                lineHeight: 1.55,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--admin-warning)",
                }}
              >
                Sem amostras
              </p>
              <p style={{ margin: "6px 0 0" }}>
                Sem dados de preco aplicado real ainda. O ground truth comeca a
                entrar quando anfitrioes confirmarem o preco aplicado ou quando
                o push automatico Stays gravar o resultado. Janela:{" "}
                {quality.windowDays} dias.
              </p>
            </div>
          ) : (
            <AdminCard variant="accent" style={{ padding: "40px 40px 36px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                  gap: 32,
                  alignItems: "end",
                }}
              >
                <div>
                  <p className="urban-admin-eyebrow">
                    MAPE (ULTIMOS {quality.windowDays} DIAS)
                  </p>
                  <p
                    className="urban-admin-display-hero"
                    style={{ marginTop: 12, color: mapeColor }}
                  >
                    {mape != null ? `${mape}%` : "—"}
                  </p>
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: 14,
                      color: "var(--admin-text-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    Alvo {"<="} {mapeThreshold}% · backtest sobre preco aplicado
                    real {"vs"} sugestao.
                  </p>
                </div>
                <div
                  style={{
                    borderLeft: "1px solid var(--admin-divider)",
                    paddingLeft: 32,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <SmallInline
                    label="RMSE"
                    value={quality.rmse != null ? `R$ ${quality.rmse}` : "—"}
                  />
                  <SmallInline
                    label="Erro mediano"
                    value={
                      quality.medianAbsoluteError != null
                        ? `R$ ${quality.medianAbsoluteError}`
                        : "—"
                    }
                  />
                  <SmallInline
                    label="Amostras"
                    value={String(quality.sampleSize)}
                    sub={
                      quality.discarded > 0
                        ? `${quality.discarded} descartadas`
                        : undefined
                    }
                  />
                </div>
              </div>
            </AdminCard>
          )}

          {/* Gate */}
          {quality.sampleSize > 0 && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                border: "1px solid var(--admin-divider)",
                borderRadius: 2,
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <AdminStatusDot
                kind={quality.qualityGate.passes ? "success" : "warn"}
                size={10}
              />
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--admin-text)",
                  }}
                >
                  Gate de qualidade:{" "}
                  {quality.qualityGate.passes ? "aprovado" : "ainda nao atingido"}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "var(--admin-text-muted)",
                  }}
                >
                  Criterio: MAPE {"<="} {quality.qualityGate.threshold}% AND
                  amostras {">="} 30.
                  {!quality.qualityGate.meetsMinSample && " Falta amostragem minima."}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* === Cobertura de ocupacao === */}
      <section style={{ marginBottom: 56 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="urban-admin-eyebrow">COBERTURA DE OCUPACAO</p>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--admin-text)",
                margin: "8px 0 0",
                letterSpacing: -0.3,
              }}
            >
              {occupancy?.distinctListings ?? 0} listings com historico
            </h2>
          </div>
          <AdminBadge kind="neutral">{properties.length} imoveis elegiveis</AdminBadge>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}
        >
          <AdminCard variant="subtle">
            <AdminCardHeader title="Por status" />
            {!occupancy || occupancy.byStatus.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
                Sem registros. Use o apontamento manual abaixo para iniciar o
                historico real.
              </p>
            ) : (
              <BarList
                rows={occupancy.byStatus.map((r) => ({ label: r.status, value: r.count }))}
              />
            )}
          </AdminCard>
          <AdminCard variant="subtle">
            <AdminCardHeader title="Por origem" />
            {!occupancy || occupancy.byOrigin.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
                Sem origens registradas ainda.
              </p>
            ) : (
              <BarList
                rows={occupancy.byOrigin.map((r) => ({ label: r.origin, value: r.count }))}
              />
            )}
          </AdminCard>
        </div>
      </section>

      {/* === Apontamento manual === */}
      <section>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 12 }}>
          APONTAMENTO MANUAL
        </p>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--admin-text)",
            margin: "0 0 8px",
            letterSpacing: -0.3,
          }}
        >
          Registrar ocupacao
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--admin-text-muted)",
            margin: "0 0 24px",
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Use para registrar observacoes reais do alpha: disponibilidade,
          reserva, diaria anunciada e receita realizada por dia. Registros
          booked/available entram no treino.
        </p>

        <AdminCard variant="subtle">
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <AdminSelect
              label="Imovel"
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
            >
              {properties.length === 0 && <option value="">Nenhum imovel elegivel</option>}
              {properties.map((property) => (
                <option key={property.listId} value={property.listId}>
                  {property.title || property.airbnbListingId || property.listId}
                  {property.userEmail ? ` — ${property.userEmail}` : ""}
                </option>
              ))}
            </AdminSelect>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14,
              }}
            >
              <AdminInput
                label="Data observada"
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
              />

              <AdminSelect
                label="Status"
                value={recordStatus}
                onChange={(e) => setRecordStatus(e.target.value as OccupancyStatus)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>

              <AdminInput
                label="Diaria anunciada"
                inputMode="decimal"
                placeholder="150,00"
                value={listedPrice}
                onChange={(e) => setListedPrice(e.target.value)}
              />

              <AdminInput
                label="Receita real do dia"
                inputMode="decimal"
                placeholder="150,00"
                value={realRevenue}
                onChange={(e) => setRealRevenue(e.target.value)}
              />
            </div>

            {selectedProperty && (
              <div
                style={{
                  padding: "12px 16px",
                  border: "1px solid var(--admin-divider)",
                  borderRadius: 2,
                  background: "rgba(255, 255, 255, 0.02)",
                  fontSize: 12,
                  color: "var(--admin-text-muted)",
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: "var(--admin-text)" }}>
                  {selectedProperty.title || "Imovel sem titulo"}
                </strong>
                <span style={{ marginLeft: 12 }}>
                  {selectedProperty.city || "cidade n/d"} /{" "}
                  {selectedProperty.state || "UF n/d"}
                </span>
                <span style={{ marginLeft: 12 }}>
                  Receita media mensal:{" "}
                  {selectedProperty.averageMonthlyRevenue != null
                    ? `R$ ${selectedProperty.averageMonthlyRevenue}`
                    : "n/d"}
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <AdminButton
                variant="primary"
                type="submit"
                disabled={properties.length === 0}
                loading={saving}
              >
                {saving ? "Salvando…" : "Salvar ocupacao"}
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      </section>
    </div>
  );
}

function SmallInline({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--admin-text)",
          margin: "6px 0 0",
          fontFamily: "monospace",
          letterSpacing: -0.3,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0 }}>
        Sem dados.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {rows.map((r) => (
        <li key={r.label}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 5,
            }}
          >
            <code style={{ color: "var(--admin-text)" }}>{r.label}</code>
            <span style={{ color: "var(--admin-accent)", fontWeight: 600, fontFamily: "monospace" }}>
              {r.value.toLocaleString("pt-BR")}
            </span>
          </div>
          <div style={{ height: 2, background: "var(--admin-divider)" }}>
            <div
              style={{
                height: "100%",
                width: `${(r.value / max) * 100}%`,
                background: "var(--admin-accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatMoneyInput(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return String(Number(value));
}

function moneyToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
