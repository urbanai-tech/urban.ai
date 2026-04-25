"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminUsers,
  setAdminUserRole,
  setAdminUserActive,
  type AdminUser,
} from "../../service/api";

/**
 * /admin/users — listagem e gestão de usuários.
 *
 * MVP: paginação simples + toggle de ativo + selector de role.
 * Próximos: busca, filtro por role, export CSV, ver detalhe do user.
 */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(p = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers(p, 20);
      setUsers(res.data);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403 || status === 401) {
        setError("Acesso negado. Você precisa ser admin.");
      } else {
        setError(err?.message || "Erro ao carregar usuários.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  async function handleRoleChange(userId: string, role: "host" | "admin" | "support") {
    setBusy(userId);
    try {
      await setAdminUserRole(userId, role);
      await load();
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleActive(userId: string, ativo: boolean) {
    setBusy(userId);
    try {
      await setAdminUserActive(userId, ativo);
      await load();
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Usuários</h1>
            <p className="text-slate-400 text-sm">
              Gestão de roles e status de ativação. Mudanças aqui têm efeito imediato.
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">
            ← Voltar ao painel
          </a>
        </header>

        {error && (
          <div className="p-4 border border-red-700 rounded-xl bg-red-950/30 text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">Carregando…</p>
        ) : (
          <>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Usuário</th>
                    <th className="px-4 py-3 text-left">E-mail</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Modo</th>
                    <th className="px-4 py-3 text-center">Ativo</th>
                    <th className="px-4 py-3 text-left">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{u.username}</p>
                        {u.company && <p className="text-xs text-slate-500">{u.company}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(
                              u.id,
                              e.target.value as "host" | "admin" | "support",
                            )
                          }
                          disabled={busy === u.id}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                        >
                          <option value="host">host</option>
                          <option value="admin">admin</option>
                          <option value="support">support</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {u.operationMode || "—"}
                        {u.pricingStrategy && ` · ${u.pricingStrategy}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(u.id, !u.ativo)}
                          disabled={busy === u.id}
                          className={`px-3 py-1 rounded text-xs font-bold ${
                            u.ativo
                              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                          }`}
                        >
                          {u.ativo ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-sm text-slate-400">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => load(Math.max(1, page - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => load(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
