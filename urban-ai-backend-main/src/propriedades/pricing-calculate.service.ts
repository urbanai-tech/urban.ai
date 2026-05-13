import { Injectable } from '@nestjs/common';

type AjustePrecoParams = {
  precoReferencia: number;
  seuPrecoAtual: number;
  capacidadeReferencia: number;
  suaCapacidade: number;
  banheiroReferencia: number;
  seuBanheiro: number;
  ocupacaoReferencia?: number;
  suaOcupacao?: number;
  fatorLocalizacao?: number;
  relevanciaEvento?: number | null;
  publicoEsperado?: number | null;
  maxAumentoPercent?: number;
  maxReducaoPercent?: number;
};

type AjustePrecoResultado = {
  precoSugerido: number;
  seuPrecoAtual: number;
  diferencaPercentual: number;
  recomendacao: string;
  motivo: string;
};

@Injectable()
export class PricingCalculateService {
  calcular({
    precoReferencia,
    seuPrecoAtual,
    capacidadeReferencia,
    suaCapacidade,
    banheiroReferencia,
    seuBanheiro,
    ocupacaoReferencia,
    suaOcupacao,
    fatorLocalizacao = 1.0,
    relevanciaEvento,
    publicoEsperado,
    maxAumentoPercent = 45,
    maxReducaoPercent = 25,
  }: AjustePrecoParams): AjustePrecoResultado {
    if (!this.isPositive(seuPrecoAtual) || !this.isPositive(precoReferencia)) {
      return {
        precoSugerido: this.roundMoney(seuPrecoAtual || precoReferencia || 0),
        seuPrecoAtual: this.roundMoney(seuPrecoAtual || 0),
        diferencaPercentual: 0,
        recomendacao: 'Manter',
        motivo: 'Preco atual ou preco de referencia ausente/invalidos; sugestao conservadora.',
      };
    }

    const ajusteCapacidade = this.clamp(
      1 + (this.safeNumber(suaCapacidade, 1) - this.safeNumber(capacidadeReferencia, 1)) * 0.04,
      0.85,
      1.2,
    );
    const ajusteBanheiro = this.clamp(
      1 + (this.safeNumber(seuBanheiro, 1) - this.safeNumber(banheiroReferencia, 1)) * 0.05,
      0.9,
      1.15,
    );
    const ajusteLocalizacao = this.clamp(this.safeNumber(fatorLocalizacao, 1), 0.9, 1.15);

    let fatorOcupacao = 1;
    if (this.isFiniteNumber(suaOcupacao) && this.isFiniteNumber(ocupacaoReferencia)) {
      fatorOcupacao = this.clamp(
        1 + (Number(suaOcupacao) - Number(ocupacaoReferencia)) * 0.005,
        0.9,
        1.1,
      );
    }

    const precoMercado =
      precoReferencia * ajusteCapacidade * ajusteBanheiro * ajusteLocalizacao * fatorOcupacao;

    const fatorEvento = this.getFatorEvento(relevanciaEvento, publicoEsperado);
    const precoBase = seuPrecoAtual * 0.65 + precoMercado * 0.35;
    const precoSemGuardrail = precoBase * fatorEvento;

    const minPrice = seuPrecoAtual * (1 - maxReducaoPercent / 100);
    const maxPrice = seuPrecoAtual * (1 + maxAumentoPercent / 100);
    const precoSugerido = this.clamp(precoSemGuardrail, minPrice, maxPrice);

    const diferenca = ((precoSugerido - seuPrecoAtual) / seuPrecoAtual) * 100;

    let recomendacao: string;
    if (diferenca > 15) {
      recomendacao = 'AUMENTAR (preco abaixo do mercado/evento)';
    } else if (diferenca > 5) {
      recomendacao = 'Pode aumentar';
    } else if (Math.abs(diferenca) <= 5) {
      recomendacao = 'Manter';
    } else {
      recomendacao = 'Reduzir levemente (preco acima do sugerido)';
    }

    return {
      precoSugerido: this.roundMoney(precoSugerido),
      seuPrecoAtual: this.roundMoney(seuPrecoAtual),
      diferencaPercentual: Number(diferenca.toFixed(1)),
      recomendacao,
      motivo:
        `Mercado=${this.roundMoney(precoMercado)}, evento=${fatorEvento.toFixed(2)}x, ` +
        `guardrail=${maxReducaoPercent}% queda/${maxAumentoPercent}% alta.`,
    };
  }

  private getFatorEvento(relevanciaEvento?: number | null, publicoEsperado?: number | null): number {
    const relevancia = this.safeNumber(relevanciaEvento, 0);
    const publico = this.safeNumber(publicoEsperado, 0);
    let fator = 1;

    if (relevancia >= 85) fator += 0.18;
    else if (relevancia >= 70) fator += 0.12;
    else if (relevancia >= 50) fator += 0.06;

    if (publico >= 30000) fator += 0.12;
    else if (publico >= 10000) fator += 0.08;
    else if (publico >= 3000) fator += 0.04;

    return this.clamp(fator, 1, 1.3);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private roundMoney(value: number): number {
    return Number(Number(value || 0).toFixed(2));
  }

  private isPositive(value: number): boolean {
    return this.isFiniteNumber(value) && Number(value) > 0;
  }

  private isFiniteNumber(value: unknown): boolean {
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  }

  private safeNumber(value: unknown, fallback: number): number {
    return this.isFiniteNumber(value) ? Number(value) : fallback;
  }
}
