"use client";

import { useEffect, useState } from "react";
import { DialogSurface } from "../../componentes/ui/DialogSurface";
import {
  staysConnect,
  staysDisconnect,
  staysGetAccount,
  staysGetCapabilities,
  staysListLinkableProperties,
  staysListListings,
  staysMatchSuggestions,
  staysPreviewPrice,
  staysSyncListings,
  type StaysAccountPublic,
  type StaysCapabilities,
  type StaysLinkableProperty,
  type StaysListingPublic,
  type StaysMatchSuggestion,
  type StaysPricePreview,
} from "../../service/api";
import { StaysListingsEmpty, StaysListingsPanel } from "./StaysListingsPanel";
import { STAYS_WRITES_DISABLED_MESSAGE, normalizeStaysAccountSlug } from "./stays-integration-domain";
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
  AppHStack,
  Icons,
} from "../../componentes/ui";
import styles from "./integrations.module.css";

const STAYS_CONSENT_VERSION = "stays-connect-v1";

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
  const [accountSlug, setAccountSlug] = useState("");
  const [clientId, setClientId] = useState("");
  const [capabilities, setCapabilities] = useState<StaysCapabilities | null>(null);
  const [properties, setProperties] = useState<StaysLinkableProperty[]>([]);
  const [suggestions, setSuggestions] = useState<StaysMatchSuggestion[]>([]);
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

  async function loadLinkingData() {
    // Vínculo e sugestões são complementares: falha aqui não derruba a tela.
    const [props, matches] = await Promise.all([
      staysListLinkableProperties().catch(() => [] as StaysLinkableProperty[]),
      staysMatchSuggestions().catch(() => [] as StaysMatchSuggestion[]),
    ]);
    setProperties(props);
    setSuggestions(matches);
  }

  useEffect(() => {
    (async () => {
      try {
        const [savedAccount, items, caps] = await Promise.all([
          staysGetAccount(),
          staysListListings(),
          staysGetCapabilities().catch(() => null),
        ]);
        setAccount(savedAccount);
        setCapabilities(caps);
        setAccountSlug(savedAccount?.accountSlug ?? "");
        setClientId(savedAccount?.clientId ?? "");
        setListings(items);
        if (items.length > 0) {
          const firstActive = items.find((item) => item.active) ?? items[0];
          setPreviewListingId(firstActive.id);
        }
        if (savedAccount && savedAccount.status !== "disconnected") await loadLinkingData();
      } catch {
        setSubmitError("Não foi possível consultar o estado da integração. Atualize a página para tentar novamente.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleListingChanged(updated: StaysListingPublic) {
    setListings((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSuggestions((current) => current.filter((item) => item.listingId !== updated.id));
  }

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
    const slug = normalizeStaysAccountSlug(accountSlug);
    if (accountSlug.trim() && !slug) {
      setSubmitError("Informe só o nome da sua conta Stays (ex.: minhaconta, de minhaconta.stays.net).");
      return;
    }
    setSubmitBusy(true);
    try {
      const acc = await staysConnect(clientId.trim(), accessToken.trim(), {
        consentAccepted: consent,
        consentVersion: STAYS_CONSENT_VERSION,
        accountSlug: slug ?? undefined,
      });
      setAccount(acc);
      setAccessToken("");
      const sync = await staysSyncListings();
      setListings(sync.listings);
      const firstActive = sync.listings.find((item) => item.active) ?? sync.listings[0];
      if (firstActive) setPreviewListingId(firstActive.id);
      await loadLinkingData();
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
      }
      await loadLinkingData();
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
      // Sem previousPriceCents: o servidor lê o preço vigente no calendário Stays.
      const result = await staysPreviewPrice({
        listingId: listing.id,
        targetDate: previewDate,
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

  const isConnected = account && account.status !== "disconnected";

  if (loading) {
    return (
      <AppPageShell maxWidth={900}>
        <p className={styles.loadingText}>Carregando…</p>
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
      {capabilities && !capabilities.priceWritesEnabled && (
        <AppHStack gap="sm" align="center" wrap>
          <AppBadge kind="warn">{STAYS_WRITES_DISABLED_MESSAGE}</AppBadge>
          <span className="urban-app-eyebrow-muted">Leituras e prévias funcionam; nenhum preço é alterado na Stays.</span>
        </AppHStack>
      )}

      {!isConnected ? (
        // ====================== Não conectado: form de conexão ======================
        <AppCard variant="default" className={styles.connectCard}>
          <AppCardHeader
            eyebrow="CONFIGURAÇÃO INICIAL"
            title="Conectar conta Stays"
            subtitle={
              <>
                No painel Stays, abra a área onde a Stays gera os códigos de acesso:{" "}
                <strong className={styles.credentialsPath}>
                  App Center → Open API → Generate credentials
                </strong>{" "}
                e cole os dois códigos abaixo. O My Urban nunca vê sua senha da Stays.
              </>
            }
          />
          <form onSubmit={handleConnect} className={styles.connectForm}>
            <AppInput
              label="Conta Stays"
              type="text"
              value={accountSlug}
              onChange={(e) => setAccountSlug(e.target.value)}
              disabled={submitBusy}
              autoComplete="off"
              placeholder="minhaconta"
              helper="Só o nome da conta, como aparece em minhaconta.stays.net. Se o piloto já foi configurado pela Urban, pode deixar em branco."
            />
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
              helper="Informe o Client Secret da API Stays. Ele é enviado por conexão segura e guardado cifrado."
            />

            <div
              className={styles.consentRow}
            >
              <input
                id="stays-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className={styles.staysConsent}
              />
              <label htmlFor="stays-consent" className={styles.consentLabel}>
                <strong>Ao conectar minha conta Stays, autorizo o My Urban a:</strong>
                <ul className={styles.consentList}>
                  <li>Ler meus anúncios, calendário e histórico de reservas</li>
                  <li>Mostrar sugestões de preço e, se eu ativar o beta automático, aplicar mudanças permitidas nos meus anúncios</li>
                  <li>Armazenar esse histórico enquanto minha assinatura estiver ativa</li>
                </ul>
                <p className={styles.consentNote}>
                  Posso desconectar a qualquer momento — os dados vinculados ao Airbnb/Stays serão apagados em até 15 dias.
                </p>
              </label>
            </div>

            {submitError && (
              <div
                role="alert"
                className={styles.submitErrorBanner}
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
          <AppCard variant="accent" className={styles.statusCard}>
            <div
              className={styles.statusRow}
            >
              <div className={styles.statusInfo}>
                <div
                  className={styles.statusIcon}
                  aria-hidden
                >
                  <Icons.Check size={18} />
                </div>
                <div>
                  <p className="urban-app-eyebrow-muted">CONEXÃO STAYS</p>
                  <p
                    className={styles.statusTitle}
                  >
                    Conectada e ativa
                  </p>
                  <p className={styles.statusSyncText}>
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
            className={styles.kpiGrid}
          >
            <AppMetricCard
              label="Anúncios ativos"
              value={`${activeListings}/${listings.length}`}
              sub="anúncios vindos da Stays"
            />
            <AppMetricCard
              label="Ligados ao My Urban"
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

          <AppCard variant="default" className={styles.simulationCard}>
            <AppCardHeader
              eyebrow="SIMULAÇÃO SEGURA"
              title="Testar preço sem alterar a Stays"
              subtitle="Simule uma mudança antes de salvar de verdade. Aqui você vê se a data pode receber o novo preço, se há avisos e se a alteração real está liberada."
            />
            <form
              onSubmit={handlePreviewPrice}
              className={styles.previewForm}
            >
              <AppSelect
                label="Anúncio"
                value={previewListingId}
                onChange={(e) => {
                  const next = listings.find((item) => item.id === e.target.value);
                  setPreviewListingId(next?.id ?? e.target.value);
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
                helper="O preço atual é lido ao vivo na Stays."
              />
              <AppButton type="submit" variant="primary" loading={previewBusy} disabled={!previewListingId}>
                Simular
              </AppButton>
            </form>

            {previewError && (
              <div
                role="alert"
                className={styles.previewErrorBanner}
              >
                {previewError}
              </div>
            )}

            {previewResult && (
              <div
                className={styles.previewResultGrid}
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
                  <div className={styles.previewIssueList}>
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
          <section className={styles.listingsSection}>
            <header className={styles.listingsHeader}>
              <div>
                <p className="urban-app-eyebrow">ANÚNCIOS SINCRONIZADOS</p>
                <h2
                  className={styles.listingsHeading}
                >
                  {listings.length} {listings.length === 1 ? "anúncio" : "anúncios"} no total
                </h2>
              </div>
            </header>

            {listings.length === 0 ? (
              <StaysListingsEmpty onSync={handleResync} busy={resyncBusy} />
            ) : (
              <StaysListingsPanel
                listings={listings}
                properties={properties}
                suggestions={suggestions}
                capabilities={capabilities}
                onListingChanged={handleListingChanged}
              />
            )}
          </section>

          {/* === Zona perigosa === */}
          <section
            className={styles.dangerZoneSection}
          >
            <p className={`urban-app-eyebrow-muted ${styles.appEyebrowMuted}`}>
              AÇÃO SENSÍVEL
            </p>
            <div
              className={styles.disconnectRow}
            >
              <div>
                <p className={styles.disconnectTitle}>
                  Desconectar conta Stays
                </p>
                <p className={styles.disconnectDescription}>
                  Desativa o modo automático em todos os imóveis. O My Urban deixa de alterar preços pela Stays.
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
            <DialogSurface
              onClose={() => setConfirmDisconnect(false)}
              aria-labelledby="disconnect-stays-title"
              className={styles.disconnectOverlay}
              onClick={() => setConfirmDisconnect(false)}
            >
              <AppCard
                variant="elevated"
                className={styles.disconnectCard}
                onClick={undefined}
              >
                <h3 id="disconnect-stays-title" className={styles.disconnectStaysTitle}>
                  Desconectar Stays?
                </h3>
                <p
                  className={styles.disconnectDialogText}
                >
                  O modo automático será desativado em todos os imóveis vinculados. Você pode reconectar a qualquer momento.
                </p>
                <div className={styles.disconnectActions}>
                  <AppButton variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                    Cancelar
                  </AppButton>
                  <AppButton variant="danger" onClick={handleDisconnect}>
                    Desconectar
                  </AppButton>
                </div>
              </AppCard>
            </DialogSurface>
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
  return (
    <div
      className={styles.previewStatPanel}
    >
      <p className={styles.previewStatLabel}>
        {label}
      </p>
      <p className={`${styles.previewStatValue} ${styles[`previewStatTone${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
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
      className={`${styles.previewIssuePanel} ${tone === "danger" ? styles.previewIssueDanger : styles.previewIssueWarning}`}
    >
      <strong>{issue.code}</strong>: {issue.message}
    </div>
  );
}
