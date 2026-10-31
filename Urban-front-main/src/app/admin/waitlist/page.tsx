"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminWaitlist,
  fetchAdminWaitlistStats,
  inviteWaitlistEntry,
  updateWaitlistNotes,
  deleteWaitlistEntry,
  type WaitlistEntry,
  type WaitlistListResponse,
  type WaitlistStats,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminSelect,
  AdminBadge,
  AdminMetricCard,
  AdminEmptyState,
  AdminPageLoading,
  AdminConfirmDialog,
  AdminDrawer,
  AdminTextarea,
  useAdminToast,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";
import styles from "./page.module.css";

/**
 * /admin/waitlist — gestão da lista de espera (F8.2 admin).
 *
 * Migrado para design system admin (.urban-admin):
 *  - 4 KPIs em grid plano sem cards arredondados.
 *  - Tabela com AdminTable + row hover orange.
 *  - prompt() nativo para edit de notas → AdminDrawer.
 *  - confirm() nativo para invite/delete → AdminConfirmDialog.
 *  - alert() nativo para resultado → AdminToast.
 *  - Ações ("Convidar Notas Remover") com espaçamento + ícones.
 */
export default function AdminWaitlistPage() {
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [data, setData] = useState<WaitlistListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{ email: string; inviteUrl: string } | null>(null);

  // Confirm/drawer state
  const [confirmInvite, setConfirmInvite] = useState<WaitlistEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WaitlistEntry | null>(null);
  const [notesEntry, setNotesEntry] = useState<WaitlistEntry | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const toast = useAdminToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        fetchAdminWaitlist({
          page,
          limit: 20,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
        }),
        fetchAdminWaitlistStats(),
      ]);
      setData(list);
      setStats(st);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(
        status === 401 || status === 403
          ? "Acesso negado."
          : e?.message || "Erro ao carregar.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  async function handleInvite() {
    if (!confirmInvite) return;
    setBusyId(confirmInvite.id);
    try {
      const result = await inviteWaitlistEntry(confirmInvite.id);
      setLastInvite({ email: confirmInvite.email, inviteUrl: result.inviteUrl });
      toast.success(
        result.emailSent
          ? confirmInvite.status === "invited"
            ? "Convite reenviado!"
            : "Convite enviado!"
          : "Link gerado, mas o e-mail falhou. Copie o link e envie por outro canal.",
      );
      setConfirmInvite(null);
      load();
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

  async function handleDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await deleteWaitlistEntry(confirmDelete.id);
      toast.success(`${confirmDelete.email} removido.`);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveNotes() {
    if (!notesEntry) return;
    setBusyId(notesEntry.id);
    try {
      await updateWaitlistNotes(notesEntry.id, notesValue || null);
      toast.success("Notas atualizadas.");
      setNotesEntry(null);
      load();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar waitlist"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
        />
      </div>
    );
  }

  const columns: AdminTableColumn<WaitlistEntry>[] = [
    {
      key: "position",
      header: "#",
      width: 64,
      render: (e) => (
        <code className={styles.positionCode}>
          #{e.position}
        </code>
      ),
    },
    {
      key: "email",
      header: "E-mail",
      render: (e) => (
        <span className={styles.emailCell}>{e.email}</span>
      ),
    },
    {
      key: "name",
      header: "Nome",
      render: (e) => (
        <span className={styles.nameCell}>
          {e.name || "—"}
        </span>
      ),
    },
    {
      key: "source",
      header: "Origem",
      width: 120,
      render: (e) => (
        <code className={styles.sourceCode}>
          {e.source}
        </code>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      align: "center",
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      key: "refs",
      header: "Indicações",
      width: 100,
      align: "center",
      render: (e) =>
        e.referralsCount > 0 ? (
          <span className={styles.accentCount}>
            ×{e.referralsCount}
          </span>
        ) : (
          <span className={styles.emptyDash}>—</span>
        ),
    },
    {
      key: "created",
      header: "Criado em",
      width: 110,
      render: (e) => (
        <span
          className={styles.dateCell}
        >
          {new Date(e.createdAt).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      width: 200,
      align: "right",
      render: (e) => (
        <div
          className={styles.rowActions}
        >
          {(e.status === "pending" || e.status === "invited") && (
            <AdminButton
              variant="primary"
              size="sm"
              disabled={busyId === e.id}
              onClick={() => setConfirmInvite(e)}
              leftIcon={<Icons.Mail size={11} />}
            >
              {e.status === "invited" ? "Reenviar" : "Convidar"}
            </AdminButton>
          )}
          <AdminButton
            variant="ghost"
            size="sm"
            disabled={busyId === e.id}
            onClick={() => {
              setNotesEntry(e);
              setNotesValue(e.notes ?? "");
            }}
            leftIcon={<Icons.Edit size={11} />}
          >
            Notas
          </AdminButton>
          <AdminButton
            variant="danger"
            size="sm"
            disabled={busyId === e.id}
            onClick={() => setConfirmDelete(e)}
            leftIcon={<Icons.Trash size={11} />}
          >
            Remover
          </AdminButton>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · LISTA DE ESPERA"
        title="Pré-lançamento (F8)"
        subtitle="Gestão da waitlist. Convites geram magic link válido por 7 dias."
      />

      {/* === KPIs === */}
      {stats && (
        <section className={styles.kpiSection}>
          <div
            className={styles.kpiGrid}
          >
            <AdminMetricCard label="Total na fila" value={stats.total} />
            <AdminMetricCard
              label="Pendentes"
              value={stats.byStatus.find((s) => s.status === "pending")?.count ?? 0}
            />
            <AdminMetricCard
              label="Convidados"
              value={stats.byStatus.find((s) => s.status === "invited")?.count ?? 0}
              status="warn"
            />
            <AdminMetricCard
              label="Convertidos"
              value={stats.byStatus.find((s) => s.status === "converted")?.count ?? 0}
              status="success"
            />
          </div>
        </section>
      )}

      {/* === Origens + Top referrers === */}
      {stats && (
        <section
          className={styles.statsGrid}
        >
          <AdminCard variant="subtle">
            <AdminCardHeader title="Origens" />
            {stats.bySource.length === 0 ? (
              <p className={styles.emptyHint}>
                Sem dados ainda.
              </p>
            ) : (
              <ul className={styles.statsList}>
                {stats.bySource.map((s) => (
                  <li
                    key={s.source}
                    className={styles.sourceItem}
                  >
                    <code className={styles.sourceLabel}>{s.source}</code>
                    <span className={styles.accentCount}>
                      {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard variant="subtle">
            <AdminCardHeader title="Top referrers" />
            {stats.topReferrers.length === 0 ? (
              <p className={styles.emptyHint}>
                Ninguém indicou ainda.
              </p>
            ) : (
              <ul className={styles.statsList}>
                {stats.topReferrers.map((r) => (
                  <li
                    key={r.referralCode}
                    className={styles.referrerItem}
                  >
                    <span
                      className={styles.referrerEmail}
                    >
                      {r.email}
                    </span>
                    <span className={styles.accentCount}>
                      ×{r.referralsCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </section>
      )}

      {/* === Último convite gerado === */}
      {lastInvite && (
        <section className={styles.inviteSection}>
          <AdminCard variant="accent">
            <AdminCardHeader
              eyebrow="ÚLTIMO CONVITE GERADO"
              title={lastInvite.email}
              actions={
                <AdminButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setLastInvite(null)}
                  leftIcon={<Icons.Close size={11} />}
                >
                  Fechar
                </AdminButton>
              }
            />
            <p
              className={styles.inviteHint}
            >
              Magic link válido por 7 dias. Use para smoke manual ou reenvio
              por outro canal.
            </p>
            <div className={styles.inviteRow}>
              <AdminInput
                readOnly
                value={lastInvite.inviteUrl}
                shellClassName={styles.inviteUrlShell}
              />
              <AdminButton
                variant="primary"
                onClick={() => {
                  navigator.clipboard?.writeText(lastInvite.inviteUrl);
                  toast.success("Link copiado para a área de transferência.");
                }}
                leftIcon={<Icons.Check size={12} />}
              >
                Copiar link
              </AdminButton>
            </div>
          </AdminCard>
        </section>
      )}

      {/* === Filtros toolbar === */}
      <section
        className={styles.filterBar}
      >
        <AdminInput
          placeholder="Buscar por email ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          leftAddon={<Icons.Search size={12} />}
          shellClassName={styles.searchShell}
        />
        <AdminSelect
          aria-label="Filtrar por status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          shellClassName={styles.statusShell}
        >
          <option value="">Todos status</option>
          <option value="pending">Pendentes</option>
          <option value="invited">Convidados</option>
          <option value="converted">Convertidos</option>
          <option value="declined">Declinados</option>
        </AdminSelect>
        <AdminButton
          variant="primary"
          onClick={() => load()}
          leftIcon={<Icons.Search size={12} />}
        >
          Buscar
        </AdminButton>
      </section>

      {/* === Tabela === */}
      {loading && !data ? (
        <AdminPageLoading showHeader={false} showKpis={false} />
      ) : (
        <AdminTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          empty={<AdminEmptyState title="Lista vazia" body="Ninguém na waitlist ainda." />}
        />
      )}

      {/* === Paginação === */}
      {data && data.total > data.limit && (
        <div
          className={styles.paginationBar}
        >
          <span>
            Página {data.page} · {data.total.toLocaleString("pt-BR")} no total
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

      {/* === Confirm invite === */}
      <AdminConfirmDialog
        open={!!confirmInvite}
        onClose={() => setConfirmInvite(null)}
        onConfirm={handleInvite}
        title={
          confirmInvite?.status === "invited"
            ? "Reenviar convite"
            : "Enviar convite"
        }
        body={`${confirmInvite?.status === "invited" ? "Reenviar" : "Gerar e enviar"} magic link para ${confirmInvite?.email}? Validade: 7 dias.`}
        confirmLabel={confirmInvite?.status === "invited" ? "Reenviar" : "Enviar"}
        loading={busyId === confirmInvite?.id}
      />

      {/* === Confirm delete === */}
      <AdminConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={`Remover ${confirmDelete?.email}?`}
        body="Esta ação é permanente. O usuário não receberá mais convite."
        confirmLabel="Remover"
        destructive
        loading={busyId === confirmDelete?.id}
      />

      {/* === Drawer notas === */}
      <AdminDrawer
        open={!!notesEntry}
        onClose={() => setNotesEntry(null)}
        eyebrow="NOTAS INTERNAS"
        title={notesEntry?.email ?? ""}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setNotesEntry(null)} disabled={busyId === notesEntry?.id}>
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
        <AdminTextarea
          label="Notas (visível só pra equipe admin)"
          rows={8}
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          placeholder="Ex: indicado por parceiro, pediu desconto, espera follow-up em 2 semanas…"
        />
      </AdminDrawer>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { kind: AdminBadgeKind; label: string }> = {
    pending: { kind: "neutral", label: "Pendente" },
    invited: { kind: "warn", label: "Convidado" },
    converted: { kind: "success", label: "Convertido" },
    declined: { kind: "error", label: "Declinado" },
  };
  const it = map[status] ?? map.pending;
  return <AdminBadge kind={it.kind}>{it.label}</AdminBadge>;
}
