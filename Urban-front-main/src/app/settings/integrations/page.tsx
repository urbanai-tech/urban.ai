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
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppCardHeader,
  AppButton,
  AppBadge,
  AppMetricCard,
  AppInput,
  AppEmptyState,
  Icons,
} from "../../componentes/ui";

const STAYS_CONSENT_VERSION = "stays-connect-v1";

const operationModeLabels: Record<StaysListingPublic["operationMode"], string> = {
  inherit: "Herdar padrão",
  notifications: "Recomendação manual",
  auto: "Automático beta",
};

function formatStaysDate(value?: string | null) {
  if (!value) return "Não registrado";
  return new Date(value).toLocaleString("pt-BR");
}

/**
 * /settings/integrations — Stays.
 *
 * REESCRITO no Sprint 3 do redesign anfitrião (auditoria UI/UX 2026-05-16).
 * Antes era a pior tela do app (P0 do relatório do usuário):
 *  - Bloco dark `bg-slate-900` sobre fundo claro com texto `text-slate-400`,
 *    ilegível. CTAs apareciam como links.
 *  - Resultado: tela representa CONFIANÇA na integração crítica e parecia
 *    debug interno.
 *
 * Agora: tela de confiança em light premium. Seções claras:
 *  1. Status da conexão (success/falha/desconectada) com hero card.
 *  2. Permissões concedidas + última sincronização.
 *  3. Listings sincronizados com modo operacional por listing.
 *  4. Zona perigosa (desconectar) separada visualmente.
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
  const [resyncBusy, setResyncBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const items = await staysListListings();
        setListings(items);
        if (items.length > 0) {
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
      const acc = await staysConnect(clientId.trim(), accessToken.trim(), {
        consentAccepted: consent,
        consentVersion: STAYS_CONSENT_VERSION,
      });
      setAccount(acc);
      setAccessToken("");
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
    setConfirmDisconnect(false);
    await staysDisconnect();
    setAccount(null);
    setListings([]);
  }

  async function handleResync() {
    setResyncBusy(true);
    try {
      const sync = await staysSyncListings();
      setListings(sync.listings);
    } finally {
      setResyncBusy(false);
    }
  }

  const activeListings = listings.filter((l) => l.active).length;
  const autoListings = listings.filter((l) => l.operationMode === "auto").length;
  const linkedListings = listings.filter((l) => Boolean(l.propriedadeId)).length;

  const isConnected = account && account.status !== "disconnected";

  if (loading) {
    return (
      <AppPageShell maxWidth={900}>
        <p style={{ color: "var(--app-text-muted)", fontSize: 14 }}>Carregando…</p>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={960}>
      <AppSectionHeader
        eyebrow="INTEGRAÇÕES · STAYS"
        title="Conexão com a Stays"
        subtitle="Conecte sua conta Stays para a Urban AI aplicar preços sugeridos automaticamente nos seus anúncios. Você pode desconectar a qualquer momento."
      />

      {!isConnected ? (
        // ====================== Não conectado: form de conexão ======================
        <AppCard variant="default" style={{ padding: 32 }}>
          <AppCardHeader
            eyebrow="CONFIGURAÇÃO INICIAL"
            title="Conectar conta Stays"
            subtitle={
              <>
                No painel Stays, abra{" "}
                <strong style={{ color: "var(--app-text)" }}>
                  App Center → Open API → Generate credentials
                </strong>{" "}
                e cole abaixo. A Urban AI nunca vê sua senha Stays.
              </>
            }
          />
          <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <AppInput
              label="Client ID"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={submitBusy}
              autoComplete="off"
              placeholder="ex: stays_xxxxxxx"
            />
            <AppInput
              label="Access Token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={submitBusy}
              autoComplete="off"
              placeholder="Cole o token gerado"
              helper="O token nunca sai do seu navegador — só viaja criptografado via HTTPS pra Urban AI."
            />

            <div
              style={{
                background: "var(--app-surface-muted)",
                border: "1px solid var(--app-divider)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <input
                id="stays-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3, accentColor: "var(--app-accent)", width: 18, height: 18 }}
              />
              <label htmlFor="stays-consent" style={{ fontSize: 13, color: "var(--app-text)", lineHeight: 1.55, cursor: "pointer" }}>
                <strong>Ao conectar minha conta Stays, autorizo a Urban AI a:</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--app-text-muted)" }}>
                  <li>Ler meus anúncios, calendário e histórico de reservas</li>
                  <li>Aplicar preços sugeridos pela IA aos meus anúncios</li>
                  <li>Armazenar esse histórico enquanto minha assinatura estiver ativa</li>
                </ul>
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--app-text-muted)" }}>
                  Posso desconectar a qualquer momento — os dados vinculados ao Airbnb/Stays serão apagados em até 15 dias.
                </p>
              </label>
            </div>

            {submitError && (
              <div
                role="alert"
                style={{
                  background: "rgba(194, 52, 46, 0.08)",
                  border: "1px solid rgba(194, 52, 46, 0.25)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "var(--app-danger)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icons.AlertCircle size={14} /> {submitError}
              </div>
            )}

            <AppButton
              type="submit"
              variant="primary"
              size="lg"
              loading={submitBusy}
              disabled={submitBusy || !consent}
              rightIcon={<Icons.ArrowRight size={14} />}
            >
              {submitBusy ? "Conectando…" : "Conectar Stays"}
            </AppButton>
          </form>
        </AppCard>
      ) : (
        // ====================== Conectado: status + sync + listings ======================
        <>
          <AppCard variant="accent" style={{ padding: 24, marginBottom: 32 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(22, 160, 107, 0.12)",
                    color: "var(--app-success)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-hidden
                >
                  <Icons.Check size={18} />
                </div>
                <div>
                  <p className="urban-app-eyebrow-muted">CONEXÃO STAYS</p>
                  <p
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--app-text)",
                      margin: "4px 0 0",
                      letterSpacing: -0.2,
                    }}
                  >
                    Conectada e ativa
                  </p>
                  <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: "2px 0 0" }}>
                    Última sincronização: {formatStaysDate(account?.lastSyncAt)}
                  </p>
                </div>
              </div>
              <AppButton
                variant="secondary"
                size="md"
                onClick={handleResync}
                loading={resyncBusy}
                leftIcon={<Icons.Zap size={14} />}
              >
                Sincronizar agora
              </AppButton>
            </div>
          </AppCard>

          {/* === KPIs ===*/}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 24,
              borderTop: "1px solid var(--app-divider)",
              borderBottom: "1px solid var(--app-divider)",
              padding: "24px 0",
              marginBottom: 40,
            }}
          >
            <AppMetricCard
              label="Listings ativos"
              value={`${activeListings}/${listings.length}`}
              sub="conectados via Stays"
            />
            <AppMetricCard
              label="Vinculados ao Urban AI"
              value={linkedListings}
              sub={
                linkedListings === listings.length
                  ? "todos vinculados"
                  : `${listings.length - linkedListings} sem vínculo`
              }
            />
            <AppMetricCard
              label="Modo automático"
              value={autoListings}
              sub="aplicam preço sem confirmação"
              accent={autoListings > 0}
            />
            <AppMetricCard
              label="Consentimento"
              value={account?.consentAcceptedAt ? "Ativo" : "—"}
              sub={
                account?.consentAcceptedAt
                  ? `versão ${account.consentVersion || "—"}`
                  : "registre no fluxo de conexão"
              }
            />
          </div>

          {/* === Listings detalhados === */}
          <section style={{ marginBottom: 32 }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div>
                <p className="urban-app-eyebrow">LISTINGS SINCRONIZADOS</p>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--app-text)",
                    margin: "8px 0 0",
                    letterSpacing: -0.3,
                  }}
                >
                  {listings.length} {listings.length === 1 ? "anúncio" : "anúncios"} no total
                </h2>
              </div>
            </header>

            {listings.length === 0 ? (
              <AppEmptyState
                title="Nenhum anúncio sincronizado"
                body="Clique em Sincronizar agora para puxar os anúncios da sua conta Stays."
                action={
                  <AppButton variant="primary" onClick={handleResync} loading={resyncBusy} leftIcon={<Icons.Zap size={14} />}>
                    Sincronizar agora
                  </AppButton>
                }
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {listings.map((l) => (
                  <AppCard key={l.id} variant="default" style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--app-text)",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {l.title || "(sem título)"}
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--app-text-muted)",
                            margin: "4px 0 0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {l.shortAddress || "Sem endereço"} ·{" "}
                          <code style={{ color: "var(--app-text-dim)" }}>ID Stays: {l.staysListingId}</code>
                        </p>
                        <p style={{ fontSize: 11, color: "var(--app-text-muted)", margin: "4px 0 0" }}>
                          {l.propriedadeId ? "Vinculado a imóvel Urban AI" : "Não vinculado ainda"} ·{" "}
                          Modo: {operationModeLabels[l.operationMode] || l.operationMode}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <AppBadge kind={l.active ? "success" : "neutral"}>
                          {l.active ? "Ativo" : "Inativo"}
                        </AppBadge>
                        {l.operationMode === "auto" && <AppBadge kind="accent">Auto</AppBadge>}
                      </div>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </section>

          {/* === Zona perigosa === */}
          <section
            style={{
              borderTop: "1px solid var(--app-divider)",
              paddingTop: 32,
            }}
          >
            <p className="urban-app-eyebrow-muted" style={{ marginBottom: 8 }}>
              ZONA PERIGOSA
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "16px 20px",
                border: "1px solid rgba(194, 52, 46, 0.18)",
                borderRadius: 8,
                background: "rgba(194, 52, 46, 0.03)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text)", margin: 0 }}>
                  Desconectar conta Stays
                </p>
                <p style={{ fontSize: 12, color: "var(--app-text-muted)", margin: "4px 0 0", maxWidth: 480 }}>
                  Desativa o modo automático em todos os imóveis. A Urban AI deixa de aplicar preços sugeridos.
                  Os dados Stays serão apagados em até 15 dias.
                </p>
              </div>
              <AppButton variant="danger" onClick={() => setConfirmDisconnect(true)}>
                Desconectar
              </AppButton>
            </div>
          </section>

          {/* Inline confirm modal */}
          {confirmDisconnect && (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                background: "rgba(0,0,0,0.45)",
              }}
              onClick={() => setConfirmDisconnect(false)}
            >
              <AppCard
                variant="elevated"
                style={{ maxWidth: 440, width: "100%", padding: "24px 24px 20px" }}
                onClick={undefined}
              >
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--app-text)" }}>
                  Desconectar Stays?
                </h3>
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: "var(--app-text-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  O modo automático será desativado em todos os imóveis vinculados. Você pode reconectar a qualquer momento.
                </p>
                <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <AppButton variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                    Cancelar
                  </AppButton>
                  <AppButton variant="danger" onClick={handleDisconnect}>
                    Desconectar
                  </AppButton>
                </div>
              </AppCard>
            </div>
          )}
        </>
      )}
    </AppPageShell>
  );
}
