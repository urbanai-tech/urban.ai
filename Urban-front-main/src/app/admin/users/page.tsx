"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminUsers,
  setAdminUserRole,
  setAdminUserActive,
  type AdminUser,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminButton,
  AdminTable,
  type AdminTableColumn,
  AdminSelect,
  AdminBadge,
  AdminEmptyState,
  AdminPageLoading,
  AdminConfirmDialog,
  useAdminToast,
  Icons,
} from "../_components";

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
 */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ user: AdminUser; role: UserRole } | null>(null);
  const [confirmActive, setConfirmActive] = useState<{ user: AdminUser; next: boolean } | null>(null);
  const toast = useAdminToast();

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers(p, 20);
      setUsers(res.data);
      setPage(res.page);
      setTotalPages(res.totalPages);
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

  async function applyRole() {
    if (!confirmRole) return;
    const { user, role } = confirmRole;
    setBusy(user.id);
    try {
      await setAdminUserRole(user.id, role);
      toast.success(`Role de ${user.email || user.username} atualizada para ${role}.`);
      setConfirmRole(null);
      await load(page);
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
      await load(page);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message || "falhou"));
    } finally {
      setBusy(null);
    }
  }

  if (loading && users.length === 0) {
    return <AdminPageLoading />;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar usuários"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={() => load(1)}>
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
          <p style={{ fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>
            {u.username}
          </p>
          {u.company && (
            <p
              style={{
                fontSize: 11,
                color: "var(--admin-text-dim)",
                margin: "2px 0 0",
              }}
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
        <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>
          {u.email}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: 140,
      render: (u) => (
        <AdminSelect
          value={u.role}
          onChange={(e) =>
            setConfirmRole({ user: u, role: e.target.value as UserRole })
          }
          disabled={busy === u.id}
          shellStyle={{ width: 120 }}
        >
          <option value="host">host</option>
          <option value="admin">admin</option>
          <option value="support">support</option>
        </AdminSelect>
      ),
    },
    {
      key: "mode",
      header: "Modo",
      render: (u) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {u.operationMode || "—"}
          {u.pricingStrategy && (
            <span style={{ color: "var(--admin-text-dim)" }}>
              {" · "}
              {u.pricingStrategy}
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
          style={{
            background: "transparent",
            border: "none",
            cursor: busy === u.id ? "not-allowed" : "pointer",
            padding: 0,
            opacity: busy === u.id ? 0.5 : 1,
          }}
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
          style={{
            fontSize: 12,
            color: "var(--admin-text-muted)",
            fontFamily: "monospace",
          }}
        >
          {new Date(u.createdAt).toLocaleDateString("pt-BR")}
        </span>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · USUÁRIOS"
        title="Usuários"
        subtitle="Gestão de roles e status de ativação. Mudanças aqui têm efeito imediato."
      />

      {/* === Tabela === */}
      <AdminTable
        columns={columns}
        rows={users}
        rowKey={(r) => r.id}
        empty={
          <AdminEmptyState
            title="Nenhum usuário"
            body="Nenhum usuário cadastrado ainda."
          />
        }
      />

      {/* === Paginação === */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
          fontSize: 12,
          color: "var(--admin-text-muted)",
        }}
      >
        <span>
          Página {page} de {totalPages}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={() => load(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            leftIcon={<Icons.ArrowLeft size={11} />}
          >
            Anterior
          </AdminButton>
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={() => load(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
            rightIcon={<Icons.ArrowRight size={11} />}
          >
            Próxima
          </AdminButton>
        </div>
      </div>

      {/* === Confirm role === */}
      <AdminConfirmDialog
        open={!!confirmRole}
        onClose={() => setConfirmRole(null)}
        onConfirm={applyRole}
        title="Alterar role"
        body={
          confirmRole
            ? `Mudar role de ${confirmRole.user.email || confirmRole.user.username} para "${confirmRole.role}"? A mudança tem efeito imediato.`
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
