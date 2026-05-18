import { Injectable } from '@nestjs/common';

export type PricingRiskStrategy = 'conservative' | 'balanced' | 'aggressive' | 'ai';
export type PricingGuardrailSource = 'preset_default' | 'user_config' | 'mixed';

export type PricingGuardrailInput = {
  pricingStrategy?: string | null;
  percentualInicial?: unknown;
  percentualFinal?: unknown;
};

export type PricingGuardrail = {
  strategy: PricingRiskStrategy;
  label: string;
  maxReducaoPercent: number;
  maxAumentoPercent: number;
  source: PricingGuardrailSource;
  minMultiplier: number;
  maxMultiplier: number;
};

const SYSTEM_MAX_REDUCAO_PERCENT = 50;
const SYSTEM_MAX_AUMENTO_PERCENT = 100;

const PRICING_GUARDRAIL_PRESETS: Record<
  PricingRiskStrategy,
  { label: string; maxReducaoPercent: number; maxAumentoPercent: number }
> = {
  conservative: {
    label: 'conservador',
    maxReducaoPercent: 5,
    maxAumentoPercent: 10,
  },
  balanced: {
    label: 'moderado',
    maxReducaoPercent: 10,
    maxAumentoPercent: 20,
  },
  aggressive: {
    label: 'agressivo',
    maxReducaoPercent: 15,
    maxAumentoPercent: 35,
  },
  ai: {
    label: 'IA assistida',
    maxReducaoPercent: 25,
    maxAumentoPercent: 45,
  },
};

const STRATEGY_ALIASES: Record<string, PricingRiskStrategy> = {
  conservative: 'conservative',
  conservadora: 'conservative',
  balanced: 'balanced',
  balanceada: 'balanced',
  moderate: 'balanced',
  moderated: 'balanced',
  moderada: 'balanced',
  aggressive: 'aggressive',
  agressiva: 'aggressive',
  ai: 'ai',
  ia: 'ai',
};

@Injectable()
export class PricingGuardrailService {
  resolve(input?: PricingGuardrailInput | null): PricingGuardrail {
    const strategy = this.normalizeStrategy(input?.pricingStrategy);
    const preset = PRICING_GUARDRAIL_PRESETS[strategy];
    const userReducao = this.normalizePercent(input?.percentualInicial);
    const userAumento = this.normalizePercent(input?.percentualFinal);

    const maxReducaoPercent = this.clampPercent(
      userReducao ?? preset.maxReducaoPercent,
      SYSTEM_MAX_REDUCAO_PERCENT,
    );
    const maxAumentoPercent = this.clampPercent(
      userAumento ?? preset.maxAumentoPercent,
      SYSTEM_MAX_AUMENTO_PERCENT,
    );

    const source = this.getSource(userReducao, userAumento);

    return {
      strategy,
      label: preset.label,
      maxReducaoPercent,
      maxAumentoPercent,
      source,
      minMultiplier: 1 - maxReducaoPercent / 100,
      maxMultiplier: 1 + maxAumentoPercent / 100,
    };
  }

  describe(guardrail: PricingGuardrail): string {
    return `perfil ${guardrail.label} (-${this.formatPercent(
      guardrail.maxReducaoPercent,
    )}%/+${this.formatPercent(guardrail.maxAumentoPercent)}%)`;
  }

  private normalizeStrategy(value: unknown): PricingRiskStrategy {
    if (typeof value !== 'string') return 'balanced';
    const key = value.trim().toLowerCase();
    return STRATEGY_ALIASES[key] ?? 'balanced';
  }

  private normalizePercent(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric =
      typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number(value);

    if (!Number.isFinite(numeric)) return null;
    return Math.abs(numeric);
  }

  private clampPercent(value: number, max: number): number {
    return Number(Math.min(Math.max(value, 0), max).toFixed(2));
  }

  private getSource(userReducao: number | null, userAumento: number | null): PricingGuardrailSource {
    if (userReducao !== null && userAumento !== null) return 'user_config';
    if (userReducao !== null || userAumento !== null) return 'mixed';
    return 'preset_default';
  }

  private formatPercent(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
  }
}
