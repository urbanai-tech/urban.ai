# Handoff - Playwright Runner Doctor

Data: 2026-05-22
Squad: `event-demand-pricing-radar`
Frente: Playwright Runner Doctor

## Objetivo

Endurecer o gate real do Event Radar contra Next travado, cache `.next` corrompido, porta ocupada, base URL inconsistente e falhas opacas de HTTP 500.

## Arquivos revisados

- `Urban-front-main/scripts/event-radar-release-gate.mjs`
- `Urban-front-main/package.json`
- `Urban-front-main/playwright.config.ts`
- `Urban-front-main/e2e/event-radar.spec.ts`
- `Urban-front-main/e2e/fixtures/event-radar.fixture.ts`
- `docs/release/runbooks/event-radar-release-gate-runbook-2026-05-22.md`

## Alteracoes feitas

- O runner agora exige `next` local apenas quando vai subir servidor; `--list` e `--no-server` dependem so de Playwright.
- O modo local limpa `.next` por padrao antes de subir o servidor proprio, com guarda de caminho para apagar somente `Urban-front-main/.next`.
- Foi adicionado opt-out de cache: `--keep-next-cache` ou `E2E_KEEP_NEXT_CACHE=1`.
- A porta default agora pode cair para a proxima livre quando `--port` nao foi explicitamente informado.
- Se `--base-url` for usado no modo local, o runner valida que ele aponta para o mesmo host/porta do servidor que sera criado; caso contrario, pede `--no-server`.
- O health check deixou de compilar `/events` como primeira rota e passou a usar `/favicon.ico` por padrao.
- Antes do browser, o runner faz preflight das quatro rotas reais: `/events`, `/events/evt-gp-sp-2026`, `/event-radar`, `/admin/event-radar`.
- Em falha, o runner imprime a cauda dos logs do Next e classifica sinais conhecidos de cache/lock: `Cannot find module`, `ENOENT`, `EPERM`, `vendor-chunks` e `webpack/cache`.
- `PLAYWRIGHT_HTML_OPEN=never` foi fixado para evitar abertura acidental de relatorio interativo em gate.
- O runbook de release foi atualizado com os novos comportamentos e flags.

## Validacoes executadas

```powershell
node --check scripts/event-radar-release-gate.mjs
node scripts/event-radar-release-gate.mjs --list
rg -n "\.skip\b|skip\(" e2e/event-radar.spec.ts e2e/fixtures/event-radar.fixture.ts
```

Resultados:

- Sintaxe do runner: OK.
- Listagem Playwright: 4 testes descobertos em `event-radar.spec.ts`.
- Busca por `skip`: sem ocorrencias no spec/fixture.

## Tentativa real

Foi iniciada uma tentativa com:

```powershell
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 180000
```

A tentativa foi interrompida pelo usuario antes da conclusao para que a main thread faca uma unica tentativa controlada. Depois da interrupcao, esta frente nao iniciou novos servidores locais.

Cheque posterior:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,3007,3041,3042,3047 }
```

Resultado: nenhuma porta local relevante em listen.

Observacao: a consulta de command line via `Get-CimInstance Win32_Process` foi bloqueada pelo Windows com `Acesso negado`, entao nao matei `node.exe` generico para evitar encerrar processos nao relacionados.

## Diagnostico

O problema anterior tinha dois gatilhos provaveis:

- O runner esperava `/events` como primeira prova de vida do servidor. Essa rota compila a tela real e podia mascarar readiness do Next como timeout em `Starting...`.
- O workspace tinha `.next` inconsistente, com sinais ja registrados de `Cannot find module './6141.js'`, `vendor-chunks` ausentes e `EPERM` em cache webpack.

O runner novo separa essas etapas:

1. sobe Next local em porta controlada;
2. valida readiness leve em `/favicon.ico`;
3. precompila/valida as quatro rotas reais via preflight;
4. roda Playwright somente se o app nao estiver retornando 5xx.

## Proximo passo recomendado

A main thread deve rodar uma unica tentativa controlada:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 180000
```

Se quiser deixar o runner escolher porta quando `3041` estiver ocupada, omitir `--port`:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --timeout-ms 180000
```

Contra staging:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --no-server --base-url https://staging.myurbanai.com
```
