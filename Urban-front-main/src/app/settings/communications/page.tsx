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
import styles from "./page.module.css";

type PreferenceKey = keyof UpdateCommunicationPreferencesPayload;

const ITEMS: Array<{
  key: PreferenceKey;
  title: string;
  body: string;
  fixed?: boolean;
}> = [
  {
    key: "emailPricing",
    title: "E-mails de sugestão de preço",
    body: "Resumo agrupado somente quando houver recomendação acionável, com imóveis afetados e explicação do motivo.",
  },
  {
    key: "pushPricing",
    title: "Push de sugestão de preço",
    body: "Avisos curtos no dispositivo quando houver recomendações novas para revisar.",
  },
  {
    key: "weeklyReport",
    title: "Resumo semanal",
    body: "Toda segunda: o que aconteceu com as suas recomendações na semana passada, os eventos relevantes das próximas semanas e o lembrete de registrar resultados.",
  },
  {
    key: "onboardingEmails",
    title: "Dicas de primeiros passos",
    body: "Série curta de e-mails nos primeiros dias para configurar seus imóveis e entender as sugestões.",
  },
  {
    key: "staysAlerts",
    title: "Alertas da Stays",
    body: "Conexão, sincronização, falhas de aplicação, bloqueios de guardrail e rollback.",
  },
  {
    key: "billingAlerts",
    title: "Avisos de billing",
    body: "Assinatura, falhas de pagamento, cota e itens essenciais da conta.",
    fixed: true,
  },
  {
    key: "marketing",
    title: "Novidades e conteúdo",
    body: "Comunicações comerciais, lançamentos e materiais educativos.",
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
        setError(err instanceof Error ? err.message : "Não foi possível carregar preferências.");
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
      setError(err instanceof Error ? err.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <AppPageShell maxWidth={900}>
        <p className={styles.loadingText}>Carregando…</p>
      </AppPageShell>
    );
  }

  if (!preferences) {
    return (
      <AppPageShell maxWidth={900}>
        <AppEmptyState
          icon={<Icons.AlertCircle size={32} />}
          title="Não foi possível carregar"
          body={error || "Tente novamente em alguns instantes."}
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={920}>
      <AppSectionHeader
        eyebrow="CONFIGURAÇÕES · COMUNICAÇÕES"
        title="Preferências de comunicação"
        subtitle="Controle quais avisos chegam por e-mail e push. Comunicações essenciais de segurança, conta e cobrança continuam ativas."
      />

      {error && (
        <div
          role="alert"
          className={styles.errorAlert}
        >
          {error}
        </div>
      )}

      <AppCard variant="default" className={styles.channelsCard}>
        <AppCardHeader
          title="Canais e categorias"
          subtitle="Essas escolhas são salvas na sua conta e passam a orientar os próximos disparos."
        />

        <div className={styles.itemList}>
          {ITEMS.map((item) => {
            const enabled = Boolean(preferences[item.key]);
            const busy = saving === item.key;
            return (
              <div
                key={item.key}
                className={styles.itemRow}
              >
                <div className={styles.itemInfo}>
                  <div className={styles.itemTitleRow}>
                    <p className={styles.itemTitle}>
                      {item.title}
                    </p>
                    {item.fixed && <AppBadge kind="neutral">ESSENCIAL</AppBadge>}
                  </div>
                  <p className={styles.itemBody}>
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
