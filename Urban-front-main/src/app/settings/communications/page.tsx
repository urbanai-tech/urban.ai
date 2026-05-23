"use client";

import { useEffect, useState } from "react";
import {
  fetchCommunicationPreferences,
  updateCommunicationPreferences,
  type CommunicationPreferences,
  type UpdateCommunicationPreferencesPayload,
} from "../../service/api";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardHeader,
  AppEmptyState,
  AppPageShell,
  AppSectionHeader,
  Icons,
} from "../../componentes/ui";

type PreferenceKey = keyof UpdateCommunicationPreferencesPayload;

const ITEMS: Array<{
  key: PreferenceKey;
  title: string;
  body: string;
  fixed?: boolean;
}> = [
  {
    key: "emailPricing",
    title: "E-mails de sugestao de preco",
    body: "Resumo agrupado com recomendacoes, imoveis afetados e explicacao do motivo.",
  },
  {
    key: "pushPricing",
    title: "Push de sugestao de preco",
    body: "Avisos curtos no dispositivo quando houver recomendacoes novas para revisar.",
  },
  {
    key: "weeklyReport",
    title: "Radar semanal de eventos",
    body: "Relatorio semanal com eventos futuros relevantes para os seus imoveis.",
  },
  {
    key: "staysAlerts",
    title: "Alertas da Stays",
    body: "Conexao, sincronizacao, falhas de aplicacao, bloqueios de guardrail e rollback.",
  },
  {
    key: "billingAlerts",
    title: "Avisos de billing",
    body: "Assinatura, falhas de pagamento, cota e itens essenciais da conta.",
    fixed: true,
  },
  {
    key: "marketing",
    title: "Novidades e conteudo",
    body: "Comunicacoes comerciais, lancamentos e materiais educativos.",
  },
];

export default function CommunicationSettingsPage() {
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [saving, setSaving] = useState<PreferenceKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPreferences(await fetchCommunicationPreferences());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar preferencias.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggle(key: PreferenceKey) {
    if (!preferences) return;
    const item = ITEMS.find((entry) => entry.key === key);
    if (item?.fixed) return;

    const nextValue = !preferences[key];
    setSaving(key);
    setError(null);
    try {
      const updated = await updateCommunicationPreferences({ [key]: nextValue });
      setPreferences(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar agora.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <AppPageShell maxWidth={900}>
        <p style={{ color: "var(--app-text-muted)", fontSize: 14 }}>Carregando...</p>
      </AppPageShell>
    );
  }

  if (!preferences) {
    return (
      <AppPageShell maxWidth={900}>
        <AppEmptyState
          icon={<Icons.AlertCircle size={32} />}
          title="Nao foi possivel carregar"
          body={error || "Tente novamente em alguns instantes."}
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={920}>
      <AppSectionHeader
        eyebrow="CONFIGURACOES · COMUNICACOES"
        title="Preferencias de comunicacao"
        subtitle="Controle quais avisos chegam por e-mail e push. Comunicacoes essenciais de seguranca, conta e cobranca continuam ativas."
      />

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            border: "1px solid rgba(194, 52, 46, 0.22)",
            background: "rgba(194, 52, 46, 0.06)",
            color: "var(--app-danger)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <AppCard variant="default" style={{ padding: 24 }}>
        <AppCardHeader
          title="Canais e categorias"
          subtitle="Essas escolhas sao salvas na sua conta e passam a orientar os proximos disparos."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ITEMS.map((item) => {
            const enabled = Boolean(preferences[item.key]);
            const busy = saving === item.key;
            return (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "16px 0",
                  borderTop: "1px solid var(--app-divider)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 240, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--app-text)" }}>
                      {item.title}
                    </p>
                    {item.fixed && <AppBadge kind="neutral">ESSENCIAL</AppBadge>}
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--app-text-muted)", lineHeight: 1.5 }}>
                    {item.body}
                  </p>
                </div>

                <AppButton
                  variant={enabled ? "secondary" : "primary"}
                  size="sm"
                  disabled={Boolean(item.fixed) || busy}
                  loading={busy}
                  leftIcon={enabled ? <Icons.Check size={14} /> : <Icons.Info size={14} />}
                  onClick={() => toggle(item.key)}
                >
                  {enabled ? "Ativo" : "Ativar"}
                </AppButton>
              </div>
            );
          })}
        </div>
      </AppCard>
    </AppPageShell>
  );
}
