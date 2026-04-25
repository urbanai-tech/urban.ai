# ADR 0009 — Modelo neural híbrido como moat de longo prazo

**Status:** Aceito (24/04/2026 · noite) — extensão do ADR 0008.

## Contexto

A pergunta do Gustavo: "Como podemos estruturar para chegar no modelo neural híbrido, que é um real moat? Pense que não temos as 10 mil linhas mas teremos em breve. Precisamos de um switch automático que muda o modelo conforme as bases melhoram."

Resposta curta: faz **muito sentido**, é exatamente o caminho certo, e ele virou produto nesta entrega.

## A tese do moat

A maioria das startups de pricing dinâmico (PriceLabs, Beyond, Wheelhouse, Pricelabs.io) parou no XGBoost. Razão: dataset disponível na época que cresceram não justificava ir além. **Hoje é diferente** — quando se tem dataset proprietário crescendo + parceria com canal oficial (Stays) que fecha o loop de receita, o modelo neural híbrido ganha em pelo menos 3 dimensões:

1. **Captura geográfica não-linear** que XGBoost não pega bem. Ex.: "imóveis na borda de um cluster de eventos pagam um prêmio descontinuado no entorno de 200m". XGBoost tenta com features manuais (distância ao centroide). CNN sobre raster geográfico aprende sozinho.

2. **Padrões temporais longos**. Ex.: "F1 SP em novembro tem efeito que começa 6 semanas antes e termina 1 semana depois, com pico assimétrico no quarto dia anterior". XGBoost com lag features pega o que o engenheiro lembrou de codar; LSTM aprende a estrutura completa.

3. **Cold start de imóvel novo**. Embedding de bairro aprendido com vizinhos transfere conhecimento para imóvel que entrou ontem — XGBoost cai para a média do bairro.

## Arquitetura proposta (Tier 4)

```
                  ┌─────────────────────────────────┐
                  │    Pricing Hybrid Network       │
                  │                                 │
   ┌─ Geo input ──┤  CNN (raster 256x256 SP)      ─┤
   │              │  ↓ embedding 64-dim             │
   │              │                                 │
   │ ┌─ Temporal ─┤  LSTM (eventos 30d, calendar) ─┤  Concat
   │ │            │  ↓ embedding 32-dim             │  ↓
   │ │            │                                 │  Dense MLP (3 layers)
   │ │  ┌─ Tabular┤  MLP (bedrooms, amenities,    ─┤  ↓
   │ │  │         │       category, comps) ↓ 32-d  │  Output: price
   └─┴──┴─────────┴─────────────────────────────────┘
```

**Insumos por imóvel × data alvo:**
- **Geo** (CNN): patch 256×256 do mapa centrado no imóvel + camadas (eventos, transporte, comércio, hotéis concorrentes)
- **Temporal** (LSTM): janela móvel de 30 dias com (eventos próximos, sazonalidade, dia da semana, feriados, tendência de preço bairro)
- **Tabular** (MLP): features estáticas do imóvel + features agregadas dos comps mais recentes
- **Embedding categórico**: bairro → vetor 16-dim (FastText ou aprendido), tipo de imóvel → 8-dim

**Saída:** preço sugerido + intervalo de confiança (CIs) — a confiança é o que permite ao cron `stays-auto-apply` recusar pushes em situações arriscadas.

## Por que o switch automático (auto-tier) é a peça que torna isso viável

Implementado nesta entrega: `AdaptivePricingStrategy` em `src/knn-engine/strategies/adaptive-pricing.strategy.ts`.

A cada predição (com cache de 5 min), a strategy consulta o `DatasetCollectorService.datasetSize()` e decide qual modelo usar:

| Tier | Threshold do dataset | Modelo escolhido |
|---|---|---|
| 0 | < 100 listings × 7 dias | Regras + multiplicadores |
| 1 | ≥ 100 × 7d (KNN treinado, XGBoost ainda não) | Regras |
| 2 | ≥ 500 × 30d AND XGBoost ready | XGBoost |
| 3 | ≥ 5.000 × 90d | XGBoost (com gate de MAPE) |
| 4 (moat) | ≥ 10.000 × 365d AND HybridNeuralPricingStrategy ready | Modelo híbrido |

Vantagens:

1. **Zero deploy entre tiers** — o produto migra automaticamente quando o dataset cresce. Sem "lembrar de virar a flag".
2. **Degradação resiliente** — se o modelo Tier 3 cair (ex.: artefato corrompido após retreino ruim), a próxima decisão volta para Tier 2 ou Tier 0 sozinha.
3. **Treino offline, deploy quente** — quando o time treinar o modelo híbrido, basta soltar o artefato + flipar `HybridStrategy.modelLoaded=true`. O AdaptivePricingStrategy detecta na próxima predição.
4. **Auditoria completa** — cada `PriceSuggestion` retorna `details.strategy = "adaptive/tier-X/Y"` permitindo análise de qual algoritmo decidiu cada coisa em produção.

## Plano de implementação (cronograma realista)

| Fase | Quando | Pré-requisito |
|---|---|---|
| **a)** Dataset collector ativo (3 frentes) | ✅ entregue 24/04 | nenhum |
| **b)** Conta AirROI + GCP + import inicial | S5–6 | sua ação manual |
| **c)** Bootstrap XGBoost (Python microservice) | S7–8 | dataset chega ≥500 listings |
| **d)** XGBoost via shadow mode em prod | S8 | (c) |
| **e)** XGBoost vira primário (Tier 2) — automático via AdaptivePricingStrategy | S9 quando MAPE ≤15% | (c)+(d) |
| **f)** Recrutar Superhost SP + Stays Reservations API | S9–11 | parceria |
| **g)** Loop de feedback de receita real (Tier 4 dataset) | S12+ | (f) |
| **h)** Treino do modelo híbrido (CNN + LSTM + MLP) | ~S20 | dataset ≥ 10k × 12m |
| **i)** Deploy do híbrido como `HybridNeuralPricingStrategy` | ~S22 | (h) |
| **j)** Auto-switch para Tier 4 quando dataset bate threshold | automático após (i) | (i) |

Tempo total realista para chegar ao Tier 4 partindo de hoje: **18–24 meses**, sendo:
- 3 meses: dataset coletor rodando + AirROI/Base dos Dados ativos = primeiros 100k pontos
- 6 meses: dataset orgânico de produção atinge crítica massa para XGBoost confiável
- 12 meses: dataset suficiente para treinar híbrido com qualidade (≥10k imóveis × 12 meses = 3.6M linhas mínimo)
- 3 meses: implementação + tuning do híbrido em Python (PyTorch ou JAX)

Antes do Tier 4 estar pronto, **estamos no Tier 2/3 entregando valor real** — ele é incremento, não pré-requisito de produto.

## O que esta entrega já deixou pronto

1. **`PriceSnapshot` entity** — tabela do dataset proprietário, indexada para queries de feature engineering.
2. **`DatasetCollectorService`** — 3 frentes de captura:
   - cron diário 03:30 BRT que tira snapshot de TODOS os imóveis cadastrados (não depende de evento próximo)
   - persistência automática dos comps a cada análise (10–30 pontos novos por análise rodada)
   - método `recordAppliedPrice` para gravar ground truth quando Stays push acontece
3. **`AdaptivePricingStrategy`** — auto-tier completo, com slot opcional para `hybrid` que aceita o modelo Tier 4 quando ele chegar.
4. **Factory atualizada** — default mudou para `adaptive`. Comportamento atual = idêntico ao anterior (dataset insuficiente → cai em rules), mas com switch automático ativo.
5. **`describeCurrentTier()`** — método de diagnóstico que retorna tier ativo + razão + tamanho do dataset, pronto para virar endpoint admin/dashboard.

## Riscos do moat

- **Dataset insuficiente para treinar híbrido** mesmo após 12 meses → mitigação: trade Stays + Superhost SP + comprar AirDNA pontual.
- **Custo de inferência** do híbrido (CNN+LSTM) → mitigação: cache agressivo (preço × bairro × dia muda pouco), serving em Python com GPU pequena (~US$ 50/mês) ou ONNX runtime CPU.
- **Concorrente fork** depois que o produto estiver no ar → mitigação: dataset é o ativo, código não. Por isso captura passiva (DatasetCollectorService) é peça mais valiosa de tudo o que foi entregue hoje.
- **Sobre-engineering pré-validation** → mitigação: estamos entregando AdaptivePricingStrategy hoje, mas só `HybridNeuralPricingStrategy` é trabalho real (S20+). Tudo até lá é XGBoost — Tier 2/3 já é diferencial competitivo na América Latina.

## Referências

- ADR 0008 — KNN→XGBoost
- F6.1 do `docs/roadmap-pos-sprint.md` v2.6
- `docs/runbooks/dataset-acquisition.md`
- Implementação: `src/knn-engine/strategies/adaptive-pricing.strategy.ts`
- Tabela: `src/entities/price-snapshot.entity.ts`
- Service: `src/knn-engine/dataset-collector.service.ts`
