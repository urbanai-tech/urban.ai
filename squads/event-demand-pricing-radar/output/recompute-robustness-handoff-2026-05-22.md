# Handoff - Recompute Robustness

Data: 2026-05-22
Agente: Recompute Robustness
Squad: Event Demand Pricing Radar

## Escopo executado

Especifiquei a politica de idempotencia e robustez para o recompute de inteligencia de eventos sem tocar backend/frontend.

O artefato principal ficou em:

- `docs/runbooks/event-intelligence-recompute-idempotency-2026-05-22.md`

## Decisoes recomendadas

### Politica de persistencia

- `EventIntelligenceSnapshot`: append-only por recompute, com dedupe de retry por `jobRunId + eventId`.
- `EventPropertyImpact`: append-only por snapshot, com dedupe intra-job por `jobRunId + eventId + propertyAddressId + analisePrecoId`.
- `PricingDecisionSnapshot`: idempotente por decisao. Repetir o mesmo calculo nao deve criar nova decisao; mudanca real de sinais/modelo/preco/guardrail deve criar nova decisao e supersedar drafts antigos.
- Outcome deve atualizar a decisao original, nao criar uma decisao nova.

### Chave recomendada para `PricingDecisionSnapshot`

```text
pricing-decision-v0:{eventId}:{propertyAddressId}:{analisePrecoId}:{targetDate}:{selectedScenario}:{modelVersion}:{metricVersion}:{signalsHash}
```

`jobRunId` fica como rastreio de execucao e retry. Ele nao deve ser a chave de negocio da decisao.

Curto prazo:

- gravar `inputSignals.idempotencyKey`;
- gravar `inputSignals.signalsHash`;
- buscar decisao existente antes de inserir.

Medio prazo:

- adicionar colunas `idempotencyKey` e `signalsHash`;
- criar indice unico para `idempotencyKey` apos limpar historico.

### Fila, retry e lock

Recomendado:

- lock por evento: `event-intelligence:event:{eventId}`;
- lock por batch: `event-intelligence:batch:{city}:{from}:{to}:{filtersHash}`;
- retry maximo 3 vezes, com backoff 1 min, 5 min, 15 min e jitter;
- retry deve reutilizar o mesmo `jobRunId`;
- batch deve processar cada evento em transacao propria;
- falha parcial nao deve cancelar o batch inteiro.

## Smoke incluido no runbook

O runbook inclui:

- SQL MySQL para conferir snapshots, duplicatas intra-job, curves persistidas, JSON valido e ultima versao.
- API smoke para recompute single, batch pequeno, leitura Host e leitura Admin.
- Gates de staging por fase.
- Rollback sem apagar dados auditaveis.
- Metricas e alertas minimos.

## Arquivos alterados

- `docs/runbooks/event-intelligence-recompute-idempotency-2026-05-22.md`
- `squads/event-demand-pricing-radar/output/recompute-robustness-handoff-2026-05-22.md`

## Comandos e validacoes rodados

Leituras de contexto:

- `Get-Content -Raw _opensquad/_memory/company.md`
- `Get-Content -Raw _opensquad/_memory/preferences.md`
- `Get-Content -Raw squads/event-demand-pricing-radar/_memory/memories.md`
- `Get-Content -Raw docs/status-entregas-radar-eventos-2026-05-22.md`
- `Get-Content -Raw docs/contracts/event-radar-release-checklist-v0.md`
- `Get-Content -Raw squads/event-demand-pricing-radar/output/backend-persistence-handoff-2026-05-22.md`
- `Get-Content -Raw squads/event-demand-pricing-radar/output/pricing-audit-handoff-2026-05-22.md`
- leituras read-only das entidades `pricing-decision-snapshot`, `event-property-impact`, `event-intelligence-snapshot` e migration de fundacao.

Validacoes:

- Confirmado que os arquivos novos ainda nao existiam antes da escrita.
- Mantido ownership exclusivo em docs/runbooks/output.
- Nenhum arquivo de backend/frontend foi alterado.

## Lacunas

- Nao rodei typecheck/Jest porque esta rodada e apenas documental e sem mudanca de codigo.
- Nao rodei SQL/API smoke porque depende de staging/DB real e IDs reais.
- Nao atualizei `memories.md` para respeitar o ownership exclusivo desta rodada.
- Ainda falta a frente Backend Decision Persistence implementar a gravacao real de `PricingDecisionSnapshot` usando a politica recomendada.
- Ainda falta escolher a infraestrutura final de fila: BullMQ/Redis, tabela MySQL de jobs ou advisory lock puro.
