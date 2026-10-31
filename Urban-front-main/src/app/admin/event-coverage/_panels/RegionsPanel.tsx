"use client";

import { useEffect, useState } from "react";
import {
  fetchCoverageRegions,
  fetchCoverageStats,
  createCoverageRegion,
  updateCoverageRegion,
  deleteCoverageRegion,
  checkCoveragePoint,
  resetStaleEnrichment,
  type CoverageRegion,
  type CoverageStats,
} from "../../../service/api";
import {
  AdminButton,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminDrawer,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminPageLoading,
  useAdminToast,
  Icons,
} from "../../_components";
import { statusLabel } from "../../_lib/status-labels";
import styles from "./RegionsPanel.module.css";

/**
 * Aba "Regiões" de /admin/event-coverage (antes a página /admin/coverage, que agora redireciona):
 * gerencia áreas de cobertura geográfica do motor de eventos.
 *
 * Migrado para design system admin (.urban-admin):
 *  - "Testar ponto" e "Nova região" viram drawers laterais.
 *  - "Reset retroativo enrichment" passa por AdminConfirmDialog destructive.
 *  - Resultado de testar ponto vira pill com cor + ícone.
 *  - Tabela com AdminTable + ações (delete) com Icons.Trash via AdminConfirmDialog.
 *  - alert()/confirm() → toast/dialog.
 */
export default function RegionsPanel() {
  const [regions, setRegions] = useState<CoverageRegion[]>([]);
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CoverageRegion | null>(null);
  const toast = useAdminToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([
        fetchCoverageRegions(),
        fetchCoverageStats(),
      ]);
      setRegions(r);
      setStats(s);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(
        status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleResetStale() {
    setResetting(true);
    try {
      const r = await resetStaleEnrichment();
      toast.success(`OK — ${r.reset} eventos marcados pra re-tentativa.`);
      setConfirmReset(false);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete(r: CoverageRegion) {
    setBusyId(r.id);
    try {
      await deleteCoverageRegion(r.id);
      toast.success(`Região '${r.name}' removida.`);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(
    r: CoverageRegion,
    newStatus: CoverageRegion["status"],
  ) {
    setBusyId(r.id);
    try {
      await updateCoverageRegion(r.id, { status: newStatus });
      toast.success("Status atualizado.");
      load();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <AdminPageLoading />;

  if (error) {
    return (
      <div className={styles.panel}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error}
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

  const columns: AdminTableColumn<CoverageRegion>[] = [
    {
      key: "name",
      header: "Nome",
      render: (r) => (
        <div>
          <p className={styles.regionName}>
            {r.name}
          </p>
          {r.notes && (
            <p
              className={styles.regionNotes}
            >
              {r.notes.slice(0, 80)}
              {r.notes.length > 80 && "…"}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 160,
      render: (r) => (
        <AdminSelect
          aria-label="Status da região"
          value={r.status}
          onChange={(e) =>
            handleStatusChange(r, e.target.value as CoverageRegion["status"])
          }
          disabled={busyId === r.id}
          shellClassName={styles.statusSelectShell}
          className={`${styles.statusSelect} ${busyId === r.id ? styles.statusSelectBusy : ""}`}
        >
          <option value="active">{statusLabel("active")}</option>
          <option value="bootstrap">{statusLabel("bootstrap")}</option>
          <option value="inactive">{statusLabel("inactive")}</option>
        </AdminSelect>
      ),
    },
    {
      key: "geom",
      header: "Geometria",
      render: (r) => (
        <span
          className={styles.regionGeometry}
        >
          {r.centerLat !== null && r.radiusKm !== null
            ? `(${r.centerLat}, ${r.centerLng}) raio ${r.radiusKm}km`
            : `bbox [${r.minLat}..${r.maxLat}, ${r.minLng}..${r.maxLng}]`}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 60,
      align: "right",
      render: (r) => (
        <button
          type="button"
          onClick={() => setConfirmDelete(r)}
          disabled={busyId === r.id}
          aria-label={`Remover ${r.name}`}
          title="Remover"
          className={`${styles.deleteButton} ${busyId === r.id ? styles.deleteButtonBusy : ""}`}
        >
          <Icons.Trash size={12} />
        </button>
      ),
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <p className={styles.toolbarText}>
          Modelo híbrido: eventos entram no motor se estão dentro do raio de imóveis cadastrados OU dentro de uma
          região configurada aqui.
        </p>
        <div className={styles.toolbarActions}>
          <AdminButton
            variant="secondary"
            onClick={() => setShowCheck(true)}
            leftIcon={<Icons.MapPin size={12} />}
          >
            Testar ponto
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={() => setShowNew(true)}
            leftIcon={<Icons.Plus size={12} />}
          >
            Nova região
          </AdminButton>
        </div>
      </div>

      {/* === KPIs === */}
      {stats && (
        <section className={styles.kpiSection}>
          <p className={`urban-admin-eyebrow ${styles.kpiEyebrow}`}>
            INDICADORES
          </p>
          <div
            className={styles.kpiGrid}
          >
            <AdminMetricCard
              label="Regiões ativas"
              value={stats.activeRegions}
              status={stats.activeRegions > 0 ? "success" : undefined}
            />
            <AdminMetricCard
              label="Bootstrap"
              value={stats.bootstrapRegions}
              sub="Pré-aquecimento"
              status={stats.bootstrapRegions > 0 ? "warn" : undefined}
            />
            <AdminMetricCard
              label="Imóveis cadastrados"
              value={stats.addresses}
            />
            <AdminMetricCard
              label="Raio por imóvel"
              value={`${stats.addressRadiusKm} km`}
            />
          </div>
        </section>
      )}

      {/* === Regiões === */}
      <section className={styles.regionsSection}>
        <header
          className={styles.regionsHeader}
        >
          <div>
            <p className="urban-admin-eyebrow">REGIÕES CONFIGURADAS</p>
            <h2
              className={styles.regionsTitle}
            >
              Overrides manuais
            </h2>
          </div>
          <AdminButton
            variant="danger"
            size="sm"
            onClick={() => setConfirmReset(true)}
            leftIcon={<Icons.RefreshCw size={12} />}
          >
            Reset retroativo
          </AdminButton>
        </header>

        <AdminTable
          columns={columns}
          rows={regions}
          rowKey={(r) => r.id}
          empty={
            <AdminEmptyState
              title="Nenhuma região configurada"
              body="Cobertura cai 100% em imóveis cadastrados."
              action={
                <AdminButton
                  variant="primary"
                  onClick={() => setShowNew(true)}
                  leftIcon={<Icons.Plus size={12} />}
                >
                  Adicionar região
                </AdminButton>
              }
            />
          }
        />
      </section>

      {/* === Drawer: testar ponto === */}
      <AdminDrawer
        open={showCheck}
        onClose={() => setShowCheck(false)}
        eyebrow="DEBUG"
        title="Testar ponto"
      >
        <CheckPointForm />
      </AdminDrawer>

      {/* === Drawer: nova região === */}
      <AdminDrawer
        open={showNew}
        onClose={() => setShowNew(false)}
        eyebrow="NOVA REGIÃO"
        title="Cadastrar"
        width={520}
      >
        <NewRegionForm
          onCreated={() => {
            setShowNew(false);
            toast.success("Região criada.");
            load();
          }}
          onCancel={() => setShowNew(false)}
        />
      </AdminDrawer>

      {/* === Dialog: reset retroativo === */}
      <AdminConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        loading={resetting}
        destructive
        title="Reset retroativo de enrichment"
        body="Reseta eventos com relevância=0 (bug antigo) para re-tentativa Gemini. Pode levar tempo no próximo cron."
        confirmLabel="Resetar"
        onConfirm={handleResetStale}
      />

      {/* === Dialog: deletar região === */}
      <AdminConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        loading={busyId === confirmDelete?.id}
        destructive
        title={`Remover '${confirmDelete?.name}'?`}
        body="Esta ação é permanente. Eventos dentro desta região deixarão de entrar no motor por override manual."
        confirmLabel="Remover"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete);
        }}
      />
    </div>
  );
}

function CheckPointForm() {
  const [checkLat, setCheckLat] = useState("");
  const [checkLng, setCheckLng] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useAdminToast();

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    const lat = Number(checkLat);
    const lng = Number(checkLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("lat/lng inválidos");
      return;
    }
    setBusy(true);
    try {
      const r = await checkCoveragePoint(lat, lng);
      setResult(r.inCoverage);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleCheck}
      className={styles.form}
    >
      <p className={styles.formHint}>
        Cole lat/lng e veja se ficaria dentro da cobertura atual.
      </p>
      <AdminInput
        label="Latitude"
        type="number"
        step="0.0001"
        placeholder="-23.5275"
        value={checkLat}
        onChange={(e) => setCheckLat(e.target.value)}
        required
      />
      <AdminInput
        label="Longitude"
        type="number"
        step="0.0001"
        placeholder="-46.6783"
        value={checkLng}
        onChange={(e) => setCheckLng(e.target.value)}
        required
      />
      <AdminButton type="submit" variant="primary" loading={busy}>
        {busy ? "Testando…" : "Testar"}
      </AdminButton>

      {result !== null && (
        <div className={`${styles.testResult} ${result ? styles.testResultOk : styles.testResultFail}`}>
          {result ? <Icons.Check size={14} /> : <Icons.Close size={14} />}
          {result ? "Dentro da cobertura" : "Fora da cobertura"}
        </div>
      )}
    </form>
  );
}

function NewRegionForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"circle" | "bbox">("circle");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("80");
  const [minLat, setMinLat] = useState("");
  const [maxLat, setMaxLat] = useState("");
  const [minLng, setMinLng] = useState("");
  const [maxLng, setMaxLng] = useState("");
  const [status, setStatus] = useState<"active" | "bootstrap" | "inactive">(
    "active",
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useAdminToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload =
        mode === "circle"
          ? {
              name,
              status,
              notes: notes || null,
              centerLat: Number(centerLat),
              centerLng: Number(centerLng),
              radiusKm: Number(radiusKm),
            }
          : {
              name,
              status,
              notes: notes || null,
              minLat: Number(minLat),
              maxLat: Number(maxLat),
              minLng: Number(minLng),
              maxLng: Number(maxLng),
            };
      await createCoverageRegion(payload);
      onCreated();
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        "Erro: " +
          (e?.response?.data?.message ?? e?.message ?? "falhou"),
      );
    } finally {
      setBusy(false);
    }
  }

  const radioLabelStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: "var(--text-xs)",
    color: "var(--admin-text)",
    cursor: "pointer",
  };

  return (
    <form
      onSubmit={submit}
      className={styles.form}
    >
      <AdminInput
        label="Nome"
        placeholder="Ex: Rio Metropolitano"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <AdminSelect
        label="Status"
        value={status}
        onChange={(e) =>
          setStatus(e.target.value as "active" | "bootstrap" | "inactive")
        }
      >
        <option value="active">{statusLabel("active")}</option>
        <option value="bootstrap">{statusLabel("bootstrap")}</option>
        <option value="inactive">{statusLabel("inactive")}</option>
      </AdminSelect>

      <div>
        <p
          className={styles.geometryLabel}
        >
          Tipo de geometria
        </p>
        <div className={styles.geometryOptions}>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="mode"
              checked={mode === "circle"}
              onChange={() => setMode("circle")}
              className={styles.radioInput}
            />
            Centro + raio
          </label>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="mode"
              checked={mode === "bbox"}
              onChange={() => setMode("bbox")}
              className={styles.radioInput}
            />
            Bounding box
          </label>
        </div>
      </div>

      {mode === "circle" ? (
        <div
          className={styles.circleFields}
        >
          <AdminInput
            label="centerLat"
            type="number"
            step="0.0001"
            placeholder="-23.5505"
            value={centerLat}
            onChange={(e) => setCenterLat(e.target.value)}
            required
          />
          <AdminInput
            label="centerLng"
            type="number"
            step="0.0001"
            placeholder="-46.6333"
            value={centerLng}
            onChange={(e) => setCenterLng(e.target.value)}
            required
          />
          <AdminInput
            label="raio (km)"
            type="number"
            placeholder="80"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            required
          />
        </div>
      ) : (
        <div
          className={styles.bboxFields}
        >
          <AdminInput
            label="minLat"
            type="number"
            step="0.0001"
            value={minLat}
            onChange={(e) => setMinLat(e.target.value)}
            required
          />
          <AdminInput
            label="maxLat"
            type="number"
            step="0.0001"
            value={maxLat}
            onChange={(e) => setMaxLat(e.target.value)}
            required
          />
          <AdminInput
            label="minLng"
            type="number"
            step="0.0001"
            value={minLng}
            onChange={(e) => setMinLng(e.target.value)}
            required
          />
          <AdminInput
            label="maxLng"
            type="number"
            step="0.0001"
            value={maxLng}
            onChange={(e) => setMaxLng(e.target.value)}
            required
          />
        </div>
      )}

      <AdminTextarea
        label="Notas"
        rows={3}
        placeholder="Justificativa, plano de expansão, etc."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div
        className={styles.formActions}
      >
        <AdminButton
          variant="ghost"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </AdminButton>
        <AdminButton type="submit" variant="primary" loading={busy}>
          {busy ? "Salvando…" : "Criar região"}
        </AdminButton>
      </div>
    </form>
  );
}
