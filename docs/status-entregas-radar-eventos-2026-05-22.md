# Status das entregas: Radar de Eventos, demanda e pricing

Data: 2026-05-22
Ultima atualizacao: 2026-05-23
Squad: `event-demand-pricing-radar`
Base: `docs/plano-consolidado-inteligencia-eventos-pricing-2026-05-22.md`

## Leitura executiva

A entrega funcional inicial saiu de **~69%** para aproximadamente **~98% no P0/P1 tecnico comprovado** depois das rodadas de implementacao, integracao e destravamento do Playwright. O gate oficial Event Radar foi executado em 2026-05-23 com preflight HTTP 200 nas quatro rotas e Playwright real **4/4 verde**, e foi reexecutado apos as alteracoes finais de heatmap/UX tambem com **4/4 verde**. Frontend e backend passaram em `tsc --noEmit`, e o pacote Jest direcionado de inteligencia/pricing/outcomes/Stays/auto-apply/contrato passou com **7 suites e 59 testes**. Para release controlado com confianca de produto, eu manteria a leitura em **~95%**, porque ainda falta aplicar migrations em DB real/staging, executar smoke de recompute com dados reais e fechar a parte P2 de outcomes/auto-apply/calibracao em ambiente real.

Esta porcentagem considera o pacote P0/P1 inicial: contrato, backend v0, motor v0, telas Host/Admin e QA basico. Se considerarmos o roadmap total P0-P2, incluindo aprendizado com outcomes, auto-apply e calibracao estatistica, o plano geral esta em aproximadamente **68-72%**, porque o loop tecnico de outcomes, calibracao e auto-apply seguro ja existe e passa em specs, mas P2 ainda depende de dados reais de reserva, aceite, aplicacao e receita para calibracao estatistica e beta operacional.

Status da rodada QA Release: **gate Event Radar aprovado**. O motor ja calcula demanda/captura/curva em runtime, os recomputes admin persistem snapshots/impactos/decisoes v0, `pricing_decision_snapshot` agora tem idempotencia defensiva em codigo e helper de outcome auditavel. O Next local limpo respondeu HTTP 200 em `/events`, `/events/evt-gp-sp-2026`, `/event-radar` e `/admin/event-radar`, e o Playwright rodou 4/4 verde. A diferenca para 100% do roadmap completo esta principalmente em DB/staging real, smoke de recompute, rollback operacional e outcomes persistidos para calibracao.

## Agrupamento por faixa de aceite

| Faixa | Entregas | Criterio objetivo |
|---|---|---|
| 100% | Contrato v0 do Radar/Eventos | Documento, fixtures e teste de contrato existem; mudancas futuras devem ser versionadas |
| 90% | Entidades/migrations, endpoints Host/Admin, Event Demand Forecast v0, Price Absorption Curve v0, Host/Admin UX | Implementado, tipado, com persistencia/idempotencia defensiva e checks combinados verdes; falta DB/staging real |
| 80% | QA/E2E, release hardening, heatmap de demanda | Runner e UI acionavel existem; falta Playwright 4/4 verde em ambiente limpo e evidencia visual |
| 50% | Aprendizado por outcomes e auto-apply | Helper auditavel existe; falta persistir outcome real de PriceUpdate/reserva e calibrar o modelo |

## Percentual por entrega

| Entrega | Percentual | Evidencia | Lacuna principal |
|---|---:|---|---|
| Contrato v0 do Radar/Eventos | 100% | `docs/contracts/event-radar-contract-v0.md`, fixtures e spec backend | Manter sincronizado com DTO real |
| Entidades/migrations de inteligencia | 94% | `event_intelligence_snapshots`, `event_property_impacts`, `pricing_decision_snapshots`, indices de retry e typecheck verde | Aplicar migration e validar em DB real |
| Endpoints Host/Admin | 95% | rotas host/admin criadas; recompute v0 retorna `writes`/`runtime`, lock/retry e reuso idempotente | Falta smoke em DB real/staging e fila externa P1 |
| Event Demand Forecast v0 | 88% | motor conectado e `EventIntelligenceSnapshot` persistido no recompute | `eventRevenuePotentialCents` ainda e soma v0 de impactos |
| Price Absorption Curve v0 | 91% | quatro cenarios, probabilidade, receita esperada, persistencia em impactos/decisoes e specs | Calibracao por outcomes reais persistidos |
| Eventos na Cidade Host | 94% | `/events` e `/events/[eventId]` criados, mapa usa lat/lng, calendario/lista e eventos sem geo | Evidencia visual live/staging |
| Radar de Eventos Host | 95% | `/event-radar`, impactos, curva, heatmap geo, celulas derivadas, cidades/imoveis/eventos sem geo | Payload backend persistido e evidencia visual/staging |
| Radar de Demanda Admin | 95% | `/admin/event-radar`, KPIs, blind spots, Geo Ops, mapa operacional compacto, hotspots/gaps/sem geo/receita | Reprocessamento assinc e QA em staging |
| `pricing_decision_snapshot` auditavel | 94% | entidade tipada, persistencia real, idempotencia defensiva, helper de outcome, PriceUpdate/Stays conectado e specs verdes | Volume real de outcomes e indices analiticos futuros |
| Heatmap de demanda | 95% | Host/Admin entendem `h3Index`/`geohash`/bbox/centro, fallback derivado, sem-geo e mapa operacional | Tile provider/payload persistido e evidencia visual live |
| QA/E2E/Release | 100% no escopo Event Radar | runner reproduzivel, smoke direto Playwright, specs sem skip, Playwright 4/4 verde, rotas Event Radar HTTP 200 | Expandir evidencia para staging/DB real |
| Auto-apply event-safe beta | 82% | guardrails, allowlists, dry-run, rollback baseline, consentimento e 11 specs verdes | Beta real com Stays/staging, rollback exercitado e outcomes persistidos |
| Outcomes & calibration loop | 68% | `PriceUpdate` alimenta outcome, dataset de aprendizado existe e calibracao ajusta curva quando ha amostra | Job retroativo, reservas reais e plug automatico no recompute |

## Percentual por fase

| Fase | Percentual | Comentario |
|---|---:|---|
| Fase 0: alinhamento de contrato | 100% | Contrato v0 e fixtures existem |
| Fase 1: trabalho paralelo isolado | 90% | Os cinco agentes entregaram fatias funcionais |
| Fase 2: mini-squads de integracao | 92% | Backend integra motor, persiste v0, salva decisao auditavel e tem idempotencia defensiva |
| Fase 3: integracao final | 96% | Typechecks, specs backend, frontend typecheck, UX heatmap e Playwright 4/4 verde; falta DB/staging real |
| Release hardening | 96% | Runner endurecido, rotas HTTP 200, causa residual isolada, smoke direto criado e gate 4/4 aprovado; falta smoke DB real |

## Como subir de 97% comprovado para 100% P0/P1

Prioridade 1: validar em ambiente real.

- Gate local Event Radar: feito em 2026-05-23 com 4/4 verde.
- Repetir contra staging: `npm run test:e2e:event-radar -- --no-server --base-url <staging>`.
- Aplicar migrations em DB real e rodar smoke de recompute.
- Confirmar auth/feature flags sem depender de fallback contratual.

Prioridade 2: tornar recompute robusto em operacao.

- Adicionar indice/coluna futura para `idempotencyKey` apos backfill.
- Evitar corrida concorrente extrema com lock por evento/cidade.
- Preparar fila/job runner com retry e lock por cidade/evento.

Prioridade 3: fechar aprendizado.

- Persistir o patch de outcome em `pricing_decision_snapshot` quando `PriceUpdate`/reserva/aceite mudarem.
- Registrar outcomes para calibrar probabilidade de absorcao.
- Separar recomendacao, aplicacao e resultado economico.

Prioridade 4: E2E e release.

- Rodar smoke mobile/desktop e registrar evidencias.
- Definir criterio de beta fechado por cidade/host.
- Exercitar rollback de flag e registrar evidencia.

## Checks objetivos faltantes para chegar em 100%

| Gate | Dono sugerido | Impacto esperado |
|---|---|---:|
| `recompute-intelligence` grava `EventIntelligenceSnapshot` real com `jobRunId` | Backend Intelligence | feito |
| Gerar e persistir `EventPropertyImpact` a partir do motor v0 | Backend Intelligence | feito |
| `pricing_decision_snapshot` registra recomendacao, probabilidade, drivers e guardrails | Backend/Pricing | feito no recompute com idempotencia defensiva |
| Helper auditavel de outcome registra aceite/aplicacao/reserva/receita | Backend/Pricing | feito; falta integracao persistida no fluxo real |
| Playwright `event-radar.spec.ts` roda contra app local/staging sem `test.skip` | QA + Experience | runner feito; falta 4/4 verde |
| QA visual desktop/mobile em `/events`, `/events/[id]`, `/event-radar`, `/admin/event-radar` | QA + Experience | falta evidencia browser limpa |
| Feature flags `EVENT_RADAR_ENABLED` e `NEXT_PUBLIC_EVENT_RADAR_ENABLED` documentadas e testadas | Release | +1 pt |
| Heatmap diferencia celula real, evento sem geo e regiao de demanda agregada | Experience/Admin | +1 pt |

## Validacoes desta rodada QA

- Playwright listou **4 testes** em `Urban-front-main/e2e/event-radar.spec.ts`.
- O spec E2E nao possui mais `test.skip` condicional.
- Runner `test:e2e:event-radar` foi criado para rodar local ou contra `--base-url`.
- Runner foi ajustado para gravar artefatos Playwright fora do OneDrive por padrao: `C:\tmp\urban-ai-event-radar-playwright`.
- Next local limpo em `127.0.0.1:3041` respondeu HTTP 200 em `/events`, `/events/evt-gp-sp-2026`, `/event-radar` e `/admin/event-radar`.
- Browser Playwright direto abriu `/events` com HTTP 200.
- Fixture JSON `docs/contracts/event-radar-fixtures-v0.json` parseou com **2 eventos**, **2 grupos de impacto** e **1 curva**.
- Jest backend `event-radar-contract.spec.ts` passou: **1 suite, 5 testes**.
- Backend combinado passou em 2026-05-23 no typecheck full (`tsc --noEmit`) e Jest direcionado ampliado com **7 suites, 59 testes** verdes.
- Dependencia instalada nesta rodada: `playwright-core@1.59.1` foi adicionado localmente em `urban-ai-backend-main/node_modules`, alinhado ao `package.json`/lock.
- Frontend passou em `tsc --noEmit`.
- ESLint direcionado passou para as telas/componentes Host e para `/admin/event-radar`.
- ESLint direcionado passou tambem para `scripts/event-radar-release-gate.mjs`.
- `git diff --check` nao apontou erros de whitespace, apenas avisos de normalizacao CRLF.
- Em 2026-05-23, o gate oficial Event Radar passou com **4/4 testes verdes** em Playwright real e foi reexecutado apos Heatmap/UX tambem com **4/4 verde**. Evidencia: `docs/evidence/event-radar-release-gate-2026-05-23.md`.
- Evidencia consolidada da rodada: `docs/evidence/roadmap-closure-validation-2026-05-23.md`.

## Rodada multiagentes de continuidade

| Agente | Foco | Meta de subida |
|---|---|---|
| Chandrasekhar | Persistencia real de `pricing_decision_snapshot` | Concluido; snapshot auditavel foi de 60% para 80% |
| Pasteur | QA/polish Host | Concluido; Host foi para ~80-82% |
| Descartes | QA/polish Admin | Concluido; Admin foi para ~81% |
| Aristotle | QA/E2E release | Concluido; E2E sem skip e checklist atualizado |
| Boyle | Robustez de recompute | Concluido; runbook de idempotencia/retry/rollout criado |

## Rodada final release

| Agente | Foco | Resultado |
|---|---|---|
| Sagan | Idempotencia backend | Concluido; `PricingDecisionSnapshot` usa `idempotencyKey`/`signalsHash` defensivos em `inputSignals` |
| Anscombe | Outcomes de pricing | Concluido; helper registra aceite, aplicacao, rejeicao, reserva, receita e fonte |
| Dalton | Heatmap Host | Concluido; Host diferencia regioes, cidades, imoveis expostos e eventos sem geo |
| Hypatia | Geo Ops Admin | Concluido; Admin separa hotspots, gaps, eventos sem geo, receita e blind spots |
| Banach | Release Gate | Concluido; runner reproduzivel criado, bloqueio local diagnosticado como ambiente/cache `.next` |

# Atualizacao Release Evidence 100

Status objetivo apos a frente Release Evidence 100:

- Event Radar/Playwright: **95% comprovado / 100% condicionado ao gate final 4/4**.
- P0 tecnico: **95% comprovado**, com criterio claro para subir a 100%.
- Release controlado: **90% comprovado**, pendente da evidencia final Playwright real.

## O que ja esta provado

- Rotas alvo do Event Radar ja responderam HTTP 200 em tentativa limpa.
- O Playwright direto abriu `/events` com HTTP 200.
- O spec nao possui skips conhecidos e lista 4 testes.
- O problema anterior foi isolado em ambiente/cache/artefatos no OneDrive.
- O runner foi endurecido para usar artefatos fora do OneDrive.

## O que falta para marcar 100%

Executar com sucesso:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

Marcamos 100% quando houver exit code 0, 4/4 testes passando em browser real e evidencia registrada em `docs/evidence/event-radar-playwright-fix-2026-05-22.md`.

## Rodada multiagentes Playwright 100

Status apos as frentes `Final Gate Runner Audit`, `Direct Playwright Smoke` e `Release Evidence 100`:

- Runner oficial endurecido para argumentos invalidos, output externo, preflight que rejeita 404, cleanup de filhos e escrita validada antes de subir servidor.
- Smoke direto `Urban-front-main/scripts/event-radar-direct-smoke.mjs` criado como trilha alternativa sem `@playwright/test`, sem limpar `.next` e sem escrever em `Urban-front-main/test-results`.
- Script npm criado: `npm run test:e2e:event-radar:direct`.
- O smoke direto valida as quatro rotas em desktop e mobile por padrao, checa ausencia de skips no spec oficial, falha em `pageerror`, usa mocks equivalentes ao contrato e grava evidencia em `C:\tmp\urban-ai-event-radar-direct-smoke`.
- `package.json` parseou via PowerShell e o comando npm novo foi confirmado.
- `event-radar.spec.ts` segue sem `test.skip`, `describe.skip` ou `.skip(`.
- `git diff --check` nos arquivos tocados nesta rodada nao apontou erro de whitespace, apenas aviso esperado de CRLF.

Leitura honesta: a entrega fica em **95% comprovado** e **~98% pronta para execucao do gate**, mas **nao deve ser marcada como 100%** ate um dos comandos abaixo terminar com exit code 0 em browser real:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --timeout-ms 300000 --request-timeout-ms 120000 --output C:\tmp\urban-ai-event-radar-playwright
```

ou, como smoke funcional direto:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
```

Bloqueio externo da sessao: novas execucoes Node/Playwright com permissao elevada ficaram indisponiveis por limite de uso do ambiente Codex. Por isso, a ultima milha deve ser rodada quando o limite resetar ou em CI/staging.

## Rodada roadmap closure - 2026-05-23

| Frente | Resultado | Percentual recomendado |
|---|---|---:|
| QA Release Gate | Gate oficial Event Radar 4/4, smoke direto desktop/mobile, scripts lint/check OK | 100% no gate local / 98% QA release |
| Backend DB & Recompute | Lock/retry idempotente, advisory lock MySQL, `runtime`/`writes.created/reused/skipped` no retorno | 97% backend recompute |
| Outcomes & Learning Loop | `PriceUpdate`/Stays alimenta `pricing_decision_snapshot.inputSignals.outcome`, dataset e calibracao de absorcao | 68% outcomes/calibracao |
| Auto-Apply & Guardrails | Cohort `event-safe-beta` com allowlists, consentimento, rollback baseline, snapshot, confidence/probability/multiplier e risk flags | 82% auto-apply P2 |
| Heatmap Geo & Experience | H3/geohash/bbox/centro, fallback derivado, sem-geo, mapa Host/Admin e CTAs mais claros | 95% UX/heatmap |

Validacoes consolidadas da rodada:

- Gate Event Radar local: **4/4 Playwright verde**, reexecutado apos Heatmap/UX.
- Smoke direto Event Radar: desktop/mobile verde nas quatro rotas segundo handoff QA.
- Frontend: `tsc --noEmit` verde.
- Backend: `tsc --noEmit` verde.
- Backend Jest ampliado: **7 suites / 59 testes verdes**.
- Evidencia consolidada: `docs/evidence/roadmap-closure-validation-2026-05-23.md`.

Leitura final desta rodada:

- **P0/P1 tecnico comprovado:** 98%.
- **Gate Event Radar local:** 100%.
- **Release controlado:** 95%, condicionado a staging/DB real.
- **Roadmap total P0-P2:** 68-72%, condicionado a volume real de outcomes, calibracao automatica, beta Stays e rollback real.

## Rodada Railway/readiness multiagentes - 2026-05-23

Status apos a rodada solicitada para "fazer acontecer" com Git/Railway:

| Frente | Resultado | Percentual recomendado |
|---|---|---:|
| Railway/Git Ops | Railway logado como `urbanai.admin@gmail.com`; backend, front e MySQL mapeados; producao atual esta no commit `9b853f5`; branch local `codex/event-radar-roadmap-closure` criada | 95% ops readiness |
| Backend staging readiness | Smoke seguro `smoke:event-intelligence` criado; dry-run valida GETs reais e `--execute` fica opt-in para recompute persistente | 98% backend readiness |
| Frontend staging gate | Runner Event Radar aceita `--api-url`/`E2E_API_URL`; gate staging documentado | 92% pronto para staging |
| Outcomes/calibracao | Criterio objetivo de amostra e relatorio `pricing-outcome-calibration-report.ts` em dry-run | 70% outcomes/calibracao |
| Auto-apply beta | Envs/runbook reforcados; dry-run assistido liberavel; live segue bloqueado ate rollback real | 86% beta operacional |
| Validacao local combinada | Backend `tsc`, frontend `tsc`, smoke scripts e Jest ampliado com 8 suites / 66 testes verdes | 99% tecnico local |

Validacoes desta rodada:

- Backend `tsc --noEmit`: verde apos ajuste cirurgico em `AirbnbPricingError.cause`.
- Frontend `tsc --noEmit`: verde.
- Backend Jest ampliado: **8 suites / 66 testes verdes**.
- `pricing-outcome-calibration-report.ts --dry-run`: verde, sem abrir conexao com banco.
- `event-intelligence-api-smoke.js --help` e `node --check`: verdes.
- `event-radar-release-gate.mjs --list`: **4 testes em 1 arquivo**.
- Saude publica atual: backend `/health` ok, backend `/health/live` ok, frontend publico HTTP 200.

Bloqueios reais que ainda impedem 100% completo:

- Nao ha staging isolado confirmado nos projetos Railway; os servicos visiveis hoje estao em `production`.
- Smoke `smoke:event-intelligence` ainda precisa de `ADMIN_BEARER_TOKEN` real e API staging/prod controlada.
- Migrations novas ainda precisam ser aplicadas em DB real/staging com backup/rollback.
- Logs Railway mostram `GOOGLE_MAPS_API_KEY` com Geocoding API negada (`REQUEST_DENIED`/HTTP 403), o que reduz qualidade de geo/heatmap real ate habilitar API/billing/restricoes corretas no Google Cloud.
- Auto-apply live segue bloqueado por decisao: falta smoke assistido, allowlist real, consentimento, rollback exercitado e evidencia de `PriceUpdate -> AnalisePreco -> PricingDecisionSnapshot`.

Leitura atualizada:

- **P0/P1 tecnico local:** 99%.
- **Gate Event Radar local:** 100%.
- **Release Railway controlado:** 95-96%, condicionado a PR/deploy, migration/smoke real e geocoding corrigido.
- **Roadmap total P0-P2:** 70-74%, porque outcomes/calibracao e beta auto-apply agora tem ferramentas de prontidao, mas ainda dependem de dados reais e operacao assistida.
