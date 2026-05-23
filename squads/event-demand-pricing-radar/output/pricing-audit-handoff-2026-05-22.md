# Handoff - Pricing Audit

## Agente

Pricing Audit

## Objetivo

Preparar `pricing_decision_snapshots` como trilha auditavel da decisao:

evento -> sinais de demanda/captura -> curva de preco -> cenario escolhido -> aplicacao/outcome.

## Entregas

- Tipagem concreta para `inputSignals`, `guardrails` e `outcome` em `PricingDecisionSnapshot`.
- Builder `PricingCalculateService.criarSnapshotDecisaoPricingEvento(...)` para gerar um draft persistivel via `Repository<PricingDecisionSnapshot>.create(...)`.
- Patch `PricingCalculateService.criarPatchOutcomeSnapshotDecisao(...)` para registrar resultado posterior sem perder a trilha da decisao original.
- Normalizacao de valores legados de `AnalisePreco` em reais para centavos dentro do fluxo de auditoria.
- Specs cobrindo:
  - snapshot com curva de absorcao e cenario selecionado;
  - linkage com `AnalisePreco` e `PriceUpdate`;
  - patch de outcome com receita realizada e delta contra receita esperada.

## Wiring Recomendado

Quando a agente Backend Persistence persistir snapshots:

```ts
const draft = pricingCalculateService.criarSnapshotDecisaoPricingEvento({
  user,
  property,
  event,
  eventIntelligenceSnapshot,
  eventPropertyImpact,
  analisePreco,
  priceInput,
  selectedScenario: 'recommended',
  jobRunId,
});

await pricingDecisionSnapshotRepository.save(
  pricingDecisionSnapshotRepository.create(draft),
);
```

Quando chegar outcome real:

```ts
const patch = pricingCalculateService.criarPatchOutcomeSnapshotDecisao({
  snapshot,
  priceUpdate,
  status: 'booked',
  appliedPriceCents,
  realizedRevenueCents,
  bookedNights,
  source: 'channel',
});

await pricingDecisionSnapshotRepository.update(snapshot.id, patch);
```

## Comandos Rodados

- `node node_modules\\jest\\bin\\jest.js pricing-calculate.service.spec.ts --runInBand`
- `node node_modules\\typescript\\lib\\tsc.js --noEmit -p tsconfig.build.json --pretty false`

Ambos passaram.

## Lacunas

- Ainda nao injetei `Repository<PricingDecisionSnapshot>` em nenhum fluxo de producao para evitar conflito com Backend Persistence.
- O outcome real depende de fonte operacional: `AnalisePreco.reservaStatus`, `PriceUpdate.status` e/ou canal externo.
- Falta decidir politica de idempotencia do snapshot: por `analisePreco + targetDate + selectedScenario`, por `jobRunId`, ou por hash dos sinais.
