# Final Gate Runner Audit - Event Radar Playwright 100

Data: 2026-05-22
Frente: Final Gate Runner Audit
Escopo: `Urban-front-main/scripts/event-radar-release-gate.mjs`

## Objetivo

Auditar o runner apos a mudanca de output do Playwright para fora do OneDrive, procurando riscos em argumentos de CLI, caminhos Windows, diretorio de output, timeout global, cleanup de `.next`, parada de processos filhos e preflight.

## Achados corrigidos

1. Argumentos com valor podiam ficar `undefined` ou `NaN`.
   - Exemplo: `--port` sem valor, `--output` sem valor ou `--timeout-ms abc`.
   - Correcao: parsing agora falha cedo com mensagem clara, valida inteiros positivos e aceita `--flag=value`.

2. Preflight das rotas reais aceitava HTTP 404.
   - A funcao HTTP marcava qualquer status `< 500` como ok.
   - Correcao: health check continua permissivo para detectar servidor vivo, mas preflight de `/events`, `/events/:id`, `/event-radar` e `/admin/event-radar` agora exige `2xx/3xx`.

3. Output do Playwright nao era testado antes da execucao.
   - Correcao: o runner cria o diretorio, testa escrita com arquivo probe e avisa se `--output` estiver dentro da workspace sincronizada.
   - A validacao acontece antes de subir Next local, evitando deixar servidor filho vivo em caso de output invalido.

4. Interrupcao podia deixar processo filho vivo.
   - Correcao: o runner rastreia filhos criados, encerra arvores de processo em Windows com `taskkill /T /F` e trata `SIGINT`, `SIGTERM` e `SIGHUP`.
   - Em sistemas nao Windows, `SIGTERM` agora espera exit real e aplica `SIGKILL` se necessario.

5. Cleanup de `.next` foi mantido com guarda de caminho.
   - Ajuste: a checagem de `.next/trace` agora roda antes da limpeza, aumentando a chance de detectar lock de processo Next existente antes de remover cache.

## Arquivos alterados

- `Urban-front-main/scripts/event-radar-release-gate.mjs`
- `docs/evidence/event-radar-playwright-fix-2026-05-22.md`
- `docs/release/runbooks/event-radar-release-gate-runbook-2026-05-22.md`

## Validacoes

- Nao rodei servidor local, conforme instrucao.
- Nao rodei comandos elevados, conforme instrucao.
- Tentei `node --check scripts/event-radar-release-gate.mjs` sem elevacao, mas o sandbox bloqueou `node.exe` com `Acesso negado`.
- Fiz revisao estatica via leitura do arquivo e busca direcionada com `rg`.

## Status da frente

Concluida. O runner ficou mais seguro para a tentativa final do gate: ele nao deve aceitar 404 no preflight, nao deve iniciar com argumentos invalidos, nao deve tentar Playwright em output nao gravavel e tem caminho melhor de cleanup para filhos em interrupcao.

## Proximo comando recomendado pela main thread

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000 --output C:\tmp\urban-ai-event-radar-playwright
```
