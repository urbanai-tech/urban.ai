'use client';

import React from 'react';
import { AlertTriangle, Bell, Bot, CheckCircle2, Lock, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppInput,
  AppLoadingStatus,
  AppPageShell,
  AppSectionHeader,
  AppSelect,
  useToastCompat,
} from '@/app/componentes/ui';
import { getProfileById, updateProfileById } from '@/app/service/api';

type PricingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'ai';
type OperationMode = 'notifications' | 'auto';

type FormState = {
  percentualInicial: string;
  percentualFinal: string;
  pricingStrategy: PricingStrategy;
  operationMode: OperationMode;
};

const PRICING_PRESETS: Record<
  PricingStrategy,
  {
    label: string;
    short: string;
    inicial: number;
    final: number | null;
    description: string;
    bestFor: string;
  }
> = {
  conservative: {
    label: 'Conservadora',
    short: '-5% a +10%',
    inicial: 5,
    final: 10,
    description: 'Move pouco o preço e evita sustos em imóveis com histórico curto.',
    bestFor: 'Primeiras semanas, imóveis novos ou anfitrião que prefere validar devagar.',
  },
  balanced: {
    label: 'Moderada',
    short: '-10% a +20%',
    inicial: 10,
    final: 20,
    description: 'Equilibra captura de demanda e segurança. É a configuração recomendada.',
    bestFor: 'Operação diária com revisão manual das sugestões.',
  },
  aggressive: {
    label: 'Agressiva',
    short: '-15% a +35%',
    inicial: 15,
    final: 35,
    description: 'Aceita aumentos maiores quando eventos fortes pressionam a procura.',
    bestFor: 'Imóveis com boa ocupação, preço base confiável e gestão ativa.',
  },
  ai: {
    label: 'IA assistida',
    short: 'teto sistêmico',
    inicial: 25,
    final: 45,
    description: 'Usa limites amplos e guardrails do motor. Ainda exige conferência no beta.',
    bestFor: 'Piloto acompanhado, com dados reais de ocupação e preço aplicado.',
  },
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

function percentLabel(value: string, fallback = '-') {
  return value ? `${value.replace('.', ',')}%` : fallback;
}

export default function PricingSettingsPage() {
  const toast = useToastCompat();
  const [form, setForm] = React.useState<FormState>({
    percentualInicial: '',
    percentualFinal: '',
    pricingStrategy: 'balanced',
    operationMode: 'notifications',
  });
  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    getProfileById()
      .then((userData) => {
        const pricingStrategy = PRICING_PRESETS[userData.pricingStrategy as PricingStrategy]
          ? (userData.pricingStrategy as PricingStrategy)
          : 'balanced';
        const preset = PRICING_PRESETS[pricingStrategy];
        setUserId(userData.id);
        setForm({
          pricingStrategy,
          operationMode: (userData.operationMode as OperationMode) || 'notifications',
          percentualInicial: formatPercent(userData.percentualInicial ?? preset.inicial, true),
          percentualFinal: formatPercent(userData.percentualFinal ?? preset.final),
        });
      })
      .catch(() => {
        toast('Falha ao carregar configurações de precificação.', { type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  function setPreset(strategy: PricingStrategy) {
    const preset = PRICING_PRESETS[strategy];
    setForm((prev) => ({
      ...prev,
      pricingStrategy: strategy,
      percentualInicial: String(preset.inicial),
      percentualFinal: preset.final !== null ? String(preset.final) : '',
    }));
  }

  function handlePercentChange(field: 'percentualInicial' | 'percentualFinal', value: string) {
    setForm((prev) => ({ ...prev, [field]: value.replace(/[^0-9,.]/g, '') }));
  }

  async function handleSave() {
    if (!userId) return;

    const inicial = parsePercentInput(form.percentualInicial);
    const finalText = form.percentualFinal.trim();
    const final = finalText ? parsePercentInput(finalText) : null;

    if (inicial === null || inicial < 0) {
      toast('Informe um limite de queda válido.', { type: 'warning' });
      return;
    }
    if (finalText && (final === null || final < 0)) {
      toast('Informe um limite de alta válido.', { type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await updateProfileById(userId, {
        pricingStrategy: form.pricingStrategy,
        operationMode: form.operationMode,
        percentualInicial: inicial,
        percentualFinal: final,
      });
      toast('Configurações de precificação salvas.', { type: 'success' });
    } catch (error) {
      console.error(error);
      toast('Erro ao salvar configurações.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const preset = PRICING_PRESETS[form.pricingStrategy];
  const canSave = Boolean(form.percentualInicial);

  if (loading) {
    return (
      <AppPageShell>
        <AppLoadingStatus
          eyebrow="PRECIFICAÇÃO"
          title="Carregando limites"
          body="Estamos buscando seus limites atuais antes de liberar ajustes."
          steps={[
            { id: 'profile', label: 'Perfil de precificação', status: 'active' },
            { id: 'limits', label: 'Limites salvos', status: 'pending' },
          ]}
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={1180}>
      <AppSectionHeader
        eyebrow="PRECIFICAÇÃO - CONFIGURAÇÕES"
        title="Limites de preço"
        subtitle="Defina até onde a Urban AI pode sugerir queda ou alta. Estes limites são guardrails: eles protegem sua diária base e deixam cada recomendação mais previsível."
        actions={
          <AppButton
            type="button"
            variant="primary"
            size="md"
            leftIcon={<Save size={15} />}
            disabled={!canSave || saving}
            loading={saving}
            onClick={handleSave}
          >
            Salvar limites
          </AppButton>
        }
      />

      <div className="settings-hero-grid">
        <AppCard variant="accent" style={{ padding: 22 }}>
          <div className="settings-current">
            <div>
              <p className="urban-app-eyebrow">Faixa aplicada</p>
              <strong>-{percentLabel(form.percentualInicial)} / +{percentLabel(form.percentualFinal, 'sem teto manual')}</strong>
              <span>{preset.label} - {preset.description}</span>
            </div>
            <AppBadge kind={form.operationMode === 'auto' ? 'warn' : 'success'}>
              {form.operationMode === 'auto' ? 'Automático' : 'Recomendação manual'}
            </AppBadge>
          </div>
        </AppCard>

        <AppCard variant="default" style={{ padding: 22 }}>
          <div className="settings-note">
            <ShieldCheck size={22} />
            <div>
              <strong>Como isso afeta as sugestões?</strong>
              <p>
                Se a diária base é R$ 150 e o limite de alta é 20%, a sugestão normal não passa de R$ 180.
                Se o limite de queda é 10%, a Urban AI não sugere abaixo de R$ 135 sem um guardrail especial.
              </p>
            </div>
          </div>
        </AppCard>
      </div>

      <AppCard variant="default">
        <div className="settings-card-header">
          <SlidersHorizontal size={20} />
          <div>
            <h2>Escolha uma estratégia</h2>
            <p>Use o preset para preencher os limites e ajuste manualmente quando precisar.</p>
          </div>
        </div>

        <div className="preset-grid">
          {(Object.keys(PRICING_PRESETS) as PricingStrategy[]).map((strategy) => {
            const item = PRICING_PRESETS[strategy];
            const active = form.pricingStrategy === strategy;
            return (
              <button
                key={strategy}
                type="button"
                className={`preset-card ${active ? 'active' : ''}`}
                onClick={() => setPreset(strategy)}
              >
                <span>{item.label}</span>
                <strong>{item.short}</strong>
                <p>{item.bestFor}</p>
                {active && <CheckCircle2 size={18} />}
              </button>
            );
          })}
        </div>

        <div className="settings-form-grid">
          <AppInput
            label="Limite de queda"
            type="text"
            value={form.percentualInicial}
            onChange={(event) => handlePercentChange('percentualInicial', event.target.value)}
            helper="Valor positivo. Ex.: 10 significa permitir até -10%."
          />
          <AppInput
            label="Limite de alta"
            type="text"
            value={form.percentualFinal}
            onChange={(event) => handlePercentChange('percentualFinal', event.target.value)}
            disabled={form.pricingStrategy === 'ai'}
            helper={form.pricingStrategy === 'ai' ? 'No piloto IA, o teto vem do guardrail sistêmico.' : 'Ex.: 20 significa permitir até +20%.'}
          />
          <AppSelect
            label="Modo de operação"
            value={form.operationMode}
            onChange={(event) => setForm((prev) => ({ ...prev, operationMode: event.target.value as OperationMode }))}
            helper="No beta, a recomendação manual é o modo mais seguro."
          >
            <option value="notifications">Receber sugestão e aprovar</option>
            <option value="auto" disabled>Aplicar automaticamente (em breve)</option>
          </AppSelect>
        </div>
      </AppCard>

      <div className="settings-info-grid">
        <AppCard variant="default">
          <div className="settings-note compact">
            <Bell size={20} />
            <div>
              <strong>Modo recomendado no beta</strong>
              <p>Você recebe a sugestão, vê o motivo, confere o evento e decide aplicar.</p>
            </div>
          </div>
        </AppCard>
        <AppCard variant="default">
          <div className="settings-note compact">
            <Bot size={20} />
            <div>
              <strong>Automação com Stays</strong>
              <p>Quando estiver ativa, os mesmos limites serão usados antes de qualquer envio externo.</p>
            </div>
          </div>
        </AppCard>
        <AppCard variant="default">
          <div className="settings-note compact">
            <AlertTriangle size={20} />
            <div>
              <strong>Limite não substitui preço base</strong>
              <p>A diária de referência de cada imóvel continua sendo configurada na aba Imóveis.</p>
            </div>
          </div>
        </AppCard>
        <AppCard variant="default">
          <div className="settings-note compact">
            <Lock size={20} />
            <div>
              <strong>Guardrails de segurança</strong>
              <p>Sugestões fora da faixa precisam de regra explícita ou revisão manual.</p>
            </div>
          </div>
        </AppCard>
      </div>

      <style jsx>{styles}</style>
    </AppPageShell>
  );
}

const styles = `
  .settings-hero-grid,
  .settings-info-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 14px;
    margin-bottom: 18px;
  }

  .settings-info-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-top: 18px;
  }

  .settings-current {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .settings-current strong {
    display: block;
    margin-top: 10px;
    color: var(--app-accent);
    font-size: 34px;
    font-weight: 850;
    line-height: 1;
  }

  .settings-current span {
    display: block;
    margin-top: 10px;
    color: var(--app-text-muted);
    font-size: 14px;
    line-height: 1.45;
  }

  .settings-card-header,
  .settings-note {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .settings-card-header {
    margin-bottom: 18px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--app-divider);
  }

  .settings-card-header h2,
  .settings-note strong {
    margin: 0;
    color: var(--app-text);
    font-size: 18px;
    line-height: 1.25;
  }

  .settings-card-header p,
  .settings-note p {
    margin: 6px 0 0;
    color: var(--app-text-muted);
    font-size: 13px;
    line-height: 1.55;
  }

  .settings-note.compact strong {
    font-size: 15px;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .preset-card {
    position: relative;
    min-height: 150px;
    padding: 14px;
    text-align: left;
    background: var(--app-surface-muted);
    color: var(--app-text);
    border: 1px solid var(--app-divider);
    border-radius: 12px;
    cursor: pointer;
  }

  .preset-card.active {
    background: var(--app-accent-soft);
    border-color: var(--app-accent-border);
  }

  .preset-card span {
    display: block;
    color: var(--app-text-muted);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .preset-card strong {
    display: block;
    margin-top: 10px;
    color: var(--app-text);
    font-size: 22px;
  }

  .preset-card p {
    margin: 10px 0 0;
    color: var(--app-text-muted);
    font-size: 12px;
    line-height: 1.45;
  }

  .preset-card svg {
    position: absolute;
    right: 12px;
    top: 12px;
    color: var(--app-accent);
  }

  .settings-form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }

  @media (max-width: 1020px) {
    .settings-hero-grid,
    .settings-info-grid,
    .preset-grid,
    .settings-form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .settings-hero-grid,
    .settings-info-grid,
    .preset-grid,
    .settings-form-grid,
    .settings-current {
      grid-template-columns: 1fr;
      flex-direction: column;
    }
  }
`;
