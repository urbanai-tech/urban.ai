# Handoff - E2E Release

Data: 2026-05-22
Agente: E2E Release
Squad: Event Demand Pricing Radar

## Objetivo

Reduzir skips condicionais, aproximar os testes Playwright do app real com locators resilientes, validar fixtures e documentar o que ainda falta para rodar o gate E2E sem ressalvas.

## Entregas

- Removi `test.skip` condicional de `Urban-front-main/e2e/event-radar.spec.ts`.
- Troquei o comportamento de "pular rota ausente" por falha explicita quando a rota retorna 404 ou 5xx.
- Alinhei a fixture Playwright ao formato consumido hoje pelo front:
  - `HostEventRadarResponse.summary` com `revenuePotentialCents`, `relevantEvents`, `opportunityNights` e `impactedProperties`.
  - Eventos do radar com `impactedProperties`, `bestPropertyImpact`, `eventRevenuePotentialCents`, `demandRadiusKm` e `interpretation`.
  - Impactos com `absorptionScenarios`, que e o campo renderizado por `PriceAbsorptionScenarios`.
  - Admin radar com `kpis`, `events`, `categories`, `sources` e `cities`.
  - Admin heatmap em `/admin/events/heatmap`.
  - Admin blind spots com `summary` e `items`, em vez de `groups`.
- Interceptei `https://example.com/**` com 204 para evitar dependencia de rede externa em imagens/fixtures.
- Atualizei o plano de QA e checklist de release com o novo estado do gate.

## Arquivos Alterados

- `Urban-front-main/e2e/event-radar.spec.ts`
- `Urban-front-main/e2e/fixtures/event-radar.fixture.ts`
- `docs/contracts/event-radar-qa-test-plan-v0.md`
- `docs/contracts/event-radar-release-checklist-v0.md`
- `squads/event-demand-pricing-radar/output/e2e-release-handoff-2026-05-22.md`

## Validacoes Rodadas

- `node node_modules\@playwright\test\cli.js test event-radar.spec.ts --list`
  - Resultado: 4 testes descobertos em 1 arquivo.
- `node node_modules\@playwright\test\cli.js test --list`
  - Resultado: suite geral descoberta; `event-radar.spec.ts` apareceu com 4 testes.
- Parse da fixture JSON de contrato:
  - Resultado: 2 eventos, 2 grupos de impacto, 4 cenarios de curva.
- Busca por skips no spec:
  - `rg -n "test\.skip|skipUntilVisible|gotoOrSkipMissingRoute" Urban-front-main/e2e/event-radar.spec.ts`
  - Resultado: sem ocorrencias.
- Typecheck front:
  - `node node_modules\typescript\bin\tsc --noEmit --pretty false`
  - Resultado: falhou por erro preexistente fora do ownership em `src/app/onboarding/page.tsx(1107,37)`, com `cep: null` incompativel com `CreateAddressDto.cep: string`.

Observacao operacional: a primeira tentativa de `node` no sandbox falhou com `Acesso negado`; os comandos foram rerodados com permissao escalada local.

## Tentativa Com App Local

- `http://127.0.0.1:3000/events`: indisponivel.
- `http://127.0.0.1:3007/events`: timeout.

Nao rodei `playwright test event-radar.spec.ts` contra UI real porque nao havia app local responsivo. O spec esta pronto para execucao direcionada assim que um Next local/staging estiver no ar.

## Lacunas Para Rodar Sem Ressalva

- Subir app local ou staging com as rotas `/events`, `/events/[eventId]`, `/event-radar` e `/admin/event-radar` responsivas.
- Executar `node node_modules\@playwright\test\cli.js test event-radar.spec.ts` sem skips e sem fallback de rota.
- Validar visual desktop/mobile das quatro telas com a fixture ligada.
- Exercitar feature flags front/backend em ligado/desligado.
- Definir se o JSON em `docs/contracts/event-radar-fixtures-v0.json` deve migrar para o mesmo formato normalizado do front ou permanecer como contrato backend v0.
