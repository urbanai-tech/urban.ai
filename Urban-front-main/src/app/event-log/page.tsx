'use client';

import React from 'react';
import { User } from 'lucide-react';
import { AppButton, AppCard, AppInput, AppPageShell, AppSelect, useToastCompat } from '@/app/componentes/ui';
import {
  getProfileById,
  updateProfileById,
} from '@/app/service/api';

type PricingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'ai';

type FormState = {
  nome: string;
  email: string;
  percentualInicial: string;
  percentualFinal: string;
  pricingStrategy: PricingStrategy;
  operationMode: string;
};

const PRICING_PRESETS: Record<PricingStrategy, { inicial: number; final: number | null }> = {
  conservative: { inicial: 5, final: 10 },
  balanced: { inicial: 10, final: 20 },
  aggressive: { inicial: 15, final: 35 },
  ai: { inicial: 25, final: 45 },
};

function formatPercent(value: number | string | null | undefined, absolute = false) {
  if (value === null || value === undefined || value === '') return '';
  const numericValue = Number(value.toString().replace(',', '.'));
  const displayValue = absolute && !Number.isNaN(numericValue) ? Math.abs(numericValue) : value;

  return displayValue.toString().replace('.', ',');
}

function parsePercentInput(value: string) {
  const trimmedValue = value.trim();

  if (!/^\d+(?:[,.]\d+)?$/.test(trimmedValue)) return null;

  return Number(trimmedValue.replace(',', '.'));
}

export default function ConfiguracoesPage() {
  const toast = useToastCompat();
  const [form, setForm] = React.useState<FormState>({
    nome: '',
    email: '',
    percentualInicial: '',
    percentualFinal: '',
    pricingStrategy: 'balanced',
    operationMode: 'notifications',
  });

  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const id = 'me';

    if (!id) {
      setLoading(false);
      toast.info('Sessao expirada');
      return;
    }

    setUserId(id);
    setLoading(true);

    getProfileById()
      .then((userData) => {
        const pricingStrategy = PRICING_PRESETS[userData.pricingStrategy as PricingStrategy]
          ? (userData.pricingStrategy as PricingStrategy)
          : 'balanced';

        setForm((prev) => ({
          ...prev,
          nome: userData.username || '',
          email: userData.email || '',
          pricingStrategy,
          operationMode: userData.operationMode || 'notifications',
          percentualInicial: formatPercent(userData.percentualInicial, true),
          percentualFinal: formatPercent(userData.percentualFinal),
        }));
      })
      .catch(() => {
        toast.error('Falha ao carregar perfil');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;

    if (name === 'percentualInicial' || name === 'percentualFinal') {
      const sanitizedValue = value.replace(/[^0-9,.]/g, '');
      setForm((prev) => ({ ...prev, [name]: sanitizedValue }));
      return;
    }

    if (name === 'pricingStrategy' && PRICING_PRESETS[value as PricingStrategy]) {
      const preset = PRICING_PRESETS[value as PricingStrategy];
      setForm((prev) => ({
        ...prev,
        pricingStrategy: value as PricingStrategy,
        percentualInicial: preset.inicial.toString(),
        percentualFinal: preset.final !== null ? preset.final.toString() : '',
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const isButtonDisabled = !form.percentualInicial;

  async function handleSave() {
    if (!userId) return;

    setSaving(true);
    const finalText = form.percentualFinal.trim();
    const inicial = parsePercentInput(form.percentualInicial);
    const final = finalText ? parsePercentInput(finalText) : null;

    if (inicial === null || inicial < 0) {
      toast.error('A queda e obrigatoria e deve ser um numero maior ou igual a zero.');
      setSaving(false);
      return;
    }

    if (finalText && (final === null || final < 0)) {
      toast.error('A alta deve ser um numero maior ou igual a zero quando preenchida.');
      setSaving(false);
      return;
    }

    try {
      await updateProfileById(userId, {
        pricingStrategy: form.pricingStrategy,
        operationMode: form.operationMode,
        percentualInicial: inicial,
        percentualFinal: final,
      });
      toast.success('Configuracoes salvas com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar configuracoes');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell>
        <div style={{ height: 300, display: "grid", placeItems: "center" }}>
          <Spinner />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={1180}>
      <header style={{ marginBottom: 24 }}>
        <h1 className="urban-app-display-md">Configuracoes</h1>
      </header>

      <AppCard variant="subtle" style={{ padding: 8, marginBottom: 24 }}>
        <AppCard variant="default" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingBottom: 20,
              marginBottom: 24,
              borderBottom: "1px solid var(--app-divider)",
            }}
          >
            <User size={24} strokeWidth={1.8} />
            <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
              Informacoes pessoais
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            <AppInput
              label="Nome completo"
              disabled
              name="nome"
              value={form.nome}
              onChange={handleChange}
              placeholder="Seu nome"
            />

            <AppInput
              label="Email"
              disabled
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="seu@email.com"
            />

            <AppSelect
              label="Estrategia de precificacao (Motor de IA)"
              name="pricingStrategy"
              value={form.pricingStrategy}
              onChange={handleChange}
              helper="Isso preenchera automaticamente os limites para novas sugestoes. A queda e salva como valor positivo."
            >
              <option value="conservative">Conservadora (-5% a +10%)</option>
              <option value="balanced">Moderada (-10% a +20%)</option>
              <option value="aggressive">Agressiva (-15% a +35%)</option>
              <option value="ai">Piloto Automatico IA (com teto sistemico)</option>
            </AppSelect>

            <AppSelect
              label="Modo de operacao"
              name="operationMode"
              value={form.operationMode}
              onChange={handleChange}
              helper="Aguarde atualizacoes para aplicar precos diretamente no painel do Airbnb."
            >
              <option value="notifications">Apenas Notificacoes (Recomendado)</option>
              <option value="auto" disabled>Automatico (Em Breve)</option>
            </AppSelect>

            <AppInput
              label="Limite de queda (%) - Max desconto"
              type="text"
              name="percentualInicial"
              value={form.percentualInicial}
              onChange={handleChange}
              placeholder="Ex: 5 ou 10"
              helper="Queda maxima permitida para novas sugestoes. Informe 5 para permitir ate -5%."
            />

            <AppInput
              label="Limite de alta (%) - Max lucro"
              type="text"
              name="percentualFinal"
              value={form.percentualFinal}
              onChange={handleChange}
              placeholder="Controlado pelo teto sistemico"
              disabled={form.pricingStrategy === 'ai'}
              helper="Alta maxima permitida para novas sugestoes. No Piloto IA, vale o teto sistemico configurado."
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <AppButton
              type="button"
              variant="primary"
              size="md"
              disabled={isButtonDisabled || saving}
              loading={saving}
              onClick={handleSave}
            >
              Salvar configuracoes
            </AppButton>
          </div>
        </AppCard>
      </AppCard>
    </AppPageShell>
  );
}

function Spinner() {
  return (
    <span
      aria-label="Carregando"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "3px solid var(--app-accent-soft)",
        borderTopColor: "var(--app-accent)",
        animation: "event-log-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes event-log-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
