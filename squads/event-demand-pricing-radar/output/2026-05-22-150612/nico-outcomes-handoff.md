# Nico Engine / Pricing Outcomes Handoff

Data: 2026-05-22

## Objetivo

Fortalecer a trilha de outcome de `PricingDecisionSnapshot` para deixar o motor pronto para calibrar probabilidade de absorcao com dados reais de aceite, aplicacao, rejeicao, reserva e receita.

## Arquivos alterados

- `urban-ai-backend-main/src/propriedades/pricing-calculate.service.ts`
- `urban-ai-backend-main/src/propriedades/pricing-calculate.service.spec.ts`
- `urban-ai-backend-main/src/entities/pricing-decision-snapshot.entity.ts`

## Entrega

- Evolui `criarPatchOutcomeSnapshotDecisao` para aceitar outcome vindo de `PriceUpdate`, `AnalisePreco` ou input manual.
- O patch agora registra `decisionStatus` auditavel: `accepted`, `applied`, `rejected`, `expired`, `superseded` ou status atual.
- Mantem o `status` top-level de `PricingDecisionSnapshot` sincronizado com o lifecycle da decisao.
- Preserva e atualiza receita esperada em centavos no patch: `expectedRevenueCents` e `expectedIncrementalRevenueCents`.
- Registra receita realizada, noites reservadas, delta contra esperado e se houve reserva gerada.
- Adiciona timestamps de aceite, rejeicao, aplicacao e registro do outcome.
- Adiciona fonte e detalhes de origem: `price_update`, `analise_preco`, `manual`, `sourceDetail`, `priceUpdateStatus`, `priceUpdateOrigin`, moeda e observacao.
- Adiciona flags de risco para rejeicao, aceite sem preco aplicado, ausencia de reserva e receita realizada abaixo do esperado.

## Exemplos de outcome

### PriceUpdate pendente aceito pelo usuario

```json
{
  "decisionStatus": "accepted",
  "status": "unknown",
  "appliedPriceCents": 64000,
  "expectedRevenueCents": 120000,
  "expectedIncrementalRevenueCents": 30000,
  "reservationGenerated": false,
  "priceAbsorbed": false,
  "source": "price_update",
  "sourceDetail": "user_accepted",
  "priceUpdateStatus": "pending",
  "priceUpdateOrigin": "user_accepted"
}
```

### AnalisePreco aplicada com reserva confirmada

```json
{
  "decisionStatus": "applied",
  "status": "booked",
  "appliedPriceCents": 64000,
  "expectedRevenueCents": 110000,
  "realizedRevenueCents": 128000,
  "revenueDeltaCents": 18000,
  "bookedNights": 2,
  "reservationGenerated": true,
  "priceAbsorbed": true,
  "externalReservationId": "reservation-123",
  "source": "analise_preco",
  "sourceDetail": "manual_dashboard"
}
```

### Rejeicao sem reserva

```json
{
  "decisionStatus": "rejected",
  "status": "not_booked",
  "expectedRevenueCents": 80000,
  "reservationGenerated": false,
  "source": "analise_preco",
  "riskFlags": ["decision_rejected", "no_booking_after_decision"]
}
```

## Validacao

- `node node_modules\jest\bin\jest.js pricing-calculate.service.spec.ts pricing-guardrail.service.spec.ts --runInBand`
  - Resultado: passou, 2 suites / 11 testes.
- `node node_modules\typescript\lib\tsc.js --noEmit -p tsconfig.build.json --pretty false`
  - Resultado: passou.

Observacao: o sandbox bloqueou `node.exe` com "Acesso negado" na primeira tentativa; os mesmos comandos passaram com permissao elevada.

## Riscos e limites

- Esta frente nao persiste o patch automaticamente; ela entrega o helper tipado para a proxima integracao com repositores/servicos de `PriceUpdate`, `AnalisePreco` e/ou `OccupancyHistory`.
- `externalReservationId` ainda precisa vir de uma fonte de reserva real, provavelmente `OccupancyHistory` ou sincronizacao Stays.
- `PriceUpdate.status = error` foi mapeado como `accepted`, porque a decisao existiu, mas o push ainda nao foi aplicado com sucesso. O integrador pode optar por flag operacional extra ao persistir.
- A estrutura esta em `inputSignals` simple-json; nao exige migration imediata, mas indices analiticos futuros podem pedir colunas dedicadas para `decisionStatus`, `reservationGenerated` e `priceAbsorbed`.

## Proximos passos

- Integrar `criarPatchOutcomeSnapshotDecisao` no fluxo que cria/atualiza `PriceUpdate`.
- Rodar reconciliacao periodica de `AnalisePreco` e `OccupancyHistory` para atualizar snapshots antigos com outcome.
- Persistir `externalReservationId`, receita realizada e noites reservadas quando a reserva vier de Stays.
- Criar job de calibracao que compare `bookingProbability` previsto com `priceAbsorbed`, `reservationGenerated` e `revenueDeltaCents`.
