# Next Runtime Doctor Handoff

Data: 2026-05-22
Frente: Next Runtime Doctor
Escopo: diagnostico runtime das rotas `/events`, `/events/[eventId]`, `/event-radar`, `/admin/event-radar`

## Resumo executivo

O bloqueio do Playwright nao parece ser causado por erro runtime claro nos componentes Event Radar. A evidencia aponta para ambiente local Next instavel por concorrencia de dev servers escrevendo no mesmo `.next`, seguido de readiness cedo demais no release gate.

Antes da limpeza havia varios `next dev` do mesmo `Urban-front-main` ativos ao mesmo tempo:

- `3007`
- `3011`
- `3051`
- `3041`

Esse cenario explica os sintomas anteriores:

- HTTP 500 generico nas rotas Event Radar.
- `.next/server/vendor-chunks/@chakra-ui.js` ausente.
- `Cannot find module './6141.js'`.
- `EPERM`/falhas de cache webpack.
- Next preso em `Starting...`.

Depois que os processos duplicados foram encerrados e uma tentativa limpa foi feita, o Next passou de `Starting...`, compilou instrumentation, middleware e pelo menos `/events` respondeu HTTP 200.

## Estado dos processos

Atendi a solicitacao da main thread e parei processos de dev server/gate ligados ao `Urban-front-main`.

Validacao final por leitura de portas:

- sem listeners em `3007`, `3011`, `3041`, `3051`, `3053`, `3054`;
- sem processo `event-radar-release-gate` ativo;
- sem browser Playwright real detectado por `playwright`, `ms-playwright`, `remote-debugging-pipe`, `test-results` ou `Urban-front-main`.

Restaram apenas processos `@playwright/mcp`, que parecem ser servicos MCP do ambiente Opensquad/Codex, nao browsers de teste do release gate.

## Evidencias novas

Logs novos em:

- `Urban-front-main/test-results/event-radar-release-gate/next-dev-3041-2026-05-22T18-40-03-131Z.out.log`
- `Urban-front-main/test-results/event-radar-release-gate/next-dev-3041-2026-05-22T18-40-03-131Z.err.log`
- `Urban-front-main/test-results/event-radar-release-gate/next-dev-3053-2026-05-22T18-39-30-009Z.out.log`
- `Urban-front-main/test-results/event-radar-release-gate/next-dev-3053-2026-05-22T18-39-30-009Z.err.log`

Trechos relevantes:

```text
✓ Compiled /instrumentation in 7.8s (1152 modules)
✓ Ready in 13.4s
○ Compiling /middleware ...
✓ Compiled /middleware in 2.9s (798 modules)
○ Compiling /events ...
✓ Compiled /events in 22.4s (3756 modules)
GET /events 200 in 25346ms
○ Compiling /events/[eventId] ...
```

O erro de cache residual no mesmo ciclo:

```text
Caching failed for pack: Error: ENOENT: no such file or directory, rename
.next/cache/webpack/edge-server-development/0.pack.gz_ -> 0.pack.gz
```

Leitura: `/events` compilou e respondeu 200 quando rodou sem os outros dev servers, mas ainda houve fragilidade de cache do webpack. O processo foi interrompido antes de terminar `/events/[eventId]`, entao nao ha evidencia de stack runtime nessa rota.

## Leitura dos logs antigos

Os `error-context.md` do Playwright mostram apenas HTTP 500 e pagina generica:

- `/events`: 500
- `/events/evt-gp-sp-2026`: 500
- `/event-radar`: 500
- `/admin/event-radar`: 500

Eles nao mostram stack de servidor nem erro React/Next especifico.

Os docs/handoffs anteriores registravam:

- `Cannot find module './6141.js'`
- `.next/server/vendor-chunks/@chakra-ui.js` ausente
- `EPERM` ao renomear packs em `.next/cache/webpack`

Isso e consistente com `.next` corrompido/concorrente, nao com import errado nas telas Event Radar.

## Inspecao de codigo no escopo

Arquivos inspecionados:

- `Urban-front-main/src/app/events/page.tsx`
- `Urban-front-main/src/app/events/[eventId]/page.tsx`
- `Urban-front-main/src/app/event-radar/page.tsx`
- `Urban-front-main/src/app/admin/event-radar/page.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/*`
- `Urban-front-main/src/app/componentes/ui/index.ts`

Pontos observados:

- `useSearchParams` em `/event-radar` esta dentro de `Suspense`.
- As chamadas de API host/admin estao dentro de `useEffect`/handlers client-side, nao no render server.
- Nao ha import real de `@chakra-ui` nas rotas/componentes Event Radar; as ocorrencias de `chakra` encontradas no UI layer sao comentarios em componentes base.
- O barrel `@/app/componentes/ui` exporta corretamente os componentes `event-intelligence`.
- Nao encontrei uso obvio de `window`, `document`, `localStorage` ou API browser no render inicial dessas rotas.

Conclusao: nao apliquei patch nas telas porque nao havia causa runtime clara no codigo permitido.

## Hipotese principal

O Playwright falhou por duas causas combinadas:

1. Concorrencia local: varios `next dev` do mesmo app escrevendo no mesmo `.next`.
2. Readiness cedo demais: o release gate considerou o servidor pronto via `/favicon.ico`; em seguida o preflight bateu nas rotas enquanto middleware/app routes ainda compilavam pela primeira vez.

Na tentativa limpa, `/favicon.ico` respondeu 200 antes das rotas ficarem compiladas. Com timeout curto, o preflight viu `fetch failed`. Com timeout adequado e sem servidores concorrentes, `/events` ja chegou a HTTP 200.

## Recomendacao para a tentativa controlada unica

Antes da tentativa:

1. Confirmar que nao ha `next dev` do `Urban-front-main` ativo.
2. Confirmar que nao ha processo `event-radar-release-gate` ativo.
3. Usar uma porta livre.

Comando recomendado para a main thread:

```powershell
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000 --health-path /events
```

Por que este comando:

- `--health-path /events` evita falso pronto via `/favicon.ico`.
- `--request-timeout-ms 120000` permite primeira compilacao de middleware e rotas.
- O runner ja limpa `.next` por padrao antes de subir servidor proprio.

Nao recomendo iniciar outro `npm run dev` em paralelo durante essa tentativa.

## O que nao foi feito

- Nao iniciei novos servidores depois da instrucao da main thread.
- Nao editei runner, E2E ou backend.
- Nao editei telas/componentes porque nao apareceu stack runtime ou import quebrado no escopo permitido.
- Nao rodei Playwright real novamente apos a instrucao de parar servidores.
