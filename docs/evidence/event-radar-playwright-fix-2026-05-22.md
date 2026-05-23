# Evidencia - Event Radar Playwright Fix

Data: 2026-05-22
Escopo: `/events`, `/events/:eventId`, `/event-radar`, `/admin/event-radar`

## Resumo

A rodada isolou o bloqueio do Playwright. O problema deixou de ser rota 404/500 ou erro runtime das telas. Em ambiente limpo, o Next compilou as rotas de Event Radar e respondeu HTTP 200 nas quatro rotas do gate. O bloqueio residual esta no `@playwright/test` limpando/escrevendo artefatos em `Urban-front-main/test-results`, dentro do OneDrive.

## Evidencias positivas

- Next independente em `127.0.0.1:3041` ficou `Ready`.
- Rotas aquecidas manualmente:
  - `/events`: HTTP 200
  - `/events/evt-gp-sp-2026`: HTTP 200
  - `/event-radar`: HTTP 200
  - `/admin/event-radar`: HTTP 200
- Browser Playwright direto abriu `/events` com HTTP 200.
- O runner `scripts/event-radar-release-gate.mjs` foi endurecido para:
  - limpar `.next` com guarda de caminho;
  - fazer health check leve;
  - fazer preflight das quatro rotas reais;
  - diagnosticar cache/lock (`MODULE_NOT_FOUND`, `ENOENT`, `EPERM`, `vendor-chunks`, `webpack/cache`);
  - gravar artefatos Playwright fora do OneDrive por padrao.

## Causa raiz isolada

O `@playwright/test` travou nos passos internos:

```text
clear output
apply rebaselines
```

Esses passos rodam antes/depois dos testes e tentam limpar ou aplicar artefatos no diretório de output. Quando o output ficou em `Urban-front-main/test-results` dentro da pasta sincronizada pelo OneDrive, a execucao travou ate o `global-timeout`.

## Correcao aplicada

O runner agora define output externo por padrao:

```text
C:\tmp\urban-ai-event-radar-playwright
```

Tambem aceita:

```bash
--output <path>
E2E_OUTPUT_DIR=<path>
--test-timeout-ms <ms>
--global-timeout-ms <ms>
```

Tambem foi criado um fallback fora do `@playwright/test`:

```text
Urban-front-main/scripts/event-radar-direct-smoke.mjs
```

Esse smoke usa Playwright como biblioteca Node, instala os mocks essenciais do spec de Event Radar, nao sobe servidor, nao limpa `.next`, nao usa `Urban-front-main/test-results` e valida as quatro rotas em desktop e mobile por padrao.

Comando:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
```

Contra staging:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com
```

## Auditoria Final Gate Runner

A auditoria da frente Final Gate Runner corrigiu riscos adicionais antes da tentativa 100%:

- flags com valor agora falham cedo quando vierem sem argumento (`--port`, `--base-url`, `--output`, timeouts etc.);
- `--flag=value` tambem e aceito para os parametros com valor;
- porta e timeouts precisam ser inteiros validos antes do runner subir qualquer coisa;
- o diretorio de output do Playwright e criado e testado para escrita antes de iniciar servidor local ou chamar `@playwright/test`;
- se o output for colocado dentro da workspace, o runner emite aviso de risco por pasta sincronizada;
- o preflight das rotas reais agora falha em 4xx/5xx, corrigindo o risco anterior de aceitar HTTP 404 como rota valida;
- sinais como `SIGINT`/`SIGTERM` encerram as arvores de processos filhos criadas pelo gate.

## Comando recomendado

Quando o limite do ambiente permitir nova execucao:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

Ou explicitando output:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --output C:\tmp\urban-ai-event-radar-playwright
```

## Status

- Rota/app runtime: desbloqueado.
- Browser Playwright direto: desbloqueado.
- Runner `@playwright/test`: corrigido para evitar output dentro do OneDrive, mas a reexecucao final nao foi possivel nesta sessao porque novos comandos elevados foram bloqueados pelo limite de uso do ambiente Codex.
- Fallback direto Playwright: implementado para fechar o smoke funcional quando o runner `@playwright/test` ficar preso em `clear output`/`apply rebaselines`.
# Release Evidence 100 - criterio objetivo

Esta secao consolida o criterio de 100% para o Event Radar/Playwright. Ela deve prevalecer como leitura de release quando houver divergencia entre percentuais anteriores.

## Definicao de 100%

O Event Radar/Playwright so deve ser considerado 100% quando todos os itens abaixo estiverem verdadeiros:

- O spec `e2e/event-radar.spec.ts` continua sem `test.skip` e lista exatamente 4 testes.
- O release gate executa em browser real com exit code 0.
- Os 4 testes Playwright passam na mesma execucao.
- As rotas `/events`, `/events/evt-gp-sp-2026`, `/event-radar` e `/admin/event-radar` passam no preflight HTTP antes do browser.
- O runner grava artefatos fora do OneDrive, preferencialmente em `C:\tmp\urban-ai-event-radar-playwright` ou no caminho informado por `--output`/`E2E_OUTPUT_DIR`.
- A evidencia final registra data/hora, comando usado, base URL, porta, resultado 4/4, caminho dos artefatos e observacoes de ambiente.

## Evidencia ja provada

- As quatro rotas alvo ja foram verificadas com HTTP 200 em tentativa limpa.
- O Playwright direto conseguiu abrir `/events` com HTTP 200.
- O bloqueio anterior foi isolado para ambiente/cache/artefatos em OneDrive, nao para quebra funcional das telas.
- O runner foi ajustado para gravar fora do OneDrive e aceitar `--output`/`E2E_OUTPUT_DIR`.
- O spec permanece sem skips conhecidos e o modo `--list` encontra 4 testes.

## Pendente para fechar 100%

Pendente apenas a execucao final do gate completo, em ambiente limpo:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

Resultado esperado para marcar 100%: Playwright real com 4/4 testes passando e artefatos salvos fora do OneDrive.

# Atualizacao 2026-05-23 - Gate oficial fechado

## Resultado principal

O gate oficial do Event Radar foi executado em browser real com exit code `0` contra o servidor local ja ativo em `http://127.0.0.1:3041`.

Comando:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url http://127.0.0.1:3041 --request-timeout-ms 120000
```

Resultado:

- Preflight `/events`: HTTP 200.
- Preflight `/events/evt-gp-sp-2026`: HTTP 200.
- Preflight `/event-radar`: HTTP 200.
- Preflight `/admin/event-radar`: HTTP 200.
- Playwright `event-radar.spec.ts`: **4 passed** em 37,4s.
- Artefatos: `C:\tmp\urban-ai-event-radar-playwright`.

Tambem houve uma execucao local com servidor iniciado pelo proprio runner usando cache preservado:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --keep-next-cache --timeout-ms 300000 --request-timeout-ms 120000
```

Resultado:

- Health check `/favicon.ico`: HTTP 200.
- Preflight das quatro rotas: HTTP 200.
- Playwright `event-radar.spec.ts`: **4 passed** em 33,3s.
- Logs do Next: `Urban-front-main/test-results/event-radar-release-gate/next-dev-3041-2026-05-23T10-47-37-583Z.*.log`.
- Artefatos: `C:\tmp\urban-ai-event-radar-playwright`.

## Ajuste aplicado no E2E

Os dois primeiros bloqueios reais apos o preflight foram seletores frageis:

- No detalhe host, `getByText('Studio Vila Mariana')` resolvia 3 elementos visiveis ou responsivos.
- No radar host, `.first()` capturava o `<option>` oculto do filtro de imovel.

O spec foi endurecido para validar linhas visiveis dentro dos blocos de impacto/radar, sem alterar telas React nem backend.

## Falhas ambientais registradas

As falhas abaixo foram reproduzidas e devem ser tratadas como ambiente local/workspace, nao como regressao funcional do Event Radar:

- Sandbox: `node.exe` falhou com `Acesso negado`; `npm` nao ficou disponivel sem permissao elevada.
- Gate local com porta explicita: `Porta 127.0.0.1:3041 ja esta em uso`.
- Gate local com porta automatica e limpeza padrao: `Nao foi possivel limpar .next: ENOTEMPTY`.
- Smoke direto contra `3041` depois do gate: `page.goto: net::ERR_CONNECTION_REFUSED`, porque o servidor existente ja nao estava mais aceitando conexao.
- Tentativa local final com `--keep-next-cache`: `Error: EPERM: operation not permitted, open '.next\trace'`.
- Tentativa local diagnostica posterior: `ENOSPC: no space left on device, write`; preflight retornou abort em `/events/evt-gp-sp-2026` e HTTP 500 em `/event-radar` e `/admin/event-radar`.

## Status

- Event Radar Playwright contract-first: **100% comprovado localmente** para o gate oficial, com 4/4 testes verdes em browser real.
- Release operacional local: **aprovado com ressalva ambiental**, porque novas execucoes podem voltar a falhar se `.next` estiver travado ou o disco da workspace estiver sem espaco.
- Ainda nao substitui validacao de staging/DB real.
