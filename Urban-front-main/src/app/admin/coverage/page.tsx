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
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminButton,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminBadge,
  AdminCard,
  AdminCardHeader,
  AdminDrawer,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminPageLoading,
  useAdminToast,
  Icons,
} from "../_components";

/**
 * /admin/coverage — gerencia áreas de cobertura geográfica do motor de eventos.
 *
 * Migrado para design system admin (.urban-admin):
 *  - "Testar ponto" e "Nova região" viram drawers laterais.
 *  - "Reset retroativo enrichment" passa por AdminConfirmDialog destructive.
 *  - Resultado de testar ponto vira pill com cor + ícone.
 *  - Tabela com AdminTable + ações (delete) com Icons.Trash via AdminConfirmDialog.
 *  - alert()/confirm() → toast/dialog.
 */
export default function CoverageAdminPage() {
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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

  const statusKindMap: Record<
    CoverageRegion["status"],
    "success" | "warn" | "neutral"
  > = {
    active: "success",
    bootstrap: "warn",
    inactive: "neutral",
  };

  const columns: AdminTableColumn<CoverageRegion>[] = [
    {
      key: "name",
      header: "Nome",
      render: (r) => (
        <div>
          <p style={{ fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>
            {r.name}
          </p>
          {r.notes && (
            <p
              style={{
                marginTop: 2,
                fontSize: 11,
                color: "var(--admin-text-muted)",
              }}
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
        <select
          value={r.status}
          onChange={(e) =>
            handleStatusChange(r, e.target.value as CoverageRegion["status"])
          }
          disabled={busyId === r.id}
          style={{
            height: 28,
            padding: "0 24px 0 8px",
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--admin-divider-strong)",
            borderRadius: 2,
            color: "var(--admin-text)",
            appearance: "none",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.55)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
            cursor: busyId === r.id ? "not-allowed" : "pointer",
          }}
        >
          <option value="active">active</option>
          <option value="bootstrap">bootstrap</option>
          <option value="inactive">inactive</option>
        </select>
      ),
    },
    {
      key: "geom",
      header: "Geometria",
      render: (r) => (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "var(--admin-text-muted)",
          }}
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
          style={{
            background: "transparent",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            borderRadius: 2,
            color: "var(--admin-danger)",
            padding: 6,
            cursor: busyId === r.id ? "not-allowed" : "pointer",
            display: "inline-flex",
            lineHeight: 0,
          }}
        >
          <Icons.Trash size={12} />
        </button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · COBERTURA"
        title="Cobertura geográfica"
        subtitle="Modelo híbrido — eventos entram no motor se estão dentro do raio de imóveis cadastrados OU dentro de uma região configurada aqui."
        actions={
          <>
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
          </>
        }
      />

      {/* === KPIs === */}
      {stats && (
        <section style={{ marginBottom: 56 }}>
          <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
            INDICADORES
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 32,
              borderTop: "1px solid var(--admin-divider)",
              borderBottom: "1px solid var(--admin-divider)",
            }}
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
      <section style={{ marginBottom: 32 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <p className="urban-admin-eyebrow">REGIÕES CONFIGURADAS</p>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--admin-text)",
                margin: "8px 0 0",
                letterSpacing: -0.3,
              }}
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
        body="Reseta eventos com relevancia=0 (bug antigo) para re-tentativa Gemini. Pode levar tempo no próximo cron."
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
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
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
        <div
          style={{
            marginTop: 8,
            padding: "14px 16px",
            border: `1px solid ${result ? "rgba(74, 222, 128, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
            borderRadius: 2,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: result ? "var(--admin-success)" : "var(--admin-danger)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
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
    fontSize: 12,
    color: "var(--admin-text)",
    cursor: "pointer",
  };

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
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
        <option value="active">active</option>
        <option value="bootstrap">bootstrap</option>
        <option value="inactive">inactive</option>
      </AdminSelect>

      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--admin-text-muted)",
            marginBottom: 8,
          }}
        >
          Tipo de geometria
        </p>
        <div style={{ display: "flex", gap: 18 }}>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="mode"
              checked={mode === "circle"}
              onChange={() => setMode("circle")}
              style={{ accentColor: "var(--admin-accent)" }}
            />
            Centro + raio
          </label>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="mode"
              checked={mode === "bbox"}
              onChange={() => setMode("bbox")}
              style={{ accentColor: "var(--admin-accent)" }}
            />
            Bounding box
          </label>
        </div>
      </div>

      {mode === "circle" ? (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
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
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
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
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 8,
        }}
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
