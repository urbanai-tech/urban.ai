# Plano minucioso para elevar Urban AI a nivel enterprise de auditabilidade

> SUPERSEDED: plano historico. Consulte `../../plano-mestre-scorecard-10-10-2026-07-15.md` para o plano vigente.

Data: 2026-05-22
Base: `docs/archive/audits/auditoria-consolidada-dados-graficos-relatorios-2026-05-22.md`
Status de implementacao local: controles P0 principais foram implementados e typechecks/testes locais passaram. Nesta continuacao, tambem foram criados o live gate enterprise, o verificador de restore drill e o E2E mockado de AskUrban contra adulteracao de `localStorage`. Itens que dependem de ambiente real seguem pendentes de execucao com credenciais: smoke Stays em staging/prod, live gate com JWTs reais, restore drill com snapshot real e evidencia visual.

## Objetivo

Transformar todos os graficos, relatorios e decisoes automaticas da Urban AI em informacoes auditaveis, reproduziveis e confiaveis o bastante para uso enterprise, sem misturar erro, vazio, mock, estimativa, projecao e fato confirmado.

## Principios obrigatorios

1. Nenhum mock de runtime em producao.
2. Falha de API nunca pode parecer "sem dados".
3. Toda metrica exibida precisa de fonte, periodo, sample size, freshness e confidence.
4. Toda mutacao critica precisa de before/after persistido.
5. Todo job que alimenta relatorio precisa de `AdminJobRun` ou equivalente.
6. Toda automacao que altera preco externo precisa de kill switch, allowlist e rollback.
7. Entitlement e permissao sempre devem vir do backend.
8. Relatorio externo deve ser reproduzivel por query/versao/fingerprint.

## Fase 0 - 48 horas: travas de seguranca

### 0.1 Stays auto-apply fail-safe

Prioridade: P0
Area: Backend/Ops
Arquivos-alvo:

- `urban-ai-backend-main/src/stays/stays-auto-apply.service.ts`
- `urban-ai-backend-main/src/stays/stays.service.ts`
- `docs/runbooks/stays-integration-setup.md`
- `docs/runbooks/stays-beta-private-smoke.md`

Entregas:

- Criar `STAYS_AUTO_APPLY_ENABLED=false` por padrao.
- Criar `STAYS_AUTO_APPLY_DRY_RUN=true` por padrao em staging/prod ate smoke aprovado.
- Criar `STAYS_AUTO_APPLY_USER_ALLOWLIST` com lista CSV de `userId` liberados.
- Criar `STAYS_AUTO_APPLY_LISTING_ALLOWLIST` com lista CSV de `listingId` liberados.
- Bloquear aplicacao real quando usuario e listing nao estiverem em allowlist aplicavel.
- Criar modo dry-run logado, sem chamada externa de mutacao para Stays.
- Bloquear cron quando env estiver ausente.
- Registrar no runbook como ativar/desativar.
- Persistir run como `AdminJobRun` ou equivalente, inclusive quando bloqueado por kill switch.

Criterio de aceite:

- Em ambiente sem flag, cron roda e nao aplica nada.
- Teste automatizado prova que auto-apply fica bloqueado por default.
- Log mostra motivo `disabled_by_global_kill_switch`.
- Dry-run gera resumo com candidatos, bloqueados, aplicaveis e motivo, sem `pushPrice` real.
- Allowlist de usuario/listing permite somente o subconjunto esperado.
- Evidencia em `docs/evidence/` registra comando, ambiente, SHA, resultado e se houve chamada externa.

Status em 2026-05-22: **implementado localmente**. O backend aceita `STAYS_AUTO_APPLY_ENABLED`, `STAYS_AUTO_APPLY_DRY_RUN`, `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`, `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS` e os aliases canonicos `STAYS_AUTO_APPLY_USER_ALLOWLIST`/`STAYS_AUTO_APPLY_LISTING_ALLOWLIST`. Specs locais validam default-off, dry-run e allowlist. Aprovacao para preco real ainda exige smoke controlado.

### 0.2 AskUrban com entitlement server-side

Prioridade: P0
Area: Frontend/Backend
Arquivos-alvo:

- `Urban-front-main/src/app/componentes/ui/AskUrbanProvider.tsx`
- `urban-ai-backend-main/src/host-panels/ask.controller.ts`
- `urban-ai-backend-main/src/host-panels/host-panels.service.ts`

Entregas:

- Endpoint de entitlement/usage deve retornar `canUse`, `plan`, `reason`, `quota`, `hardCap`, `used` e `resetAt`.
- Provider nao deve assumir `profissional` por fallback.
- Estado inicial `unknown` deve bloquear drawer ate resposta do backend.
- LocalStorage pode ser cache visual, nunca fonte de permissao.
- Backend deve bloquear `POST /ask/question` com 403 quando plano nao permitir e 429 quando hard cap for atingido.

Criterio de aceite:

- Usuario sem plano elegivel ve upgrade, mesmo alterando localStorage.
- Backend retorna 403/429 com mensagem controlada.
- Teste cobre plano permitido, bloqueado e quota atingida.
- E2E cobre estado inicial `unknown`, falha de entitlement e tampering de `localStorage`.

Status em 2026-05-22: **implementado localmente e E2E mockado aprovado**. Backend retorna `canUse`, `plan`, `reason`, quota/hard cap e bloqueia 403/429; frontend consulta esse contrato e nao usa `localStorage` como fonte de entitlement. Nesta continuacao foi adicionado e executado `Urban-front-main/e2e/ask-urban-entitlement.spec.ts`, que prova que `localStorage` adulterado nao abre o drawer quando `GET /ask/usage` bloqueia. Falta rodar o mesmo gate com usuario real de staging/prod sem direito/quota.

### 0.3 Corrigir `crypto` no client dashboard

Prioridade: P0
Area: Frontend
Arquivo-alvo:

- `Urban-front-main/src/app/dashboard/page.tsx`

Entregas:

- Remover `import crypto from "crypto"`.
- Usar `idAnalise`, `ev.id` ou chave deterministica browser-safe.
- Rodar `next build` ou ao menos typecheck + smoke da rota.

Criterio de aceite:

- Build nao depende de polyfill Node no client.
- Cards mantem chave estavel entre renders.

## Fase 1 - 7 dias: jobs e trilhas de auditoria

### 1.1 Persistir todos os crons criticos

Prioridade: P0
Area: Backend/Ops
Jobs:

- `dataset-daily-snapshot`
- `dataset-event-proximity-snapshot`
- `events-geocoder`
- `events-enrichment`
- `pricing-retrain`
- `weekly-event-report`
- `stays-auto-apply`

Entregas:

- Criar helper `runTrackedJob`.
- Persistir `jobName`, `runId`, `startedAt`, `finishedAt`, `status`, `durationMs`, `inputSummary`, `resultSummary`, `errorSummary`.
- Expor no admin jobs/collectors health.
- Alertar quando job critico ficar stale.
- Incluir execucoes automaticas de cron, nao apenas triggers manuais admin.
- Padronizar `triggeredBy`: `admin:<userId>`, `cron:<jobName>` ou `system:<service>`.

Criterio de aceite:

- Dashboard admin mostra ultima execucao real de cada job.
- Falha simulada aparece como `failed`.
- Relatorio consegue citar `jobRunId`.
- Cada job critico tem teste que prova registro `success`, `error` e `blocked/skipped` quando aplicavel.

Status em 2026-05-22: **implementado localmente**. `AdminJobRun`/helper de tracking cobre jobs manuais e crons criticos: dataset daily snapshot, event proximity snapshot, events geocoder, events enrichment, pricing retrain, weekly event report e Stays auto-apply. Ainda falta propagar `jobRunId` nos relatorios e validar em staging/prod.

### 1.2 Transformar bulk action em auditoria real

Prioridade: P1
Area: Backend/Frontend
Arquivos-alvo:

- `urban-ai-backend-main/src/host-panels/host-panels.service.ts`
- `urban-ai-backend-main/src/admin-audit/*`
- `Urban-front-main/src/app/portfolio/page.tsx`

Entregas:

- Trocar `auditLogId: randomUUID()` por registro persistido.
- Gravar before/after por propriedade.
- Gravar actor, action, payload normalizado e resultado.
- No frontend, intersectar selecao com propriedades atualmente carregadas.

Criterio de aceite:

- Toda acao em lote abre um registro consultavel.
- IDs nao visiveis/filtros antigos nao sao enviados por engano.
- Erro parcial lista propriedades aplicadas e rejeitadas.

### 1.3 AdminAuditService resiliente

Prioridade: P1
Area: Backend

Entregas:

- Classificar acoes criticas: financeiro, plano, role, pricing, Stays, bulk action.
- Para acoes criticas, usar transacao ou outbox.
- Criar alerta se audit log falhar.
- Manter best-effort apenas para acoes nao criticas.

Criterio de aceite:

- Falha de audit em acao critica nao passa silenciosamente.
- Existe retry/outbox ou erro claro ao usuario.

## Fase 2 - 14 dias: proveniencia em metricas e graficos

### 2.1 Contrato padrao de metadados de relatorio

Prioridade: P0/P1
Area: Backend/Frontend

Criar contrato comum para respostas analiticas:

```ts
type ReportMeta = {
  generatedAt: string;
  source: string;
  sourceTables: string[];
  period: { from: string; to: string };
  sampleSize: number;
  freshness: "fresh" | "stale" | "unknown";
  confidence: "high" | "medium" | "low";
  metricVersion: string;
  jobRunId?: string;
};
```

Aplicar em:

- ROI;
- Pace;
- Portfolio calendar;
- Market Intel;
- Admin quality;
- Dataset diagnostics;
- Weekly reports.

Criterio de aceite:

- UI mostra origem/freshness quando necessario.
- Export de relatorio inclui meta.
- Erro e ausencia de dados sao estados diferentes.

### 2.2 Separar confirmado, projetado e potencial

Prioridade: P1
Area: Produto/Frontend/Backend
Arquivos-alvo:

- `urban-ai-backend-main/src/roi/roi.service.ts`
- `Urban-front-main/src/app/my-roi/page.tsx`
- `Urban-front-main/src/app/admin/roi/page.tsx`

Entregas:

- Labels: `receita confirmada`, `incremento confirmado`, `incremento projetado`, `potencial aberto`.
- Remover copy que sugira dinheiro gerado quando for projecao.
- Exportar breakdown.

Criterio de aceite:

- Nenhum card financeiro mistura confirmado e estimado sem label.
- Relatorio externo pode ser explicado para auditor.

### 2.3 Market Intel com confianca explicita

Prioridade: P1
Area: Backend/Frontend

Entregas:

- Retornar `comparablesCount`, `snapshotCount`, `radiusKm`, `latestSnapshotDate`, `confidence`.
- Mostrar que e benchmark da base disponivel, nao mercado total.
- Adicionar estado `insufficient_data`.

Criterio de aceite:

- Com poucos comparaveis, UI reduz confianca e nao vende conclusao forte.
- Tabela de comparaveis mostra fonte anonima e criterio.

### 2.4 Datas locais nos graficos

Prioridade: P1
Area: Frontend
Arquivos-alvo:

- `PaceChart.tsx`
- `PreviewStrip.tsx`
- `AdrComparisonChart.tsx`

Entregas:

- Criar helper `parseLocalDate`.
- Substituir `new Date("YYYY-MM-DD")`.
- Cobrir timezone `America/Sao_Paulo`.

Criterio de aceite:

- Labels nao deslocam um dia.
- Teste/smoke visual com data perto de meia-noite UTC.

## Fase 3 - 21 a 30 dias: seguranca operacional e docs canonicos

### 3.1 Service account para coletores

Prioridade: P0/P1
Area: Backend/Pipeline/Ops

Entregas:

- Criar autenticao por API key/service account para `/events/ingest`.
- Escopo unico: ingestao de eventos.
- Registrar `actor`, `collectorVersion`, `ingestRunId`, `source`.
- Rate limit especifico por coletor.
- Rotacao documentada.

Criterio de aceite:

- Coletor nao depende de JWT admin de 15 min.
- Evento ingerido consegue ser ligado a uma execucao de coletor.

### 3.2 Docs canonicos e docs historicos

Prioridade: P1
Area: Docs/Ops

Entregas:

- Criar indice de documentos atuais.
- Marcar roadmaps antigos como historicos.
- Atualizar:
  - `estado-da-IA-e-evolucao.md`;
  - `docs/archive/audits/auditoria-pwa-push-notifications-2026-05-21.md`;
  - `runbooks/admin-evolution.md`;
  - `runbooks/testing-strategy.md`;
  - `runbooks/stays-integration-setup.md`;
  - `next-actions.md`.
- Todo relatorio datado deve ter `Status atual`, `Substituido por` e `Ultima validacao contra codigo`.

Criterio de aceite:

- Um operador sabe qual documento seguir hoje.
- Documento antigo nao contradiz codigo atual sem aviso.

### 3.3 Restore drill e migration posture

Prioridade: P1
Area: Backend/Ops

Entregas:

- Rodar restore em ambiente temporario.
- Medir RTO/RPO.
- Validar schema e tabelas criticas.
- Documentar evidencia em `docs/evidence/`.
- Esclarecer que migrations incrementais nao substituem backup.

Criterio de aceite:

- Existe evidencia de restore real.
- Checklist de go-live inclui data do ultimo restore drill.

Status em 2026-05-22: **harness implementado**. Foi criado `urban-ai-backend-main/scripts/restore-drill-verify.js`, com dry-run aprovado, para validar conexao, tabelas esperadas, contagens, timestamps e leitura de `admin_job_runs`/`admin_audit_logs` em banco restaurado. Falta executar contra snapshot real restaurado em staging/temp DB.

### 3.4 Live gate enterprise staging/prod

Prioridade: P0/P1
Area: QA/Ops

Entregas:

- Criar script de smoke reproduzivel para backend/frontend/admin/Ask.
- Gerar evidencia markdown sem segredos.
- Bloquear mutacoes por default.
- Permitir ingestao de evento smoke apenas com opt-in explicito.
- Integrar workflow manual de release gate.

Criterio de aceite:

- Dry-run passa sem rede/segredos.
- Staging read-only passa com URLs/JWTs reais.
- Staging mutante cria/atualiza evento controlado e registra audit log.
- Producao roda read-only; qualquer mutacao exige aprovacao dupla.

Status em 2026-05-22: **harness implementado**. Foi criado `scripts/enterprise-auditability-live-gate.js`, com dry-run aprovado e job manual em `.github/workflows/release-gate.yml`. Falta executar com secrets reais.

## Fase 4 - 45 dias: relatorios auditaveis e exports

### 4.1 MetricDefinitionRegistry

Prioridade: P1/P2
Area: Backend/Dados

Entregas:

- Criar registry de metricas com:
  - nome;
  - definicao;
  - formula;
  - owner;
  - versao;
  - fontes;
  - limitações;
  - criterio de confianca.
- Versionar mudancas.

Criterio de aceite:

- Todo KPI em dashboard aponta para uma metrica versionada.
- Mudanca de formula nao altera historico sem registro.

### 4.2 Export auditavel por relatorio

Prioridade: P2
Area: Backend/Frontend

Entregas:

- Export JSON/CSV/PDF com:
  - payload;
  - meta;
  - filtros;
  - actor;
  - `generatedAt`;
  - `queryFingerprint`;
  - `metricVersion`.
- Salvar evidencia opcional em storage.

Criterio de aceite:

- Um numero visto em tela pode ser reproduzido depois.
- Export permite auditoria sem acessar codigo.

### 4.3 E2E autenticado para rotas host/admin

Prioridade: P1/P2
Area: QA/Frontend/Backend

Entregas:

- Testar 401/403.
- Testar ownership entre usuarios.
- Testar empty vs error.
- Testar portfolio bulk action.
- Testar AskUrban entitlement.
- Testar Market Intel com poucos dados.

Criterio de aceite:

- Release gate bloqueia regressao de mock/entitlement/cross-tenant.

## Fase 5 - 60 a 90 dias: maturidade ML e moat

### 5.1 Versionamento de algoritmo e features

Prioridade: P2
Area: Backend/Dados/ML

Entregas:

- Gravar em cada sugestao:
  - `algorithmVersion`;
  - `modelVersion`;
  - `featureSnapshotId`;
  - ids/fontes dos comparaveis;
  - job que gerou;
  - confidence.

Criterio de aceite:

- Uma recomendacao pode ser reexplicada meses depois.

### 5.2 Uplift economico real

Prioridade: P2
Area: Dados/Produto

Entregas:

- Conectar sugestao, preco aplicado, reserva, receita, ocupacao e baseline.
- Separar aderencia de preco de resultado economico.
- Criar metricas:
  - ADR lift;
  - occupancy lift;
  - RevPAR;
  - incremental confirmado;
  - incremental projetado.

Criterio de aceite:

- ROI nao depende apenas de preco sugerido vs aplicado.
- Produto consegue provar valor com evidencia.

### 5.3 Governanca de modelo

Prioridade: P2/P3
Area: ML/Ops

Entregas:

- Registro de modelos.
- Backtesting recorrente.
- Threshold de qualidade para ativacao.
- Fallback documentado para rules engine.
- Monitoramento de drift.

Criterio de aceite:

- "IA" pode ser apresentada sem exagero.
- Modelo ruim cai para regra com alerta e registro.

## Matriz minima de validacao antes de marcar pronto

| Controle | Evidencia minima | Status documental em 2026-05-22 |
|---|---|---|
| Stays auto-apply envs | Unit tests de default-off, dry-run, allowlist usuario/listing; smoke registrando ausencia de chamada externa em dry-run; nomes de env alinhados | Parcial |
| Ask entitlement server-side | Unit/integration de `GET /ask/usage` e `POST /ask/question` para plano permitido, 403 e 429; E2E com localStorage adulterado | Implementado localmente; E2E mockado aprovado; staging real pendente |
| Erro vs empty state | Teste de UI/API com 500 exibindo erro e 200 vazio exibindo empty state; evidencia visual ou Playwright trace | Parcial |
| Jobs tracking | `AdminJobRun` persistido para todos os crons listados, com sucesso, erro e skipped; admin mostra historico filtravel | Implementado localmente; staging pendente |
| Relatorios auditaveis | Payload inclui `generatedAt`, fonte, periodo, sample size, confidence, metric version e `jobRunId` quando houver | Pendente |
| Live gate staging/prod | `scripts/enterprise-auditability-live-gate.js` com backend/frontend/admin/Ask e ingestao controlada opcional | Harness implementado; execucao real pendente |
| Restore drill | Snapshot restaurado em staging/temp DB + `restore-drill-verify.js` gerando evidencia | Harness implementado; execucao real pendente |
| Validacao final | Arquivo em `docs/evidence/` com data, SHA, comandos, ambiente e resultado real | Harness pronto; evidencia real pendente |

## Sequencia recomendada

1. Fechar kill switch Stays.
2. Fechar AskUrban server-side entitlement.
3. Remover `crypto` do dashboard client.
4. Persistir jobs automaticos criticos.
5. Persistir auditoria real de bulk actions.
6. Separar erro vs vazio nas telas.
7. Adicionar `ReportMeta` aos relatorios.
8. Atualizar docs canonicos.
9. Rodar enterprise live gate em staging e producao read-only.
10. Rodar restore drill.
11. Implementar MetricDefinitionRegistry e exports auditaveis.

## Indicadores de pronto

Urban AI pode comecar a se posicionar como enterprise-auditable quando:

- 100% dos graficos principais tem meta de proveniencia.
- 100% dos jobs alimentadores tem run persistido.
- 100% das mutacoes criticas tem before/after.
- 0 entitlements dependem de localStorage.
- 0 empty states mascaram erro.
- auto-apply externo tem kill switch e allowlist.
- restore drill foi executado e documentado.
- relatorios financeiros separam confirmado/projetado/potencial.

## Resultado esperado

Ao final das fases 0 a 3, o produto fica seguro para beta pago controlado com discurso honesto e evidencia operacional.

Ao final das fases 4 e 5, o produto passa a ter base real para pitch enterprise: dados rastreaveis, relatorios reproduziveis, jobs auditados, governanca de modelo e valor financeiro demonstravel.
