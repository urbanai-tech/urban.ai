"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchAdminAuditLogs,
  type AdminAuditLog,
  type AdminAuditLogsResponse,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminButton,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminEmptyState,
  AdminPageLoading,
  AdminDrawer,
  Icons,
} from "../_components";
import styles from "./page.module.css";

/**
 * /admin/audit-logs — histórico de ações sensíveis no painel admin.
 *
 * Migrado pro design system admin (.urban-admin):
 *  - 5 filtros viram AdminInput em grid + botão primary "Filtrar".
 *  - Coluna "Depois" vira AdminButton ghost "Ver" → AdminDrawer com JSON formatado.
 *  - AdminTable + hover orange.
 */
export default function AdminAuditLogsPage() {
  const [data, setData] = useState<AdminAuditLogsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    entityId: "",
    actorUserId: "",
  });
  const [applied, setApplied] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<AdminAuditLog | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAdminAuditLogs({
          page,
          limit: 25,
          action: applied.action || undefined,
          entityType: applied.entityType || undefined,
          entityId: applied.entityId || undefined,
          actorUserId: applied.actorUserId || undefined,
        });
        if (!cancelled) setData(response);
      } catch (err: unknown) {
        const e = err as { message?: string };
        if (!cancelled) setError(e?.message || "Erro ao carregar logs de auditoria.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const pages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.limit));
  }, [data]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({
      action: filters.action.trim(),
      entityType: filters.entityType.trim(),
      entityId: filters.entityId.trim(),
      actorUserId: filters.actorUserId.trim(),
    });
  }

  function clearFilters() {
    setFilters({ action: "", entityType: "", entityId: "", actorUserId: "" });
    setApplied({ action: "", entityType: "", entityId: "", actorUserId: "" });
    setPage(1);
  }

  const columns: AdminTableColumn<AdminAuditLog>[] = [
    {
      key: "createdAt",
      header: "Quando",
      width: 160,
      render: (log) => (
        <span
          className={styles.labelTextMutedFs12}
        >
          {formatDate(log.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      render: (log) => (
        <code className={styles.codeAccentFs12}>
          {log.action}
        </code>
      ),
    },
    {
      key: "entity",
      header: "Entidade",
      render: (log) => (
        <div>
          <p className={styles.textTextW500}>
            {log.entityType}
          </p>
          {log.entityId && (
            <code
              className={styles.codeTextDimFs11}
            >
              {log.entityId}
            </code>
          )}
        </div>
      ),
    },
    {
      key: "actor",
      header: "Admin",
      render: (log) => (
        <code className={styles.codeTextMutedFs11}>
          {log.actorUserId || "sistema"}
        </code>
      ),
    },
    {
      key: "after",
      header: "Depois",
      width: 100,
      align: "right",
      render: (log) => (
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={() => setDetailLog(log)}
          leftIcon={<Icons.FileText size={11} />}
        >
          Ver
        </AdminButton>
      ),
    },
  ];

  if (loading && !data) {
    return <AdminPageLoading />;
  }

  return (
    <div className={styles.boxM0xautoP40x32}>
      <AdminSectionHeader
        eyebrow="ADMIN · AUDITORIA"
        title="Auditoria"
        subtitle="Histórico de alterações sensíveis feitas dentro do painel administrativo."
      />

      {/* === Filtros === */}
      <section className={styles.sectionMb32}>
        <AdminCard variant="subtle">
          <form
            onSubmit={applyFilters}
            className={styles.gridColsAuto180Gap14}
          >
            <AdminInput
              label="Ação"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
              placeholder="finance.cost_update"
            />
            <AdminInput
              label="Entidade"
              value={filters.entityType}
              onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value }))}
              placeholder="user"
            />
            <AdminInput
              label="ID da entidade"
              value={filters.entityId}
              onChange={(e) => setFilters((prev) => ({ ...prev, entityId: e.target.value }))}
            />
            <AdminInput
              label="Admin"
              value={filters.actorUserId}
              onChange={(e) => setFilters((prev) => ({ ...prev, actorUserId: e.target.value }))}
              placeholder="userId"
            />
            <div className={styles.rowWrapGap8}>
              <AdminButton
                type="submit"
                variant="primary"
                leftIcon={<Icons.Search size={12} />}
              >
                Filtrar
              </AdminButton>
              <AdminButton
                type="button"
                variant="ghost"
                onClick={clearFilters}
              >
                Limpar
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      </section>

      {error && (
        <div className={styles.sectionMb32}>
          <AdminEmptyState
            eyebrow="Erro"
            title="Falha ao carregar"
            body={error}
            icon={<Icons.AlertCircle size={32} />}
          />
        </div>
      )}

      {/* === Tabela === */}
      <section>
        <header
          className={styles.rowBetweenCentered}
        >
          <p className={styles.textTextMutedFs12}>
            {loading
              ? "Carregando…"
              : `${(data?.total ?? 0).toLocaleString("pt-BR")} registros encontrados`}
          </p>
          <div className={styles.rowCenteredGap8}>
            <AdminButton
              variant="ghost"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              leftIcon={<Icons.ArrowLeft size={11} />}
            >
              Anterior
            </AdminButton>
            <span
              className={styles.labelTextMutedFs11}
            >
              {page} / {pages}
            </span>
            <AdminButton
              variant="ghost"
              size="sm"
              disabled={page >= pages || loading}
              onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
              rightIcon={<Icons.ArrowRight size={11} />}
            >
              Próxima
            </AdminButton>
          </div>
        </header>

        <AdminTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          empty={
            <AdminEmptyState
              title="Nenhum registro encontrado"
              body="Ajuste os filtros ou aguarde novas ações sensíveis no painel."
            />
          }
        />
      </section>

      {/* === Drawer JSON detalhe === */}
      <AdminDrawer
        open={!!detailLog}
        onClose={() => setDetailLog(null)}
        eyebrow="DETALHE DO REGISTRO"
        title={detailLog?.action ?? ""}
        width={560}
      >
        {detailLog && (
          <div className={styles.stackGap20}>
            <div>
              <p className="urban-admin-eyebrow-muted">QUANDO</p>
              <p
                className={styles.textTextFs13}
              >
                {formatDate(detailLog.createdAt)}
              </p>
            </div>
            <div>
              <p className="urban-admin-eyebrow-muted">ENTIDADE</p>
              <p
                className={styles.textTextFs13M6x0x0}
              >
                {detailLog.entityType}
                {detailLog.entityId && (
                  <>
                    {" · "}
                    <code className={styles.codeTextMuted}>
                      {detailLog.entityId}
                    </code>
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="urban-admin-eyebrow-muted">ADMIN</p>
              <p
                className={styles.textTextFs13}
              >
                {detailLog.actorUserId || "sistema"}
              </p>
            </div>
            {detailLog.before != null && (
              <JsonBlock label="Antes" value={detailLog.before} />
            )}
            {detailLog.after != null && (
              <JsonBlock label="Depois" value={detailLog.after} />
            )}
            {detailLog.metadata != null && (
              <JsonBlock label="Metadata" value={detailLog.metadata} />
            )}
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <pre
        className={styles.preBlockTextBgSurfaceElevated}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
