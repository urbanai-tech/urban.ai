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
import styles from "./page.module.css";

/**
 * /admin/properties — listagem para drill-down por imóvel (gap I5 do roadmap).
 *
 * Lista TODOS os imóveis ativos da plataforma com indicadores de saúde:
 *  - imóvel
 *  - usuário (host)
 *  - cidade/estado
 *  - localidade valida? (gap H1 do roadmap: 16/29 com cidade "A definir")
 *  - tem coordenadas? (gap C/H pra geocoder)
 *  - tem recomendação futura? (gap D4 cobertura)
 *  - última análise
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
  lastAnalysisAt: string | null;
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
        const r = await api.get("/admin/properties", { params: { limit: 200 } });
        const data = r?.data;
        const items: AdminPropertyRow[] = Array.isArray(data)
          ? data
          : data?.items ?? data?.data ?? [];
        setRows(items);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; message?: string };
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          setError("Acesso negado. Você precisa ser admin.");
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
            className={styles.textTextFs13}
          >
            {r.propertyName || "(sem nome)"}
          </p>
          <p
            className={styles.textTextDimFs11}
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
        <span className={styles.labelTextMutedFs12}>
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
          <div className={styles.rowCenteredGap8}>
            {invalid ? (
              <AdminBadge kind="error">Inválida</AdminBadge>
            ) : (
              <span className={styles.labelTextFs12}>
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
          <Icons.Check size={14} className={styles.okIcon} />
        ) : (
          <Icons.Close size={14} className={styles.offIcon} />
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
          <span className={styles.labelTextMono}>
            R$ {Number(r.manualDailyPrice).toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className={styles.labelTextDim}>—</span>
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
          <span className={styles.labelAccentW600}>{count}</span>
        ) : (
          <span className={styles.labelTextDim}>0</span>
        );
      },
    },
    {
      key: "lastAnalysis",
      header: "Última análise",
      width: 130,
      render: (r) =>
        r.lastAnalysisAt ? (
          <span className={styles.labelTextMutedFs12}>
            {new Date(r.lastAnalysisAt).toLocaleDateString("pt-BR")}
          </span>
        ) : (
          <span className={styles.labelTextDim}>—</span>
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
          className={styles.detailLink}
        >
          <Icons.ArrowRight size={14} />
        </NextLink>
      ),
    },
  ];

  return (
    <div className={styles.boxM0xautoP40x32}>
      <AdminSectionHeader
        eyebrow="ADMIN · IMÓVEIS"
        title="Drill-down por imóvel"
        subtitle="Visão consolidada de todos os imóveis cadastrados. Cobre o gap I5 do roadmap — suporte entende um imóvel sem abrir SQL."
      />

      {error ? (
        <AdminEmptyState
          eyebrow="ERRO"
          title="Falha ao carregar imóveis"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
        />
      ) : (
        <>
          {/* KPIs derivados */}
          <section className={styles.sectionMb32}>
            <div
              className={styles.gridColsAuto180Gap32}
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
          <div className={styles.rowGap12Mb20}>
            <AdminInput
              placeholder="Buscar por nome / email / cidade / id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftAddon={<Icons.Search size={12} />}
              shellClassName={styles.searchShell}
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
            className={styles.sectionMt48Bordered}
          >
            <AdminCard variant="accent">
              <p
                className={styles.textTextMutedFs14}
              >
                Esta tela cobre o item{" "}
                <strong className={styles.strongAccent}>I5</strong> (detalhe do
                imóvel) do roadmap. Para destravar:{" "}
                <strong className={styles.strongText}>
                  ativar Geocoding API
                </strong>{" "}
                no GCP corrige a coluna Geo e Localidade automaticamente, e{" "}
                <strong className={styles.strongText}>
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
