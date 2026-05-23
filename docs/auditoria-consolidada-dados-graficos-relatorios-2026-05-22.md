# Auditoria consolidada de dados, graficos e relatorios - 2026-05-22

Status: atualizacao pos-melhorias.
Substitui/complementa: `docs/auditoria-confiabilidade-dados-graficos-relatorios-2026-05-21.md` e `docs/auditoria-mocks-hardcoded-admin-usuarios-2026-05-21.md`.
Metodo: auditoria multiagente por leitura estatica, varredura local, validacao de typecheck/testes e consolidacao manual.
Adendo de implementacao: nesta rodada foram implementados controles adicionais de auto-apply Stays, entitlement AskUrban server-side, separacao erro vs empty state, tracking persistente em crons selecionados e service account para ingestao de eventos. Na continuacao, foram criados tambem o enterprise live gate, o restore drill verifier e o E2E de AskUrban contra tampering de `localStorage`. Smokes de staging/producao ainda precisam ser executados com credenciais reais antes de chamar o sistema de 100% enterprise em ambiente real.

## Veredito executivo

O sistema evoluiu bastante desde a auditoria anterior. O problema critico de dados mockados em runtime foi tratado: o frontend nao tem mais flags `NEXT_PUBLIC_*_MOCK_DATA`, nao retorna sucesso falso com payload sintetico nos fluxos principais e agora existem endpoints backend reais para Pace, Portfolio, Pricing Rules, Market Intel e AskUrban.

Mesmo assim, a resposta enterprise continua sendo: **ainda nao e 100% auditavel ponta a ponta**.

Classificacao atual recomendada: **pre-enterprise avancado / beta operacional controlado**.

Nota estimada de prontidao enterprise para dados e relatorios: **7.0/10**.
Na auditoria anterior, o risco principal era mock/fallback. Agora o risco principal mudou para governanca operacional: jobs automaticos, audit trail persistente, permissoes/entitlements, evidencia reproduzivel e separacao visual entre erro, ausencia de dado, estimativa e fato confirmado.

## O que melhorou

### 1. Mocks de runtime removidos dos fluxos criticos

Arquivo principal: `Urban-front-main/src/app/service/api.ts`

Varredura atual nao encontrou:

- `NEXT_PUBLIC_PACE_MOCK_DATA`
- `NEXT_PUBLIC_PORTFOLIO_MOCK_DATA`
- `NEXT_PUBLIC_PRICING_RULES_MOCK_DATA`
- `NEXT_PUBLIC_MARKET_INTEL_MOCK_DATA`
- `NEXT_PUBLIC_ASK_MOCK_DATA`
- `USE_MOCK`
- `mock-fallback`

Os fluxos agora chamam API real e relancam erro:

- `fetchPace`
- `fetchPortfolioCalendar`
- `mutatePortfolioBulkAction`
- `fetchPricingRules`
- `savePricingRules`
- `previewPricingRules`
- `fetchMarketIntel`
- `fetchAskUsage`
- `postAskQuestion`
- `submitAskFeedback`

Impacto: o risco de mostrar demo como dado real caiu muito.

### 2. Endpoints backend reais foram adicionados

Arquivos principais:

- `urban-ai-backend-main/src/host-panels/pace.controller.ts`
- `urban-ai-backend-main/src/host-panels/portfolio.controller.ts`
- `urban-ai-backend-main/src/host-panels/properties-panel.controller.ts`
- `urban-ai-backend-main/src/host-panels/ask.controller.ts`
- `urban-ai-backend-main/src/host-panels/host-panels.service.ts`

Contratos existentes hoje:

- `GET /pace/portfolio`
- `GET /properties/:id/pace`
- `GET /portfolio/calendar`
- `POST /portfolio/bulk-action`
- `GET /properties/:id/pricing-rules`
- `PUT /properties/:id/pricing-rules`
- `POST /properties/:id/pricing-rules/preview`
- `POST /properties/:id/pricing-rules/copy-from/:sourceId`
- `GET /properties/:id/market-intel`
- `GET /ask/usage`
- `POST /ask/question`
- `POST /ask/feedback`

Todos passam por `JwtAuthGuard`. Isso corrige um P0 importante da auditoria anterior.

### 3. Persistencia nova para host panels

Arquivos principais:

- `urban-ai-backend-main/src/entities/pricing-rule-config.entity.ts`
- `urban-ai-backend-main/src/entities/ask-urban-message.entity.ts`
- `urban-ai-backend-main/src/migrations/1779700000000-CreateHostPanelPersistence.ts`

O sistema agora grava:

- regras de pricing por imovel em `pricing_rule_configs`;
- mensagens/citacoes/feedback do AskUrban em `ask_urban_messages`.

Impacto: Pricing Rules e AskUrban deixaram de ser apenas UX/estado local e passaram a ter rastro no banco.

### 4. Admin alpha deixou de ter email pessoal default

Arquivos principais:

- `Urban-front-main/src/app/admin/alpha/page.tsx`
- `Urban-front-main/src/app/service/api.ts`
- `urban-ai-backend-main/src/admin/admin.service.ts`

O backend exige email explicito via `requireAlphaEmail`, e o frontend usa `NEXT_PUBLIC_ADMIN_ALPHA_DEFAULT_EMAIL` somente se configurado. Isso melhora isolamento entre smoke interno e dado analitico real.

### 5. PWA Push saiu do "nao existe" para "implementado, dependente de env"

Arquivos principais:

- `Urban-front-main/public/sw.js`
- `Urban-front-main/src/app/service/pwaPush.ts`
- `urban-ai-backend-main/src/push/push.controller.ts`

O relatorio de PWA de 21/05 tem um veredito historico parcialmente superado. Hoje ha camada Web Push implementada, mas producao ainda depende de:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

## Confiabilidade atual por area

| Area | Estado atual | Auditabilidade | Confianca recomendada |
|---|---|---:|---:|
| Admin dashboard | Backend real, blockers e readiness | Alta | Boa para operacao |
| Admin quality | MAPE/cobertura com amostra minima | Media/alta | Boa quando ha sample size |
| ROI | Endpoint real, mas mistura confirmado/projetado/potencial | Media | Usar com ressalvas |
| Pace | Endpoint real usando ocupacao/historico | Media | Boa se erro e "sem dado" forem separados |
| Portfolio calendar | Endpoint real por usuario | Media | Boa, mas bulk action precisa audit log real |
| Pricing Rules | Persistido no banco, preview real | Media | Boa para configuracao, falta historico/versionamento |
| Market Intel | Usa imoveis/snapshots reais proximos | Media | Nao e "mercado total"; e benchmark da base disponivel |
| AskUrban | Persiste mensagens, responde com dados reais salvos | Media/baixa | Assistente operacional, nao fonte auditavel final |
| Eventos | Fonte, sourceId, dedup e enrichment | Media/alta | Boa para eventos ingeridos, cobertura ainda limitada |
| Stays | Consentimento, token, PriceUpdate, rollback | Alta na base | P0: auto-apply precisa kill switch |
| PWA Push | Implementado, dependente de env | Media | Pronto para smoke, nao provar sem VAPID prod |

## P0 atuais

### P0.1 - Stays auto-apply precisa kill switch global e allowlist

Arquivo principal: `urban-ai-backend-main/src/stays/stays-auto-apply.service.ts`

O cron `stays-auto-apply` roda de hora em hora e aplica sugestoes para listings com modo efetivo `auto`. A base de `PriceUpdate`, idempotencia e rollback e boa. A releitura estatica ja encontrou parte do bloqueio global/dry-run em implementacao paralela; o contrato operacional ainda precisa ficar consolidado com:

- `STAYS_AUTO_APPLY_ENABLED=false` por padrao;
- `STAYS_AUTO_APPLY_DRY_RUN=true` por padrao ate validacao;
- `STAYS_AUTO_APPLY_USER_ALLOWLIST` com CSV de usuarios liberados;
- `STAYS_AUTO_APPLY_LISTING_ALLOWLIST` com CSV de listings liberados;
- modo dry-run que nunca chame mutacao externa em Stays;
- evidencia de smoke antes de ativar para qualquer conta real.

Risco: uma configuracao errada pode transformar sugestao em alteracao externa de preco sem o nivel de governanca esperado em beta privado.

Status implementado em 2026-05-22: kill switch, dry-run, allowlists e aliases foram implementados. O codigo aceita `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`/`STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS` e tambem `STAYS_AUTO_APPLY_USER_ALLOWLIST`/`STAYS_AUTO_APPLY_LISTING_ALLOWLIST`. Testes locais cobrem default-off, dry-run e allowlist. Auto-apply real continua dependente de smoke controlado antes de qualquer conta produtiva.

### P0.2 - Jobs automaticos criticos nao estao todos persistidos como `AdminJobRun`

Hoje ha tracking administrativo para jobs manuais, mas crons importantes ainda ficam majoritariamente em log/memoria:

- dataset daily snapshot;
- event proximity snapshot;
- geocoder;
- event enrichment;
- pricing retrain;
- weekly report;
- auto-apply Stays.

Risco: um relatorio pode depender de job atrasado/falhado sem evidencia persistida suficiente.

Exigencia enterprise: todo job que alimenta grafico/relatorio deve gravar inicio, fim, status, duracao, actor, input, output resumido, erro e `generatedAt`.

Status implementado localmente em 2026-05-22: `AdminJobRun`/helper de tracking agora cobrem jobs manuais e crons criticos (`dataset-daily-snapshot`, `dataset-event-proximity-snapshot`, `events-geocoder`, `events-enrichment`, `pricing-retrain`, `weekly-event-report`, `stays-auto-apply`). Ainda falta propagar `jobRunId` nos relatorios que dependem deles e validar em staging/prod.

### P0.3 - Coletores ainda dependem de JWT admin/usuario tecnico

Runbook relevante: `docs/runbooks/events-ingest-camada1.md`

O proprio runbook registra que o access token JWT expira em 15 minutos e recomenda API key permanente dedicada. Para ingestao enterprise, coletor precisa de:

- service account;
- API key escopada somente para ingestao;
- `collectorVersion`;
- `ingestRunId`;
- origem/fonte;
- rotacao de segredo;
- rate limit especifico.

### P0.4 - AskUrban fazia gating de plano no cliente

Arquivo principal: `Urban-front-main/src/app/componentes/ui/AskUrbanProvider.tsx`

O provider lia `localStorage` e assumia `profissional` como fallback. Isso foi corrigido: a UI agora consulta `GET /ask/usage` e usa `canUse`, `plan` e `reason` vindos do backend antes de abrir o drawer.

Correcao recomendada: buscar permissao/assinatura no backend, usar estado `unknown` bloqueado e liberar o drawer somente apos confirmacao server-side.

Contrato esperado para o endpoint de usage/entitlement:

- `canUse`: boolean;
- `plan`: plano normalizado visto pelo backend;
- `reason`: motivo controlado para bloqueio ou aviso;
- `used`, `quota`, `hardCap` e `resetAt`;
- 403 para plano sem direito;
- 429 para limite diario/hard cap atingido.

Status implementado em 2026-05-22: backend bloqueia por plano/quota com 403/429, `GET /ask/usage` retorna `canUse`, `plan`, `reason`, quota e hard cap, e `AskUrbanProvider` nao usa mais `localStorage` como fonte de permissao. Foi adicionado e executado E2E mockado (`ask-urban-entitlement.spec.ts`, 2 testes Chromium aprovados) para provar que tampering de `localStorage` nao abre o drawer quando backend bloqueia. Falta rodar contra usuario real de staging/prod.

### P0.5 - Dashboard client importa `crypto` de Node

Arquivo principal: `Urban-front-main/src/app/dashboard/page.tsx`

A pagina e client-side e importa `crypto` de Node para gerar hash. Typecheck passa, mas isso pode quebrar build/bundle ou aumentar polyfill indesejado em Next. Deve usar ID estavel vindo do backend ou hash simples/browser-safe.

## P1 atuais

### P1.1 - Erro de API ainda pode virar empty state

Exemplos originalmente observados antes das edicoes paralelas:

- `/portfolio`: erro de carga vira `{ properties: [] }` na pagina.
- `/painel`: erro no Pace vira `setPaceData([])`.

Isso e melhor que mock, mas ainda confunde "API falhou" com "nao ha dados". Em relatorio enterprise, esses estados precisam ser diferentes.

Status Docs/Evidence em 2026-05-22: **parcial, pendente de teste**. Releitura estatica apos edicoes paralelas indica que `/portfolio` e `/painel` passaram a guardar mensagens de erro (`loadError`/`paceError`) em vez de zerar dados no catch. Falta executar teste UI/API para provar 500 vs 200 vazio e registrar evidencia.

### P1.2 - Bulk action do Portfolio retorna `auditLogId` randomico nao persistente

Arquivo principal: `urban-ai-backend-main/src/host-panels/host-panels.service.ts`

`portfolioBulkAction` retorna `auditLogId: randomUUID()`, mas esse id nao aponta para um registro persistido de auditoria. Alem disso, a selecao no frontend pode manter IDs antigos quando filtros/reload mudam o dataset.

Correcao recomendada:

- persistir `AdminAuditLog` ou `PortfolioBulkActionLog`;
- registrar before/after por propriedade;
- limpar/intersectar selecao quando a lista carregada muda.

### P1.3 - Pricing Rules precisa historico de alteracao

`PricingRuleConfig` persiste a config atual, mas nao guarda historico completo de before/after, ator, motivo, origem e versao da regra. Para enterprise, uma mudanca de regra que altera precos futuros precisa ser auditavel.

### P1.4 - Market Intel precisa sample size e proveniencia explicitos

O Market Intel agora usa dados reais da base, mas nao e "mercado total". Ele compara com imoveis proximos disponiveis na base interna. A UI/contrato deve mostrar:

- `comparablesCount`;
- periodo;
- quantidade de snapshots;
- distancia/radius;
- freshness;
- confidence;
- explicacao de que e benchmark da base disponivel.

### P1.5 - Datas `YYYY-MM-DD` em graficos podem sofrer shift de timezone

Arquivos apontados:

- `Urban-front-main/src/app/componentes/ui/PaceChart.tsx`
- `Urban-front-main/src/app/properties/[id]/pricing-rules/components/PreviewStrip.tsx`
- `Urban-front-main/src/app/properties/[id]/market/components/AdrComparisonChart.tsx`

Uso de `new Date("YYYY-MM-DD")` pode renderizar label deslocado em timezone Brasil. Padronizar parser local.

### P1.6 - PricingRuleCard ainda tem mini-graficos hipoteticos

Arquivo principal: `Urban-front-main/src/app/properties/[id]/pricing-rules/components/PricingRuleCard.tsx`

O preview global e real, mas mini-graficos por regra podem parecer impacto calculado. Eles devem usar dados do preview backend ou ser rotulados como ilustracao.

### P1.7 - AdminAuditService ainda e best-effort

Arquivo principal: `urban-ai-backend-main/src/admin-audit/admin-audit.service.ts`

Falha de escrita de auditoria gera warning, mas nao bloqueia mutacao. Para acoes criticas, e preciso outbox/retry ou fail-closed.

### P1.8 - Disaster recovery ainda depende de backup real

`Baseline` de migrations e no-op. Isso pode ser aceitavel para um banco historico ja provisionado, mas precisa restore drill real documentado. `migration:run` nao deve ser tratado como recuperacao completa de schema.

Status implementado em 2026-05-22: foi criado `urban-ai-backend-main/scripts/restore-drill-verify.js`, verificador read-only para banco restaurado, com dry-run aprovado. Ele valida tabelas esperadas, contagens, timestamps e leitura das tabelas de auditoria. Falta executar contra snapshot real restaurado.

### P1.9 - Gate de ambiente real precisava virar comando reproduzivel

Antes desta continuacao, a validacao final ainda estava descrita como procedimento manual. Agora existe `scripts/enterprise-auditability-live-gate.js`, que gera evidencia markdown para backend/frontend/admin/Ask e pode executar ingestao controlada de evento smoke apenas com `--allow-mutations`.

Status implementado em 2026-05-22: dry-run aprovado, scripts de package adicionados e job manual `enterprise-live-gate` incluido em `.github/workflows/release-gate.yml`. Falta executar com `ENTERPRISE_GATE_*` reais.

## Relatorios/documentos que precisam de atualizacao ou aviso de historico

| Documento | Status atual | Acao recomendada |
|---|---|---|
| `auditoria-confiabilidade-dados-graficos-relatorios-2026-05-21.md` | Correto como delta curto, incompleto para estado atual | Manter e apontar para este doc |
| `auditoria-mocks-hardcoded-admin-usuarios-2026-05-21.md` | Correto para runtime | Adicionar ressalva sobre mocks em teste/KNN legado |
| `auditoria-pwa-push-notifications-2026-05-21.md` | Veredito inicial ficou historico | Marcar como superado pela implementacao Web Push |
| `estado-da-IA-e-evolucao.md` | Honesto, mas datado | Criar adendo 22/05 com host panels, mocks removidos, PWA e estado ML |
| `roadmap.md` / `next-actions.md` | Historico | Marcar como roadmap antigo ou substituir por consolidado 22/05 |
| `runbooks/admin-evolution.md` | Desatualizado | Atualizar contagem de endpoints/paginas admin |
| `runbooks/testing-strategy.md` | Parcialmente datado | Atualizar com smokes autenticados e PWA |
| `runbooks/stays-integration-setup.md` | Parcialmente datado | Atualizar consentimento real em `StaysAccount` e kill switch auto-apply |

## Criterios de validacao para fechar o ciclo 22/05

| Area | Criterio minimo para sair de pendente | Evidencia esperada |
|---|---|---|
| Stays auto-apply | Default desligado, dry-run sem mutacao externa, allowlist usuario/listing e motivo de bloqueio registrado; nomes de env alinhados com o runbook | Testes unitarios + smoke com arquivo em `docs/evidence/` |
| AskUrban entitlement | Permissao derivada do backend, provider bloqueia estado `unknown`, localStorage adulterado nao libera uso | Unit/integration backend + Playwright/RTL frontend |
| Erro vs empty state | 500/timeout renderiza erro; 200 vazio renderiza empty state; analytics nao conta falha como vazio | Teste de UI/API e, se possivel, screenshot/trace |
| Jobs tracking | Todo cron critico grava `AdminJobRun` ou equivalente com status, duracao, input/output resumido e erro | Query/admin screenshot + teste de falha simulada |
| Relatorio auditavel | Payload exportado contem `generatedAt`, periodo, fonte, sample size, confidence, metricVersion e `jobRunId` quando aplicavel | JSON/CSV/PDF exemplo anexado em evidencia |
| Live gate real | `scripts/enterprise-auditability-live-gate.js` passa em staging/prod read-only; ingestao mutante somente em staging controlado | Markdown em `docs/evidence/enterprise-live-gate-*.md` |
| Restore drill | Snapshot real restaurado em staging/temp DB e validado por `restore-drill-verify.js` | Markdown em `docs/evidence/restore-drill-*.md` |

Nenhum item acima deve ser marcado como aprovado apenas por alteracao documental. Aprovacao exige validacao executada e registrada.

## Validacoes executadas neste ciclo

Nota Docs/Evidence: este worker nao reexecutou typecheck, Jest, Playwright, smoke em staging/prod ou chamada real ao Stays. As validacoes abaixo pertencem ao ciclo consolidado do documento; os controles adicionados neste adendo so devem ser marcados como aprovados quando houver evidencia propria em `docs/evidence/`.

### Execucao local principal

Frontend typecheck:

```powershell
node_modules\.bin\tsc.cmd --noEmit --incremental false
```

Resultado: aprovado.

Backend typecheck:

```powershell
node node_modules\typescript\bin\tsc -p tsconfig.build.json --noEmit
```

Resultado: aprovado.

Backend Jest alvo:

```powershell
node node_modules\jest\bin\jest.js admin/admin.service.spec.ts knn-engine/dataset-collector.service.spec.ts knn-engine/backtesting.spec.ts stays/stays.service.spec.ts sugestao/sugestion.service.spec.ts propriedades/pricing-guardrail.service.spec.ts evento/events-ingest.service.spec.ts --runInBand
```

Resultado: 7 suites aprovadas, 76 testes aprovados.

Gate enterprise dry-run:

```powershell
node scripts\enterprise-auditability-live-gate.js --dry-run
```

Resultado: aprovado.

Restore verifier dry-run:

```powershell
cd urban-ai-backend-main
node scripts\restore-drill-verify.js --dry-run
```

Resultado: aprovado.

### Execucao paralela por agente backend

O agente backend reportou suite Jest completa aprovada:

- 34 suites;
- 243 testes;
- 0 falhas.

## Conclusao

As melhorias recentes corrigiram os pontos mais perigosos da auditoria anterior: mock runtime e contratos ausentes. Hoje o sistema e muito mais confiavel do que estava antes.

Ainda assim, ele nao deve ser chamado de 100% enterprise-auditable enquanto os P0 atuais nao forem fechados. A proxima fase nao e "tirar mock"; isso ja avancou. A proxima fase e transformar cada numero exibido em evidencia reproduzivel: job rastreado, fonte clara, permissoes server-side, historico before/after, erro separado de vazio e relatorio com `generatedAt`, `sampleSize`, `confidence` e `metricVersion`.
