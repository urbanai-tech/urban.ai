# Evidencia - Roadmap Closure Validation

Data: 2026-05-23
Squad: `event-demand-pricing-radar`

## Resultado parcial da rodada

Status: **validacoes principais verdes**

## Frontend / Event Radar

Gate oficial executado com sucesso:

```text
Preflight:
/events: HTTP 200
/events/evt-gp-sp-2026: HTTP 200
/event-radar: HTTP 200
/admin/event-radar: HTTP 200

Playwright:
4 passed (37.8s)
```

Evidencia detalhada: `docs/evidence/event-radar-release-gate-2026-05-23.md`.

Reexecucao apos a frente Heatmap Geo & Experience Closure:

```text
Preflight:
/events: HTTP 200
/events/evt-gp-sp-2026: HTTP 200
/event-radar: HTTP 200
/admin/event-radar: HTTP 200

Playwright:
4 passed (36.5s)
```

Typecheck frontend:

```text
node node_modules/typescript/bin/tsc --noEmit
exit code 0
```

## Backend

Typecheck backend:

```text
node node_modules/typescript/bin/tsc --noEmit
exit code 0
```

Observacao: `playwright-core@1.59.1` estava ausente de `urban-ai-backend-main/node_modules` nesta workspace local, embora constasse no `package.json`/`package-lock.json`. A dependencia foi instalada localmente copiando a mesma versao ja presente em `Urban-front-main/node_modules`, e o typecheck backend full passou em seguida.

Jest direcionado ampliado:

```text
Test Suites: 7 passed, 7 total
Tests: 59 passed, 59 total
```

Suites:

- `src/event-intelligence/event-intelligence.service.spec.ts`
- `src/knn-engine/event-pricing-intelligence.service.spec.ts`
- `src/knn-engine/pricing-outcome-learning.service.spec.ts`
- `src/propriedades/pricing-calculate.service.spec.ts`
- `src/stays/stays.service.spec.ts`
- `src/stays/stays-auto-apply.service.spec.ts`
- `src/evento/event-radar-contract.spec.ts`

## Leitura de progresso

- QA/E2E/Release Event Radar: **100% no escopo local**.
- Backend tecnico direcionado: **verde para as frentes de inteligencia, pricing, outcomes, contract, Stays e auto-apply**.
- Roadmap P0/P1 tecnico: **~98% comprovado**.
- Release controlado: **~95%**, ainda dependente de DB/staging real.
- Roadmap total P0-P2: **~68-72%**, porque o loop tecnico de outcomes, calibracao e auto-apply seguro existe e passa em specs, mas producao ainda depende de dados/ambiente real.

## Pendencias para 100% do roadmap completo

- Aplicar migrations em DB real/staging.
- Rodar `recompute-intelligence` contra dados reais e registrar snapshots/impactos/decisoes.
- Rodar gate contra staging.
- Alimentar outcomes reais de aceite/aplicacao/reserva/receita em volume.
- Calibrar probabilidade de absorcao com outcomes acumulados e plugar calibracao no recompute automatico.
- Rodar beta de auto-apply com allowlists reais e rollback exercitado.

## Atualizacao Railway/readiness multiagentes

Data: 2026-05-23

Status: **validacoes locais verdes; release remoto condicionado a staging/DB real**

O Railway foi mapeado em modo seguro:

- Conta: `urbanai.admin@gmail.com`.
- Backend: projeto `backend`, servico `urban.ai`, ambiente `production`, commit ativo `9b853f5`.
- Frontend: projeto `Front`, servico `Frontend`, ambiente `production`, commit ativo `9b853f5`.
- MySQL: projeto `mysql`, servico `MySQL`, ambiente `production`.
- Nao ha ambiente staging isolado confirmado via MCP; por isso, qualquer smoke remoto com escrita deve ser tratado como producao controlada ou aguardar staging dedicado.

Saude publica verificada:

```text
GET https://urbanai-production-85fd.up.railway.app/health      -> status ok, db ok
GET https://urbanai-production-85fd.up.railway.app/health/live -> status ok
GET https://app.myurbanai.com                                  -> HTTP 200
```

Observacao operacional relevante:

```text
Railway deploy logs: Google Geocoding API HTTP 403 REQUEST_DENIED.
```

Isso indica que `GOOGLE_MAPS_API_KEY` existe, mas a Geocoding API/billing/restricoes do projeto Google precisam ser corrigidas para o heatmap e enriquecimento geo real atingirem qualidade de producao.

Novos artefatos/ajustes:

- `urban-ai-backend-main/scripts/event-intelligence-api-smoke.js`: smoke API seguro; dry-run por padrao, `--execute` para recompute persistente.
- `urban-ai-backend-main/scripts/pricing-outcome-calibration-report.ts`: relatorio de prontidao de calibracao; dry-run por padrao.
- `Urban-front-main/scripts/event-radar-release-gate.mjs`: aceita `--api-url`/`E2E_API_URL` para validar front local com API remota.
- `docs/runbooks/stays-beta-private-smoke.md`: reforcado para dry-run, allowlists, consentimento, risk flags e rollback.
- `urban-ai-backend-main/.env.example`: envs de auto-apply beta documentadas.

Validacoes adicionais:

```text
Backend tsc --noEmit: exit code 0
Frontend tsc --noEmit: exit code 0
Backend Jest ampliado: 8 suites / 66 testes verdes
pricing-outcome-calibration-report.ts --dry-run: verde, sem DB
event-intelligence-api-smoke.js --help: verde
event-intelligence-api-smoke.js --check: verde
event-radar-release-gate.mjs --list: 4 testes em 1 arquivo
git diff --check nos arquivos tocados: sem erro, apenas avisos CRLF
```

Leitura atualizada:

- P0/P1 tecnico local: **99%**.
- Gate Event Radar local: **100%**.
- Release Railway controlado: **95-96%**.
- Roadmap total P0-P2: **70-74%**.

Ainda falta para 100% remoto:

- Criar/confirmar staging isolado, idealmente com DB nao-producao.
- Aplicar migrations em staging e rodar `smoke:event-intelligence --dry-run`.
- Rodar um recompute `--execute` em evento controlado e repetir para comprovar idempotencia.
- Repetir Playwright Event Radar contra front staging.
- Habilitar/corrigir Google Geocoding API.
- Rodar beta Stays em dry-run assistido com allowlists reais e rollback registrado.
