"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  fetchAdminUsers,
  setAdminUserRole,
  setAdminUserActive,
  type AdminUser,
  type AdminUsersFilters,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminButton,
  AdminTable,
  type AdminTableColumn,
  AdminSelect,
  AdminInput,
  AdminBadge,
  AdminEmptyState,
  AdminPageLoading,
  AdminConfirmDialog,
  useAdminToast,
  Icons,
} from "../_components";
import { roleLabel, statusLabel } from "../_lib/status-labels";
import {
  EMPTY_USER_FILTERS,
  filtersToQuery,
  hasActiveFilters,
  type UserFiltersForm,
} from "./users-filters";
import styles from "./page.module.css";

type UserRole = "host" | "admin" | "support";

/**
 * /admin/users — listagem e gestão de usuários.
 *
 * Migrado pro design system admin (.urban-admin):
 *  - AdminTable + hover orange.
 *  - confirm() de toggle ativo → AdminConfirmDialog.
 *  - confirm() de mudança de role → AdminConfirmDialog.
 *  - Badges status com AdminBadge.
 *  - alert() → useAdminToast.
 *
 * Busca e filtros (e-mail/nome/empresa, papel, status, plano, data de criação)
 * são aplicados no backend (GET /admin/users); a paginação preserva o filtro
 * aplicado. O formulário só consulta ao enviar (Enter ou "Filtrar").
 */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<UserFiltersForm>(EMPTY_USER_FILTERS);
  const [applied, setApplied] = useState<AdminUsersFilters>({});
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ user: AdminUser; role: UserRole } | null>(null);
  const [confirmActive, setConfirmActive] = useState<{ user: AdminUser; next: boolean } | null>(null);
  const toast = useAdminToast();

  const load = useCallback(async (p: number, filters: AdminUsersFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers(p, 20, filters);
      setUsers(res.data);
      setPage(res.page);
      setTotalPages(res.totalPages);
      setTotal(res.total);
      setApplied(filters);
      setLoadedOnce(true);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      if (status === 403 || status === 401) {
        setError("Acesso negado. Você precisa ser admin.");
      } else {
        setError(e?.message || "Erro ao carregar usuários.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    load(1, filtersToQuery(form));
  }

  function clearFilters() {
    setForm(EMPTY_USER_FILTERS);
    load(1);
  }

  async function applyRole() {
    if (!confirmRole) return;
    const { user, role } = confirmRole;
    setBusy(user.id);
    try {
      await setAdminUserRole(user.id, role);
      toast.success(`Papel de ${user.email || user.username} atualizado para ${roleLabel(role)}.`);
      setConfirmRole(null);
      await load(page, applied);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message || "falhou"));
    } finally {
      setBusy(null);
    }
  }

  async function applyActive() {
    if (!confirmActive) return;
    const { user, next } = confirmActive;
    setBusy(user.id);
    try {
      await setAdminUserActive(user.id, next);
      toast.success(`${user.email || user.username} ${next ? "ativado" : "desativado"}.`);
      setConfirmActive(null);
      await load(page, applied);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message || "falhou"));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !loadedOnce) {
    return <AdminPageLoading />;
  }

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar usuários"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={() => load(1, applied)}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const columns: AdminTableColumn<AdminUser>[] = [
    {
      key: "user",
      header: "Usuário",
      render: (u) => (
        <div>
          <p className={styles.usernameText}>
            {u.username}
          </p>
          {u.company && (
            <p
              className={styles.companyText}
            >
              {u.company}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "email",
      header: "E-mail",
      render: (u) => (
        <span className={styles.emailCell}>
          {u.email}
        </span>
      ),
    },
    {
      key: "role",
      header: "Papel",
      width: 170,
      render: (u) => (
        <AdminSelect
          aria-label="Papel do usuário"
          value={u.role}
          onChange={(e) =>
            setConfirmRole({ user: u, role: e.target.value as UserRole })
          }
          disabled={busy === u.id}
          shellClassName={styles.roleShell}
        >
          <option value="host">{roleLabel("host")}</option>
          <option value="admin">{roleLabel("admin")}</option>
          <option value="support">{roleLabel("support")}</option>
        </AdminSelect>
      ),
    },
    {
      key: "mode",
      header: "Modo",
      render: (u) => (
        <span className={styles.modeCell}>
          {u.operationMode ? statusLabel(u.operationMode) : "—"}
          {u.pricingStrategy && (
            <span className={styles.pricingStrategyText}>
              {" · "}
              {statusLabel(u.pricingStrategy)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "active",
      header: "Status",
      width: 130,
      align: "center",
      render: (u) => (
        <button
          type="button"
          onClick={() => setConfirmActive({ user: u, next: !u.ativo })}
          disabled={busy === u.id}
          className={styles.statusToggle}
          title={u.ativo ? "Clique para desativar" : "Clique para ativar"}
        >
          <AdminBadge kind={u.ativo ? "success" : "neutral"}>
            {u.ativo ? "Ativo" : "Inativo"}
          </AdminBadge>
        </button>
      ),
    },
    {
      key: "created",
      header: "Criado",
      width: 110,
      render: (u) => (
        <span
          className={styles.createdAtCell}
        >
          {new Date(u.createdAt).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · USUÁRIOS"
        title="Usuários"
        subtitle="Gestão de papéis e status de ativação. Mudanças aqui têm efeito imediato."
      />

      {/* === Busca e filtros === */}
      <form
        className={styles.filters}
        onSubmit={applyFilters}
        role="search"
        aria-label="Filtrar usuários"
      >
        <AdminInput
          label="Buscar"
          type="search"
          placeholder="E-mail, nome ou empresa"
          maxLength={120}
          value={form.q}
          onChange={(e) => setForm({ ...form, q: e.target.value })}
          shellClassName={styles.filterSearch}
        />
        <AdminSelect
          label="Papel"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as UserFiltersForm["role"] })}
        >
          <option value="">Todos</option>
          <option value="host">{roleLabel("host")}</option>
          <option value="admin">{roleLabel("admin")}</option>
          <option value="support">{roleLabel("support")}</option>
        </AdminSelect>
        <AdminSelect
          label="Status"
          value={form.ativo}
          onChange={(e) => setForm({ ...form, ativo: e.target.value as UserFiltersForm["ativo"] })}
        >
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </AdminSelect>
        <AdminInput
          label="Plano"
          placeholder="Ex.: profissional"
          maxLength={64}
          value={form.plan}
          onChange={(e) => setForm({ ...form, plan: e.target.value })}
        />
        <AdminInput
          label="Criado de"
          type="date"
          value={form.createdFrom}
          max={form.createdTo || undefined}
          onChange={(e) => setForm({ ...form, createdFrom: e.target.value })}
        />
        <AdminInput
          label="Criado até"
          type="date"
          value={form.createdTo}
          min={form.createdFrom || undefined}
          onChange={(e) => setForm({ ...form, createdTo: e.target.value })}
        />
        <div className={styles.filterActions}>
          <AdminButton type="submit" variant="primary" size="sm" disabled={loading}>
            Filtrar
          </AdminButton>
          <AdminButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={
              loading ||
              (!hasActiveFilters(applied) && !hasActiveFilters(filtersToQuery(form)))
            }
          >
            Limpar
          </AdminButton>
        </div>
      </form>
      <p className={styles.resultCount} role="status">
        {total === 1 ? "1 usuário" : `${total.toLocaleString("pt-BR")} usuários`}
        {hasActiveFilters(applied) ? " com os filtros aplicados" : ""}
      </p>

      {/* === Tabela === */}
      <AdminTable
        columns={columns}
        rows={users}
        rowKey={(r) => r.id}
        empty={
          hasActiveFilters(applied) ? (
            <AdminEmptyState
              title="Nenhum usuário encontrado"
              body="Nenhum usuário atende aos filtros aplicados. Ajuste ou limpe os filtros."
              action={
                <AdminButton variant="secondary" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </AdminButton>
              }
            />
          ) : (
            <AdminEmptyState
              title="Nenhum usuário"
              body="Nenhum usuário cadastrado ainda."
            />
          )
        }
      />

      {/* === Paginação === */}
      <div
        className={styles.pagination}
      >
        <span>
          Página {page} de {totalPages}
        </span>
        <div className={styles.paginationActions}>
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={() => load(Math.max(1, page - 1), applied)}
            disabled={page <= 1 || loading}
            leftIcon={<Icons.ArrowLeft size={11} />}
          >
            Anterior
          </AdminButton>
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={() => load(Math.min(totalPages, page + 1), applied)}
            disabled={page >= totalPages || loading}
            rightIcon={<Icons.ArrowRight size={11} />}
          >
            Próxima
          </AdminButton>
        </div>
      </div>

      {/* === Confirmação de papel === */}
      <AdminConfirmDialog
        open={!!confirmRole}
        onClose={() => setConfirmRole(null)}
        onConfirm={applyRole}
        title="Alterar papel"
        body={
          confirmRole
            ? `Mudar o papel de ${confirmRole.user.email || confirmRole.user.username} para "${roleLabel(confirmRole.role)}"? A mudança tem efeito imediato.`
            : ""
        }
        confirmLabel="Alterar"
        loading={busy === confirmRole?.user.id}
      />

      {/* === Confirm active === */}
      <AdminConfirmDialog
        open={!!confirmActive}
        onClose={() => setConfirmActive(null)}
        onConfirm={applyActive}
        title={confirmActive?.next ? "Ativar usuário" : "Desativar usuário"}
        body={
          confirmActive
            ? `${confirmActive.next ? "Ativar" : "Desativar"} ${confirmActive.user.email || confirmActive.user.username}? A mudança tem efeito imediato.`
            : ""
        }
        confirmLabel={confirmActive?.next ? "Ativar" : "Desativar"}
        destructive={!confirmActive?.next}
        loading={busy === confirmActive?.user.id}
      />
    </div>
  );
}
