# ADR 0008 — Algoritmo de pricing: KNN é só baseline, XGBoost é o moat

**Status:** Aceito (24/04/2026) — substitui parcialmente o ADR 0002 (que justifica KNN no curto prazo, sem comprometer com longo prazo).

## Contexto

A pergunta do Gustavo em 24/04: "KNN classifier é o melhor motor de ML pro que queremos entregar? Não seria melhor random forest ou outro algoritmo que realmente aprende e vire um moat em alguns meses?"

A pergunta acerta. Hoje o motor Urban AI:
- Usa `ml-knn` para classificar imóveis em 3 categorias (Econômico/Standard/Premium)
- Aplica multiplicadores fixos (categoria + atratividade + travel time + relevância)
- Treina com 3 imóveis mock — efetivamente roda na regra, não no KNN

Pergunta operacional: enquanto não temos dataset, a arquitetura tem que evoluir já?

## Análise comparativa de algoritmos

| Algoritmo | Pontos fortes | Limitações para nosso caso | Veredicto |
|---|---|---|---|
| **Regras + multiplicadores (atual)** | Simples, interpretável, funciona com dataset zero, baseline confiável | Não aprende, não generaliza, "+X% por categoria" é arbitrário | Manter como **fallback** sempre — quando ML falha ou dado é insuficiente |
| **KNN** | Simples de implementar, "imóveis similares pagaram X" é narrativa que vende | Não escala (cada predição varre dataset), não captura interações não-lineares, sensível a features irrelevantes, sem memória temporal, ruim para regressão de preço (foi pensado para classificação) | **Descartar** — não vale a complexidade vs ganho. Era escolha pragmática quando o time não tinha tempo de implementar nada melhor |
| **Random Forest** | Robusto, lida bem com features mistas, feature importance para explicabilidade, baseline forte para tabular | Mais lento que XGBoost, menos preciso em benchmarks de pricing | **Cogitável**, mas dominado por XGBoost no mesmo nicho |
| **XGBoost / LightGBM** | Estado-da-arte para pricing tabular, rápido para inferir, captura interações complexas, feature importance, lida com missing data | Caixa-preta vs random forest (mas com SHAP fica explicável), exige tuning de hyperparams, biblioteca pesa um pouco no deploy | **Recomendado** — é o cavalo de batalha de toda startup que faz pricing dinâmico hoje (PriceLabs, Beyond, Wheelhouse usam variações) |
| **Modelo neural híbrido** (CNN+LSTM+MLP) | Potencial maior — combina geo (CNN sobre mapa), temporal (LSTM sobre eventos+calendar), tabular (MLP sobre features). Captura padrões que XGBoost não pega. Vira **moat real** com dataset crescendo. | Complexidade alta, dataset grande necessário (>10k linhas), exige GPU para treinar, hyperparam tuning é arte, deployment exige Python | **Aspiracional** — caminho de longo prazo, S20+ |
| **Causal forests / uplift modeling** | Mede o **uplift** real de uma sugestão de preço — exatamente a métrica de negócio | Dataset enorme com tratamento aleatório necessário | **Pós go-live + ≥1k usuários ativos** |

## Decisão

**Caminho de evolução em 4 estágios, alinhado com os Tiers da F6.1 do roadmap:**

| Tier IA | Algoritmo | Por quê |
|---|---|---|
| **Tier 0 (atual)** | Regras + multiplicadores | É o que existe, funciona, vende como "engine de regras" |
| **Tier 1** | Regras (primário) + **XGBoost shadow mode** | XGBoost roda em paralelo; sua predição é logada mas não usada. Permite medir MAPE sem risco. Coexistem porque o `PricingStrategy` agora é uma interface. |
| **Tier 2** | XGBoost (primário) + Regras (fallback) | Quando MAPE ≤ 15% comprovado por backtesting, troca o flag. Regras viram fallback para imóvel novo sem histórico. |
| **Tier 3** | XGBoost ensembled com features geo+temporal | Adicionar embedding de bairro (categorical embedding via FastText ou similar), lag features de eventos (próximos 7/14/30 dias), sazonalidade explícita. Mantém XGBoost como motor — só enriquece o input. |
| **Tier 4 (moat)** | Modelo neural híbrido + causal uplift | Em paralelo ao XGBoost, treinar uma rede que recebe (a) tabular features, (b) geo via OSM raster + KNN locais, (c) temporal via LSTM de eventos. Quando outperform XGBoost em MAPE + custo de inferência aceitável, virar primário. |

## Por que KNN sai

KNN não é ruim para classificação simples. Mas o produto que estamos entregando é **regressão de preço por imóvel × data**, com features mistas (categóricas: bairro, tipo de imóvel; numéricas: lat/lng, distância, ratings, sazonalidade). Para isso, gradient boosting ganha em todos os benchmarks publicados. Manter KNN agora seria optimizar para a etapa errada: economiza horas hoje, paga em qualidade depois.

## Implicação arquitetural

A engine precisa virar uma **strategy plugável** com 3 estratégias coexistindo:

```typescript
interface PricingStrategy {
  name: string;
  suggestPrice(input): Promise<PriceSuggestion>;
  isReady(): boolean; // dataset suficiente?
}

class RuleBasedPricingStrategy implements PricingStrategy { ... } // hoje
class XGBoostPricingStrategy implements PricingStrategy { ... } // amanhã
class ShadowModeStrategy implements PricingStrategy { ... } // wraps duas e compara
```

Selector controlado por env var `PRICING_STRATEGY = 'rules' | 'xgboost' | 'shadow' | 'auto'`. Default `rules`.

XGBoost em **Node.js** existe (`@dqbd/xgboost` ou via WASM), mas é meio ginástica. Decisão: quando chegar a hora de implementar XGBoost real, **extrair `pricing-engine` para microserviço Python** (revertendo parcialmente ADR 0002). Mantém o backend NestJS limpo, deixa Python lidar com pandas/scikit/xgboost que é a ferramenta certa para isso. O scaffold preparado nesta PR já contempla esse cenário (a estratégia "XGBoost" pode ser implementação local ou HTTP client para um microserviço externo — interface esconde).

## Quando revisitar

- **Tier 4 vs Tier 3:** revisar quando dataset passar de 100k linhas. Aí faz sentido investir em rede neural.
- **Causal forests:** revisar pós go-live com ≥1k usuários e capacidade de fazer A/B test em produção.
- **Voltar para KNN:** improvável. Se acontecer, será como ferramenta auxiliar de "imóveis similares" no UI, não como motor primário.

## Consequências

**Positivas:**
- Caminho honesto de evolução de algoritmo, sem prender em otimização local errada.
- Shadow mode permite trocar de algoritmo com risco controlado.
- Microserviço Python na hora certa (Tier 2+), aproveitando o ecossistema ML maduro.

**Negativas:**
- Uma camada de indireção a mais (Strategy pattern) — overhead pequeno, justificado.
- Quando virar XGBoost, deploy de modelo (artefato `.json`/`.bin`) entra no pipeline de release. Adicionar ao runbook de deploy.

## Referências

- [XGBoost benchmark de pricing](https://xgboost.readthedocs.io/en/stable/) — comunidade
- [Shadow mode em ML systems](https://martinfowler.com/articles/cd4ml.html) — Martin Fowler
- ADR 0002 — KNN no backend (parcialmente substituído por este)
- F6.1 do `docs/roadmap-pos-sprint.md` v2.4
