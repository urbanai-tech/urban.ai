"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminContactSubmissions,
  updateAdminContactSubmission,
  type ContactSubmission,
  type ContactSubmissionListResponse,
  type ContactSubmissionStatus,
} from "../../service/api";

const STATUS_LABELS: Record<ContactSubmissionStatus, string> = {
  new: "Novo",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  archived: "Arquivado",
};

export default function AdminContactsPage() {
  const [data, setData] = useState<ContactSubmissionListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactSubmissionStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401 || status === 403
          ? "Acesso negado."
          : err?.message || "Erro ao carregar contatos.",
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
      await load();
    } catch (err: any) {
      alert("Erro: " + (err?.response?.data?.message || err?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  async function editNotes(entry: ContactSubmission) {
    const notes = prompt("Notas internas:", entry.notes ?? "");
    if (notes === null) return;
    setBusyId(entry.id);
    try {
      await updateAdminContactSubmission(entry.id, { notes: notes || null });
      await load();
    } catch (err: any) {
      alert("Erro: " + (err?.response?.data?.message || err?.message || "falhou"));
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
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Contatos</h1>
            <p className="text-sm text-slate-400">
              Mensagens enviadas pelo formulario publico de contato.
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">
            Voltar
          </a>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Nesta pagina" value={(data?.items.length ?? 0).toLocaleString("pt-BR")} />
          <Stat label="Novos no filtro" value={counts.new.toLocaleString("pt-BR")} color="text-orange-300" />
          <Stat
            label="Em andamento no filtro"
            value={counts.in_progress.toLocaleString("pt-BR")}
            color="text-sky-300"
          />
          <Stat
            label="Total filtrado"
            value={(data?.total ?? 0).toLocaleString("pt-BR")}
            color="text-emerald-300"
          />
        </section>

        <section className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            placeholder="Buscar por nome, email, assunto ou mensagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ContactSubmissionStatus | "all");
              setPage(1);
            }}
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          >
            <option value="all">Todos status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              load();
            }}
            className="px-4 py-2 rounded bg-emerald-500 text-slate-900 font-bold text-sm"
          >
            Buscar
          </button>
        </section>

        <section className="border border-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-slate-500 text-sm">Carregando...</p>
          ) : !data || data.items.length === 0 ? (
            <p className="p-6 text-center text-slate-500 text-sm">Nenhuma mensagem encontrada.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {data.items.map((entry) => (
                <article key={entry.id} className="p-5 bg-slate-900/30">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={entry.status} />
                        <span className="text-xs text-slate-500">
                          {new Date(entry.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-50">{entry.subject}</h2>
                        <p className="text-sm text-slate-400">
                          {entry.name} -{" "}
                          <a className="text-emerald-300 hover:underline" href={`mailto:${entry.email}`}>
                            {entry.email}
                          </a>
                        </p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
                        {entry.message}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-slate-400 border-l-2 border-emerald-600 pl-3">
                          {entry.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-56">
                      <select
                        value={entry.status}
                        disabled={busyId === entry.id}
                        onChange={(e) =>
                          updateStatus(entry, e.target.value as ContactSubmissionStatus)
                        }
                        className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => editNotes(entry)}
                        className="px-3 py-2 rounded border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-50"
                      >
                        Notas internas
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {data && data.total > data.limit && (
          <section className="flex justify-between items-center text-sm">
            <span className="text-slate-500">
              Pagina {data.page} de {Math.ceil(data.total / data.limit)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page === 1}
                className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={data.page * data.limit >= data.total}
                className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-30"
              >
                Proxima
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

function StatusBadge({ status }: { status: ContactSubmissionStatus }) {
  const colors: Record<ContactSubmissionStatus, string> = {
    new: "bg-orange-700/40 text-orange-200",
    in_progress: "bg-sky-700/40 text-sky-200",
    resolved: "bg-emerald-700/40 text-emerald-200",
    archived: "bg-slate-700 text-slate-200",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold ${colors[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
