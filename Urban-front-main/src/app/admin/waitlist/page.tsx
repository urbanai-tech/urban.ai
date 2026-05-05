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

/**
 * /admin/waitlist — gestão da lista de espera (F8.2 admin).
 *
 * Mostra:
 *  - Stats (total, byStatus, bySource, top referrers)
 *  - Lista paginada com search + filtro de status
 *  - Ações: Convidar (gera magic link + email), Editar notas, Remover
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
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401 || status === 403
          ? "Acesso negado."
          : err?.message || "Erro ao carregar.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  async function handleInvite(entry: WaitlistEntry) {
    if (!confirm(`Enviar convite para ${entry.email}?`)) return;
    setBusyId(entry.id);
    try {
      await inviteWaitlistEntry(entry.id);
      alert("Convite enviado!");
      load();
    } catch (err: any) {
      alert("Erro: " + (err?.response?.data?.message || err?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(entry: WaitlistEntry) {
    if (!confirm(`Remover ${entry.email} da lista? Não pode ser desfeito.`)) return;
    setBusyId(entry.id);
    try {
      await deleteWaitlistEntry(entry.id);
      load();
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleEditNotes(entry: WaitlistEntry) {
    const newNotes = prompt("Notas internas:", entry.notes ?? "");
    if (newNotes === null) return;
    setBusyId(entry.id);
    try {
      await updateWaitlistNotes(entry.id, newNotes || null);
      load();
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lista de Espera</h1>
            <p className="text-sm text-slate-400">
              Gestão da waitlist do pré-lançamento (F8). Convites geram magic
              link válido por 7 dias.
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">
            ← Voltar
          </a>
        </header>

        {/* Stats */}
        {stats && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total na fila" value={stats.total.toLocaleString("pt-BR")} />
            <Stat
              label="Pendentes"
              value={
                stats.byStatus.find((s) => s.status === "pending")?.count.toLocaleString("pt-BR") ?? "0"
              }
            />
            <Stat
              label="Convidados"
              value={
                stats.byStatus.find((s) => s.status === "invited")?.count.toLocaleString("pt-BR") ?? "0"
              }
              color="text-amber-300"
            />
            <Stat
              label="Convertidos"
              value={
                stats.byStatus.find((s) => s.status === "converted")?.count.toLocaleString("pt-BR") ?? "0"
              }
              color="text-emerald-400"
            />
          </section>
        )}

        {/* Source breakdown + top referrers */}
        {stats && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Origens</h3>
              {stats.bySource.length === 0 ? (
                <p className="text-xs text-slate-500">Sem dados ainda.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {stats.bySource.map((s) => (
                    <li key={s.source} className="flex justify-between">
                      <code className="text-slate-300">{s.source}</code>
                      <span className="font-bold text-emerald-300">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Top referrers</h3>
              {stats.topReferrers.length === 0 ? (
                <p className="text-xs text-slate-500">Ninguém indicou ainda.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {stats.topReferrers.map((r) => (
                    <li key={r.referralCode} className="flex justify-between items-center">
                      <span className="truncate text-slate-300">{r.email}</span>
                      <span className="font-bold text-orange-300 ml-2">×{r.referralsCount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Filtros */}
        <section className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            placeholder="Buscar por email ou nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          >
            <option value="">Todos status</option>
            <option value="pending">Pendentes</option>
            <option value="invited">Convidados</option>
            <option value="converted">Convertidos</option>
            <option value="declined">Declinados</option>
          </select>
          <button
            onClick={() => load()}
            className="px-4 py-2 rounded bg-emerald-500 text-slate-900 font-bold text-sm"
          >
            Buscar
          </button>
        </section>

        {/* Tabela */}
        <section className="border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">E-mail</th>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Origem</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Indicações</th>
                <th className="px-3 py-2 text-left">Criado em</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    Carregando…
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500 text-xs">
                    Lista vazia.
                  </td>
                </tr>
              ) : (
                data.items.map((e) => (
                  <tr key={e.id} className="border-t border-slate-800 hover:bg-slate-900/30">
                    <td className="px-3 py-2 font-mono text-emerald-300">#{e.position}</td>
                    <td className="px-3 py-2">{e.email}</td>
                    <td className="px-3 py-2 text-slate-400">{e.name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      <code>{e.source}</code>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-3 py-2 text-center text-orange-300">
                      {e.referralsCount > 0 ? `×${e.referralsCount}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        {e.status === "pending" && (
                          <button
                            onClick={() => handleInvite(e)}
                            disabled={busyId === e.id}
                            className="text-xs px-2 py-1 rounded bg-emerald-500 text-slate-900 font-bold disabled:opacity-50"
                          >
                            Convidar
                          </button>
                        )}
                        <button
                          onClick={() => handleEditNotes(e)}
                          disabled={busyId === e.id}
                          className="text-xs px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
                        >
                          Notas
                        </button>
                        <button
                          onClick={() => handleDelete(e)}
                          disabled={busyId === e.id}
                          className="text-xs px-2 py-1 rounded border border-red-700/40 text-red-300 hover:bg-red-950/30"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Paginação */}
        {data && data.total > data.limit && (
          <section className="flex justify-between items-center text-sm">
            <span className="text-slate-500">
              Página {data.page} · {data.total.toLocaleString("pt-BR")} no total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page === 1}
                className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.page * data.limit >= data.total}
                className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-30"
              >
                Próxima →
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? "text-slate-50"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-slate-700 text-slate-200",
    invited: "bg-amber-700/40 text-amber-200",
    converted: "bg-emerald-700/40 text-emerald-200",
    declined: "bg-red-900/40 text-red-300",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold ${colors[status] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}
