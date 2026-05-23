# Outcomes Calibration Readiness

Data: 2026-05-23
Agente: Noether Outcomes Calibration
Escopo: fechar o maximo possivel da frente Outcomes & calibration loop sem DB real/producao

## Status executivo

A frente esta tecnicamente pronta para medir prontidao de calibracao antes de plugar outcomes reais no recompute automatico.

Nesta rodada foi adicionada uma melhoria pequena e segura:

- `PricingOutcomeLearningService.evaluateCalibrationReadiness(...)` para transformar dataset de outcomes em criterios objetivos de amostra.
- `scripts/pricing-outcome-calibration-report.ts` para gerar relatorio Markdown em dry-run, fixture JSON ou leitura DB explicitamente permitida.
- Teste unitario focado cobrindo gaps de amostra minima antes de uso automatico.

Nao rodei nada em DB real/producao.

## Percentual

- Outcomes & calibration loop: **70%**.
- P2 outcomes/calibracao: **64%**.
- Roadmap total P0-P2: **69-73%**.
- Confianca para liberar calibracao automatica em recompute real: **ainda nao liberado**, depende de amostra real e smoke staging/local restaurado.

Leitura: o loop tecnico existe, agora tem criterio mensuravel e comando de relatorio. A diferenca ate 100% e dado real, reconciliacao retroativa e operacao com staging/DB nao-producao.

## O que ja existe

- `PriceUpdate`/Stays alimenta `pricing_decision_snapshot.inputSignals.outcome` em best-effort.
- `PricingOutcomeLearningService` extrai linhas de aprendizado com probabilidade prevista, outcome observado, receita, noites, fonte e peso.
- `priceAbsorptionCurve(...)` aceita `PriceAbsorptionCalibrationInput` e aplica ajuste conservador.
- Specs focadas validam extracao, resumo, calibracao e aplicacao na curva.
- Novo relatorio permite saber se a amostra esta pronta antes de ativar calibracao automatica.

## Criterios de amostra minima

Padrao recomendado para primeira ativacao controlada:

| Criterio | Minimo | Motivo |
|---|---:|---|
| Total de linhas `trainingReady=true` | 60 | Reduz ruido antes de ajustar probabilidade global |
| Linhas por cenario observado | 20 | Evita calibrar somente com um mix acidental de cenarios |
| Linhas por confianca observada | 20 | Permite saber se `high/medium/low` esta coerente |
| Janela temporal | 30-90 dias | Captura ciclos recentes sem misturar sazonalidade demais |
| Fontes aceitas | `price_update`, `analise_preco`, reserva Stays reconciliada | Mantem trilha auditavel |
| Campos obrigatorios | `bookingProbability`, `inputSignals.outcome.status`, `decisionStatus` ou status do snapshot | Necessarios para comparar previsto vs observado |

Para o recompute automatico por cidade/cenario, usar um degrau mais conservador:

- minimo global: 120 linhas;
- minimo por cidade relevante: 40 linhas;
- minimo por cenario dentro da cidade: 20 linhas quando houver diversidade suficiente;
- `maxAdjustment` inicial: 0.08 a 0.12 ponto absoluto;
- abortar se Brier score piorar em comparacao com baseline anterior.

## Comandos seguros

Dry-run sem DB:

```bash
cd urban-ai-backend-main
node node_modules\ts-node\dist\bin.js -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --dry-run
```

Relatorio a partir de fixture JSON exportada de ambiente seguro:

```bash
cd urban-ai-backend-main
node node_modules\ts-node\dist\bin.js -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --input ./tmp/pricing-decision-snapshots.fixture.json --output ../docs/evidence/outcome-calibration-report.md
```

Leitura em DB nao-producao, somente quando explicitamente aprovado:

```bash
cd urban-ai-backend-main
APP_ENV=staging node node_modules\ts-node\dist\bin.js -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --allow-db-read --limit 5000 --output ../docs/evidence/outcome-calibration-report.md
```

O script bloqueia ambiente/URL com aparencia de producao. Ainda assim, a regra operacional e: rodar primeiro contra fixture ou banco restaurado/local, nunca direto em producao.

## O que falta para usar dados reais

1. Reconciliacao retroativa:
   - juntar `PricingDecisionSnapshot`, `PriceUpdate`, `AnalisePreco` e reservas/ocupacao;
   - preencher `externalReservationId`, `realizedRevenueCents`, `bookedNights`, `reservationGenerated`, `priceAbsorbed` e `recordedAt`;
   - manter idempotencia por snapshot/priceUpdate/reserva.

2. Fonte real de reserva:
   - ingerir reservas Stays ou fonte equivalente;
   - mapear cancelamentos, bloqueios e no-shows;
   - diferenciar ausencia de reserva de indisponibilidade operacional.

3. Evidencia de amostra:
   - gerar `outcome-calibration-report.md` com fixture/staging;
   - confirmar criterios minimos;
   - revisar buckets por cenario e confianca.

4. Plug no recompute:
   - chamar `buildProbabilityCalibration(...)` somente quando `evaluateCalibrationReadiness(...).ready=true`;
   - registrar `source`, `sampleSize`, `maxAdjustment` e versao da calibracao nos drivers/snapshots;
   - manter fallback para curva sem calibracao.

5. Observabilidade:
   - salvar relatorio por execucao;
   - acompanhar Brier score, delta previsto-observado e receita incremental;
   - alertar quando amostra cair abaixo do minimo ou quando ajuste saturar o limite.

## Validacao realizada

Comandos executados sem DB:

```bash
node node_modules\jest\bin\jest.js pricing-outcome-learning.service.spec.ts --runInBand
node node_modules\ts-node\dist\bin.js -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --dry-run
```

Resultado:

- Jest: 1 suite, 4 testes, verde.
- Dry-run: gerou plano de criterios sem abrir conexao com banco.

## Handoff

Proximo agente deve tratar isto como pronto para smoke com fixture ou staging restaurado. O bloqueio remanescente nao e codigo de calculo; e disponibilidade de outcomes reais confiaveis e confirmacao de que a distribuicao por cidade/cenario/confianca tem volume suficiente.
