# Outcomes & Learning Loop Handoff

Data: 2026-05-23
Frente: Outcomes & Learning Loop
Escopo: Event Radar, demanda e pricing P2

## Resumo

Fechei a primeira trilha tecnica real para aprendizado por outcomes:

- `PriceUpdate` agora alimenta `pricing_decision_snapshot.inputSignals.outcome` durante o lifecycle de push Stays: aceite/pending, aplicacao com sucesso, rejeicao do canal, erro e replay idempotente.
- Quando a `AnalisePreco` vinculada ja tem reserva/receita/noites, o patch de outcome tambem carrega esses campos para o snapshot.
- O motor de absorcao aceita calibracao opcional via `PriceAbsorptionCalibrationInput`.
- Novo `PricingOutcomeLearningService` transforma snapshots com outcome em dataset de aprendizado e resume calibracao de probabilidade de absorcao.
- Contrato v0 documentado com o shape de `PricingDecisionOutcome` e regra de treino.

## Arquivos alterados

- `urban-ai-backend-main/src/stays/stays.service.ts`
- `urban-ai-backend-main/src/stays/stays.service.spec.ts`
- `urban-ai-backend-main/src/stays/stays.module.ts`
- `urban-ai-backend-main/src/knn-engine/event-pricing-intelligence.service.ts`
- `urban-ai-backend-main/src/knn-engine/pricing-outcome-learning.service.ts`
- `urban-ai-backend-main/src/knn-engine/pricing-outcome-learning.service.spec.ts`
- `urban-ai-backend-main/src/knn-engine/knn-engine.module.ts`
- `docs/contracts/event-radar-contract-v0.md`
- `squads/event-demand-pricing-radar/output/2026-05-23-roadmap-closure/outcomes-learning-loop.md`

## Comportamento entregue

### Outcome persistido a partir de Stays/PriceUpdate

`StaysService.pushPrice(...)` agora tenta atualizar o snapshot auditavel vinculado a `analisePrecoId`:

- antes da chamada externa: registra `decisionStatus = accepted` para `PriceUpdate.status = pending`;
- sucesso do canal: registra `decisionStatus = applied`;
- rejeicao do canal: registra `decisionStatus = rejected`;
- erro de rede/5xx: preserva o PriceUpdate com `status = error` e registra outcome best-effort;
- replay idempotente: reaproveita o `PriceUpdate` existente e reconcilia o outcome.

A integracao e best-effort: falha de snapshot nao bloqueia push real de preco.

### Dataset de aprendizado

`PricingOutcomeLearningService` cria linhas com:

- IDs de snapshot/evento/imovel/lista/analise/priceUpdate;
- cenario escolhido, preco, multiplicador e probabilidade prevista;
- outcome real: absorveu ou nao, reserva, receita, noites e delta contra esperado;
- features de entrada: demanda do evento, captura do imovel, compressao e noites afetadas;
- flags de treino: `trainingReady` fica `false` para `blocked`, `pending` e `unknown`.

### Calibracao de absorcao

O servico calcula:

- taxa prevista media;
- taxa observada media;
- delta de probabilidade;
- Brier score;
- buckets por cenario e confianca.

Quando a amostra minima existe, `buildProbabilityCalibration(...)` gera input para `priceAbsorptionCurve({ calibration })`. O motor aplica ajuste conservador com limite de `maxAdjustment`.

## Validacoes

- `node node_modules\jest\bin\jest.js pricing-calculate.service.spec.ts stays.service.spec.ts pricing-outcome-learning.service.spec.ts event-pricing-intelligence.service.spec.ts --runInBand`
  - Resultado: passou, 4 suites / 37 testes.
- `node node_modules\typescript\lib\tsc.js --noEmit -p tsconfig.build.json --pretty false`
  - Resultado: passou.

Observacao: o sandbox bloqueou `node.exe` com `Acesso negado`; os comandos foram executados com permissao elevada.

## Riscos e lacunas

- Ainda nao ha job periodico de reconciliacao retroativa para snapshots antigos.
- Ainda nao ha sync real de reservas Stays; reserva/receita entram quando `AnalisePreco` ja tiver feedback ou quando o PriceUpdate estiver ligado a uma analise enriquecida.
- Sem migration nova: outcome segue em `inputSignals` simple-json. Para escala, criar colunas/indices analiticos para `decisionStatus`, `outcomeStatus`, `priceAbsorbed`, `recordedAt` e `priceUpdateId`.
- Calibracao esta pronta em servico e motor, mas ainda nao foi plugada automaticamente no recompute admin.
- Nao rodei release/e2e nem mexi em telas React, conforme restricao da frente.

## Percentual recomendado

- Frente Outcomes & Learning Loop: **68%** tecnico funcional.
- P2 outcomes/calibracao: de **50%** para **62%**.
- Roadmap total P0-P2: de **50%** para **58%**.
- P0/P1 tecnico e release controlado: manter leitura anterior, pois esta frente nao executou gate browser/DB/staging.

## Proximos passos

1. Criar job de reconciliacao diaria: `PricingDecisionSnapshot` + `PriceUpdate` + `AnalisePreco` + `OccupancyHistory`.
2. Ingerir reservas Stays reais e preencher `externalReservationId`, receita e noites.
3. Plugar `PricingOutcomeLearningService.buildProbabilityCalibration(...)` no recompute quando houver amostra minima por cidade/cenario.
4. Adicionar migration P1 para campos analiticos dedicados do outcome.
