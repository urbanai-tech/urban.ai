# Evidencia - controles enterprise de auditabilidade - 2026-05-22

Data: 2026-05-22
Worker: Docs/Evidence
Escopo: documentacao para auto-apply Stays, Ask entitlement server-side, erro vs empty state, jobs tracking, live gate enterprise, restore drill verifier e criterios de validacao.
Resultado: controles principais implementados, validacao local automatizada executada e harness de staging/producao criado; smokes reais permanecem dependentes de URLs/tokens/credenciais do ambiente.

## Leituras estaticas realizadas

Foram feitas buscas/leitura local em arquivos de backend, frontend e docs para verificar se os controles esperados ja estavam presentes antes de atualizar a documentacao.

Resumo observado apos releitura estatica do estado atual do workspace:

- `STAYS_AUTO_APPLY_ENABLED` e `STAYS_AUTO_APPLY_DRY_RUN`: implementados no backend e validados por spec.
- Allowlist Stays: o backend aceita os nomes operacionais `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`/`STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS` e os aliases canonicos `STAYS_AUTO_APPLY_USER_ALLOWLIST`/`STAYS_AUTO_APPLY_LISTING_ALLOWLIST`.
- `AskUrbanProvider`: passou a consultar `GET /ask/usage`; `localStorage` nao e mais fonte de permissao.
- `HostPanelsService.askUsage`: expoe `canUse`, `plan`, `reason`, quota/hard cap e bloqueia pergunta com 403/429.
- `AdminJobRun` e helper de tracking: cobrem triggers admin/manuais e crons criticos de dataset, event proximity, geocoder, enrichment, pricing retrain, weekly report e Stays auto-apply.
- `/portfolio` e `/painel`: releitura estatica indica estados de erro separados (`loadError`/`paceError`), mas sem teste executado por este worker.
- `scripts/enterprise-auditability-live-gate.js`: criado para smoke read-only de backend/frontend/admin/Ask e smoke mutante controlado de ingestao de eventos.
- `urban-ai-backend-main/scripts/restore-drill-verify.js`: criado para verificacao read-only de banco restaurado em staging/temp DB.
- `Urban-front-main/e2e/ask-urban-entitlement.spec.ts`: criado para provar que `localStorage` adulterado nao libera AskUrban quando o backend bloqueia.

## Matriz de status

| Controle | Status Docs/Evidence | Evidencia atual | O que falta para aprovar |
|---|---|---|---|
| Stays auto-apply envs | Implementado localmente | Kill switch, dry-run, allowlists e aliases validados por spec | Smoke staging/prod antes de mutacao externa real |
| Ask entitlement server-side | Implementado localmente + E2E mockado aprovado | Backend bloqueia por plano/quota; provider consulta backend; spec cobre tampering de localStorage | Rodar E2E contra staging com usuario real bloqueado/quota |
| Erro vs empty state | Implementado localmente | Estados de erro separados em `/portfolio` e `/painel`; frontend typecheck aprovado | Evidencia visual/trace contra API 500 e 200 vazio |
| Jobs tracking | Implementado localmente | Crons criticos persistem `AdminJobRun` quando repo disponivel | Validar em staging/prod e propagar `jobRunId` nos relatorios |
| Live gate staging/prod | Harness implementado | Script gera evidencia markdown e bloqueia mutacoes por default | Rodar com URLs/JWTs/chave de ingestao reais |
| Restore drill | Harness implementado | Verificador read-only de schema/tabelas/contagens para banco restaurado | Restaurar snapshot real em staging/temp DB e executar verifier |
| Criterios de validacao | Em execucao | Typechecks, suites Jest locais e dry-runs dos gates aprovados | Smokes staging/prod e restore drill real |

## Criterios para futura aprovacao

### Stays auto-apply

- Env ausente ou `STAYS_AUTO_APPLY_ENABLED=false` bloqueia aplicacao real.
- `STAYS_AUTO_APPLY_DRY_RUN=true` nunca chama mutacao externa.
- Usuario/listing fora das allowlists e bloqueado com motivo rastreavel.
- Nomes de env de allowlist estao alinhados com o contrato aprovado, ou aliases estao documentados e testados.
- Caminho real so roda com kill switch ligado, dry-run desligado e allowlist explicita.
- `AdminJobRun` ou equivalente registra sucesso, erro e bloqueio.

### AskUrban

- `GET /ask/usage` retorna `canUse`, `plan`, `reason`, `used`, `quota` e `hardCap`.
- `POST /ask/question` aplica 403 para plano sem direito e 429 para limite atingido.
- Provider nao libera drawer antes do backend responder.
- Tampering de `localStorage` nao altera permissao efetiva.

### Erro vs empty state

- Falha de API mostra estado de erro e acao de retry.
- Resposta vazia valida mostra empty state.
- Export/relatorio nao usa dataset vazio quando a origem falhou.

### Jobs tracking

- Cada cron critico grava inicio, fim, status, duracao, actor, input/output resumido e erro.
- Admin mostra historico e stale state.
- Relatorios citam `jobRunId` quando dependem de job.

## Validacoes locais executadas

- Frontend typecheck: `node node_modules\typescript\bin\tsc --noEmit --incremental false` aprovado.
- Backend typecheck: `node node_modules\typescript\bin\tsc -p tsconfig.build.json --noEmit` aprovado.
- Backend Jest completo: 37 suites / 254 testes aprovados.
- Enterprise live gate dry-run: `node scripts\enterprise-auditability-live-gate.js --dry-run` aprovado.
- Restore drill verifier dry-run: `cd urban-ai-backend-main; node scripts\restore-drill-verify.js --dry-run` aprovado.
- AskUrban entitlement E2E: `node node_modules\@playwright\test\cli.js test ask-urban-entitlement.spec.ts --project=chromium` aprovado, 2 testes em Chromium.
- Enterprise access readiness: `node scripts\enterprise-access-readiness.js --output docs\evidence\enterprise-access-readiness-2026-05-22.md` executado; resultado esperado `blocked` por ausencia de variaveis reais.
- Release evidence local: `node scripts\release-evidence.js --output docs\evidence\release-evidence-2026-05-22.md` aprovado.

## Harness operacional criado nesta continuacao

### Enterprise live gate

Comando dry-run:

```powershell
node scripts\enterprise-auditability-live-gate.js --dry-run
```

Comando staging read-only:

```powershell
$env:ENTERPRISE_GATE_BACKEND_URL="https://<api-staging>"
$env:ENTERPRISE_GATE_FRONTEND_URL="https://<app-staging>"
$env:ENTERPRISE_GATE_ADMIN_JWT="<admin-jwt>"
$env:ENTERPRISE_GATE_HOST_JWT="<host-jwt>"
node scripts\enterprise-auditability-live-gate.js --env=staging --strict --skip-events-ingest --output docs/evidence/enterprise-live-gate-staging.md
```

Comando staging com ingestao mutante controlada:

```powershell
$env:ENTERPRISE_GATE_EVENTS_INGEST_KEY="<events-ingest-key>"
node scripts\enterprise-auditability-live-gate.js --env=staging --strict --allow-mutations --output docs/evidence/enterprise-live-gate-staging.md
```

### Restore drill verifier

Comando dry-run:

```powershell
node urban-ai-backend-main\scripts\restore-drill-verify.js --dry-run
```

Comando apos restaurar snapshot em staging/temp DB:

```powershell
$env:RESTORE_DATABASE_URL="mysql://<user>:<pass>@<staging-host>:3306/<database>"
cd urban-ai-backend-main
node scripts\restore-drill-verify.js --output ..\docs\evidence\restore-drill-2026-Q2.md
```

### Evidencias geradas sem credenciais reais

- `docs/evidence/enterprise-live-gate-dry-run-2026-05-22.md`
- `docs/evidence/restore-drill-dry-run-2026-05-22.md`
- `docs/evidence/enterprise-access-readiness-2026-05-22.md`
- `docs/evidence/release-evidence-2026-05-22.md`

O readiness atual ficou `0/4 ready` porque nenhuma das variaveis reais de staging/prod/restore/Stays esta presente no ambiente local. Isso e um bloqueio de acesso, nao de codigo.

## Validacoes ainda nao executadas

Este arquivo ainda nao registra smoke real em staging/prod, chamada real ao Stays, usuario real de AskUrban bloqueado/quota, restore drill com snapshot real ou evidencia visual. A diferenca agora e que os comandos/harness existem; falta plugar credenciais e anexar os resultados gerados.
