# Environment Doctor Handoff - Playwright Local Gate

Data: 2026-05-22
Workspace: `C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI`
Front: `C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\Urban-front-main`

## Objetivo

Preparar a main thread para uma tentativa controlada do Playwright Event Radar sem herdar processos Next antigos, portas ocupadas ou cache `.next` inconsistente dentro do OneDrive.

Esta frente nao editou codigo. Somente diagnosticou ambiente, parou dev servers ligados a esta workspace e registrou procedimento.

## Estado encontrado

### Processos

Foram encontrados processos Node/Next ligados ao gate local do Event Radar:

- PID `5728`: `scripts/event-radar-release-gate.mjs --port 3053 --timeout-ms 240000`
- PID `18472`: `...\Urban-front-main\node_modules\next\dist\bin\next dev -p 3053 -H 127.0.0.1`
- PID `23304`: `...\Urban-front-main\node_modules\next\dist\server\lib\start-server.js`

Tambem houve, durante o diagnostico, ciclos anteriores nas portas `3041`, `3051` e `3053`. A evidencia mais importante ficou nos logs de `3041` e `3053`.

### Acao executada

Os PIDs acima foram encerrados com `Stop-Process` apos confirmacao de que os filhos apontavam para `Urban-front-main`:

```powershell
$targetProcessIds = @(5728,18472,23304)
foreach ($targetProcessId in $targetProcessIds) {
  $proc = Get-Process -Id $targetProcessId -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $targetProcessId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 2
```

Confirmacao pos-stop:

- Nenhum processo `node.exe` restante com `Urban-front-main`, `event-radar-release-gate`, `next\dist\bin\next`, `start-server.js` ou `next dev`.
- Nenhum listener restante nas portas monitoradas `3000`, `3007`, `3041`, `3047`, `3051`, `3053`.

Observacao final: em uma checagem posterior, apareceu um novo Next na porta `3055`:

- PID `25228`: `node_modules\next\dist\bin\next dev -p 3055 -H 127.0.0.1`
- PID `28808`: `...\Urban-front-main\node_modules\next\dist\server\lib\start-server.js`

Como esse processo surgiu depois da limpeza e usa a porta recomendada para a tentativa controlada, ele foi tratado como execucao da main thread e nao foi encerrado por esta frente.

## Evidencias do bloqueio

### Porta 3041

Log: `Urban-front-main\test-results\event-radar-release-gate\next-dev-3041-2026-05-22T18-40-03-131Z.out.log`

Achado positivo:

```text
Next.js 15.5.12
Local: http://127.0.0.1:3041
Ready in 13.4s
Compiled /events in 22.4s
GET /events 200 in 25346ms
Compiling /events/[eventId] ...
```

Achado negativo:

Log: `Urban-front-main\test-results\event-radar-release-gate\next-dev-3041-2026-05-22T18-40-03-131Z.err.log`

```text
[webpack.cache.PackFileCacheStrategy] Caching failed for pack:
Error: ENOENT: no such file or directory, rename
'...\Urban-front-main\.next\cache\webpack\edge-server-development\0.pack.gz_'
-> '...\Urban-front-main\.next\cache\webpack\edge-server-development\0.pack.gz'
```

Interpretacao: a app chegou a responder `/events` com HTTP 200, entao o spec nao parece ser o problema central. O risco principal e cache webpack/Next dentro de OneDrive, com rename atomico falhando (`ENOENT`) e build incremental ficando incoerente.

### Porta 3053

Log: `Urban-front-main\test-results\event-radar-release-gate\next-dev-3053-2026-05-22T18-41-20-380Z.out.log`

```text
Next.js 15.5.12
Local: http://127.0.0.1:3053
Starting...
```

Interpretacao: outro ciclo ficou preso no startup/compilacao, provavelmente concorrendo com o mesmo `.next`.

### Cache `.next`

`Urban-front-main\.next` existe e foi atualizado durante as tentativas. Estado observado:

- `.next\cache`
- `.next\server`
- `.next\static`
- `.next\types`
- `.next\trace`
- manifestos gerados entre `15:40` e `15:42`

Em leituras anteriores, havia evidencia de build incompleto:

- `.next\server\chunks\6141.js`: ausente.
- busca por `@chakra-ui`/`6141`: sem correspondencias nos artefatos `.next\server`/`.next\static`.
- rotas `.next\server\app\events` e `.next\server\app\event-radar` chegaram a nao existir durante um ciclo incompleto.

## Procedimento seguro recomendado para a main thread

### 1. Preflight de portas/processos

```powershell
$Workspace = "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI"
$Front = Join-Path $Workspace "Urban-front-main"
$FrontResolved = (Resolve-Path -LiteralPath $Front).Path

Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -match [regex]::Escape($FrontResolved) -or
    $_.CommandLine -match "event-radar-release-gate|next dev|start-server.js"
  } |
  Select-Object ProcessId,ParentProcessId,CommandLine |
  Format-List

Get-NetTCPConnection -LocalPort 3000,3007,3041,3047,3051,3053 -ErrorAction SilentlyContinue |
  ForEach-Object {
    $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    [pscustomobject]@{
      LocalAddress = $_.LocalAddress
      LocalPort = $_.LocalPort
      State = $_.State
      OwningProcess = $_.OwningProcess
      ProcessName = $proc.ProcessName
      Path = $proc.Path
    }
  } |
  Format-List
```

Regra: nao matar processo Node generico. Encerrar somente se o command line apontar para `Urban-front-main\node_modules\next` ou para `scripts/event-radar-release-gate.mjs` desta tentativa.

### 2. Limpeza segura do `.next`

Executar somente depois de confirmar que nao ha processo Next/gate desta workspace vivo:

```powershell
$Workspace = "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI"
$Front = (Resolve-Path -LiteralPath (Join-Path $Workspace "Urban-front-main")).Path
$Next = Join-Path $Front ".next"
$NextResolvedParent = (Resolve-Path -LiteralPath $Front).Path

if (-not (Test-Path -LiteralPath $Next)) {
  "Nada a limpar: .next nao existe."
} elseif (-not $Next.StartsWith($NextResolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Caminho inseguro para .next: $Next"
} else {
  Remove-Item -LiteralPath $Next -Recurse -Force
}
```

Observacao: o projeto esta dentro de OneDrive. Se `Remove-Item` falhar com `EPERM`/arquivo em uso, repetir o preflight de processos e pausar sincronizacao do OneDrive temporariamente antes de nova tentativa. Nao usar wildcard como `Remove-Item .next*`.

### 3. Rodada controlada local

Preferir uma porta nova e unica:

```powershell
Set-Location -LiteralPath "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\Urban-front-main"
npm run test:e2e:event-radar -- --port 3055 --timeout-ms 240000
```

Se `npm` for bloqueado no sandbox, usar o runner direto:

```powershell
Set-Location -LiteralPath "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\Urban-front-main"
node scripts/event-radar-release-gate.mjs --port 3055 --timeout-ms 240000
```

### 4. Criterio de sucesso

- `event-radar.spec.ts` sem `test.skip`.
- Next chega a `Ready`.
- `/events` responde `200`.
- Playwright executa 4 testes reais.
- Resultado esperado: `4 passed`.

### 5. Se falhar de novo

Coletar antes de qualquer nova tentativa:

```powershell
Get-ChildItem -LiteralPath ".\test-results\event-radar-release-gate" -Force |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 12 Name,Length,LastWriteTime

Get-Content -LiteralPath ".\test-results\event-radar-release-gate\<ultimo-out>.log"
Get-Content -LiteralPath ".\test-results\event-radar-release-gate\<ultimo-err>.log"
```

Se aparecer `webpack.cache.PackFileCacheStrategy` com erro de rename em `.next\cache`, tratar como problema de ambiente/cache OneDrive, nao como regressao funcional imediata.

## Recomendacao operacional

Para chegar no 100% com menos ruido, a melhor tentativa e:

1. Garantir portas livres.
2. Garantir nenhum Next/gate da workspace vivo.
3. Limpar `.next` com caminho absoluto.
4. Rodar o gate em porta nova (`3055` ou superior).
5. Se houver novo erro de cache, repetir fora do OneDrive ou em CI/staging limpo.
