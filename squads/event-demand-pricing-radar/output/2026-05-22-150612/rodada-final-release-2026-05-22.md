# Rodada final release - Radar de Eventos

Data: 2026-05-22
Run ID: `2026-05-22-150612`
Status inicial: P0 tecnico ~88%, release controlado ~82%, roadmap P0-P2 ~45%

## Objetivo

Aproximar a entrega de um release controlado forte, atacando as lacunas que ainda impedem a leitura de 95-100% no P0/P1 operacional.

## Agentes em paralelo

| Agente | Frente | Ownership |
|---|---|---|
| Sagan | Backend Idempotency | `event-intelligence` backend, specs e idempotencia de `PricingDecisionSnapshot` |
| Anscombe | Pricing Outcomes | helpers/specs de outcome em `PricingCalculateService` |
| Dalton | Host Heatmap | telas host e componentes `event-intelligence` |
| Hypatia | Admin Geo Ops | `/admin/event-radar` |
| Banach | Release Gate | Playwright, fixtures, checklist e diagnostico de dev server |

## Gates de aceite desta rodada

- Retry de recompute nao duplica `PricingDecisionSnapshot`.
- Outcome de recomendacao de pricing pode ser registrado de forma auditavel.
- Heatmap Host/Admin distingue potencial, falta de geo/dado e imoveis impactados.
- E2E segue sem skip e tem caminho mais reprodutivel para execucao real.
- Status final e memoria do squad sao atualizados com evidencias e lacunas reais.

## Handoffs esperados

- `lia-idempotency-handoff.md`
- `nico-outcomes-handoff.md`
- `maya-host-heatmap-handoff.md`
- `otto-admin-geo-handoff.md`
- `tais-release-gate-handoff.md`

## Resultado consolidado

| Frente | Status | Evidencia |
|---|---|---|
| Backend Idempotency | Concluido | `PricingDecisionSnapshot` calcula `idempotencyKey`/`signalsHash` e reutiliza decisao existente em retry |
| Pricing Outcomes | Concluido | Helper de outcome registra aceite, aplicacao, rejeicao, reserva, receita, fonte e metadados |
| Host Heatmap | Concluido | Heatmap Host diferencia regioes, cidades, imoveis expostos e eventos sem geo |
| Admin Geo Ops | Concluido | Admin separa hotspots, gaps de cobertura, eventos sem geo, receita potencial e blind spots |
| Release Gate | Concluido parcial | Runner reproduzivel criado; Playwright list verde; Playwright real bloqueado por ambiente/cache local |

## Validacoes integradas

- Backend `tsc --noEmit`: passou.
- Jest backend direcionado: passou com **5 suites / 27 testes**.
- Frontend `tsc --noEmit`: passou.
- ESLint direcionado Host/Admin/runner: passou.
- `node scripts/event-radar-release-gate.mjs --list`: passou com **4 testes**.
- `event-radar.spec.ts`: sem `test.skip`.
- `git diff --check`: sem erro de whitespace; apenas avisos de CRLF do Windows.

## Status apos a rodada

- P0 tecnico: **~93%**.
- Release controlado: **~87%**.
- Roadmap total P0-P2: **~50%**.

## Bloqueios para 100%

- Rodar Playwright 4/4 verde em staging/CI limpo ou workspace local sem cache `.next` quebrado.
- Aplicar migrations e rodar smoke de recompute em DB real.
- Persistir outcomes reais de `PriceUpdate`/reserva usando o helper auditavel.
- Evoluir idempotencia defensiva para indice/coluna dedicada e lock/fila operacional.
- Registrar evidencia visual desktop/mobile das telas Host/Admin.
