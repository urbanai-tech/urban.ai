"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminContactSubmissions,
  updateAdminContactSubmission,
  type ContactSubmission,
  type ContactSubmissionListResponse,
  type ContactSubmissionStatus,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminMetricCard,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminBadge,
  AdminEmptyState,
  AdminPageLoading,
  AdminDrawer,
  useAdminToast,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";

const STATUS_LABELS: Record<ContactSubmissionStatus, string> = {
  new: "Novo",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  archived: "Arquivado",
};

/**
 * /admin/contacts — mensagens recebidas pelo form público de contato.
 *
 * Migrado pro design system admin (.urban-admin):
 *  - 4 KPIs em grid plano (AdminMetricCard).
 *  - Cards de mensagem como AdminCard subtle com StatusBadge.
 *  - prompt() de notas internas → AdminDrawer com AdminTextarea.
 *  - alert() → useAdminToast.
 */
export default function AdminContactsPage() {
  const [data, setData] = useState<ContactSubmissionListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactSubmissionStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesEntry, setNotesEntry] = useState<ContactSubmission | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const toast = useAdminToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminContactSubmissions({
        page,
        limit: 25,
        search: search.trim() || undefined,
        status: statusFilter,
      });
      setData(list);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(
        status === 401 || status === 403
          ? "Acesso negado."
          : e?.message || "Erro ao carregar contatos.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const counts = useMemo(() => {
    const base: Record<ContactSubmissionStatus, number> = {
      new: 0,
      in_progress: 0,
      resolved: 0,
      archived: 0,
    };
    if (data?.byStatus?.length) {
      data.byStatus.forEach((item) => {
        base[item.status] = item.count;
      });
      return base;
    }
    data?.items.forEach((item) => {
      base[item.status] += 1;
    });
    return base;
  }, [data]);

  async function updateStatus(entry: ContactSubmission, status: ContactSubmissionStatus) {
    if (entry.status === status) return;
    setBusyId(entry.id);
    try {
      await updateAdminContactSubmission(entry.id, { status });
      toast.success(`Status alterado para ${STATUS_LABELS[status]}.`);
      await load();
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error("Erro: " + (e?.response?.data?.message || e?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveNotes() {
    if (!notesEntry) return;
    setBusyId(notesEntry.id);
    try {
      await updateAdminContactSubmission(notesEntry.id, { notes: notesValue || null });
      toast.success("Notas atualizadas.");
      setNotesEntry(null);
      await load();
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error("Erro: " + (e?.response?.data?.message || e?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) {
    return <AdminPageLoading />;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar contatos"
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

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · CONTATOS"
        title="Mensagens"
        subtitle="Mensagens enviadas pelo formulário público de contato."
      />

      {/* === KPIs === */}
      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 32,
            borderTop: "1px solid var(--admin-divider)",
            borderBottom: "1px solid var(--admin-divider)",
          }}
        >
          <AdminMetricCard
            label="Nesta página"
            value={(data?.items.length ?? 0).toLocaleString("pt-BR")}
          />
          <AdminMetricCard
            label="Novos no filtro"
            value={counts.new.toLocaleString("pt-BR")}
            status="warn"
          />
          <AdminMetricCard
            label="Em andamento"
            value={counts.in_progress.toLocaleString("pt-BR")}
            status="accent"
          />
          <AdminMetricCard
            label="Total filtrado"
            value={(data?.total ?? 0).toLocaleString("pt-BR")}
            accent
          />
        </div>
      </section>

      {/* === Filtros === */}
      <section
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <AdminInput
          placeholder="Buscar por nome, email, assunto ou mensagem…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          leftAddon={<Icons.Search size={12} />}
          shellStyle={{ flex: 1, minWidth: 240 }}
        />
        <AdminSelect
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ContactSubmissionStatus | "all");
            setPage(1);
          }}
          shellStyle={{ width: 200 }}
        >
          <option value="all">Todos status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </AdminSelect>
        <AdminButton
          variant="primary"
          onClick={() => {
            setPage(1);
            load();
          }}
          leftIcon={<Icons.Search size={12} />}
        >
          Buscar
        </AdminButton>
      </section>

      {/* === Mensagens === */}
      <section style={{ marginBottom: 24 }}>
        {!data || data.items.length === 0 ? (
          <AdminEmptyState
            title="Nenhuma mensagem"
            body="Nenhuma mensagem encontrada com esses filtros."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.items.map((entry) => (
              <AdminCard key={entry.id} variant="subtle">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <StatusBadge status={entry.status} />
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--admin-text-dim)",
                            fontFamily: "monospace",
                            letterSpacing: 0.5,
                          }}
                        >
                          {new Date(entry.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <h3
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: "var(--admin-text)",
                          margin: 0,
                          letterSpacing: -0.2,
                        }}
                      >
                        {entry.subject}
                      </h3>
                      <p
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          color: "var(--admin-text-muted)",
                        }}
                      >
                        {entry.name} ·{" "}
                        <a
                          href={`mailto:${entry.email}`}
                          style={{
                            color: "var(--admin-accent)",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          {entry.email}
                        </a>
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <AdminSelect
                        value={entry.status}
                        disabled={busyId === entry.id}
                        onChange={(e) =>
                          updateStatus(entry, e.target.value as ContactSubmissionStatus)
                        }
                        shellStyle={{ width: 180 }}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </AdminSelect>
                      <AdminButton
                        variant="ghost"
                        size="md"
                        disabled={busyId === entry.id}
                        onClick={() => {
                          setNotesEntry(entry);
                          setNotesValue(entry.notes ?? "");
                        }}
                        leftIcon={<Icons.Edit size={12} />}
                      >
                        Notas
                      </AdminButton>
                    </div>
                  </div>

                  <p
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      color: "var(--admin-text)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {entry.message}
                  </p>

                  {entry.notes && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--admin-text-muted)",
                        borderLeft: "2px solid var(--admin-accent)",
                        paddingLeft: 12,
                        margin: 0,
                        lineHeight: 1.55,
                      }}
                    >
                      <span
                        className="urban-admin-eyebrow-muted"
                        style={{ display: "block", marginBottom: 4 }}
                      >
                        NOTAS INTERNAS
                      </span>
                      {entry.notes}
                    </p>
                  )}
                </div>
              </AdminCard>
            ))}
          </div>
        )}
      </section>

      {/* === Paginação === */}
      {data && data.total > data.limit && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--admin-text-muted)",
          }}
        >
          <span>
            Página {data.page} de {totalPages}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page === 1}
              leftIcon={<Icons.ArrowLeft size={11} />}
            >
              Anterior
            </AdminButton>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.page * data.limit >= data.total}
              rightIcon={<Icons.ArrowRight size={11} />}
            >
              Próxima
            </AdminButton>
          </div>
        </div>
      )}

      {/* === Drawer notas === */}
      <AdminDrawer
        open={!!notesEntry}
        onClose={() => setNotesEntry(null)}
        eyebrow="NOTAS INTERNAS"
        title={notesEntry?.subject ?? ""}
        footer={
          <>
            <AdminButton
              variant="ghost"
              onClick={() => setNotesEntry(null)}
              disabled={busyId === notesEntry?.id}
            >
              Cancelar
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={handleSaveNotes}
              loading={busyId === notesEntry?.id}
            >
              Salvar
            </AdminButton>
          </>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <p className="urban-admin-eyebrow-muted">DE</p>
          <p
            style={{
              fontSize: 13,
              color: "var(--admin-text)",
              margin: "6px 0 0",
            }}
          >
            {notesEntry?.name} · {notesEntry?.email}
          </p>
        </div>
        <AdminTextarea
          label="Notas (visíveis só pra equipe admin)"
          rows={10}
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          placeholder="Ex: cliente quer demo, follow-up em 1 semana, parceiro estratégico…"
        />
      </AdminDrawer>
    </div>
  );
}

function StatusBadge({ status }: { status: ContactSubmissionStatus }) {
  const map: Record<ContactSubmissionStatus, { kind: AdminBadgeKind; label: string }> = {
    new: { kind: "warn", label: STATUS_LABELS.new },
    in_progress: { kind: "accent", label: STATUS_LABELS.in_progress },
    resolved: { kind: "success", label: STATUS_LABELS.resolved },
    archived: { kind: "neutral", label: STATUS_LABELS.archived },
  };
  const it = map[status] ?? map.new;
  return <AdminBadge kind={it.kind}>{it.label}</AdminBadge>;
}
