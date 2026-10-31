"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchMarketHealth,
  importLicensedDataset,
  type LicensedDatasetImportResult,
  type MarketHealthNeighborhood,
  type MarketHealthReport,
  type MarketHealthSource,
  type MarketUploadLicense,
} from "../../service/api";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminSelect,
  AdminTable,
  AdminTextarea,
  Icons,
  useAdminToast,
  type AdminTableColumn,
} from "../_components";
import { formatLocalDate } from "../../lib/date";
import {
  coverageMeta,
  EMPTY_UPLOAD_FORM,
  formatDay,
  hasUploadErrors,
  LICENSE_OPTIONS,
  licenseLabel,
  marketHints,
  sourceShortLabel,
  sourceStatusMeta,
  validateUpload,
  type UploadForm,
} from "./market-sources-domain";
import styles from "./page.module.css";

/**
 * /admin/market-sources — saúde das fontes de mercado por bairro e upload do dataset licenciado
 * (ADR 0028): volume por fonte e bairro, última atualização, cobertura de imóveis com comp set
 * suficiente e importações recentes. A coleta própria aparece desligada (parecer jurídico).
 */
export default function AdminMarketSourcesPage() {
  const [report, setReport] = useState<MarketHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UploadForm>(EMPTY_UPLOAD_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<LicensedDatasetImportResult | null>(null);
  const toast = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchMarketHealth());
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = formatLocalDate(new Date());
  const errors = useMemo(() => validateUpload(form, today), [form, today]);
  const shownErrors = submitted ? errors : {};
  const license = LICENSE_OPTIONS.find((option) => option.value === form.license);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasUploadErrors(errors) || !form.file || uploading) return;
    setUploading(true);
    setResult(null);
    try {
      const imported = await importLicensedDataset({
        file: form.file,
        datasetLabel: form.datasetLabel,
        city: form.city,
        license: form.license as MarketUploadLicense,
        collectedAt: form.collectedAt,
        mapping: form.mapping,
      });
      setResult(imported);
      toast.success(`Import concluído: ${imported.imported} anúncios, ${imported.observations} observações.`);
      setSubmitted(false);
      setForm({ ...EMPTY_UPLOAD_FORM, city: form.city });
      void load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } }; message?: string };
      const message = e?.response?.data?.message;
      toast.error((Array.isArray(message) ? message.join("; ") : message) ?? e?.message ?? "Erro ao importar o dataset.");
    } finally {
      setUploading(false);
    }
  }

  if (loading && !report) return <AdminPageLoading />;

  if (error || !report) {
    return (
      <div className={styles.pageContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error ?? "Sem dados."}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={load}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const coverage = coverageMeta(report.coverage);
  const hints = marketHints(report);

  const sourceColumns: AdminTableColumn<MarketHealthSource>[] = [
    { key: "label", header: "Fonte", render: (s) => <span className={styles.strong}>{s.label}</span> },
    {
      key: "status",
      header: "Estado",
      width: 150,
      render: (s) => {
        const meta = sourceStatusMeta(s);
        return <AdminBadge kind={meta.badge}>{meta.label}</AdminBadge>;
      },
    },
    {
      key: "listings",
      header: "Anúncios / imóveis",
      width: 150,
      align: "right",
      render: (s) => <span className={styles.num}>{s.listings.toLocaleString("pt-BR")}</span>,
    },
    {
      key: "last",
      header: "Última coleta",
      width: 130,
      render: (s) => <span className={styles.muted}>{s.id === "customers" ? "ao vivo" : formatDay(s.lastCollectedAt)}</span>,
    },
    { key: "detail", header: "Detalhe", render: (s) => <span className={styles.muted}>{sourceStatusMeta(s).detail}</span> },
  ];

  const neighborhoodColumns: AdminTableColumn<MarketHealthNeighborhood>[] = [
    { key: "source", header: "Fonte", width: 170, render: (n) => sourceShortLabel(n.source) },
    { key: "city", header: "Cidade", width: 160, render: (n) => <span className={styles.muted}>{n.city}</span> },
    { key: "neighborhood", header: "Bairro", render: (n) => n.neighborhood ?? "(sem bairro)" },
    {
      key: "listings",
      header: "Volume",
      width: 120,
      align: "right",
      render: (n) => (
        <span className={styles.num}>
          {n.listings.toLocaleString("pt-BR")}
          {n.hosts != null ? ` · ${n.hosts} anf.` : ""}
        </span>
      ),
    },
    { key: "last", header: "Coleta", width: 120, render: (n) => <span className={styles.muted}>{formatDay(n.lastCollectedAt)}</span> },
  ];

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · MERCADO POR BAIRRO"
        title="Fontes de mercado"
        subtitle="De onde vêm os comparáveis que o anfitrião vê: clientes My Urban, dataset licenciado e Inside Airbnb. Mínimos de privacidade por env."
        actions={
          <AdminButton variant="secondary" onClick={load} disabled={loading} leftIcon={<Icons.RefreshCw size={12} />}>
            {loading ? "Atualizando…" : "Atualizar"}
          </AdminButton>
        }
      />

      <section className={styles.section} aria-label="Cobertura de comp set">
        <AdminCard variant="accent">
          <div className={styles.headline}>
            <div className={styles.headlineMain}>
              <p className="urban-admin-eyebrow">IMÓVEIS ATIVOS COM COMP SET SUFICIENTE</p>
              <div className={styles.headlineValue}>
                <span className={styles.headlineNumber}>{coverage.pctText}</span>
                <span className={styles.muted}>meta {coverage.targetText}</span>
              </div>
              <div>
                <AdminBadge kind={coverage.badge}>{coverage.label}</AdminBadge>
              </div>
              <p className={styles.muted}>{coverage.summary}</p>
              <p className={styles.muted}>
                Mínimos: {report.config.minHosts} anfitriões distintos (clientes) ou {report.config.minExternalListings} anúncios
                distintos (externas); dado externo vale por até {report.config.externalMaxAgeDays} dias.
              </p>
            </div>
            <div className={styles.kpis}>
              <AdminMetricCard label="Imóveis ativos" value={report.coverage.activeProperties} />
              <AdminMetricCard label="Avaliados" value={report.coverage.sampled} />
              <AdminMetricCard label="Com comp set" value={report.coverage.withSufficientCompSet} accent />
            </div>
          </div>
        </AdminCard>
      </section>

      <section className={styles.section} aria-label="Por fonte">
        <p className={`urban-admin-eyebrow ${styles.sectionTitle}`}>POR FONTE</p>
        <AdminTable
          columns={sourceColumns}
          rows={report.sources}
          rowKey={(s) => s.id}
          empty={<AdminEmptyState eyebrow="Sem dados" title="Nenhuma fonte configurada" />}
        />
      </section>

      <section className={styles.section} aria-label="O que fazer">
        <p className={`urban-admin-eyebrow ${styles.sectionTitle}`}>O QUE FAZER</p>
        {hints.length === 0 ? (
          <AdminCard variant="subtle">
            <p className={styles.muted}>Nada a fazer: fontes atualizadas e cobertura na meta.</p>
          </AdminCard>
        ) : (
          <ul className={styles.hints}>
            {hints.map((hint) => (
              <li key={hint}>
                <AdminCard variant="subtle">
                  <p className={styles.muted}>{hint}</p>
                </AdminCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-label="Volume por bairro">
        <p className={`urban-admin-eyebrow ${styles.sectionTitle}`}>VOLUME POR FONTE E BAIRRO</p>
        <AdminTable
          columns={neighborhoodColumns}
          rows={report.neighborhoods}
          rowKey={(n) => `${n.source}|${n.city}|${n.neighborhood ?? ""}`}
          empty={<AdminEmptyState eyebrow="Sem dados" title="Nenhum anúncio ou imóvel por bairro ainda" />}
        />
      </section>

      <section className={styles.section} aria-label="Enviar dataset licenciado">
        <p className={`urban-admin-eyebrow ${styles.sectionTitle}`}>ENVIAR DATASET LICENCIADO (CSV)</p>
        <form onSubmit={handleSubmit} noValidate>
          <AdminCard variant="subtle">
            <AdminCardHeader eyebrow="UPLOAD" title="Dataset de fornecedor" />
            <p className={styles.muted}>
              Converta Parquet para CSV antes de enviar. Máx. 25 MB. A licença define se o dado pode ser mostrado ao anfitrião.
            </p>
            <div className={styles.uploadForm}>
              <AdminInput
                label="Arquivo CSV"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                error={shownErrors.file}
              />
              <div className={styles.uploadGrid}>
                <AdminInput
                  label="Fornecedor (rótulo)"
                  value={form.datasetLabel}
                  onChange={(e) => setForm({ ...form, datasetLabel: e.target.value.toLowerCase() })}
                  placeholder="airroi"
                  helper="Vira a origem do dado (licensed:airroi)."
                  error={shownErrors.datasetLabel}
                />
                <AdminInput
                  label="Mercado (cidade)"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value.toLowerCase() })}
                  placeholder="sao-paulo"
                  error={shownErrors.city}
                />
                <AdminInput
                  label="Data de coleta do arquivo"
                  type="date"
                  max={today}
                  value={form.collectedAt}
                  onChange={(e) => setForm({ ...form, collectedAt: e.target.value })}
                  error={shownErrors.collectedAt}
                />
                <AdminSelect
                  label="Licença contratada"
                  value={form.license}
                  onChange={(e) => setForm({ ...form, license: e.target.value })}
                  helper={license?.help}
                  error={shownErrors.license}
                >
                  <option value="">Selecione…</option>
                  {LICENSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <AdminTextarea
                label="Mapeamento de colunas (opcional, JSON)"
                value={form.mapping}
                onChange={(e) => setForm({ ...form, mapping: e.target.value })}
                rows={3}
                placeholder='{"externalId":"id","adr":"preco_diaria","adrUnit":"reais","occupancy":"ocupacao","observedDate":"data"}'
                helper="Sem mapeamento, usa os cabeçalhos padrão: listing_id, latitude, longitude, adr, occupancy, date, neighborhood, room_type, bedrooms, accommodates, airbnb_listing_id."
                error={shownErrors.mapping}
              />
              <div className={styles.uploadActions}>
                <AdminButton type="submit" variant="primary" size="lg" loading={uploading} leftIcon={<Icons.Upload size={13} />}>
                  {uploading ? "Importando…" : "Importar dataset"}
                </AdminButton>
                {submitted && hasUploadErrors(errors) ? (
                  <span role="alert" className={styles.errorText}>
                    Corrija os campos destacados para importar.
                  </span>
                ) : null}
              </div>
            </div>
          </AdminCard>
        </form>

        {result ? (
          <div className={styles.result} role="status">
            <AdminCard variant="subtle">
              <AdminCardHeader eyebrow="ÚLTIMA IMPORTAÇÃO" title={result.source} />
              <div className={styles.resultGrid}>
                <AdminMetricCard label="Linhas lidas" value={result.parsed} />
                <AdminMetricCard label="Anúncios" value={result.imported} status={result.imported > 0 ? "success" : "error"} />
                <AdminMetricCard label="Observações" value={result.observations} />
                <AdminMetricCard label="Puladas" value={result.skipped} status={result.skipped > 0 ? "warn" : undefined} />
              </div>
              {Object.keys(result.skippedReasons).length ? (
                <ul className={styles.reasons}>
                  {Object.entries(result.skippedReasons).map(([reason, count]) => (
                    <li key={reason}>
                      {count} linha(s): {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {result.warnings.map((warning) => (
                <p key={warning} className={styles.muted}>
                  {warning}
                </p>
              ))}
            </AdminCard>
          </div>
        ) : null}
      </section>

      <section className={styles.section} aria-label="Importações recentes">
        <p className={`urban-admin-eyebrow ${styles.sectionTitle}`}>IMPORTAÇÕES RECENTES</p>
        {report.recentImports.length === 0 ? (
          <AdminCard variant="subtle">
            <p className={styles.muted}>Nenhuma importação registrada ainda.</p>
          </AdminCard>
        ) : (
          <AdminTable
            columns={[
              { key: "when", header: "Quando", width: 150, render: (i) => new Date(i.createdAt).toLocaleString("pt-BR") },
              { key: "source", header: "Origem", render: (i) => <span className={styles.strong}>{i.source}</span> },
              { key: "license", header: "Licença", width: 200, render: (i) => <AdminBadge kind="neutral">{licenseLabel(i.license)}</AdminBadge> },
              { key: "collected", header: "Coleta", width: 110, render: (i) => formatDay(i.collectedAt) },
              {
                key: "rows",
                header: "Anúncios / puladas",
                width: 150,
                align: "right",
                render: (i) => `${i.rowsImported.toLocaleString("pt-BR")} / ${i.rowsSkipped.toLocaleString("pt-BR")}`,
              },
            ]}
            rows={report.recentImports}
            rowKey={(i) => i.id}
          />
        )}
        <p className={`${styles.muted} ${styles.footnote}`}>Atualizado em {new Date(report.generatedAt).toLocaleString("pt-BR")}.</p>
      </section>
    </div>
  );
}
