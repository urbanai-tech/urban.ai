# Handoff - Backend Persistence

Data: 2026-05-22
Agente: Backend Persistence
Squad: Event Demand Pricing Radar

## Escopo executado

- Evolui `POST /admin/events/:eventId/recompute-intelligence` de stub para recompute v0 com escrita real.
- Evolui `POST /admin/events/intelligence/recompute` para batch v0 com escrita real por evento encontrado.
- Persiste `EventIntelligenceSnapshot` append-only usando o motor Nico (`eventDemandScore`) como fonte de demanda.
- Persiste `EventPropertyImpact` append-only a partir de `AnalisePreco` quando ha evento, imovel e host carregados.
- Retorna `writes` reais nos endpoints de recompute, incluindo contadores de snapshots e impacts gravados.
- Mantem `pricingDecisionSnapshot` como lacuna explicita v0, sem tocar em telas React nem `api.ts`.

## Arquivos alterados

- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.spec.ts`
- `squads/event-demand-pricing-radar/_memory/memories.md`
- `squads/event-demand-pricing-radar/output/backend-persistence-handoff-2026-05-22.md`

## Comportamento novo

- Recompute single:
  - carrega o evento;
  - calcula impactos persistiveis vindos de `AnalisePreco`;
  - salva um `EventIntelligenceSnapshot`;
  - salva `EventPropertyImpact` para cada analise persistivel;
  - retorna `status: "ok"`, `jobRunId`, resumo e contadores em `writes`.

- Recompute batch:
  - busca eventos pelo filtro admin;
  - para cada evento, roda a mesma rotina do recompute single;
  - salva snapshot mesmo quando nao ha `AnalisePreco`;
  - salva impacts apenas quando ha analise com evento, endereco e usuario proprietario.

## Testes rodados

- `node node_modules\\typescript\\lib\\tsc.js --noEmit -p tsconfig.build.json --pretty false`
- `node node_modules\\jest\\bin\\jest.js event-intelligence.service.spec.ts event-pricing-intelligence.service.spec.ts event-radar-contract.spec.ts --runInBand`

Resultado: typecheck passou; 3 suites Jest passaram, 15 testes verdes.

## Lacunas remanescentes

- `pricing_decision_snapshot` ainda nao e persistido pelo recompute v0.
- O batch e sincrono e conservador; ainda nao ha fila/job runner com retry, lock ou rate limit.
- A estrategia atual e append-only; ainda nao ha deduplicacao por `jobRunId`, evento, imovel e analise.
- `eventRevenuePotentialCents` e derivado de incremento esperado dos impacts persistiveis; nao e um modelo financeiro completo de cidade/regiao.
- `hotRegions` e heatmap persistido ainda ficam fora desta entrega.
