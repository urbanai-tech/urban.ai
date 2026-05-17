"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { api } from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminBadge,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";

/**
 * /admin/properties — listagem para drill-down por imovel (gap I5 do roadmap).
 *
 * Lista TODOS os imoveis ativos da plataforma com indicadores de saude:
 *  - imovel
 *  - usuario (host)
 *  - cidade/estado
 *  - localidade valida? (gap H1 do roadmap: 16/29 com cidade "A definir")
 *  - tem coordenadas? (gap C/H pra geocoder)
 *  - tem recomendacao futura? (gap D4 cobertura)
 *  - ultima analise
 *
 * Click em uma row abre /admin/properties/[id] com tela detalhada.
 */

type AdminPropertyRow = {
  id: string;
  propertyName: string;
  userId: string;
  userEmail?: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  manualDailyPrice?: number | null;
  lastAnalysisAt?: string | null;
  futureRecommendationsCount?: number;
  active?: boolean;
};

export default function AdminPropertiesPage() {
  const [rows, setRows] = useState<AdminPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Tenta o endpoint admin oficial primeiro; fallback gracioso se nao existir.
        const r = await api
          .get("/admin/properties", { params: { limit: 200 } })
          .catch(() => api.get("/admin/properties/list", { params: { limit: 200 } }))
          .catch(() => api.get("/propriedades/admin/list", { params: { limit: 200 } }));
        const data = r?.data;
        const items: AdminPropertyRow[] = Array.isArray(data)
          ? data
          : data?.items ?? data?.data ?? [];
        setRows(items);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; message?: string };
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          setError("Acesso negado. Você precisa ser admin.");
        } else if (e?.response?.status === 404) {
          setError(
            "Endpoint /admin/properties ainda não existe no backend. Tela pronta para ligar quando estiver.",
          );
        } else {
          setError(e?.message || "Erro ao carregar imóveis.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.propertyName?.toLowerCase().includes(q) ||
      r.userEmail?.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q)
    );
  });

  // KPIs derivados
  const total = rows.length;
  const withCoords = rows.filter(
    (r) => r.latitude != null && r.longitude != null && Number(r.latitude) !== 0,
  ).length;
  const invalidLocality = rows.filter(
    (r) => !r.city || /^a\s*definir$/i.test(r.city.trim()) || !r.state,
  ).length;
  const withFutureRecs = rows.filter((r) => (r.futureRecommendationsCount ?? 0) > 0).length;

  if (loading) {
    return <AdminPageLoading />;
  }

  const columns: AdminTableColumn<AdminPropertyRow>[] = [
    {
      key: "name",
      header: "Imóvel",
      render: (r) => (
        <div>
          <p
            style={{
              fontWeight: 600,
              color: "var(--admin-text)",
              margin: 0,
              fontSize: 13,
            }}
          >
            {r.propertyName || "(sem nome)"}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--admin-text-dim)",
              margin: "2px 0 0",
              fontFamily: "monospace",
            }}
          >
            {r.id.slice(0, 8)}…
          </p>
        </div>
      ),
    },
    {
      key: "host",
      header: "Host",
      render: (r) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {r.userEmail || r.userId.slice(0, 8) + "…"}
        </span>
      ),
    },
    {
      key: "locality",
      header: "Localidade",
      width: 180,
      render: (r) => {
        const invalid = !r.city || /^a\s*definir$/i.test(r.city.trim()) || !r.state;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {invalid ? (
              <AdminBadge kind="error">Inválida</AdminBadge>
            ) : (
              <span style={{ fontSize: 12, color: "var(--admin-text)" }}>
                {r.city}/{r.state}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "coords",
      header: "Geo",
      width: 60,
      align: "center",
      render: (r) => {
        const has = r.latitude != null && r.longitude != null && Number(r.latitude) !== 0;
        return has ? (
          <Icons.Check size={14} style={{ color: "var(--admin-success)" }} />
        ) : (
          <Icons.Close size={14} style={{ color: "var(--admin-danger)" }} />
        );
      },
    },
    {
      key: "price",
      header: "Diária base",
      width: 110,
      align: "right",
      render: (r) =>
        r.manualDailyPrice != null ? (
          <span style={{ fontFamily: "monospace", color: "var(--admin-text)" }}>
            R$ {Number(r.manualDailyPrice).toLocaleString("pt-BR")}
          </span>
        ) : (
          <span style={{ color: "var(--admin-text-dim)" }}>—</span>
        ),
    },
    {
      key: "recs",
      header: "Recomendações futuras",
      width: 170,
      align: "right",
      render: (r) => {
        const count = r.futureRecommendationsCount ?? 0;
        return count > 0 ? (
          <span style={{ color: "var(--admin-accent)", fontWeight: 600 }}>{count}</span>
        ) : (
          <span style={{ color: "var(--admin-text-dim)" }}>0</span>
        );
      },
    },
    {
      key: "lastAnalysis",
      header: "Última análise",
      width: 130,
      render: (r) =>
        r.lastAnalysisAt ? (
          <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
            {new Date(r.lastAnalysisAt).toLocaleDateString("pt-BR")}
          </span>
        ) : (
          <span style={{ color: "var(--admin-text-dim)" }}>—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      width: 60,
      align: "right",
      render: (r) => (
        <NextLink
          href={`/admin/properties/${r.id}`}
          style={{
            color: "var(--admin-text-muted)",
            display: "inline-flex",
            padding: 4,
          }}
        >
          <Icons.ArrowRight size={14} />
        </NextLink>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · IMÓVEIS"
        title="Drill-down por imóvel"
        subtitle="Visão consolidada de todos os imóveis cadastrados. Cobre o gap I5 do roadmap — suporte entende um imóvel sem abrir SQL."
      />

      {error ? (
        <AdminEmptyState
          eyebrow="ENDPOINT PENDENTE"
          title="Backend ainda não expõe /admin/properties"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
        />
      ) : (
        <>
          {/* KPIs derivados */}
          <section style={{ marginBottom: 32 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 32,
                borderTop: "1px solid var(--admin-divider)",
                borderBottom: "1px solid var(--admin-divider)",
                padding: "24px 0",
              }}
            >
              <KpiInline label="Total cadastrados" value={total} />
              <KpiInline
                label="Com coordenadas"
                value={`${withCoords}/${total}`}
                accent={withCoords < total}
              />
              <KpiInline
                label="Localidade inválida"
                value={invalidLocality}
                kind={invalidLocality > 0 ? "warn" : "neutral"}
              />
              <KpiInline
                label="Com recomendações futuras"
                value={`${withFutureRecs}/${total}`}
                accent={withFutureRecs < total}
              />
            </div>
          </section>

          {/* Toolbar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <AdminInput
              placeholder="Buscar por nome / email / cidade / id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftAddon={<Icons.Search size={12} />}
              shellStyle={{ flex: 1, maxWidth: 480 }}
            />
          </div>

          {/* Tabela */}
          <AdminTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            empty={
              <AdminEmptyState
                title="Nenhum imóvel encontrado"
                body="Ajuste a busca ou cadastre o primeiro imóvel."
              />
            }
          />

          {/* Footer ações */}
          <section
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: "1px solid var(--admin-divider)",
            }}
          >
            <AdminCard variant="accent">
              <p
                style={{
                  fontSize: 14,
                  color: "var(--admin-text-muted)",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Esta tela cobre o gap{" "}
                <strong style={{ color: "var(--admin-accent)" }}>I5</strong> (drill-down de
                propriedade) do roadmap. Para destravar:{" "}
                <strong style={{ color: "var(--admin-text)" }}>
                  ativar Geocoding API
                </strong>{" "}
                no GCP corrige a coluna Geo e Localidade automaticamente, e{" "}
                <strong style={{ color: "var(--admin-text)" }}>
                  rodar o smoke autenticado de recomendação
                </strong>{" "}
                preenche a coluna Recomendações futuras.
              </p>
            </AdminCard>
          </section>
        </>
      )}
    </div>
  );
}

function KpiInline({
  label,
  value,
  accent,
  kind,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  kind?: "warn" | "neutral";
}) {
  const color =
    kind === "warn"
      ? "var(--admin-warning)"
      : accent
        ? "var(--admin-accent)"
        : "var(--admin-text)";
  return (
    <div>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p
        className="urban-admin-display-md"
        style={{ marginTop: 10, color }}
      >
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
    </div>
  );
}
