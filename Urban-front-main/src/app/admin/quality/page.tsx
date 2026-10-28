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
  type PropertyDropdown,
} from "../../service/api";
import PropertySelect from "../../componentes/PropertySelect";
import { formatLocalDate } from "../../lib/date";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminBadge,
  AdminStatusDot,
  AdminInput,
  AdminSelect,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
  useAdminToast,
} from "../_components";
import styles from "./page.module.css";

type OccupancyStatus = "booked" | "available" | "blocked" | "unknown";

const statusOptions: Array<{ value: OccupancyStatus; label: string }> = [
  { value: "available", label: "Disponível" },
  { value: "booked", label: "Reservado" },
  { value: "blocked", label: "Bloqueado" },
  { value: "unknown", label: "Desconhecido" },
];

/**
 * /admin/quality — MAPE + cobertura de ocupação.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero KPI: MAPE atual em Archivo (display) gigante com cor por threshold.
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
  const [recordDate, setRecordDate] = useState(() => formatLocalDate(new Date()));
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

  const propertyPickerOptions = useMemo<PropertyDropdown[]>(
    () =>
      properties.map((property) => ({
        id: property.listId,
        propertyName: property.title || property.airbnbListingId || property.listId,
        nome: property.title || property.airbnbListingId || property.listId,
        userId: property.userId ?? "",
        analisado: "completed",
        image_url: "",
        latitude: 0,
        longitude: 0,
        id_do_anuncio: property.airbnbListingId ?? undefined,
        internalCode: property.userEmail,
        bairro: property.neighborhood,
        cidade: property.city,
        estado: property.state,
        locationLabel: [property.neighborhood, property.city, property.state].filter(Boolean).join(", "),
        manualDailyPrice: property.manualDailyPrice,
        dailyPrice: property.dailyPrice,
        averageMonthlyRevenue: property.averageMonthlyRevenue,
        pricingInputsUpdatedAt: null,
      })),
    [properties],
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
      toast.error("Selecione um imóvel.");
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
      toast.error(e?.response?.data?.message || e?.message || "Erro ao salvar ocupação.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminPageLoading />;

  if (error) {
    return (
      <div className={styles.pageContainer}>
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
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · QUALIDADE"
        title="Qualidade da IA + ocupação"
        subtitle="MAPE sobre preço aplicado real e cobertura de histórico de ocupação."
      />

      {/* === Hero KPI: MAPE === */}
      {quality && (
        <section className={styles.section}>
          {quality.sampleSize === 0 ? (
            <div
              className={styles.emptyNotice}
            >
              <p
                className={styles.emptyNoticeTitle}
              >
                Sem amostras
              </p>
              <p className={styles.emptyNoticeBody}>
                Sem dados de preço aplicado real ainda. O ground truth comeca a
                entrar quando anfitriões confirmarem o preço aplicado ou quando
                o push automático Stays gravar o resultado. Janela:{" "}
                {quality.windowDays} dias.
              </p>
            </div>
          ) : (
            <AdminCard variant="accent" className={styles.heroCard}>
              <div
                className={styles.heroGrid}
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
                    className={styles.heroDescription}
                  >
                    Alvo {"<="} {mapeThreshold}% · backtest sobre preço aplicado
                    real {"vs"} sugestão.
                  </p>
                </div>
                <div
                  className={styles.heroStats}
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
              className={styles.gateBar}
            >
              <AdminStatusDot
                kind={quality.qualityGate.passes ? "success" : "warn"}
                size={10}
              />
              <div className={styles.gateContent}>
                <p
                  className={styles.gateTitle}
                >
                  Gate de qualidade:{" "}
                  {quality.qualityGate.passes ? "aprovado" : "ainda não atingido"}
                </p>
                <p
                  className={styles.gateDescription}
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

      {/* === Cobertura de ocupação === */}
      <section className={styles.section}>
        <header
          className={styles.breakdownHeader}
        >
          <div>
            <p className="urban-admin-eyebrow">COBERTURA DE OCUPAÇÃO</p>
            <h2
              className={styles.breakdownTitle}
            >
              {occupancy?.distinctListings ?? 0} listings com histórico
            </h2>
          </div>
          <AdminBadge kind="neutral">{properties.length} imóveis elegíveis</AdminBadge>
        </header>

        <div
          className={styles.breakdownGrid}
        >
          <AdminCard variant="subtle">
            <AdminCardHeader title="Por status" />
            {!occupancy || occupancy.byStatus.length === 0 ? (
              <p className={styles.emptyHint}>
                Sem registros. Use o apontamento manual abaixo para iniciar o
                histórico real.
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
              <p className={styles.emptyHint}>
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
        <p className={`urban-admin-eyebrow ${styles.formEyebrow}`}>
          APONTAMENTO MANUAL
        </p>
        <h2
          className={styles.formTitle}
        >
          Registrar ocupação
        </h2>
        <p
          className={styles.formIntro}
        >
          Use para registrar observações reais do alpha: disponibilidade,
          reserva, diária anunciada e receita realizada por dia. Registros
          booked/available entram no treino.
        </p>

        <AdminCard variant="subtle">
          <form
            onSubmit={handleSubmit}
            className={styles.occupancyForm}
          >
            <div className={styles.propertyField}>
              <span
                className={styles.fieldLabel}
              >
                Imóvel
              </span>
              <PropertySelect
                value={selectedListId}
                propsInfo={propertyPickerOptions}
                setPropertyId={setSelectedListId}
                disabled={properties.length === 0}
                placeholder={properties.length === 0 ? "Nenhum imóvel elegível" : "Buscar imóvel"}
                maxWidth="100%"
              />
            </div>

            <div
              className={styles.formFields}
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
                label="Diária anunciada"
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
                className={styles.propertyInfo}
              >
                <strong className={styles.strongText}>
                  {selectedProperty.title || "Imóvel sem título"}
                </strong>
                <span className={styles.propertyMeta}>
                  {selectedProperty.city || "cidade n/d"} /{" "}
                  {selectedProperty.state || "UF n/d"}
                </span>
                <span className={styles.propertyMeta}>
                  Receita média mensal:{" "}
                  {selectedProperty.averageMonthlyRevenue != null
                    ? `R$ ${selectedProperty.averageMonthlyRevenue}`
                    : "n/d"}
                </span>
              </div>
            )}

            <div className={styles.formActions}>
              <AdminButton
                variant="primary"
                type="submit"
                disabled={properties.length === 0}
                loading={saving}
              >
                {saving ? "Salvando…" : "Salvar ocupação"}
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
        className={styles.statValue}
      >
        {value}
      </p>
      {sub && (
        <p className={styles.statSub}>
          {sub}
        </p>
      )}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  if (rows.length === 0) {
    return (
      <p className={styles.barListEmpty}>
        Sem dados.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul
      className={styles.barList}
    >
      {rows.map((r) => (
        <li key={r.label}>
          <div
            className={styles.barRow}
          >
            <code className={styles.strongText}>{r.label}</code>
            <span className={styles.barValue}>
              {r.value.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className={styles.barTrack}>
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
