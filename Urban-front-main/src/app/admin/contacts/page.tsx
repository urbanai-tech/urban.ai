"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminContactSubmissions,
  updateAdminContactSubmission,
  type ContactSubmission,
  type ContactSubmissionCategory,
  type ContactSubmissionListResponse,
  type ContactSubmissionSeverity,
  type ContactSubmissionStatus,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
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
import styles from "./page.module.css";

const STATUS_LABELS: Record<ContactSubmissionStatus, string> = {
  new: "Novo",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  archived: "Arquivado",
};

const CATEGORY_LABELS: Record<ContactSubmissionCategory, string> = {
  sales: "Comercial",
  support: "Suporte",
  billing: "Billing",
  privacy_lgpd: "LGPD",
  stays: "Stays",
  incident: "Incidente",
  partnership: "Parceria",
};

const SEVERITY_LABELS: Record<ContactSubmissionSeverity, string> = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
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
  const [categoryValue, setCategoryValue] = useState<ContactSubmissionCategory>("support");
  const [severityValue, setSeverityValue] = useState<ContactSubmissionSeverity>("P2");
  const [ownerValue, setOwnerValue] = useState("");
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
      await updateAdminContactSubmission(notesEntry.id, {
        category: categoryValue,
        severity: severityValue,
        assignedOwner: ownerValue || null,
        notes: notesValue || null,
      });
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
      <div className={styles.pageContainer}>
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
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · CONTATOS"
        title="Mensagens"
        subtitle="Mensagens enviadas pelo formulário público de contato."
      />

      {/* === KPIs === */}
      <section className={styles.kpiSection}>
        <div
          className={styles.kpiGrid}
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
        className={styles.filterBar}
      >
        <AdminInput
          placeholder="Buscar por nome, e-mail, assunto ou mensagem…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          leftAddon={<Icons.Search size={12} />}
          shellClassName={styles.searchShell}
        />
        <AdminSelect
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ContactSubmissionStatus | "all");
            setPage(1);
          }}
          shellClassName={styles.statusShell}
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
      <section className={styles.messagesSection}>
        {!data || data.items.length === 0 ? (
          <AdminEmptyState
            title="Nenhuma mensagem"
            body="Nenhuma mensagem encontrada com esses filtros."
          />
        ) : (
          <div className={styles.messageStack}>
            {data.items.map((entry) => (
              <AdminCard key={entry.id} variant="subtle">
                <div
                  className={styles.messageStack}
                >
                  <div
                    className={styles.messageHeader}
                  >
                    <div className={styles.messageInfo}>
                      <div
                        className={styles.badgeRow}
                      >
                        <StatusBadge status={entry.status} />
                        <SeverityBadge severity={entry.severity ?? "P2"} />
                        <CategoryBadge category={entry.category ?? "support"} />
                        <span
                          className={styles.messageDate}
                        >
                          {new Date(entry.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <h3
                        className={styles.messageSubject}
                      >
                        {entry.subject}
                      </h3>
                      <p
                        className={styles.messageSender}
                      >
                        {entry.name} ·{" "}
                        <a
                          href={`mailto:${entry.email}`}
                          className={styles.emailLink}
                        >
                          {entry.email}
                        </a>
                        {entry.dueAt && (
                          <span style={{ color: dueColor(entry.dueAt), marginLeft: 8 }}>
                            SLA: {new Date(entry.dueAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {entry.assignedOwner && (
                          <span className={styles.ownerLabel}>
                            Owner: {entry.assignedOwner}
                          </span>
                        )}
                      </p>
                    </div>
                    <div
                      className={styles.messageActions}
                    >
                      <AdminSelect
                        value={entry.status}
                        disabled={busyId === entry.id}
                        onChange={(e) =>
                          updateStatus(entry, e.target.value as ContactSubmissionStatus)
                        }
                        shellClassName={styles.rowStatusShell}
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
                          setCategoryValue(entry.category ?? "support");
                          setSeverityValue(entry.severity ?? "P2");
                          setOwnerValue(entry.assignedOwner ?? "");
                        }}
                        leftIcon={<Icons.Edit size={12} />}
                      >
                        Notas
                      </AdminButton>
                    </div>
                  </div>

                  <p
                    className={styles.messageBody}
                  >
                    {entry.message}
                  </p>

                  {entry.notes && (
                    <p
                      className={styles.messageNotes}
                    >
                      <span
                        className={`urban-admin-eyebrow-muted ${styles.notesEyebrow}`}
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
          className={styles.paginationBar}
        >
          <span>
            Página {data.page} de {totalPages}
          </span>
          <div className={styles.paginationButtons}>
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
        <div className={styles.modalSender}>
          <p className="urban-admin-eyebrow-muted">DE</p>
          <p
            className={styles.modalSenderValue}
          >
            {notesEntry?.name} · {notesEntry?.email}
          </p>
        </div>
        <div
          className={styles.modalFieldsGrid}
        >
          <AdminSelect
            label="Categoria"
            value={categoryValue}
            onChange={(e) => setCategoryValue(e.target.value as ContactSubmissionCategory)}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            label="Severidade"
            value={severityValue}
            onChange={(e) => setSeverityValue(e.target.value as ContactSubmissionSeverity)}
          >
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </AdminSelect>
          <AdminInput
            label="Owner"
            value={ownerValue}
            onChange={(e) => setOwnerValue(e.target.value)}
            placeholder="ex: suporte, Gustavo, legal"
          />
        </div>
        <AdminTextarea
          label="Notas internas (visíveis só para suporte/operação)"
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

function CategoryBadge({ category }: { category: ContactSubmissionCategory }) {
  const map: Record<ContactSubmissionCategory, { kind: AdminBadgeKind; label: string }> = {
    sales: { kind: "accent", label: CATEGORY_LABELS.sales },
    support: { kind: "neutral", label: CATEGORY_LABELS.support },
    billing: { kind: "warn", label: CATEGORY_LABELS.billing },
    privacy_lgpd: { kind: "warn", label: CATEGORY_LABELS.privacy_lgpd },
    stays: { kind: "accent", label: CATEGORY_LABELS.stays },
    incident: { kind: "error", label: CATEGORY_LABELS.incident },
    partnership: { kind: "success", label: CATEGORY_LABELS.partnership },
  };
  const it = map[category] ?? map.support;
  return <AdminBadge kind={it.kind}>{it.label}</AdminBadge>;
}

function SeverityBadge({ severity }: { severity: ContactSubmissionSeverity }) {
  const map: Record<ContactSubmissionSeverity, AdminBadgeKind> = {
    P0: "error",
    P1: "warn",
    P2: "accent",
    P3: "neutral",
  };
  return <AdminBadge kind={map[severity] ?? "neutral"}>{severity}</AdminBadge>;
}

function dueColor(value: string) {
  const due = new Date(value).getTime();
  if (!Number.isFinite(due)) return "var(--admin-text-muted)";
  return due < Date.now() ? "var(--admin-danger)" : "var(--admin-text-muted)";
}
