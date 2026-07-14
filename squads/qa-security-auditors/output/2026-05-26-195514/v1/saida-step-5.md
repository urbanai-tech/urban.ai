# [VEREDITO] Consolidacao enterprise de auditabilidade - Urban AI

Data: 2026-05-26
Run ID: `2026-05-26-195514`
Escopo: branch local, sem Railway, sem staging/prod, sem segredos, sem chamadas reais Stays.
Equipe: Caio Codigo, Sofia Seguranca, Ulisses UX, Vera Veredito.

## Veredito executivo

Nao: ainda nao da para cravar `100% auditavel`, `100% confiavel` ou `enterprise-level completo`.

Sim: o sistema esta muito melhor do que antes e ja saiu do risco principal de demo/mock em fluxos criticos. A classificacao honesta agora e:

**Beta operacional controlado / pre-enterprise avancado.**

Nota local estimada depois desta rodada: **7.2/10 em auditabilidade de dados**, mas **com P0 de seguranca a corrigir antes de qualquer claim enterprise serio**.

O ponto importante: antes o maior problema era mock/fallback. Agora o maior problema e prova enterprise: autenticacao forte, readiness publico, metadados de relatorio, trilha before/after, jobRunId, restore real e evidencia de ambiente.

## O que ja esta forte

1. AskUrban agora tem entitlement server-side.
   - Evidencia: `host-panels.service.ts:675`, `host-panels.service.ts:1781`, `AskUrbanProvider.tsx:68`, `ask-urban-entitlement.spec.ts:70`.
   - LocalStorage adulterado nao e mais fonte de permissao.

2. Stays auto-apply esta fail-closed por codigo.
   - Evidencia: `stays-auto-apply.service.ts:84`, `stays-auto-apply.service.ts:120`, `stays-auto-apply.service.spec.ts:120`.
   - Tem kill switch, dry-run, allowlists e guardrails.

3. Events ingest ganhou service account dedicada e audit log.
   - Evidencia: `events-ingest-api-key.guard.ts:20`, `events-ingest.controller.ts:79`.
   - A API key ausente bloqueia ingestao.

4. Jobs criticos passaram a ter `AdminJobRun`.
   - Evidencia: `admin-job-run-tracker.ts:18`, `dataset-collector.service.ts:191`, `events-geocoder.service.ts:56`, `pricing-bootstrap.service.ts:68`, `stays-auto-apply.service.ts:122`.

5. Existem harnesses reproduziveis de operacao.
   - `scripts/enterprise-auditability-live-gate.js`
   - `scripts/enterprise-access-readiness.js`
   - `urban-ai-backend-main/scripts/restore-drill-verify.js`

6. Evidencias desta execucao foram geradas.
   - `squads/qa-security-auditors/output/2026-05-26-195514/enterprise-live-gate-dry-run.md`
   - `squads/qa-security-auditors/output/2026-05-26-195514/enterprise-access-readiness.md`
   - `squads/qa-security-auditors/output/2026-05-26-195514/restore-drill-dry-run.md`

## Bloqueadores P0

### P0.1 - Corrigir `/auth/google`

Risco: takeover de conta.

Evidencia:

- `urban-ai-backend-main/src/auth/auth.controller.ts:280`
- `urban-ai-backend-main/src/auth/auth.service.ts:301`
- `urban-ai-backend-main/src/auth/auth.service.ts:335`

Acao:

- Endpoint deve aceitar `id_token`, nao `email` cru.
- Validar assinatura Google, `aud`, `iss`, `exp` e `email_verified`.
- Nao converter conta local existente sem fluxo de vinculacao.
- Adicionar teste de token invalido, token de outro audience e e-mail nao verificado.

### P0.2 - Proteger `/health` detalhado

Risco: exposicao operacional.

Evidencia:

- `urban-ai-backend-main/src/health/health.controller.ts:8`
- `urban-ai-backend-main/src/health/health.service.ts:99`

Acao:

- Manter `/health/live` publico e minimalista.
- Proteger `/health` detalhado por admin/internal token/IP allowlist.
- Remover nomes de variaveis sensiveis da resposta publica.

### P0.3 - Exigir/rotular `dataStatus` e `jobRunId` em inteligencia de eventos

Risco: grafico derivado parecer dado persistido.

Evidencia:

- `event-intelligence.service.ts:1553`
- `event-intelligence.service.ts:1555`
- `event-intelligence.service.ts:1556`
- `event-intelligence.service.ts:2022`

Acao:

- UI deve exibir `dataStatus`, `jobRunId`, `modelVersion`, `dataQualityFlags`.
- Selo enterprise so aparece quando `dataStatus='persisted'` e ha `jobRunId`.
- Export deve incluir esses metadados.

### P0.4 - Restore verifier deve falhar sem trilha auditavel real

Risco: restore aprovado sem dados de auditoria.

Evidencia:

- `restore-drill-verify.js:95`

Acao:

- Falhar se `admin_job_runs` ou `admin_audit_logs` estiverem vazias em restore real.
- Validar timestamp recente e amostra minima.

## P1 importantes

1. Persistir blockers Stays por listing/analise.
   - Hoje ha log e agregado; falta trilha duravel por decisao.

2. Adicionar `skipped`/`blocked` ao `AdminJobRun`.
   - Evita que kill switch/env disabled pareca "sem execucao".

3. Completar `AdminAuditLog` para todo `POST/PATCH/DELETE` admin.
   - Auditoria fail-open nao e enterprise para mutacoes criticas.

4. Evoluir events ingest de key estatica para HMAC/key id por coletor.
   - Evita spoofing do actor e replay.

5. Corrigir linguagem UX de aplicacao de preco.
   - `Aplicar sugestao` deve virar `Aceitar sugestao` se nao aplica em canal externo.

6. Mostrar fallback/mock/derivado de forma dominante.
   - Badge pequena nao basta para relatorio enterprise.

7. Separar ROI confirmado vs projetado.
   - Evitar "Gerado" quando inclui atribuicao/estimativa.

8. Separar erro de propriedades vs vazio real no dashboard.

## Plano minucioso

### 0-48h

1. Fechar `/auth/google` com validacao real de token.
2. Proteger `/health` detalhado.
3. Fazer restore verifier falhar se tabelas auditaveis estiverem vazias.
4. Trocar CTA `Aplicar sugestao` quando for apenas aceite.
5. Exibir erro especifico quando propriedades falharem no dashboard.

### 3-7 dias

6. Tornar `dataStatus/jobRunId/modelVersion/dataQualityFlags` visiveis em admin/host event radar.
7. Persistir blockers Stays em trilha duravel.
8. Criar `AdminJobRun.status = skipped | blocked`.
9. Completar `AdminAuditLog` para mutacoes admin criticas.
10. Rodar testes locais completos e anexar evidencia desta nova rodada.

### 7-14 dias

11. Criar contrato `ReportMeta` comum:
    - `generatedAt`
    - `source`
    - `sourceTables`
    - `period`
    - `sampleSize`
    - `freshness`
    - `confidence`
    - `metricVersion`
    - `jobRunId`
12. Aplicar em ROI, Pace, Portfolio, Market Intel, Admin Quality, Event Radar e Weekly Reports.
13. Exportar relatorios com metadados e fingerprint de reproducao.

### Dependente de ambiente real

14. Rodar live gate com:
    - `ENTERPRISE_GATE_BACKEND_URL`
    - `ENTERPRISE_GATE_FRONTEND_URL`
    - `ENTERPRISE_GATE_ADMIN_JWT`
    - `ENTERPRISE_GATE_HOST_JWT`
    - `ENTERPRISE_GATE_EVENTS_INGEST_KEY`
15. Rodar restore drill com `RESTORE_DATABASE_URL` apontando para snapshot real restaurado.
16. Rodar smoke Stays sandbox/conta assistida com dry-run e allowlist.
17. Rodar AskUrban real com usuario bloqueado, permitido e quota excedida.

## Criterio para chamar de enterprise-level

Pode chamar de enterprise-auditable quando:

- 100% dos graficos principais tem `ReportMeta`.
- 100% dos jobs alimentadores tem run persistido, inclusive `skipped/blocked`.
- 100% das mutacoes criticas tem before/after duravel.
- Health detalhado nao e publico.
- Google login valida token real.
- Live gate passa em staging/prod read-only.
- Restore drill real foi executado e salvo em `docs/evidence`.
- Stays real smoke foi executado em ambiente controlado.

## Proxima decisao

Recomendacao da Vera: implementar primeiro os P0.1 a P0.4. Esses quatro itens mudam o sistema de "muito melhor" para "defensavel em auditoria tecnica".
