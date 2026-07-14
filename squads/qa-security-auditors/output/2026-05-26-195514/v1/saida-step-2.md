# [QA] Auditoria local e root-cause

## 1. Alta - relatorios de inteligencia ainda misturam dado persistido com dado derivado sem `jobRunId`

Evidencia:

- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:139`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:1553`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:1555`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:1556`
- `Urban-front-main/src/app/admin/event-radar/page.tsx:244`

Root-cause: quando nao ha snapshot persistido, a inteligencia de eventos ainda pode retornar `modelVersion: 'stub-contract-v0'`, `jobRunId: null` e `dataStatus: 'derived_from_event_fields'`. A UI exibe score, potencial e confianca, mas nem sempre deixa o `dataStatus`/`jobRunId` dominante na leitura.

Impacto: nao da para afirmar 100% auditavel/confiavel em graficos de demanda/eventos quando parte dos numeros vem de derivacao runtime.

Recomendacao: para modo enterprise, exigir `dataStatus='persisted'` e `jobRunId` em relatorios/exportacoes, ou rotular explicitamente cada metrica como derivada.

## 2. Alta - restore drill nao falha se tabelas de auditoria estiverem vazias

Evidencia:

- `urban-ai-backend-main/scripts/restore-drill-verify.js:95`
- `urban-ai-backend-main/scripts/restore-drill-verify.js:96`
- `urban-ai-backend-main/scripts/restore-drill-verify.js:106`

Root-cause: o check `auditability.tables_nonempty` le `COUNT(*)`, mas nao gera erro quando `admin_job_runs` ou `admin_audit_logs` tem zero linhas.

Impacto: um restore real pode gerar evidencia `PASS` mesmo sem trilha auditavel recuperada.

Recomendacao: em modo execute, falhar se tabelas obrigatorias estiverem vazias; validar tambem timestamp recente e amostra minima de linhas.

## 3. Alta - Stays auto-apply guarda blockers criticos so em log/agregado

Evidencia:

- `urban-ai-backend-main/src/stays/stays-auto-apply.service.ts:146`
- `urban-ai-backend-main/src/stays/stays-auto-apply.service.ts:298`
- `urban-ai-backend-main/src/stays/stays-auto-apply.service.ts:514`

Root-cause: o cron retorna contadores agregados e registra blockers via logger. O `AdminJobRun` recebe resultado resumido, mas nao cria trilha duravel por listing/analise/decision snapshot para todo bloqueio ou permissao.

Impacto: depois que logs expiram, fica dificil provar por imovel por que um push foi bloqueado ou permitido.

Recomendacao: persistir blockers e audit context em `AdminAuditLog` ou entidade propria por `listingId`, `analisePrecoId`, `decisionSnapshotId`.

## 4. Media/Alta - `AdminJobRun` nao modela `skipped`/`blocked`

Evidencia:

- `urban-ai-backend-main/src/entities/admin-job-run.entity.ts:21`
- `urban-ai-backend-main/src/stays/stays-auto-apply.service.ts:123`
- `urban-ai-backend-main/src/email/weekly-event-report.service.ts:66`

Root-cause: `AdminJobRun` aceita apenas `running | success | error`. Alguns skips operacionais retornam antes do tracking, como concorrencia ativa ou env disabled.

Impacto: dashboards de jobs podem parecer "sem execucao" quando houve skip relevante.

Recomendacao: adicionar status `skipped`/`blocked` e registrar skips por kill switch, env disabled e concorrencia.

## 5. Media - AskUrban esta correto localmente, mas sem prova real staging/prod

Evidencia:

- `urban-ai-backend-main/src/host-panels/host-panels.service.ts:675`
- `urban-ai-backend-main/src/host-panels/host-panels.service.ts:1781`
- `Urban-front-main/src/app/componentes/ui/AskUrbanProvider.tsx:68`
- `Urban-front-main/e2e/ask-urban-entitlement.spec.ts:70`
- `scripts/enterprise-auditability-live-gate.js:74`

Root-cause: o controle local esta bom, mas o gate enterprise pula AskUrban quando nao ha JWT real.

Impacto: existe garantia local por teste, mas nao evidencia real de usuario bloqueado/permitido/quota em staging/prod.

Recomendacao: rodar live gate com JWT de usuario bloqueado, usuario permitido e usuario quota-exceeded, salvando evidencia sem tokens.

## Verificacoes

Feito: leitura local de scripts, servicos backend, provider frontend, specs e runbooks/evidence.

Nao feito: DB restaurado, staging/prod, Railway logs, chamadas reais Stays/AskUrban/events ingest.
