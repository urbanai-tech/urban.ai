
import { Injectable } from '@nestjs/common';

type AjustePrecoParams = {
  precoReferencia: number;
  seuPrecoAtual: number;
  capacidadeReferencia: number;
  suaCapacidade: number;
  banheiroReferencia: number;
  seuBanheiro: number;
  ocupacaoReferencia: number;
  suaOcupacao?: number;
  fatorLocalizacao?: number;
};

type AjustePrecoResultado = {
  precoSugerido: number;
  seuPrecoAtual: number;
  diferencaPercentual: number;
  recomendacao: string;
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
  }: AjustePrecoParams): AjustePrecoResultado {
    
    const ajusteCapacidade = 1 + (suaCapacidade - capacidadeReferencia) * 0.05;
    const ajusteBanheiro = 1 + (seuBanheiro - banheiroReferencia) * 0.07;

    let precoSugerido = precoReferencia * ajusteCapacidade * ajusteBanheiro * fatorLocalizacao;

    if (suaOcupacao === undefined) {
      if (ocupacaoReferencia < 50) {
        precoSugerido *= 0.95;
      } else {
        precoSugerido *= 1.05;
      }
    } else {
      const fatorOcupacao = 1 + (suaOcupacao - ocupacaoReferencia) * 0.01;
      precoSugerido *= fatorOcupacao;
    }

    const diferenca = ((precoSugerido - seuPrecoAtual) / seuPrecoAtual) * 100;

    let recomendacao: string;
    if (diferenca > 15) {
      recomendacao = 'AUMENTAR (preço abaixo do mercado)';
    } else if (diferenca > 5) {
      recomendacao = 'Pode aumentar';
    } else if (Math.abs(diferenca) <= 5) {
      recomendacao = 'Manter';
    } else {
      recomendacao = 'Reduzir (preço acima do sugerido)';
    }

    return {
      precoSugerido: Number(precoSugerido.toFixed(2)),
      seuPrecoAtual,
      diferencaPercentual: Number(diferenca.toFixed(1)),
      recomendacao,
    };
  }
}
