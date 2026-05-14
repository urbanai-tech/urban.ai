"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchAdminAuditLogs,
  type AdminAuditLog,
  type AdminAuditLogsResponse,
} from "../../service/api";

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
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Erro ao carregar logs de auditoria.");
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-bold">Admin</p>
            <h1 className="text-3xl font-bold mt-1">Auditoria</h1>
            <p className="text-slate-400 mt-2">
              Historico de alteracoes sensiveis feitas dentro do painel administrativo.
            </p>
          </div>
          <a
            href="/admin"
            className="px-4 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-900"
          >
            Voltar ao painel
          </a>
        </header>

        <form
          onSubmit={applyFilters}
          className="grid grid-cols-1 md:grid-cols-5 gap-3 border border-slate-800 bg-slate-900/40 rounded-xl p-4"
        >
          <FilterInput
            label="Acao"
            value={filters.action}
            onChange={(value) => setFilters((prev) => ({ ...prev, action: value }))}
            placeholder="finance.cost_update"
          />
          <FilterInput
            label="Entidade"
            value={filters.entityType}
            onChange={(value) => setFilters((prev) => ({ ...prev, entityType: value }))}
            placeholder="user"
          />
          <FilterInput
            label="ID da entidade"
            value={filters.entityId}
            onChange={(value) => setFilters((prev) => ({ ...prev, entityId: value }))}
          />
          <FilterInput
            label="Admin"
            value={filters.actorUserId}
            onChange={(value) => setFilters((prev) => ({ ...prev, actorUserId: value }))}
            placeholder="userId"
          />
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400"
            >
              Filtrar
            </button>
          </div>
        </form>

        {error && (
          <div className="border border-red-800 bg-red-950/30 rounded-xl p-4 text-red-100">
            {error}
          </div>
        )}

        <section className="border border-slate-800 bg-slate-900/40 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-800">
            <p className="text-sm text-slate-300">
              {loading ? "Carregando..." : `${data?.total ?? 0} registros encontrados`}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-40 hover:bg-slate-800"
              >
                Anterior
              </button>
              <span className="text-slate-400">
                {page}/{pages}
              </span>
              <button
                type="button"
                disabled={page >= pages || loading}
                onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-40 hover:bg-slate-800"
              >
                Proxima
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Quando</th>
                  <th className="text-left px-4 py-3 font-medium">Acao</th>
                  <th className="text-left px-4 py-3 font-medium">Entidade</th>
                  <th className="text-left px-4 py-3 font-medium">Admin</th>
                  <th className="text-left px-4 py-3 font-medium">Depois</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
                {!loading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-sm">
      <span className="block text-slate-400 mb-1">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-emerald-500"
      />
    </label>
  );
}

function AuditRow({ log }: { log: AdminAuditLog }) {
  return (
    <tr className="border-t border-slate-800 align-top">
      <td className="px-4 py-3 whitespace-nowrap text-slate-300">
        {formatDate(log.createdAt)}
      </td>
      <td className="px-4 py-3">
        <code className="text-emerald-300">{log.action}</code>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{log.entityType}</div>
        {log.entityId && <code className="text-xs text-slate-500">{log.entityId}</code>}
      </td>
      <td className="px-4 py-3">
        <code className="text-xs text-slate-400">{log.actorUserId || "sistema"}</code>
      </td>
      <td className="px-4 py-3 min-w-[280px] max-w-[520px]">
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-300">
          {shortJson(log.after ?? log.metadata ?? log.before)}
        </pre>
      </td>
    </tr>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortJson(value: unknown) {
  if (value == null) return "-";
  const text = JSON.stringify(value, null, 2);
  return text.length > 900 ? `${text.slice(0, 900)}...` : text;
}
