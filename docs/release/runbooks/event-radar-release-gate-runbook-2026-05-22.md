# Runbook de Release Gate - Event Radar E2E

Data: 2026-05-22
Owner: Tais Integracao
Escopo: `/events`, `/events/:eventId`, `/event-radar`, `/admin/event-radar`

## Objetivo

Rodar o E2E real do Event Radar sem skips e com evidencia suficiente para promover o release. O gate deve falhar se qualquer rota estiver ausente, retornar HTTP 5xx, ou se o spec tiver skips.

## Comandos

Listar testes e validar ausencia de skip:

```bash
cd Urban-front-main
npm run test:e2e:event-radar:list
```

Rodar o gate local com Next dev iniciado pelo proprio runner:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

Rodar contra staging ou contra um dev server ja responsivo:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url https://staging.myurbanai.com
```

Fallback direto quando `npm` nao estiver disponivel no terminal do Codex:

```bash
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --list
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
node scripts/event-radar-release-gate.mjs --no-server --base-url https://staging.myurbanai.com
```

Fallback direto sem `@playwright/test`, para quando o runner travar em limpeza de output dentro do OneDrive:

```bash
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com
```

## O que o runner faz

- Verifica se `e2e/event-radar.spec.ts` nao contem `test.skip`, `describe.skip` ou `.skip(`.
- Verifica se Playwright existe em `node_modules`; exige Next local somente quando o runner vai subir servidor.
- Valida argumentos de CLI antes de executar: flags com valor precisam receber valor, portas precisam estar entre `1` e `65535`, e timeouts precisam ser inteiros positivos.
- Aceita parametros com espaco (`--port 3041`) ou inline (`--port=3041`).
- Quando roda local, checa porta antes de iniciar o Next.
- Se a porta default estiver ocupada e `--port` nao tiver sido informado explicitamente, procura a proxima porta livre.
- Se `--base-url` for usado no modo local, valida que ele aponta para o mesmo host/porta do servidor criado. Para servidor ja existente, use `--no-server --base-url`.
- Limpa `.next` por padrao apenas no modo local em que o proprio runner sobe o Next. Use `--keep-next-cache` ou `E2E_KEEP_NEXT_CACHE=1` para preservar cache.
- Sobe `next dev` com `NEXT_TELEMETRY_DISABLED=1`.
- Espera um health check leve responder. O default e `/favicon.ico`; ajuste com `--health-path`.
- Faz preflight das quatro rotas reais (`/events`, `/events/evt-gp-sp-2026`, `/event-radar`, `/admin/event-radar`) antes do browser e falha em respostas fora de `2xx/3xx`. Use `--skip-route-preflight` apenas para diagnostico manual.
- Roda `@playwright/test` contra `e2e/event-radar.spec.ts`.
- Salva logs do Next em `Urban-front-main/test-results/event-radar-release-gate/`.
- Salva artefatos do Playwright fora da workspace sincronizada por padrao: `C:\tmp\urban-ai-event-radar-playwright` no Windows, ou `tmpdir()/urban-ai-event-radar-playwright` em outros sistemas.
- Cria e testa permissao de escrita no diretorio de output do Playwright antes de iniciar servidor local ou testes.
- Avisa se `--output` apontar para dentro da workspace, porque isso pode reabrir o problema de lock em pasta sincronizada.
- Aceita `--output <path>`, `E2E_OUTPUT_DIR`, `--test-timeout-ms` e `--global-timeout-ms` para ajustar o runner sem editar config global.
- Encerra as arvores de processos filhos criadas pelo runner, inclusive em `SIGINT`/`SIGTERM`.
- Quando ha falha, imprime cauda dos logs e sinaliza padroes conhecidos de cache/lock: `MODULE_NOT_FOUND`, `ENOENT`, `EPERM`, `vendor-chunks` e `webpack/cache`.

## Smoke direto Playwright

O script `scripts/event-radar-direct-smoke.mjs` usa Playwright como biblioteca Node, sem acionar o runner `@playwright/test`. Ele nao sobe servidor, nao limpa `.next`, nao toca `Urban-front-main/test-results` e grava relatorio por padrao em:

```text
C:\tmp\urban-ai-event-radar-direct-smoke
```

Ele valida:

- ausencia de `test.skip`/`describe.skip` no spec oficial;
- quatro rotas do Event Radar retornando resposta HTTP, sem 404 e sem 5xx;
- textos principais de catalogo, detalhe, radar host e radar admin;
- link oficial do evento;
- mocks de auth, assinatura, propriedades, catalogo, radar host, detalhe host, heatmap admin e blind spots admin;
- viewport desktop e mobile por padrao.

Argumentos uteis:

```bash
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com --viewport desktop
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com --output C:\tmp\urban-ai-event-radar-direct-smoke
```

## Evidencia coletada nesta rodada

Ambiente: Windows, workspace em OneDrive, multiplos processos Node/Next ja ativos.

Checks verdes:

- `node scripts/event-radar-release-gate.mjs --list`: 4 testes descobertos.
- `rg "test.skip|describe.skip|.skip(" e2e/event-radar.spec.ts`: sem ocorrencias.
- `node --check scripts/event-radar-release-gate.mjs`: OK.
- `node node_modules/eslint/bin/eslint.js scripts/event-radar-release-gate.mjs`: OK.
- Revisao Playwright Runner Doctor: runner endurecido contra cache `.next`, porta ocupada, health check pesado e base URL inconsistente.
- Revisao Final Gate Runner Audit: runner endurecido contra argumentos invalidos, output nao gravavel, preflight permissivo demais e processos filhos sobrevivendo a interrupcao.
- Tentativa independente em `3041`: Next ficou `Ready` e as quatro rotas responderam HTTP 200 (`/events`, `/events/evt-gp-sp-2026`, `/event-radar`, `/admin/event-radar`).
- Browser Playwright direto abriu `/events` com HTTP 200.
- Fallback `scripts/event-radar-direct-smoke.mjs` criado para validar as quatro rotas com Playwright direto quando `@playwright/test` travar no output do OneDrive.

Checks bloqueados:

- `node scripts/event-radar-release-gate.mjs --port 3047 --timeout-ms 120000` iniciou o Next, mas o servidor ficou em `Starting...` e `/events` nao respondeu no prazo.
- `node scripts/event-radar-release-gate.mjs --no-server --base-url http://127.0.0.1:3007` executou os 4 testes em browser real, mas todas as rotas retornaram HTTP 500.
- Uma tentativa local controlada do runner novo foi iniciada e interrompida pelo usuario antes de concluir; depois disso nao foram iniciados novos servidores locais nesta frente.
- `@playwright/test` travou no passo interno `clear output`/`apply rebaselines` quando o output ficava em `Urban-front-main/test-results` dentro do OneDrive. O runner foi ajustado para gravar output fora do OneDrive por padrao.
- A reexecucao final com `--output C:\tmp\urban-ai-event-radar-playwright` nao foi rodada nesta sessao porque novos comandos elevados foram bloqueados por limite de uso do ambiente Codex.

Sinais de causa raiz ambiental:

- Existem listeners locais antigos em `3007`.
- Logs existentes mostram cache/build `.next` inconsistente:
  - `Cannot find module './6141.js'`
  - `.next/server/vendor-chunks/@chakra-ui.js` ausente
  - `EPERM` ao renomear packs em `.next/cache/webpack`
- Rodar `node` dentro do sandbox sem permissao elevada retornou `Acesso negado`; no Codex, os comandos Node precisaram de permissao elevada.
- O problema residual do Playwright local nao e rota 404/500: e lock/limpeza de artefatos em pasta sincronizada. Usar `--output` fora do OneDrive e necessario para o gate local.

## Criterio de aceite

O release gate fica aprovado quando:

- `npm run test:e2e:event-radar:list` lista 4 testes.
- `event-radar.spec.ts` continua sem skips.
- `npm run test:e2e:event-radar -- --no-server --base-url <staging>` passa com 4/4 testes verdes.
- Os artefatos do output configurado nao mostram HTTP 404/5xx nas quatro rotas.
- Logs do servidor nao mostram erro de cache `.next`, `MODULE_NOT_FOUND`, `EPERM`, tela branca ou redirect loop.

## Procedimento recomendado antes do proximo gate local

1. Fechar processos Next antigos que estejam servindo a mesma workspace.
2. Rodar em workspace fora de pasta sincronizada pelo OneDrive, ou pausar sincronizacao durante o gate.
3. Limpar `.next` somente depois de fechar processos Next.
4. Subir o gate com uma porta livre. O runner agora limpa `.next` por padrao, faz preflight das rotas reais e escreve artefatos do Playwright fora do OneDrive:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

Se quiser controlar explicitamente a pasta de artefatos:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --output C:\tmp\urban-ai-event-radar-playwright
```

Se quiser preservar cache para diagnostico:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --keep-next-cache
```

5. Se staging estiver disponivel, preferir:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url https://staging.myurbanai.com
```

## Rollback do gate

Nenhum rollback de produto e necessario para este runner. Se o script causar ruido local, remover apenas:

- `Urban-front-main/scripts/event-radar-release-gate.mjs`
- scripts `test:e2e:event-radar` e `test:e2e:event-radar:list` do `Urban-front-main/package.json`

# Atualizacao operacional - 2026-05-23

## Evidencia verde

Gate oficial contra servidor local existente:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url http://127.0.0.1:3041 --request-timeout-ms 120000
```

Resultado:

- Preflight das quatro rotas Event Radar: HTTP 200.
- `event-radar.spec.ts`: **4 passed** em browser real.
- Artefatos Playwright: `C:\tmp\urban-ai-event-radar-playwright`.

Gate oficial subindo Next local com cache preservado:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --keep-next-cache --timeout-ms 300000 --request-timeout-ms 120000
```

Resultado:

- Health check `/favicon.ico`: HTTP 200.
- Preflight das quatro rotas Event Radar: HTTP 200.
- `event-radar.spec.ts`: **4 passed**.

Smoke direto com Next temporario:

```bash
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3043
```

Resultado:

- Desktop e mobile passaram nas quatro rotas.
- Relatorio: `C:\tmp\urban-ai-event-radar-direct-smoke\event-radar-direct-smoke.json`.
- Screenshots desktop/mobile em `C:\tmp\urban-ai-event-radar-direct-smoke`.

## Erros ambientais conhecidos

Se o ambiente local estiver com processos Next concorrentes, cache travado ou disco sem espaco, o gate pode falhar antes dos testes. Mensagens observadas em 2026-05-23:

- `node.exe`: `Acesso negado` dentro do sandbox; usar permissao elevada do Codex para Node/Playwright.
- `Porta 127.0.0.1:3041 ja esta em uso`; usar `--no-server --base-url` se o servidor existente estiver saudavel, ou liberar/trocar porta.
- `Nao foi possivel limpar .next: ENOTEMPTY`; fechar processos Next/Node e tentar novamente.
- `EPERM: operation not permitted, open '.next\trace'`; indica lock/permissao no cache do Next dentro do OneDrive.
- `ENOSPC: no space left on device, write`; liberar espaco antes de rodar gate local.

## Ajustes de hardening 2026-05-23

- O E2E passou a usar linhas/blocos visiveis para validar imovel impactado, evitando falso negativo por `<option>` oculto e conteudo responsivo duplicado.
- O smoke direto passou a procurar qualquer match visivel para textos esperados, em vez de usar apenas o primeiro match.
- O runner oficial passou a detectar encerramento precoce do Next durante o health check e a diagnosticar `ENOSPC` como problema ambiental de cache/disco.
