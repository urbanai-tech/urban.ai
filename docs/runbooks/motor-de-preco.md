# Runbook — Motor de preço (KNN + regras), v1 e v2

Owner: engenharia backend/pricing · Última revisão: 2026-10-24

## O que mudou e por quê

A auditoria de 2026-10-24 encontrou um motor que **só sabia subir preço**: somava
multiplicadores (+10% fixo por ser "Standard", proximidade contada duas vezes,
relevância do Gemini até +50% sem teto), ignorava as regras do imóvel
(`PricingRuleConfig`) e o KNN comparava graus de lat/lng com contagem de
amenidades sem normalizar, treinado com rótulos `category ?? 1` (quase tudo
"Standard"). Além disso, `propriedade.service` fazia `Math.max(KNN, cálculo)`,
então nenhuma redução chegava ao anfitrião.

O motor v2 (`urban-ai-backend-main/src/knn-engine/pricing-engine-v2.ts`) corrige isso:

| Tema | v1 (legado) | v2 |
|---|---|---|
| Combinação | soma de bônus, nunca < 1,0 | produto de fatores com sinal; pode ficar abaixo da base |
| Categoria KNN | +10% Standard / +20% Premium | informativa (o preço base já embute o padrão do imóvel) |
| Proximidade do evento | +50% (score>80) **e** +30% (≤15 min) — mesmo sinal | uma vez: até +12% × magnitude do evento × decaimento `exp(-d/raio)` |
| Gemini (`relevancia`) | `relevancia/200`, até +50%, sem validação | até +20% (teto rígido 30%), exige confiança ≥ 0,6, × proximidade |
| Regras do imóvel | ignoradas | fim de semana, dia útil lento, última hora, noite-lacuna, piso, evento |
| Sem evento | não havia sugestão | ajuste-base −5% (configurável) |
| Guardrail | só no chamador (teto do sistema +100%) | `maxDecreasePercent` (default 20%) / `maxIncreasePercent` (default 50%) + piso `occupancy_floor` |
| Explicação | texto livre | `details.drivers[]` no formato de `PricingDecisionSnapshot.drivers` |

### KNN

- Features: lat/lng projetados para km (equiretangular local, erro < 0,5% vs. haversine),
  z-score ajustado **no treino**, x/y com o mesmo desvio (isotropia). O scaler vai junto
  no modelo serializado (`PropertyClassifier.exportModel()` / `importModel()`).
- `K` configurável (`PRICING_KNN_K`, default 5, máx. 25), voto ponderado por distância.
- Rótulo v2 (`knn-labels.ts`): percentil do ADR dentro do bairro (`Address.bairro`) ou
  célula de ~2 km; grupo com < 5 imóveis usa a cidade. Fallback documentado: categoria
  explícita → Standard (contado em `labelStats.bySource.fallback` no log do treino).
- O modelo legado (features cruas, K=3, `category`) continua treinado só para o v1
  não mudar de número enquanto o v2 não estiver ligado.
- A análise por evento (`propriedade.service`) agora treina um classificador **local**
  com os comps; antes sobrescrevia o modelo compartilhado do bootstrap a cada análise.

### Gemini / injeção de prompt

- Prompt: texto do evento vai entre `<dados_evento>` e é tratado como dado; campos
  truncados e sem caracteres de controle.
- Resposta: `parseEventEnrichmentResponse` aceita **um** objeto JSON, lê só
  `relevancia`, `raioImpactoKm`, `capacidadeEstimada`, `confianca` (numéricos), limita
  faixas (relevância 1–100) e ignora qualquer outra chave ou texto.
- Motor: sem confiança explícita (`relevanciaConfianca`), o score só entra se
  corroborado por dado observável (`venueCapacity`/`expectedAttendance` ≥ 1000).
  **LLM sozinho não move preço.** A confiança auto-declarada não é persistida
  (não há coluna); persistir exige migration — ver "Próximos passos".

## Flags e variáveis

| Variável | Default | Efeito |
|---|---|---|
| `PRICING_ENGINE_V2` | `shadow` | `shadow`: responde v1 (números iguais aos de antes) e anexa `details.shadowV2` + log debug `[shadow-v2]`. `true`: responde v2. `false`: só v1. |
| `PRICING_KNN_K` | `5` | K do KNN v2 (1–25, nunca > tamanho do treino). |
| `PRICING_V2_MAX_DECREASE_PERCENT` | `20` | Redução máxima quando o chamador não passa guardrail (0–50). |
| `PRICING_V2_MAX_INCREASE_PERCENT` | `50` | Aumento máximo quando o chamador não passa guardrail (0–100). |
| `PRICING_V2_NO_EVENT_ADJUSTMENT_PERCENT` | `-5` | Ajuste-base de noite sem evento fora do fim de semana (−20–0). Hipótese a calibrar. |
| `PRICING_V2_HIGH_ATTRACTIVITY_UPLIFT_PERCENT` / `..._MEDIUM_...` | `12` / `5` | Uplift máximo de proximidade. |
| `PRICING_GEMINI_MAX_UPLIFT_PERCENT` | `20` | Teto da contribuição do LLM (rígido em 30). |
| `PRICING_GEMINI_MIN_CONFIDENCE` | `0.6` | Confiança mínima para o LLM contar. |

Por que o default é `shadow` e não `true`: o v2 muda números de forma material (≈50%
das noites ficam abaixo da base no backtest) e a única evidência é sintética. Em
`shadow` nada muda para o anfitrião e passamos a ter v1 × v2 lado a lado nos logs.
Ligar é trocar uma variável no Railway e reiniciar; desligar é o mesmo caminho.

Com `PRICING_ENGINE_V2=true` em `propriedade.service`, a sugestão final passa a ser a
**média** do cálculo ancorado no mercado (`PricingCalculateService.calcular`) e do v2,
em vez de `Math.max` — e continua limitada pelo guardrail do perfil do usuário.

`PRICING_STRATEGY` (adaptive/rules/xgboost/shadow) continua funcionando e é ortogonal:
`RuleBasedPricingStrategy` repassa `input.context` para o motor. Observação: hoje
nenhum fluxo de sugestão em produção passa pela `PricingStrategyFactory`; ela só é
usada no diagnóstico de tier do admin. O fluxo real é `propriedade.service` →
`UrbanAIPricingEngine.suggestPrice`.

## Backtest offline (sintético)

Código: `src/knn-engine/backtest/` (gerador com semente fixa + comparação). Rodar:

```bash
cd urban-ai-backend-main
PRICING_BACKTEST_PRINT=1 npx jest src/knn-engine/backtest/engine-comparison
```

Semente 20261024: 150 imóveis, 9.000 noites (2.809 com evento; 248 com score de LLM inflado).

| Motor | MAPE | MAPE c/ evento | MAPE s/ evento | Gate ≤15% | % abaixo da base | % acima da base | mult. min / p10 / p50 / p90 / max |
|---|---|---|---|---|---|---|---|
| Base (não mexer) | 16,83% | 15,17% | 17,58% | não | 0% | 0% | 1 / 1 / 1 / 1 / 1 |
| v1 | 43,77% | 101,50% | 17,58% | não | 0% | 31,2% | 1 / 1 / 1 / 2 / 2 |
| v2 | 12,59% | 15,36% | 11,34% | sim | 50,5% | 35,9% | 0,8 / 0,8 / 0,983 / 1,15 / 1,3 |

Distribuição de multiplicadores:

| Motor | <0,90 | 0,90–0,99 | =1,00 | 1,01–1,10 | 1,11–1,30 | 1,31–1,60 | >1,60 |
|---|---|---|---|---|---|---|---|
| v1 | 0% | 0% | 68,8% | 0% | 0,2% | 3,2% | 27,8% |
| v2 | 31,9% | 18,6% | 13,6% | 13,5% | 22,4% | 0% | 0% |

Leitura honesta:

- **Isto não prova valor.** O "preço realizado" sai de um modelo que nós escrevemos.
  O gerador usa fatores próprios de dia da semana, raio de evento por evento, viés do
  anfitrião e LLM ruidoso/inflado, mas a *forma* (dia útil mais barato, evento com
  decaimento por distância, última hora e lacuna vendendo com desconto) é a mesma
  hipótese do v2. Um motor que compartilha as hipóteses do gerador ganha por construção.
- O ganho do v2 vem das noites **sem evento** (11,3% vs 17,6%). Em noites **com evento**
  o v2 empata com "não mexer" (15,4% vs 15,2%) e ainda tem viés de alta quando o LLM
  infla o score — os uplifts de evento são os parâmetros menos confiáveis.
- O que o backtest garante de verdade (e o teste trava): determinismo, v1 nunca abaixo
  da base, v2 dentro do guardrail (0,8–1,5), v2 melhor que v1 neste mercado.
- Validação real: rodar em `shadow`, comparar `shadowV2` com outcomes reais
  (`pricing-outcome-learning.service.ts`, `integracoes-outcomes-calibracao.md`).

## Riscos para produção ao ligar `PRICING_ENGINE_V2=true`

1. **Preços vão cair para anfitriões existentes**: dias úteis, noites sem evento, última
   hora e lacunas — até −20% (ou o guardrail do perfil; "moderado" = −10%). O piso padrão
   `occupancy_floor` (R$180) segura quedas de quem cobra acima disso.
2. Noites com evento passam a subir **bem menos** que no v1 (que chegava a +150% antes do
   teto). Quem se acostumou com os aumentos verá sugestões mais modestas.
3. A **auto-aplicação** Stays (`src/stays/stays-auto-apply.service.ts`) tem
   `STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER` default **1,00**: reduções nunca são
   auto-aplicadas. Isso não foi alterado nesta mudança (fora do escopo) e é o
   comportamento seguro até haver evidência real; baixar esse piso é decisão separada.
4. `propriedade.service` passa ao v2 as regras salvas do imóvel (sem config → defaults
   do painel) e a ocupação de `OccupancyHistory` (noite anterior, alvo e seguinte). Sem
   histórico de ocupação, `gap_night_filler` não dispara e `last_minute` trata a noite
   como não reservada. A análise é por evento, então a noite precificada é a do
   evento: o caminho "noite sem evento" só é usado por quem chama o motor sem evento
   (backtest, futuras rotas de calendário).
5. A curva de absorção de evento (`event-pricing-intelligence.service.ts`, que alimenta
   `PricingDecisionSnapshot`) é outro motor e também não recomenda abaixo de 1,0×; não
   foi alterada aqui.

## Como ligar / desligar

1. Confirmar que o `[shadow-v2]` aparece nos logs (nível debug) com diferenças plausíveis.
2. Railway → backend → `PRICING_ENGINE_V2=true` → redeploy.
3. Reverter: `PRICING_ENGINE_V2=shadow` (ou `false`) → redeploy. Não há migration nem
   dado a desfazer.

## Próximos passos

- Persistir a confiança do Gemini (coluna nova + migration) em vez de exigir corroboração.
- Passar ocupação real (calendário Stays) para o v2 em `propriedade.service`.
- Calibrar os percentuais com outcomes reais antes de liberar reduções na auto-aplicação.
