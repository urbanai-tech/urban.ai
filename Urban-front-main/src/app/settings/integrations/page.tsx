"use client";

import { useEffect, useState } from "react";
import {
  staysConnect,
  staysDisconnect,
  staysListListings,
  staysPreviewPrice,
  staysSyncListings,
  type StaysAccountPublic,
  type StaysListingPublic,
  type StaysPricePreview,
} from "../../service/api";
import { formatLocalDate } from "../../lib/date";
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppCardHeader,
  AppButton,
  AppBadge,
  AppMetricCard,
  AppInput,
  AppSelect,
  AppEmptyState,
  Icons,
} from "../../componentes/ui";

const STAYS_CONSENT_VERSION = "stays-connect-v1";

const operationModeLabels: Record<StaysListingPublic["operationMode"], string> = {
  inherit: "Usar padrão da conta",
  notifications: "Recomendação manual",
  auto: "Automático em beta",
};

function formatStaysDate(value?: string | null) {
  if (!value) return "Não registrado";
  return new Date(value).toLocaleString("pt-BR");
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
}

function formatCurrency(cents?: number | null) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "sem preço";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
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
  const [previewListingId, setPreviewListingId] = useState("");
  const [previewDate, setPreviewDate] = useState(tomorrowIso());
  const [previewPrice, setPreviewPrice] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<StaysPricePreview | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const items = await staysListListings();
        setListings(items);
        if (items.length > 0) {
          const firstActive = items.find((item) => item.active) ?? items[0];
          setPreviewListingId(firstActive.id);
          setPreviewPrice(firstActive.basePriceCents ? String(firstActive.basePriceCents / 100) : "");
          setAccount({
            id: "unknown",
            status: "active",
            clientId: "",
            lastSyncAt: null,
            consentAcceptedAt: null,
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
      setSubmitError("Preencha os dois códigos gerados na Stays.");
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
      const firstActive = sync.listings.find((item) => item.active) ?? sync.listings[0];
      if (firstActive) {
        setPreviewListingId(firstActive.id);
        setPreviewPrice(firstActive.basePriceCents ? String(firstActive.basePriceCents / 100) : "");
      }
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
      const selectedStillExists = sync.listings.some((item) => item.id === previewListingId);
      if (!selectedStillExists) {
        const firstActive = sync.listings.find((item) => item.active) ?? sync.listings[0];
        setPreviewListingId(firstActive?.id ?? "");
        setPreviewPrice(firstActive?.basePriceCents ? String(firstActive.basePriceCents / 100) : "");
      }
    } finally {
      setResyncBusy(false);
    }
  }

  async function handlePreviewPrice(e: React.FormEvent) {
    e.preventDefault();
    setPreviewError(null);
    setPreviewResult(null);

    const listing = listings.find((item) => item.id === previewListingId);
    const priceReais = Number(String(previewPrice).replace(",", "."));
    if (!listing) {
      setPreviewError("Selecione um anúncio sincronizado.");
      return;
    }
    if (!previewDate) {
      setPreviewError("Informe a data da simulação.");
      return;
    }
    if (!Number.isFinite(priceReais) || priceReais <= 0) {
      setPreviewError("Informe um preço válido em reais.");
      return;
    }

    setPreviewBusy(true);
    try {
      const result = await staysPreviewPrice({
        listingId: listing.id,
        targetDate: previewDate,
        previousPriceCents: listing.basePriceCents ?? null,
        newPriceCents: Math.round(priceReais * 100),
        currency: "BRL",
      });
      setPreviewResult(result);
    } catch (err) {
      const msg = (err as Error)?.message || "Não foi possível simular a mudança.";
      setPreviewError(msg);
    } finally {
      setPreviewBusy(false);
    }
  }

  const activeListings = listings.filter((l) => l.active).length;
  const autoListings = listings.filter((l) => l.operationMode === "auto").length;
  const linkedListings = listings.filter((l) => Boolean(l.propriedadeId)).length;
  const previewListing = listings.find((item) => item.id === previewListingId) ?? null;

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
        subtitle="Conecte sua conta Stays para trazer seus anúncios e receber sugestões de preço. O modo automático ainda é beta e só muda preços quando estiver liberado para sua conta."
      />

      {!isConnected ? (
        // ====================== Não conectado: form de conexão ======================
        <AppCard variant="default" style={{ padding: 32 }}>
          <AppCardHeader
            eyebrow="CONFIGURAÇÃO INICIAL"
            title="Conectar conta Stays"
            subtitle={
              <>
                No painel Stays, abra a área onde a Stays gera os códigos de acesso:{" "}
                <strong style={{ color: "var(--app-text)" }}>
                  App Center → Open API → Generate credentials
                </strong>{" "}
                e cole os dois códigos abaixo. A Urban AI nunca vê sua senha da Stays.
              </>
            }
          />
          <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <AppInput
              label="Código da conta Stays"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={submitBusy}
              autoComplete="off"
              placeholder="Ex.: stays_xxxxxxx"
              helper="Na Stays, esse campo aparece como Client ID."
            />
            <AppInput
              label="Chave de acesso Stays"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={submitBusy}
              autoComplete="off"
              placeholder="Cole a chave gerada"
              helper="Na Stays, esse campo aparece como Access Token. Ele é enviado por conexão segura para ativar a integração."
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
                  <li>Mostrar sugestões de preço e, se eu ativar o beta automático, aplicar mudanças permitidas nos meus anúncios</li>
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
              label="Anúncios ativos"
              value={`${activeListings}/${listings.length}`}
              sub="anúncios vindos da Stays"
            />
            <AppMetricCard
              label="Ligados à Urban AI"
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
              sub="em beta, mudam preço sem confirmação"
              accent={autoListings > 0}
            />
            <AppMetricCard
              label="Autorização"
              value={account?.consentAcceptedAt ? "Ativo" : "—"}
              sub={
                account?.consentAcceptedAt
                  ? "aceita na conexão"
                  : "pendente"
              }
            />
          </div>

          <AppCard variant="default" style={{ padding: 24, marginBottom: 32 }}>
            <AppCardHeader
              eyebrow="SIMULAÇÃO SEGURA"
              title="Testar preço sem alterar a Stays"
              subtitle="Simule uma mudança antes de salvar de verdade. Aqui você vê se a data pode receber o novo preço, se há avisos e se a alteração real está liberada."
            />
            <form
              onSubmit={handlePreviewPrice}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
              <AppSelect
                label="Anúncio"
                value={previewListingId}
                onChange={(e) => {
                  const next = listings.find((item) => item.id === e.target.value);
                  setPreviewListingId(e.target.value);
                  setPreviewPrice(next?.basePriceCents ? String(next.basePriceCents / 100) : "");
                  setPreviewResult(null);
                }}
                shellStyle={{ minWidth: 0, maxWidth: 340 }}
              >
                {listings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {[item.title || item.staysListingId, item.shortAddress].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </AppSelect>
              <AppInput
                label="Data da simulação"
                type="date"
                value={previewDate}
                onChange={(e) => {
                  setPreviewDate(e.target.value);
                  setPreviewResult(null);
                }}
              />
              <AppInput
                label="Novo preço (R$)"
                type="number"
                min="1"
                step="0.01"
                value={previewPrice}
                onChange={(e) => {
                  setPreviewPrice(e.target.value);
                  setPreviewResult(null);
                }}
                helper={previewListing ? `Base: ${formatCurrency(previewListing.basePriceCents)}` : undefined}
              />
              <AppButton type="submit" variant="primary" loading={previewBusy} disabled={!previewListingId}>
                Simular
              </AppButton>
            </form>

            {previewError && (
              <div
                role="alert"
                style={{
                  marginTop: 16,
                  border: "1px solid rgba(194, 52, 46, 0.22)",
                  background: "rgba(194, 52, 46, 0.06)",
                  color: "var(--app-danger)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              >
                {previewError}
              </div>
            )}

            {previewResult && (
              <div
                style={{
                  marginTop: 18,
                  borderTop: "1px solid var(--app-divider)",
                  paddingTop: 18,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                }}
              >
                <PreviewStat label="Atual" value={formatCurrency(previewResult.previousPriceCents)} />
                <PreviewStat label="Novo" value={formatCurrency(previewResult.newPriceCents)} />
                <PreviewStat
                  label="Diferença"
                  value={
                    previewResult.diffPercent == null
                      ? "sem preço anterior"
                      : `${previewResult.diffPercent > 0 ? "+" : ""}${previewResult.diffPercent.toFixed(1)}%`
                  }
                />
                <PreviewStat
                  label="Limites de segurança"
                  value={previewResult.withinGuardrails ? "dentro do limite" : "bloqueado"}
                  tone={previewResult.withinGuardrails ? "success" : "danger"}
                />
                <PreviewStat
                  label="Alteração real"
                  value={previewResult.readyForPush ? "liberado" : "bloqueado"}
                  tone={previewResult.readyForPush ? "success" : "warning"}
                />
                <PreviewStat
                  label="Já testado?"
                  value={previewResult.idempotentReplay ? "sim" : "não"}
                />
                {(previewResult.blockers.length > 0 || previewResult.warnings.length > 0) && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
                    {previewResult.blockers.map((item) => (
                      <PreviewIssue key={item.code} issue={item} tone="danger" />
                    ))}
                    {previewResult.warnings.map((item) => (
                      <PreviewIssue key={item.code} issue={item} tone="warning" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </AppCard>

          {/* === Listings detalhados === */}
          <section style={{ marginBottom: 32 }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div>
                <p className="urban-app-eyebrow">ANÚNCIOS SINCRONIZADOS</p>
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
                          <span style={{ color: "var(--app-text-dim)" }}>Código na Stays: {l.staysListingId}</span>
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
                        {l.operationMode === "auto" && <AppBadge kind="accent">Beta automático</AppBadge>}
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
              AÇÃO SENSÍVEL
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
                  Desativa o modo automático em todos os imóveis. A Urban AI deixa de alterar preços pela Stays.
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

function PreviewStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "var(--app-success)"
      : tone === "warning"
        ? "var(--app-warning)"
        : tone === "danger"
          ? "var(--app-danger)"
          : "var(--app-text)";

  return (
    <div
      style={{
        border: "1px solid var(--app-divider)",
        borderRadius: 8,
        padding: "10px 12px",
        background: "var(--app-surface-muted)",
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: "var(--app-text-muted)", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 14, color, fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

function PreviewIssue({
  issue,
  tone,
}: {
  issue: { code: string; message: string };
  tone: "warning" | "danger";
}) {
  return (
    <div
      style={{
        border: `1px solid ${tone === "danger" ? "rgba(194, 52, 46, 0.22)" : "rgba(200, 129, 14, 0.24)"}`,
        background: tone === "danger" ? "rgba(194, 52, 46, 0.06)" : "rgba(200, 129, 14, 0.08)",
        color: tone === "danger" ? "var(--app-danger)" : "var(--app-warning)",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <strong>{issue.code}</strong>: {issue.message}
    </div>
  );
}
