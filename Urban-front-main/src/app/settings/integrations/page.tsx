"use client";

import { useEffect, useState } from "react";
import {
  staysConnect,
  staysDisconnect,
  staysListListings,
  staysSyncListings,
  type StaysAccountPublic,
  type StaysListingPublic,
} from "../../service/api";

/**
 * Settings › Integrações › Stays
 *
 * MVP do painel de integração. Permite:
 *  - conectar conta Stays (clientId + accessToken manual)
 *  - disparar sync das listings
 *  - ver listings sincronizados e status da conta
 *  - desconectar
 *
 * Ainda pendente (próximos passos):
 *  - OAuth 2.0 quando a Stays oferecer
 *  - matching auto entre listing Stays e imóvel Urban AI
 *  - seletor de operationMode por listing
 *  - histórico de PriceUpdate por listing
 */
export default function IntegrationsPage() {
  const [account, setAccount] = useState<StaysAccountPublic | null>(null);
  const [listings, setListings] = useState<StaysListingPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const items = await staysListListings();
        setListings(items);
        if (items.length > 0) {
          // inferimos que existe conta ativa se há listings cacheados
          setAccount({
            id: "unknown",
            status: "active",
            clientId: "",
            lastSyncAt: null,
          });
        }
      } catch {
        /* sem conta ainda — ok */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!consent) {
      setSubmitError("Você precisa marcar o consentimento para continuar.");
      return;
    }
    if (!clientId.trim() || !accessToken.trim()) {
      setSubmitError("Preencha Client ID e Access Token.");
      return;
    }

    setSubmitBusy(true);
    try {
      const acc = await staysConnect(clientId.trim(), accessToken.trim());
      setAccount(acc);
      setAccessToken(""); // limpa o campo — não manter token em memória do browser mais do que o necessário
      const sync = await staysSyncListings();
      setListings(sync.listings);
    } catch (err) {
      const msg = (err as Error)?.message || "Erro ao conectar.";
      setSubmitError(msg);
    } finally {
      setSubmitBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Tem certeza? Isso desativa o modo autônomo em todos os imóveis.")) return;
    await staysDisconnect();
    setAccount(null);
    setListings([]);
  }

  async function handleResync() {
    setLoading(true);
    try {
      const sync = await staysSyncListings();
      setListings(sync.listings);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-slate-400">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">Integrações</h1>
        <p className="text-slate-400">
          Conecte sua conta Stays para habilitar o modo automático de precificação.
        </p>
      </header>

      {/* === Bloco: conectar Stays === */}
      {!account || account.status === "disconnected" ? (
        <section className="border border-slate-800 rounded-xl p-6 bg-slate-900/60">
          <h2 className="text-xl font-bold mb-4">Conectar Stays</h2>
          <p className="text-sm text-slate-400 mb-4">
            No seu painel Stays, vá em <span className="font-mono">App Center → Open API → Generate credentials</span>.
            Cole <strong>Client ID</strong> e <strong>Access Token</strong> abaixo. A Urban AI nunca vê sua senha Stays.
          </p>
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label htmlFor="stays-client-id" className="block text-sm font-semibold mb-1">
                Client ID
              </label>
              <input
                id="stays-client-id"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={submitBusy}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="stays-access-token" className="block text-sm font-semibold mb-1">
                Access Token
              </label>
              <input
                id="stays-access-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                disabled={submitBusy}
                autoComplete="off"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 accent-emerald-500"
              />
              <span>
                Ao conectar minha conta Stays, autorizo a Urban AI a:
                <br />
                • ler meus anúncios, calendário e histórico de reservas
                <br />
                • aplicar preços sugeridos pela IA aos meus anúncios
                <br />
                • armazenar esse histórico enquanto minha assinatura estiver ativa
                <br />
                Posso desconectar a qualquer momento — os dados vinculados ao Airbnb/Stays serão apagados em até 15 dias.
              </span>
            </label>
            {submitError && (
              <p role="alert" className="text-red-400 text-sm">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitBusy || !consent}
              className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitBusy ? "Conectando…" : "Conectar Stays"}
            </button>
          </form>
        </section>
      ) : (
        <section className="border border-emerald-800/60 rounded-xl p-6 bg-emerald-950/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Stays conectada</h2>
            <button
              onClick={handleDisconnect}
              className="text-sm text-red-400 hover:text-red-300 underline"
            >
              Desconectar
            </button>
          </div>
          <p className="text-sm text-slate-300 mb-4">
            Status: <span className="font-bold">{account.status}</span>
            {account.lastSyncAt && <> · última sincronização: {new Date(account.lastSyncAt).toLocaleString("pt-BR")}</>}
          </p>
          <button
            onClick={handleResync}
            className="px-4 py-2 rounded-lg border border-emerald-500 text-emerald-300 hover:bg-emerald-500/10 text-sm"
          >
            Sincronizar listings
          </button>
        </section>
      )}

      {/* === Bloco: listings === */}
      {listings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">Seus listings Stays ({listings.length})</h2>
          <div className="space-y-3">
            {listings.map((l) => (
              <div
                key={l.id}
                className="border border-slate-800 rounded-lg p-4 bg-slate-900/40 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{l.title || "(sem título)"}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {l.shortAddress || "—"} · ID Stays: {l.staysListingId}
                  </p>
                  <p className="text-xs text-slate-500">
                    Modo: <span className="font-mono">{l.operationMode}</span> ·
                    {l.propriedadeId ? ` vinculado a imóvel Urban AI` : " ainda não vinculado"}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    l.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {l.active ? "ativo" : "inativo"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
