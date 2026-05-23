# Frontend Staging Gate - Event Radar

Data: 2026-05-23
Agente: Lovelace Frontend/Staging Gate
Escopo: `Urban-front-main/e2e/`, `Urban-front-main/scripts/event-radar-*`, evidencias/handoff

## Veredito

O Event Radar esta pronto para validacao de staging do ponto de vista frontend/gate. O runner oficial e o smoke direto ja existem, estao parametrizaveis para ambiente remoto e a lacuna pequena de API URL foi fechada no runner oficial com `--api-url` / `E2E_API_URL`.

Percentual recomendado desta frente: **92% pronto para staging**.

Leitura do percentual:

- **100%** para gate local contract-first ja evidenciado.
- **95%** para capacidade operacional de rodar contra staging, porque `--base-url` ja existia e `--api-url` agora cobre local frontend + API remota.
- **92%** geral desta frente, pois a execucao real contra staging ainda depende de URL publica, API configurada no deploy e ambiente remoto saudavel.

## Como parametrizar

### Base URL do app

O app sob teste e definido por:

- `--base-url <url>` no runner oficial.
- `E2E_BASE_URL=<url>`.
- `playwright.config.ts` tambem usa `E2E_BASE_URL`; em CI cai para `https://staging.myurbanai.com`; local cai para `http://localhost:3000`.

Comando staging recomendado:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url https://staging.myurbanai.com --request-timeout-ms 120000 --output C:\tmp\urban-ai-event-radar-staging-playwright
```

### API URL

O frontend usa `NEXT_PUBLIC_API_URL` em `src/app/service/api.ts` como `baseURL` do axios.

Melhoria aplicada no runner oficial:

- `--api-url <url>` foi adicionado em `scripts/event-radar-release-gate.mjs`.
- `E2E_API_URL` tambem e aceito.
- Quando o runner sobe o Next local, o valor e propagado para `NEXT_PUBLIC_API_URL`.
- Em `--no-server` contra app remoto, o runner registra a API informada no processo Playwright, mas a API real do app remoto continua sendo a `NEXT_PUBLIC_API_URL` definida no build/deploy de staging.

Comando para frontend local apontando para API remota:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --api-url https://api-staging.myurbanai.com --timeout-ms 300000 --request-timeout-ms 120000
```

Comando staging remoto, quando a API ja estiver configurada no deploy:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url https://staging.myurbanai.com --request-timeout-ms 120000
```

Fallback visual direto desktop/mobile:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com --output C:\tmp\urban-ai-event-radar-staging-direct-smoke
```

## Scripts confirmados

- `npm run test:e2e:event-radar`: executa `scripts/event-radar-release-gate.mjs`.
- `npm run test:e2e:event-radar:list`: lista os 4 testes do spec.
- `npm run test:e2e:event-radar:direct`: executa `scripts/event-radar-direct-smoke.mjs`.
- `scripts/event-radar-release-gate.mjs`: preflight HTTP das rotas, valida ausencia de skips, sobe Next local ou usa `--no-server`, grava artefatos fora do OneDrive por padrao.
- `scripts/event-radar-direct-smoke.mjs`: smoke direto com Playwright como biblioteca, desktop/mobile por padrao, mocks de APIs Event Radar e screenshots em `C:\tmp`.

Rotas cobertas:

- `/events`
- `/events/evt-gp-sp-2026`
- `/event-radar`
- `/admin/event-radar`

## Checks locais executados nesta rodada

```powershell
cd Urban-front-main
node --check scripts/event-radar-release-gate.mjs
node --check scripts/event-radar-direct-smoke.mjs
rg -n "test\.skip|describe\.skip|\.skip\(" e2e/event-radar.spec.ts scripts/event-radar-release-gate.mjs scripts/event-radar-direct-smoke.mjs
node scripts/event-radar-release-gate.mjs --list
```

Resultado:

- `node --check scripts/event-radar-release-gate.mjs`: OK.
- `node --check scripts/event-radar-direct-smoke.mjs`: OK.
- Busca por skips: sem ocorrencias.
- Listagem Playwright: **4 testes em 1 arquivo**.
- Observacao operacional: `node.exe` retornou `Acesso negado` no sandbox; os checks Node foram reexecutados fora do sandbox, sem deploy.

## Evidencias locais existentes

- `docs/evidence/event-radar-release-gate-2026-05-23.md`: gate oficial aprovado, preflight 4/4 HTTP 200 e Playwright 4/4 verde.
- `docs/evidence/event-radar-direct-smoke-2026-05-22.md`: smoke direto desktop/mobile verde nas quatro rotas, com JSON e screenshots em `C:\tmp\urban-ai-event-radar-direct-smoke`.
- `squads/event-demand-pricing-radar/output/2026-05-23-roadmap-closure/qa-release-gate.md`: consolida gate local, smoke direto, checks de sintaxe/lint e erros ambientais conhecidos.
- `docs/release/runbooks/event-radar-release-gate-runbook-2026-05-22.md`: runbook operacional com comandos local, staging, fallback direto e criterio de aceite.
- `squads/event-demand-pricing-radar/output/2026-05-23-roadmap-closure/final-roadmap-closure-summary.md`: marca gate local Event Radar como 100% e release controlado como 95%, mantendo staging/DB real como pendencia.

## Lacunas para fechar staging

- Confirmar a URL final do app staging. O fallback atual assume `https://staging.myurbanai.com`.
- Confirmar que o deploy staging foi construido com `NEXT_PUBLIC_API_URL` apontando para a API staging correta.
- Rodar o comando `--no-server --base-url <staging>` em ambiente remoto real e anexar artefatos.
- Validar CORS da API staging com origem do front staging.
- Rodar recompute/migrations/DB real no backend antes de declarar release controlado 100%.
- Se o objetivo for teste com dados reais, criar uma suite separada sem mocks; o gate atual e contract-first com mocks para isolar regressao frontend.

## Criterio de aceite staging

Staging pode ser considerado fechado para o frontend quando:

- `npm run test:e2e:event-radar:list` listar 4 testes.
- `event-radar.spec.ts` permanecer sem skips.
- `npm run test:e2e:event-radar -- --no-server --base-url <staging>` terminar com exit code `0`.
- Preflight das quatro rotas retornar HTTP `2xx/3xx`.
- Playwright retornar **4 passed**.
- Artefatos em `C:\tmp\urban-ai-event-radar-staging-playwright` nao mostrarem 404, 5xx, tela branca ou redirect loop.
- Se houver API real no escopo, confirmar em deploy que `NEXT_PUBLIC_API_URL` aponta para API staging e que CORS permite a origem do front.
