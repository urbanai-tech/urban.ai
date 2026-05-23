# Evidencia - Event Radar Release Gate

Data: 2026-05-23
Escopo: `/events`, `/events/evt-gp-sp-2026`, `/event-radar`, `/admin/event-radar`

## Resultado

Status: **aprovado**

- Preflight HTTP das quatro rotas: **4/4 OK**
- Playwright real em Chromium: **4/4 testes passaram**
- Exit code do gate: **0**
- Artefatos Playwright: `.playwright-mcp/event-radar-playwright-20260523`
- Resultado Playwright: `.playwright-mcp/event-radar-playwright-20260523/.last-run.json`
- Reexecucao apos fechamento Heatmap/UX: **4/4 testes passaram em 36.5s**

## Comando executado

```powershell
cd Urban-front-main
& 'C:\Users\gusta\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000 --output '..\.playwright-mcp\event-radar-playwright-20260523'
```

## Preflight

```text
/events: HTTP 200
/events/evt-gp-sp-2026: HTTP 200
/event-radar: HTTP 200
/admin/event-radar: HTTP 200
```

## Playwright

```text
Running 4 tests using 1 worker
4 passed (37.8s)
```

## Observacao

A primeira execucao do gate em 2026-05-23 ja tinha destravado infraestrutura e rodado browser real, mas falhou em 3 asserts frageis do spec por textos duplicados/elementos ocultos. O spec foi corrigido para usar `data-testid` escopado em vez de texto solto. A segunda execucao passou com 4/4.

Depois da frente Heatmap Geo & Experience Closure, o gate foi reexecutado no mesmo dia para validar o estado mais recente das telas:

```text
Preflight:
/events: HTTP 200
/events/evt-gp-sp-2026: HTTP 200
/event-radar: HTTP 200
/admin/event-radar: HTTP 200

Playwright:
4 passed (36.5s)
```
