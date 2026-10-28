"use client";

import { useState } from "react";
import { importCsvEvents } from "../../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminBadge,
  AdminEmptyState,
  useAdminToast,
  Icons,
} from "../../_components";
import styles from "./page.module.css";

/**
 * /admin/events/import — Camada 3 (F6.2 Plus): import semestral em CSV.
 *
 * Migrado para design system admin (.urban-admin):
 *  - File input estilizado com label uppercase + bordas admin.
 *  - Resumos parsed/criados/atualizados como AdminMetricCard.
 *  - Tabela de "Resumo por source" via AdminTable.
 *  - alert()/erros → toast.
 *  - CTA "Importar" via AdminButton primary com loading.
 */

const CSV_TEMPLATE = `nome,dataInicio,dataFim,enderecoCompleto,cidade,estado,latitude,longitude,categoria,venueType,venueCapacity,expectedAttendance,linkSiteOficial,descricao
"Congresso de Turismo SP","2026-06-18T09:00:00","2026-06-20T18:00:00","São Paulo Expo, SP","São Paulo","SP","-23.6258","-46.6469","conferencia","convention_center","90000","25000","","Evento curado manualmente para importacao operacional"
"Final regional de futebol","2026-06-27T16:00:00","","Allianz Parque","São Paulo","SP","-23.5275","-46.6783","esporte","stadium","43713","40000","",""`;

const BETA_IMPORT_TARGET = 100;

interface ImportResult {
  parsedRows: number;
  invalidRows: Array<{ line: number; reason: string }>;
  ingest: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    bySource: Record<
      string,
      { created: number; updated: number; skipped: number }
    >;
  };
}

type SourceAggRow = {
  source: string;
  created: number;
  updated: number;
  skipped: number;
};

export default function ImportarCsvEventos() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const toast = useAdminToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || submitting) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo > 5MB. Divida em partes menores.");
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const r = await importCsvEvents(file, sourceLabel || undefined);
      setResult(r);
      toast.success(
        `Import concluído: ${r.ingest.created} criados, ${r.ingest.updated} atualizados.`,
      );
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        e?.response?.data?.message ?? e?.message ?? "Erro ao processar CSV.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "urban-ai-events-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const sourceColumns: AdminTableColumn<SourceAggRow>[] = [
    {
      key: "source",
      header: "Source",
      render: (r) => (
        <span
          className={styles.sourceName}
        >
          {r.source}
        </span>
      ),
    },
    {
      key: "created",
      header: "Criados",
      width: 110,
      align: "right",
      render: (r) => (
        <span
          style={{
            fontFamily: "monospace",
            color: r.created > 0 ? "var(--admin-success)" : "var(--admin-text-dim)",
          }}
        >
          {r.created.toLocaleString("pt-BR")}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Atualizados",
      width: 120,
      align: "right",
      render: (r) => (
        <span
          style={{
            fontFamily: "monospace",
            color: r.updated > 0 ? "var(--admin-accent)" : "var(--admin-text-dim)",
          }}
        >
          {r.updated.toLocaleString("pt-BR")}
        </span>
      ),
    },
    {
      key: "skipped",
      header: "Skipados",
      width: 110,
      align: "right",
      render: (r) => (
        <span
          style={{
            fontFamily: "monospace",
            color: r.skipped > 0 ? "var(--admin-danger)" : "var(--admin-text-dim)",
          }}
        >
          {r.skipped.toLocaleString("pt-BR")}
        </span>
      ),
    },
  ];

  const sourceRows: SourceAggRow[] = result
    ? Object.entries(result.ingest.bySource).map(([source, agg]) => ({
        source,
        ...agg,
      }))
    : [];

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · EVENTOS"
        title="Importar CSV"
        subtitle={
          <>
            Camada 3 — curadoria humana em lote. Max 1000 linhas, 5MB. Source:{" "}
            <code>admin-csv-import</code> (override via campo opcional).
          </>
        }
        actions={
          <AdminButton
            variant="secondary"
            as="a"
            href="/admin/events/new"
            leftIcon={<Icons.ArrowLeft size={11} />}
          >
            Cadastrar 1 evento
          </AdminButton>
        }
      />

      {/* Schema esperado */}
      <AdminCard variant="subtle" className={styles.schemaCard}>
        <AdminCardHeader
          eyebrow="SCHEMA"
          title="Estrutura do CSV"
          actions={
            <AdminButton
              variant="secondary"
              size="sm"
              onClick={downloadTemplate}
              leftIcon={<Icons.Download size={12} />}
            >
              Baixar template
            </AdminButton>
          }
        />
        <p
          className={styles.schemaHint}
        >
          Cabeçalho na 1ª linha. Colunas obrigatórias: <code>nome</code>,{" "}
          <code>dataInicio</code>. Demais opcionais. Aliases aceitos:{" "}
          <code>name</code>/<code>nome</code>, <code>startdate</code>/
          <code>dataInicio</code>, <code>address</code>/
          <code>enderecoCompleto</code>, <code>lat</code>/<code>latitude</code>,
          etc.
        </p>
      </AdminCard>

      {/* Meta beta */}
      <AdminCard variant="subtle" className={styles.criteriaCard}>
        <AdminCardHeader eyebrow="META FALLBACK BETA" title="Critérios de aceite" />
        <div
          className={styles.criteriaGrid}
        >
          <p className={styles.criteriaItem}>
            <strong className={styles.emphasis}>Volume:</strong> envie
            pelo menos {BETA_IMPORT_TARGET} eventos futuros de SP/30d quando
            APIs ainda não estiverem completas.
          </p>
          <p className={styles.criteriaItem}>
            <strong className={styles.emphasis}>Qualidade:</strong>{" "}
            priorize endereço, cidade, categoria, venue/capacidade e link oficial
            para dedupe e explicação de impacto.
          </p>
          <p className={styles.criteriaItem}>
            <strong className={styles.emphasis}>Gate:</strong> linhas
            com data passada ou UF fora de SP são rejeitadas antes do ingest para
            manter o lote útil ao beta.
          </p>
          <p className={styles.criteriaItem}>
            <strong className={styles.emphasis}>Depois do upload:</strong>{" "}
            confira o dashboard, rode geocoder em <code>/admin/jobs</code> se
            houver pendentes e revise invalidRows.
          </p>
        </div>
      </AdminCard>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Upload" />
          <div className={styles.uploadForm}>
            <FileField
              file={file}
              onChange={setFile}
            />
            <AdminInput
              label="Source label (opcional)"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder='Ex: "csv-spturis-2026q2", "csv-pmi-2026"'
              helper="Default: admin-csv-import. Útil pra rastrear de qual planilha veio. Normalizado para minúsculas, números, ponto, underline e hífen."
            />

            <div
              className={styles.uploadActions}
            >
              <AdminButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={!file}
                loading={submitting}
                leftIcon={<Icons.Upload size={13} />}
              >
                {submitting ? "Processando…" : "Importar"}
              </AdminButton>
              {file && (
                <span
                  className={styles.selectedFileInfo}
                >
                  <strong className={styles.emphasis}>
                    {file.name}
                  </strong>{" "}
                  · {(file.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          </div>
        </AdminCard>
      </form>

      {/* Resultado */}
      {result && (
        <section className={styles.resultSection}>
          <p className={`urban-admin-eyebrow ${styles.sectionEyebrow}`}>
            RESULTADO
          </p>
          <div
            className={styles.resultMetricsGrid}
          >
            <AdminMetricCard
              label="Linhas no CSV"
              value={result.parsedRows}
            />
            <AdminMetricCard
              label="Inválidas"
              value={result.invalidRows.length}
              status={result.invalidRows.length > 0 ? "warn" : undefined}
            />
            <AdminMetricCard
              label="Criados"
              value={result.ingest.created}
              status={result.ingest.created > 0 ? "success" : undefined}
            />
            <AdminMetricCard
              label="Atualizados"
              value={result.ingest.updated}
            />
            <AdminMetricCard
              label="Skipados"
              value={result.ingest.skipped}
              status={result.ingest.skipped > 0 ? "error" : undefined}
            />
          </div>

          <ImportReadiness result={result} />

          {result.invalidRows.length > 0 && (
            <AdminCard variant="subtle" className={styles.invalidRowsCard}>
              <AdminCardHeader
                eyebrow="LINHAS INVÁLIDAS"
                title={`${result.invalidRows.length} rejeitadas`}
              />
              <ul
                className={styles.invalidRowsList}
              >
                {result.invalidRows.map((r, i) => (
                  <li key={i}>
                    <span className={styles.invalidRowLine}>
                      Linha {r.line}:
                    </span>{" "}
                    {r.reason}
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}

          {sourceRows.length > 0 && (
            <section className={styles.sourcesSection}>
              <p className={`urban-admin-eyebrow ${styles.sectionEyebrow}`}>
                RESUMO POR SOURCE
              </p>
              <AdminTable
                columns={sourceColumns}
                rows={sourceRows}
                rowKey={(r) => r.source}
                empty={<AdminEmptyState title="Sem agregados por source" />}
              />
            </section>
          )}
        </section>
      )}
    </div>
  );
}

function FileField({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label className={styles.field}>
      <span
        className={styles.fileFieldLabel}
      >
        Arquivo CSV *
      </span>
      <input
        type="file"
        accept=".csv,text/csv"
        required
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className={styles.fileInput}
      />
      {file && (
        <p
          className={styles.fileSelected}
        >
          Selecionado:{" "}
          <strong className={styles.emphasis}>{file.name}</strong>
        </p>
      )}
    </label>
  );
}

function ImportReadiness({ result }: { result: ImportResult }) {
  const acceptedRows = Math.max(0, result.parsedRows - result.invalidRows.length);
  const usefulRows = result.ingest.created + result.ingest.updated;
  const progress = Math.min(
    100,
    Math.round((usefulRows / BETA_IMPORT_TARGET) * 100),
  );
  const ready = usefulRows >= BETA_IMPORT_TARGET;

  return (
    <div
      style={{
        padding: 24,
        borderRadius: 2,
        border: "1px solid var(--admin-divider)",
        borderLeft: `2px solid ${
          ready ? "var(--admin-success)" : "var(--admin-warning)"
        }`,
        background: "var(--admin-surface)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div className={styles.progressInfo}>
        <div
          className={styles.progressBadgeRow}
        >
          <AdminBadge kind={ready ? "success" : "warn"}>
            {ready ? "Pronto p/ beta" : "Abaixo da meta"}
          </AdminBadge>
        </div>
        <h3
          className={styles.progressTitle}
        >
          {ready
            ? "Lote suficiente para beta"
            : "Lote ainda abaixo da meta beta"}
        </h3>
        <p
          className={styles.progressDescription}
        >
          {usefulRows.toLocaleString("pt-BR")} eventos criados/atualizados de{" "}
          {BETA_IMPORT_TARGET.toLocaleString("pt-BR")} recomendados para
          SP/30d. {acceptedRows.toLocaleString("pt-BR")} linhas passaram pela
          validação básica.
        </p>
        {!ready && (
          <p
            className={styles.progressHint}
          >
            Complete com mais eventos oficiais ou divida a planilha por fonte,
            mantendo um sourceLabel rastreável como{" "}
            <code>csv-spturis-2026q2</code>.
          </p>
        )}
      </div>
      <div className={styles.progressPercent}>
        <p
          className="urban-admin-display-sm"
          style={{
            color: ready ? "var(--admin-success)" : "var(--admin-warning)",
          }}
        >
          {progress}%
        </p>
        <p className={`urban-admin-eyebrow-muted ${styles.progressPercentLabel}`}>
          DO ALVO
        </p>
      </div>
    </div>
  );
}
