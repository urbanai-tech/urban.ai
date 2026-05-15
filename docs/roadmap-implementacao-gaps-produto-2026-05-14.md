# Roadmap de Implementacao dos Gaps de Produto - Urban AI

Data: 2026-05-14
Ultima atualizacao de acompanhamento: 2026-05-15
Base: `docs/auditoria-produto-lancamento-2026-05-13.md`, `docs/roadmap-pos-sprint.md`, `docs/backlog-produto-pos-assuncao.md`, `docs/go-live-manual-checklist.md`, commits recentes em `main/origin` e codigo em `Urban-front-main/`, `urban-ai-backend-main/` e `urban-webscraping-main/`.
Objetivo: transformar todos os gaps encontrados na auditoria de produto em plano executavel, com fases, tarefas, dependencias, criterios de aceite e gates de lancamento.

---

## 1. Norte do roadmap

### Veredito usado como premissa

A Urban AI deve seguir por tres marcos, em vez de tentar um go-live publico direto:

| Marco | Estado alvo | Resultado esperado |
|---|---|---|
| M1 - Pre-lancamento seguro | Landing + waitlist + analytics + narrativa sem promessa quantitativa | Captar demanda e aprender canal sem expor produto pago. |
| M2 - Beta fechado assistido | Eventos vivos + recomendacoes novas + captura de preco aplicado + relatorio semanal | Validar valor real com 5-10 anfitrioes. |
| M3 - Beta pago / go-live controlado | Stripe validado + ROI/cases + ops/admin + release gate | Cobrar clientes com risco controlado. |

### Principios

- Primeiro corrigir o core: eventos futuros e recomendacoes novas.
- Nao vender "IA que aumenta 30%" antes de ter ground truth e cases.
- Stays fica como beta privado ate credenciais, criptografia, smoke e rollback real.
- Billing so entra em producao paga depois de smoke ponta-a-ponta.
- Tudo que for operacional precisa de painel, alerta ou runbook, nao depender apenas de terminal.
- API keys externas podem ficar para configuracao posterior, mas o codigo deve lidar claramente com ausencia delas.

### Modo real em 2026-05-15

- **Publico novo:** continua em `prelaunch`/waitlist, com narrativa conservadora e sem promessa quantitativa de ROI.
- **Contas existentes com imoveis:** operam como **alpha assistido**, especialmente o usuario tester Gustavo, com quota ampliada, preco base inicial e registro de resultado real.
- **Produto vendavel:** ainda nao e go-live publico pago; o proximo salto e provar recomendacao nova + resultado real em 3-5 ciclos acompanhados.
- **Deploy confirmado:** commits ate `f20da01` foram enviados para `origin/main` e `urbanai-tech/main`; backend e frontend Railway chegaram a `SUCCESS` em 2026-05-15 13:42 UTC.
- **E2E read-only em producao:** admin final 100% (`docs/e2e-reports/2026-05-15T13-27-37/report.md`) e anfitriao final 100% (`docs/e2e-reports/2026-05-15T13-45-31/report.md`) com a conta Gustavo/admin.

---

## 2. Fases macro

### 2.0 Placar rapido em porcentagens

As porcentagens abaixo sao estimativas operacionais para acompanhamento. Elas combinam codigo pronto, validacao em ambiente real, dependencias externas e prova de produto. Nao sao "percentual de linhas de codigo"; sao percentual de prontidao para usar com seguranca.

| Marco | Prontidao | Leitura simples | O que falta para 100% |
|---|---:|---|---|
| M1 - Pre-lancamento seguro | **90%** | Waitlist, e-mail de entrada, convite definitivo, FAQ, contato publico persistido, painel admin, aceite mockado no endpoint real e smoke Playwright publico estao operaveis; deploy prod confirmado. | GA4/Pixel reais, teste com 5 leads, smoke de e-mail/convite em prod e conferir copy em todos os canais. |
| M2 - Alpha/beta fechado assistido | **81%** | Alpha de contas existentes ganhou quota, preco base, historico sugerido vs. praticado, ROI, painel admin alpha, fallback CSV com gate de qualidade e E2E read-only admin/anfitriao 100% em producao. | Rodar fluxos mutantes controlados com Gustavo: reprocessar, aceitar/aplicar sugestao, registrar resultado e acumular 3-5 evidencias reais. |
| M3 - Beta pago / go-live controlado | **64%** | Operacao, release gate, historico de jobs, audit log admin, suporte/LGPD, contatos com contadores globais, ROI, E2E prod 100% read-only, checkout oficial corrigido, smoke Stripe documentado, e-mails billing ligados aos webhooks mockados e migration de `price_updates` reduziram risco; ainda falta prova para cobrar. | Executar Stripe/KYC/smoke, cases, MailerSend real, suporte e legal. |
| M4 - Go-live publico | **39%** | Base operacional mais madura, caminho de cases, admin mais completo, cobertura E2E maior, checkout menos fragil e Stays mais seguro por fail-closed/readiness; prova de mercado ainda insuficiente. | 3 cases auditados, cobertura alta, dataset/ROI, suporte, observabilidade e billing maduros. |

| Area | Pronto | O que ja esta pronto | Principal bloqueio |
|---|---:|---|---|
| Narrativa e prelaunch | **88%** | Copy mais segura, `LAUNCH_MODE`, envs publicas no Docker, waitlist/analytics instrumentados, e-mail de confirmacao, FAQ de recomendacao/limites, aceite de convite real, E2E mockado no endpoint atual e admin com reenvio/copia de link. | Validar fluxo real com 5 leads, MailerSend, GA4/Pixel e revisao final de canais. |
| Eventos e coletores | **71%** | Runner estruturado, cron configuravel, Docker corrigido, fontes gratuitas/camadas ja codadas, health alinhado com aliases/criticidade do runner, UI admin mostra status/critical/env faltante/sinais, webscraping expoe health/cron status sem vazar secrets, fallback manual destacado no admin, import CSV com meta de 100 eventos, gate contra data passada/UF fora de SP e runbook operacional. | Medir eventos futuros reais apos deploy e popular 100-200 eventos SP/30d. |
| Recomendacoes de preco | **67%** | Job com contadores, dedupe, motivos de falha, `criadoEm` atualizado, dashboard, filtros de qualidade de evento, feedback de resultado, reprocessamento alpha, smoke mockado de recomendacao/empty state/aceite/preco aplicado e smoke autenticado condicional de dashboard/admin/alpha. | Executar o smoke autenticado com Gustavo e atingir >=70% de cobertura beta. |
| Dataset, IA e ROI | **64%** | Diagnostics, snapshots usando preco armazenado, UI de preco aplicado, preco aplicado em `PriceSnapshot`, propriedades com smoke mockado de diaria base/receita/historico, ROI usuario/admin, historico sugerido vs. real e smoke autenticado condicional para `/admin/roi`. | Executar smoke com beta tester, ocupacao, features diarias, 7 dias de snapshots, MAPE/cases. |
| Billing e Stripe | **77%** | Resolver de Price IDs, seed idempotente, erro claro, DTO/servico validam plano/ciclo/quantity antes do checkout, `/plans` usa Stripe.js oficial sem fallback inexistente, tem smoke mockado de readiness para preco ausente/chave Stripe ausente/plano sob consulta, onboarding cobre payload de checkout anual/quantity, templates transacionais de assinatura/cancelamento/falha/quota testados, webhooks de assinatura ativa/cancelamento/falha disparam e-mail billing best-effort, cadastro dispara quota warning/exceeded nos pontos de uso, `/my-plan` esta defensivo para alpha/payload sem `plan.amount` e mostra quota/ciclo/status, admin sync check explicita gate 8/8, docs/env apontam para runbooks corretos, webhook/status, migration `peding` e runbook de smoke ponta-a-ponta. | Executar smoke checkout/webhook/quota/cancelamento, disparo MailerSend real de e-mails billing e KYC/live. |
| Stays automatico | **40%** | Produto reposicionado como beta privado; `price_updates` tem migration; conector/servico falham fechado sem `STAYS_API_BASE_URL` e `STAYS_TOKEN_ENCRYPTION_KEY`; connect exige consentimento versionado e persiste IP/user-agent; integracoes mostram sync/consentimento/modo por listing; `/admin/stays` mostra readiness/missing envs; runbook cobre credencial/criptografia/push/rollback. | Credenciais reais/sandbox, executar connect/sync/push/rollback com consentimento real e rollback auditavel. |
| Admin e operacao | **96% read-only** | Dashboard executivo com eventos, pricing, dataset, billing e Stays; fallback manual; import CSV; `/admin/jobs`; waitlist; alpha ops; ROI; audit logs; contatos publicos; health dos coletores testado; `/admin/stays` mostra bloqueio/liberacao operacional; E2E admin prod 100% e smoke mockado de jobs admin. | Validar mutacoes com fixture, drill-down por propriedade e alertas externos. |
| Infra/release | **71%** | Health/config melhores, Docker frontend/webscraping corrigido, runner evita sucesso falso, runbook de release gate, staging release drill, runbook de fallback de eventos, smokes de recomendacao/dataset/billing/Stays, smoke Playwright publico, smoke de contato/jobs admin, smoke autenticado condicional, protocolo para devs/agentes, migrations de historico admin/`price_updates`/consentimento Stays. | Executar staging real, branch protection, ampliar smoke automatizado e restore drill. |
| Legal/LGPD | **48%** | Consentimento de analytics/marketing, copy conservadora, FAQ sem promessa quantitativa, gate Stays exige consentimento versionado/rastreavel com IP/user-agent e runbook de suporte/LGPD define processo de M3. | Executar DPAs, revisao juridica final, processo LGPD e consentimentos versionados em producao. |
| Marketing/beta | **46%** | Atribuicao/referral, contato publico persistido com triagem admin por status global, aceite waitlist testado no endpoint atual, contato publico coberto por E2E mockado e runbook de beta assistido definem ICP, onboarding, relatorio semanal e template de case. | Recrutar 20-30 leads, ativar 5-10 anfitrioes e produzir cases reais. |
| Testes E2E | **93%** | Spec de prelaunch/waitlist/analytics, F8 waitlist->aceite mockado no endpoint real, smoke publico, contato publico, login/post-login/logout mockado, onboarding import/registro/configuracao/checkout payload mockado, propriedades/preco base/historico/exclusao mockados, jobs admin mockado, meu plano/quota mockado, readiness de checkout em `/plans`, integracao Stays mockada, dashboard com recomendacao/empty state/aceite/preco aplicado, reset de senha mockado, confirmacao de e-mail mockada, auditor produto admin/anfitriao e E2E autenticado prod 100% para rotas/APIs read-only; builds passaram; deploy prod confirmado. | Ampliar para fluxos mutantes: MailerSend real e checkout Stripe test mode em staging. |

Resumo honesto: **pre-lancamento publico esta quase pronto**, **alpha assistido para contas existentes ja e operavel**, e **beta pago/go-live continuam bloqueados por prova real de ROI, Stripe validado e operacao monitorada**.

| Fase | Janela sugerida | Tema | Pronto | Status em 2026-05-15 | Gate de saida |
|---|---:|---|---:|---|---|
| F0 | 0-1 dia | Alinhamento e baseline de execucao | 85% | Roadmap de gaps, runbooks, processo de deploy e evidencias Railway consolidados; falta rotina fixa de status semanal | Backlog fechado, branch/processo definidos, metricas base salvas. |
| F1 | 2-3 dias | Pre-lancamento seguro | 90% | E-mail de entrada, convite definitivo, FAQ, contato publico, admin waitlist, runbook alinhado e smoke publico/F8 avancaram; falta validar GA/Pixel e fluxo com 5 leads reais | Waitlist testada, analytics pronto, copy ajustada. |
| F2 | 3-7 dias | Eventos vivos | 74% | Runner/cron/container corrigidos, keys cadastradas no webscraping/backend, health admin mostra status/criticidade/env faltante, webscraping informa health/cron/nextRun/lastError, fallback manual guiado, CSV rejeita data passada/UF fora de SP e runbook operacional; falta medir eventos reais apos execucao | >= 200 eventos futuros SP/30d ou fallback manual ativo; coletores com lastSeen < 48h. |
| F3 | 3-7 dias | Recomendacoes novas | 72% | Reprocessamento alpha, filtros de qualidade de eventos, preco base, feedback de resultado, smoke mockado de recomendacao/empty state/aceite/preco aplicado e E2E host read-only 100% foram implementados; falta rodar mutacao com Gustavo | Recomendacoes com `criado_em` atual; cobertura >= 70% dos imoveis ativos em regioes cobertas. |
| F4 | 1-2 semanas | Dataset, qualidade e ROI | 64% | Snapshot automatizado/manual, preco aplicado, receita real, propriedades com diaria base/receita/historico mockado, ROI usuario/admin, historico sugerido vs. praticado e smoke `/admin/roi` avancaram; ocupacao/features/MAPE ainda pendentes | Snapshots por 7 dias, preco aplicado capturado, relatorio de qualidade inicial. |
| F5 | 3-5 dias | Billing e planos | 77% | Checkout ganhou validacao de DTO/quantity, `/plans` usa `loadStripe` oficial e tem smoke de readiness para preco ausente/chave Stripe ausente/plano sob consulta, onboarding cobre payload anual/quantity, templates de assinatura/cancelamento/falha/quota tem teste unitario, webhooks de assinatura ativa/cancelamento/falha e cadastro por quota chamam MailerSend best-effort, `/my-plan` mostra assinatura/ciclo/quota e nao quebra com assinatura alpha, sync check admin mostra gate 8/8/sem chave, docs/env apontam para runbooks corretos e testes/builds cobrem billing; falta executar KYC/test-live e ponta-a-ponta | Checkout/webhook/quota/cancelamento testados; status de pagamentos saneado. |
| F6 | 1-2 semanas apos credenciais | Stays beta privado | 40% | Mantido como beta privado/oculto; `price_updates` e consentimento Stays tem migrations, integracao falha fechado sem envs, connect exige consentimento auditavel, tela de integracoes mostra sync/consentimento/modo por listing e o admin mostra readiness/missing envs; execucao real pendente | Connect/sync/push/rollback testado com conta real ou sandbox. |
| F7 | 1-2 semanas em paralelo | Admin, ops e confiabilidade | 96% read-only | Dashboard executivo + jobs + historico + alpha ops + ROI + audit logs + contatos publicos + collectors health testado + Stays readiness + E2E admin prod 100% + jobs admin mockado; staging real/alertas externos e mutacoes pendentes | Jobs/admin/audit/staging/observabilidade cobrindo operacao diaria. |
| F8 | 2 semanas | Beta fechado assistido | 51% | Alpha assistido com Gustavo pode rodar; waitlist, aceite mockado no endpoint real, contatos com triagem por status global, contato publico testado e playbook estao prontos para ampliar para 5-10 anfitrioes | 5-10 anfitrioes ativos, feedback semanal, primeiros cases. |
| F9 | apos gates | Beta pago / go-live controlado | 38% | Nao liberado; release gate, historico, staging drill, suporte/LGPD, smoke autenticado, admin, lifecycle billing por webhook e quota billing estao mais claros, mas Stripe real/cases seguem bloqueando | 3 cases, billing ok, suporte/termos/observabilidade ok. |
| F10 | continuo | Evolucao IA/moat | 35% | Fundacao parcial; dataset proprio ganhou preco aplicado/resultado real, mas ainda sem MAPE suficiente | Tier 1/2 com dataset real, MAPE, shadow mode e roadmap ML. |

### 2.1 Acompanhamento executivo - 2026-05-15

Legenda: **feito em codigo** = implementado e commitado, ainda sujeito a validacao de ambiente; **validar** = precisa rodar em staging/producao ou com credencial real; **pendente** = ainda nao implementado.

| Frente | Feito em codigo | Falta validar | Ainda pendente |
|---|---|---|---|
| A - Narrativa | Copy publica removeu promessa direta de "30%" e automatismo forte em `/landing` e `/lancamento`. `LAUNCH_MODE` entrou no `public-config`. `/lancamento` ganhou FAQ explicando recomendacao, limites, manual/auto e cobertura prioritaria. | Conferir todas as paginas, pitch e materiais externos. | Matriz final de mensagens por modo e revisao final de canais. |
| B - Waitlist e analytics | GA4/Meta continuam gated por consentimento; atribuicao first/last touch, UTM/referral, eventos `waitlist_signup`, `waitlist_referral_*` e fallback para backend `/waitlist` foram adicionados. Docker do front expoe envs publicas no build. Signup novo dispara e-mail de confirmacao com posicao/link referral. Aceite definitivo em `/auth/waitlist/accept` cria usuario real, marca waitlist como converted, bloqueia duplicidade com 409 claro, tem smoke F8 mockado no endpoint real e o admin permite convidar/reenviar/copiar link. | Teste ponta-a-ponta em producao/staging com GA4/Pixel reais, MailerSend real, build Docker/Railway, 5 inscricoes teste e 1 convite aceito em conta real. | A/B test, templates finais e revisao final de copy/canais continuam pendentes. |
| C - Eventos e coletores | `run_all_collectors.sh` agora chama runner Python estruturado; coletores opcionais sem chave viram `skipped/missing_key`; falha critica retorna exit code; resumo machine-readable foi adicionado. Cron ficou configuravel (`COLLECTOR_CRON_INTERVAL_SECONDS`, `RUN_COLLECTORS_ON_BOOT`), roda modulo Python direto no container e o spider legado correto e `even3`. Health admin respeita aliases/criticidade real e a UI mostra status, criticidade, aliases, variaveis ausentes, `stale`, `missing_key`, `no_events` e sinais operacionais; ha testes cobrindo alias/missing env/stale. Dashboard admin mostra fallback manual quando eventos futuros ficam abaixo do gate beta; import CSV agora normaliza `sourceLabel` e barra data passada/UF fora de SP antes do ingest. API Football, SerpAPI, Tavily e Firecrawl foram cadastradas nos ambientes de webscraping/backend conforme autorizado. | Rodar `DRY_RUN` e execucao real no container/Railway; confirmar `lastSeen`, `created24h`, eventos futuros no banco e se cada key esta sendo lida no servico correto. | Popular 100-200 eventos futuros SP; revisar termos/fallback por fonte e remover fontes quebradas ou ruidosas. |
| D - Recomendacoes | Job de processamento ganhou contadores reais, dedupe, motivos de falha, skip de evento passado e update de `criadoEm`. Foram adicionados filtros de qualidade de evento, reprocessamento alpha por admin/cron, registro de resultado real da recomendacao, smoke mockado de dashboard com recomendacao/empty state/aceite/preco aplicado e smoke autenticado condicional para dashboard/admin/alpha. | Executar E2E autenticado com Gustavo: reprocessar, confirmar recomendacao atual, aceitar/aplicar, registrar resultado e ver historico. | Expiracao formal, simulador admin e automacao de alertas externos. |
| E - Dataset e ROI | `DatasetCollectorService` ganhou diagnostics, snapshot usando preco armazenado, preco aplicado em `PriceSnapshot`, diaria base inicial, receita real mensal, propriedades com smoke mockado de diaria/receita/historico, historico sugerido vs. praticado, `/my-roi`, `/admin/roi` e smoke autenticado condicional do painel ROI. | Confirmar migrations/tabelas em prod, rodar snapshot automatico por 7 dias, validar ROI do usuario Gustavo e comparar com dados reais de reserva/ocupacao. | Captura/import de ocupacao, `EventProximityFeature` diario, MAPE/cases e fonte externa AirROI/GCP quando aprovada. |
| F - Billing e Stripe | Resolvedor unico de Price ID por plano/ciclo; seed de planos ficou idempotente; checkout falha com erro claro se Stripe/URLs nao estiverem configurados; DTO valida plano/ciclo/quantity e o service rejeita quantity nao numerico antes de chamar Stripe; `/plans` usa `loadStripe`, remove fallback para rota inexistente e tem smoke de readiness para preco ausente/chave Stripe ausente/plano sob consulta; onboarding cobre payload anual/quantity; templates transacionais de assinatura/cancelamento/falha/quota tem teste unitario; webhooks de checkout, subscription deleted e invoice failed disparam e-mails best-effort; quota warning/exceeded dispara no fluxo de cadastro quando cruza 80% ou bloqueia N+1; `/my-plan` mostra ciclo, quota e disponibilidade; admin sync check separa Price IDs faltantes/sem chave e mostra gate 8/8; docs/env/README apontam para runbooks reais; webhook normaliza status; migration corrige `peding` para `pending`. Runbook `docs/runbooks/stripe-billing-smoke.md` define prova de sync check, checkout, webhook, quota e cancelamento. | Executar smoke Stripe: checkout, webhook, quota, cancelamento, sync check 8/8 e disparos MailerSend reais. Confirmar KYC/live mode. | Upsell de quantity e validacao real do envio MailerSend em staging/prod. |
| G - Stays | Copy/onboarding reposicionam automatico como beta privado via Stays, com preview/consent/rollback como requisito. Admin dashboard e `/admin/stays` explicitam se Stays esta em beta privado por falta de envs. `price_updates` e campos de consentimento tem migrations. `.env.example` deixa `STAYS_API_BASE_URL` vazio por padrao e o connector/servico bloqueiam chamadas reais sem base URL; `connectAccount` exige consentimento versionado, encryption key e persiste IP/user-agent antes de qualquer operacao real; tela de integracoes mostra ultima sync, consentimento, status e modo por listing. Runbook `docs/runbooks/stays-beta-private-smoke.md` define prova de token criptografado, sync, push, rollback e consentimento. | Configurar `STAYS_API_BASE_URL` e `STAYS_TOKEN_ENCRYPTION_KEY` em staging/sandbox, rodar smoke allowlisted com consentimento real. | Connect/sync/push/rollback real, allowlist, rollback UI e auto-match listing. |
| H - Onboarding e dashboard | Empty states no dashboard explicam imovel sem recomendacao e mes/dia sem eventos; card mostra motivo da sugestao/preco aplicado; onboarding tem smoke mockado de import Airbnb individual, registro, criacao de endereco/processo e configuracao inicial; reset de senha tem smoke mockado cobrindo pedido e nova senha com hash; confirmacao de e-mail tem smoke mockado para envio, codigo e redirect. | Validar UX com dados reais, MailerSend e mobile. | Backfill cidade/UF invalida e validacao forte de endereco no onboarding. |
| I - Admin e ops | `/admin/dashboard` ganhou blocos de recomendacoes, dataset, billing e Stays. `/admin/jobs` executa jobs com historico. `/admin/waitlist` mostra link e reenvio. Entraram tambem `/admin/alpha`, `/admin/roi`, `/admin/audit-logs`, `/admin/contacts` com contadores globais por status e `/admin/collectors-health` mais acionavel/testado para aliases, missing envs e stale. Mudancas criticas de usuarios/financeiro/coverage/waitlist registram auditoria. | Conferir dados reais no admin depois de deploy, validar permissoes, testar reprocessamento alpha e comparar KPIs com consulta direta no banco. | Drill-down por propriedade e alertas externos. |
| J - Infra e release | Health/public-config ficaram mais explicitos; runner dos coletores evita "sucesso falso"; Docker frontend/webscraping foi corrigido; runbooks de release/staging existem; smoke publico, contato publico, jobs admin mockado e smoke autenticado condicional aparecem na suite Playwright; migrations de `price_updates` e consentimento Stays foram adicionadas. | Executar staging real, configurar branch protection, rodar smoke de release pos-deploy autenticado, confirmar migrations novas no banco e validar que Stays falha fechado sem envs. | Backup restore drill, alertas externos, Sentry prod/staging separado e load test. |
| K - Legal/LGPD | Consentimento continua gateando analytics/marketing; copy ficou mais conservadora. Runbook `docs/runbooks/suporte-lgpd-beta-pago.md` define canais, severidade, pedidos LGPD, DPAs e evidencias antes de M3. | Revisao juridica de termos/copy atualizada, canais de suporte/privacidade ativos e DPAs prioritarios revisados. | Processo LGPD completo, consentimentos versionados para Stays/comunicacoes e ticketing estruturado. |
| L - Marketing/beta | Base tecnica de atribuicao/referral, contato publico persistido, triagem admin com contadores globais por status, E2E mockado do formulario publico de contato e runbook `docs/runbooks/beta-fechado-assistido.md` definem ICP, onboarding assistido, relatorio semanal e template de case. | Rodar campanha pequena/waitlist real, responder contatos do admin e ativar 5-10 anfitrioes acompanhados. | Recrutamento 20-30 leads, oferta beta, cases aprovados e rotina comercial. |
| M - Testes frontend | Specs E2E de prelaunch/waitlist/analytics, F8 waitlist->aceite no endpoint real, smoke publico de release, contato publico, login/post-login/logout mockado, onboarding import/registro/configuracao/checkout payload mockado, propriedades/preco base/historico/exclusao mockados, jobs admin mockado, meu plano/quota, readiness de checkout em `/plans`, integracao Stays, dashboard com recomendacao/empty state/aceite/preco aplicado, reset de senha mockado, confirmacao de e-mail mockada e smoke autenticado condicional foram adicionadas. Builds locais passaram nas rodadas anteriores e deploy prod do ultimo pacote ficou verde. | Rodar Playwright autenticado em prod/staging com Gustavo/admin e confirmar GA/Pixel com consentimento. | Smokes completos: MailerSend real e checkout Stripe test mode em staging. |

### 2.2 Proximos checkpoints de acompanhamento

| Checkpoint | Dono sugerido | Como marcar pronto |
|---|---|---|
| Validar waitlist/analytics | Produto + Dev | 5 leads teste com source/UTM, 1 invite validado, eventos GA4/Meta visiveis. |
| Rodar coletores sem sucesso falso | Dev/Ops | Container sobe, `/health` do webscraping mostra `status=ok`, cron executa no intervalo configurado com `nextRunAt`, runner mostra `success/degraded/failed`, sources criticas com `lastSeen < 48h` e eventos futuros crescendo. |
| Provar recomendacao nova | Dev/Produto | Seguir `docs/runbooks/recomendacao-nova-smoke.md`: pelo menos 1 imovel reprocessado gera/atualiza `AnalisePreco` com `criadoEm` de hoje, evento futuro e motivo visivel. |
| Capturar ground truth inicial | Produto | Seguir `docs/runbooks/dataset-ground-truth-smoke.md`: pelo menos 1 sugestao aceita com `precoAplicado` registrado via dashboard/API. |
| Confirmar snapshots automaticos | Dev/Ops | `PriceSnapshot` cresce diariamente usando preco armazenado dos listings ou resolver externo documentado; se falhar, motivo de skip fica acionavel. |
| Operar jobs admin | Dev/Ops | `/admin/jobs` roda geocoder, reset de enrichment stale e snapshot de dataset, registra historico em `admin_job_runs` e mostra sucesso/erro compreensivel para operador. |
| Operar alpha Gustavo | Produto + Dev | Usuario Gustavo entra sem bloqueio de quota, ve recomendacoes, registra diaria praticada/receita real e aparece em `/admin/alpha` e `/admin/roi`. |
| Validar admin completo | Dev/Ops | `/admin/alpha`, `/admin/roi`, `/admin/audit-logs` e `/admin/contacts` carregam com conta admin real e mostram dados consistentes. |
| Confirmar migrations prod | Dev/Ops | Tabelas/colunas de alpha feedback, ROI/audit/contact submissions e admin jobs existem no banco e nao ha erro de migration no boot. |
| Confirmar migration Stays `price_updates` | Dev/Ops | Tabela `price_updates` existe em prod/staging apos migration `1779500000000-CreatePriceUpdates`, com indices esperados e sem depender de `synchronize`. |
| Validar Stays fail-closed | Dev/Ops | Sem `STAYS_API_BASE_URL`/`STAYS_TOKEN_ENCRYPTION_KEY`, connect/sync/push retornam erro amigavel e nao chamam Stays nem persistem token real. |
| Monitorar cron alpha | Dev/Ops | `alpha-pricing-reprocess` roda nos horarios configurados, gera log audivel e nao duplica recomendacoes indevidamente. |
| Saneamento Stripe | Dev/Financeiro | Seguir `docs/runbooks/stripe-billing-smoke.md`: `peding = 0`, sync check sem missing/not-configured, smoke checkout/webhook/quota/cancel ok. |
| Readiness admin confiavel | Dev/Ops | Numeros do `/admin/dashboard` batem com consulta direta no banco para eventos, pricing, dataset e billing. |

### 2.3 Mudancas incorporadas nesta rodada

| Referencia | Frente | O que muda no acompanhamento |
|---|---|---|
| `workspace atual` - `feat: add contact triage status counts` | I, L, F8 | Admin de contatos passa a receber `byStatus` do backend e mostrar novos/em andamento no filtro inteiro, nao apenas na pagina atual; spec cobre busca + contadores globais. |
| `workspace atual` - `feat: expose webscraping cron health` | C, J | Webscraping passa a expor `/health`, `/health.json`, `/health/live` e `/cron-status.json` com Scrapyd, cron, ultima execucao, proxima execucao e erro resumido sem vazar API key; runbook novo define gate operacional F2. |
| `workspace atual` - `fix: mark fully failed admin jobs as errors` | C, E, I | Fluxo controlado em producao mostrou geocoder com 100/100 falhas HTTP 403 e status antigo `success`; `runTrackedJob` passa a marcar `error` quando todos os itens tentados falham ou quando o resultado reporta status bloqueado. |
| `workspace atual` - `fix: explain Google geocoder failures` | C, E, I | `MapsService.updateLatLngByEventId()` passa a falhar cedo sem `GOOGLE_MAPS_API_KEY` e normaliza erros Google/axios; 403/`REQUEST_DENIED` vira mensagem acionavel sobre restricao server-side, Geocoding API e billing, em vez de `Request failed with status code 403`. |
| `producao 2026-05-15 21:00 UTC` - causa raiz geocoder | C, E, I | Logs do cron confirmaram que a chave existe, mas a **Geocoding API nao esta ativada** no projeto Google Cloud associado. Proximo passo depende do console Google Cloud: ativar Geocoding API, manter billing ativo e confirmar restricao server-side da key. |
| `workspace atual` - `feat: snapshot event proximity features` | C, E, I | `DatasetCollectorService` passa a gerar snapshots diarios/manual de proximidade a eventos por imovel, com contagens 7/14/30d, mega-eventos, distancia/travel time estimado, categoria predominante e oferta comparavel; admin `/admin/jobs` ganhou acao para zerar o blocker `event_proximity_features_empty`. |
| `producao 2026-05-15` - backfill event proximity | C, E, I | Migration `FixEventProximityUniqueIndex1779560000000` aplicada no MySQL Railway; job `event-proximity-snapshot` rodou com `captured=27`, depois `duplicates=29`; diagnostico passou para 28 registros e removeu o blocker `event_proximity_features_empty`. |
| `workspace atual` - `fix: use Stripe.js checkout on plans` | F, M | `/plans` deixa de depender de `window.Stripe` e de fallback para rota inexistente; agora usa `loadStripe`, erro claro de publishable key e redirecionamento oficial por sessionId. |
| `workspace atual` - `feat: show Stays readiness in admin` | G, I, J | `/admin/stays/health` retorna readiness, missing envs e betaPrivate; a tela admin mostra se Stays esta bloqueado ou pronto para smoke controlado antes de qualquer token real. |
| `workspace atual` - `fix: validate checkout payload before Stripe` | F, J | `CreateCheckoutSessionDto` valida plano, ciclo e quantity; `PaymentsService` rejeita quantity nao numerico antes de criar customer/sessao, e specs de billing/Stripe subiram para 32 testes mockados. |
| `workspace atual` - `fix: clarify stripe sync gate` | F, I | Admin de precos mostra gate F5 8/8, separa Price IDs sem chave de faltantes e tipa `not-configured` no contrato frontend. |
| `workspace atual` - `docs: align stripe price references` | F, J | README/env/runbook de incidente deixam de apontar para `docs/stripe-price-matrix.md` inexistente e referenciam os runbooks atuais de matriz F6.5 e smoke Stripe. |
| `workspace atual` - `feat: audit stays connect consent` | G, K | Connect Stays passa a exigir consentimento versionado antes de ping, persiste data/IP/user-agent e tem migration/teste dedicado para rastreabilidade. |
| `workspace atual` - `test: cover contact and admin jobs smokes` | I, L, M | Playwright cobre envio publico de contato para triagem e adiciona smoke mockado de `/admin/jobs` com geocoder/historico/readiness sem credenciais reais. |
| `workspace atual` - `feat: show plan quota readiness` | F, M | `/my-plan` passa a buscar quota, mostrar contratados/ativos/disponiveis, ciclo/quantidade da assinatura e ganhou E2E mockado para assinatura + falha de quota. |
| `workspace atual` - `feat: surface stays integration status` | G, M | Tela de integracoes Stays mostra ultima sync, consentimento, contagem de listings/modes e ganhou E2E mockado de connect+sync com consentimento. |
| `workspace atual` - `fix: make Stays fail closed without envs` | G, J | `STAYS_API_BASE_URL` sai do default para vazio, connector bloqueia chamada sem base URL e `StaysService` exige base URL/encryption key antes de conectar ou enviar dados reais; teste garante que nao faz ping nem salva token quando envs faltam. |
| `workspace atual` - `test: cover dashboard recommendation states` | D, H, M | Playwright mockado cobre dashboard sem recomendacoes e card com motivo/preco/CTA, fechando parte do smoke M4 sem credenciais reais. |
| `workspace atual` - `test: cover dashboard applied price flow` | D, E, M | Playwright mockado cobre aceite de sugestao, payload `aceito`, registro de preco aplicado, resultado de reserva, receita/noites e feedback observacional. |
| `workspace atual` - `test: cover reset password smoke` | H, M | Playwright mockado cobre pedido de reset e atualizacao de senha com token/hash, reduzindo risco do fluxo H6/M2 sem depender de MailerSend real. |
| `workspace atual` - `test: cover plans checkout readiness` | F, M | Playwright mockado cobre `/plans` com preco zerado, chave Stripe ausente e plano sob consulta sem criar sessao indevida, preparando M3 antes do smoke Stripe real. |
| `workspace atual` - `test: cover email confirmation smoke` | H, M | Playwright mockado cobre envio inicial de codigo, preenchimento dos 6 digitos, payload de confirmacao e redirect por perfil, reduzindo o gap H6/M2 antes do MailerSend real. |
| `workspace atual` - `test: cover onboarding Airbnb import` | H, M | Playwright mockado cobre onboarding ate busca de anuncio individual, `resolve`, `quick-info`, selecao de imovel e CTA de registro habilitado. |
| `workspace atual` - `test: cover onboarding registration config` | H, M | Playwright mockado cobre registro do imovel importado, criacao de endereco, fila de processo, configuracao `balanced/notifications` e chegada ao paywall. |
| `workspace atual` - `test: cover onboarding checkout payload` | F, M | Playwright mockado cobre CTA do paywall no onboarding e payload `plan=starter`, `billingCycle=annual`, `quantity=1` antes de qualquer Stripe real. |
| `workspace atual` - `test: cover billing email templates` | F, J | Jest cobre templates de assinatura ativa, cancelamento, falha de pagamento e quota warning/exceeded com valores, datas e links sem `undefined`. |
| `workspace atual` - `feat: send billing lifecycle emails` | F, J | `PaymentsService` importa `MailerModule` e chama e-mails HTML best-effort nos webhooks `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed` e nos eventos de quota warning/exceeded do cadastro; Jest valida envio mockado e status sem depender de MailerSend real. |
| `workspace atual` - `test: cover properties pricing inputs` | E, H, M | Playwright mockado cobre `/properties`, diaria base, receita media mensal, PATCH de pricing inputs, historico de alteracoes e exclusao confirmada por DELETE. |
| `workspace atual` - `test: cover login post-login routing` | H, M | Playwright mockado cobre login com senha SHA-256, verificacao de usuario ativo, `/post-login` com endereco ativo e redirect para dashboard. |
| `workspace atual` - `test: cover logout flow` | H, M | Playwright mockado cobre `POST /auth/logout`, limpeza de sessao via sidebar e retorno para a tela de login. |
| `workspace atual` - `test: cover collector health actionable states` | C, I | `AdminService.collectorsHealth()` passa a ter cobertura para alias `serpapi_events` -> `serpapi-events`, `missing_key`, `stale` e `no_events`, reduzindo risco de painel operacional enganar operador. |
| `3717790` - `fix: add price updates migration` | G, J | A tabela `price_updates` deixa de depender de sincronizacao implicita e passa a ter migration dedicada, removendo um bloqueio tecnico para smoke Stays push/rollback. |
| `workspace atual` - `test: add authenticated alpha/admin smoke` | D, E, I, M | Playwright ganhou smoke condicional com `E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD` para login, dashboard, `/admin`, `/admin/alpha` e `/admin/roi`; sem credenciais, pula limpo e nao bloqueia suite publica. |
| `workspace atual` - `test: align F8 waitlist acceptance smoke` | B, L, M | Spec F8 agora mocka `POST /auth/waitlist/accept`, valida payload de token/username/password e confirma redirect para dashboard, removendo dependencia do endpoint antigo `/auth/register`. |
| `workspace atual` - `fix: surface collector health signals` | C, I | `/admin/collectors-health` passa a mostrar status, criticidade, aliases, variaveis ausentes e sinais de `stale`/`missing_key`/`no_events`, deixando a operacao de F2 mais acionavel. |
| `workspace atual` - `docs: align prelaunch invite runbook` | B, L | Runbook de prelaunch deixou de tratar o aceite de convite como TODO e documenta o fluxo atual `GET /waitlist/invite` -> `POST /auth/waitlist/accept` -> `/dashboard`. |
| `workspace atual` - `fix: harden waitlist invite acceptance` | B, I | Aceite definitivo de convite agora cria usuario real, bloqueia duplicidade com mensagem 409, marca conversao e o admin mostra/copia/reenvia link para smoke operacional. |
| `workspace atual` - `feat: feed applied prices into dataset snapshots` | D, E | Preco aplicado registrado pelo usuario passa a alimentar `PriceSnapshot`, reduzindo o gap entre recomendacao aceita e ground truth inicial. |
| `workspace atual` - `feat: add admin jobs and dataset diagnostics` | E, I | Admin ganhou pagina de jobs com geocoder, reset de enrichment stale, diagnostics de dataset e execucao manual de snapshot. |
| `workspace atual` - `fix: align collector health criticality` | C, I | Health dos coletores normaliza aliases e criticidade para reduzir alerta falso quando uma fonte opcional esta sem chave. |
| `workspace atual` - `docs: add release and parallel-dev protocols` | J, M | Runbook de release gate e protocolo de devs/agentes paralelos deixam o processo menos dependente de conversa solta. |
| `workspace atual` - `feat: persist admin job run history` | I, J, M | Jobs admin passam a ser rastreados em `admin_job_runs`, com migration, endpoints `/admin/jobs/*` e historico visivel em `/admin/jobs`. |
| `workspace atual` - `feat: send waitlist signup confirmation` | B | Cadastro novo na waitlist envia confirmacao por e-mail com posicao e link de referral, sem bloquear signup se MailerSend falhar. |
| `workspace atual` - `copy: add prelaunch recommendation FAQ` | A, K | `/lancamento` ganhou FAQ de recomendacao/limites e copy menos automatica, reduzindo risco de promessa sem prova antes do beta. |
| `workspace atual` - `feat: surface event fallback actions` | C, I | Dashboard admin passa a destacar cadastro manual/importacao CSV/jobs quando a cobertura futura esta abaixo do gate beta. |
| `workspace atual` - `feat: guide csv event fallback readiness` | C, I | Import CSV ganhou template com datas futuras, checklist operacional e indicador de progresso contra a meta de 100 eventos para fallback beta. |
| `workspace atual` - `fix: gate csv event fallback quality` | C, I | Import CSV normaliza `sourceLabel` e rejeita linhas com data passada ou UF fora de SP antes do ingest; spec cobre o gate de qualidade. |
| `workspace atual` - `docs: add manual event fallback runbook` | C, J | Runbook de fallback manual define quando ativar, fontes, campos minimos, evidencia e criterios para aceitar lote de eventos. |
| `workspace atual` - `docs: add recommendation smoke runbook` | D, J | Runbook de smoke define pre-condicoes, execucao, criterios e evidencia para provar recomendacao nova antes do M2. |
| `workspace atual` - `docs: add dataset ground truth smoke` | E, J | Runbook de ground truth define como provar preco aplicado, `PriceSnapshot` e evidencia de recomendado vs. aplicado para F4. |
| `workspace atual` - `docs: add Stripe billing smoke` | F, J | Runbook de billing define validacao de Price IDs, checkout, webhook, quota, cancelamento e separacao test/live para preparar M3. |
| `workspace atual` - `docs: add Stays beta private smoke` | G, J, K | Runbook de Stays define gates de credencial, token criptografado, consentimento, push manual/auto e rollback antes de expor automacao. |
| `workspace atual` - `docs: add assisted beta playbook` | L, E, D | Runbook de beta fechado define ICP, onboarding, relatorio semanal e template de case para transformar smokes tecnicos em prova com anfitrioes reais. |
| `workspace atual` - `docs: add staging release drill` | J, M | Runbook de staging/release amarra PR, CI, deploy controlado, smokes por frente, branch protection, producao monitorada e restore drill. |
| `workspace atual` - `docs: add support LGPD paid beta runbook` | K, I | Runbook de suporte/LGPD define canais, severidade, processo de titular, DPAs, consentimentos e criterio minimo para beta pago. |
| `workspace atual` - `test: add public release gate smoke` | M, J, A | Playwright cobre rotas publicas criticas, links legais da landing e verificacao anonima sem vazar dados privados obvios. |
| `3d9e1db` - `fix: automate dataset snapshots and scraper cadence` | C, E | Cron dos coletores passou a ter intervalo configuravel e execucao no boot; snapshot de dataset agora consegue capturar preco de listings com `dailyPrice`, `raw` ou `priceText`, reduzindo dependencia imediata de resolver externo. |
| `92958db` - `fix: expose frontend public envs in docker build` | B, J | Build Docker do frontend agora recebe envs publicas criticas para prelaunch, analytics, Pixel, waitlist, app URL e Sentry. |
| `01c15c1` - `fix: run webscraping collectors in container` | C, J | Imagem Docker do webscraping copia pacote e scripts para o runtime e o cron chama `python -m urban_webscrapping.collectors.run_all`, evitando dependencia de caminho shell fora do container. |
| `9eb1495` - `fix: schedule legacy even3 spider` | C | Runner agenda o spider legado correto `even3`, removendo falha operacional por nome antigo `even_three`. |
| `6d07c19` - `feat: add alpha ops pricing feedback and ROI dashboards` | D, E, I | Alpha assistido ganhou reprocessamento admin/cron, filtros de qualidade de eventos, feedback de resultado, ROI usuario/admin e historico sugerido vs. real. |
| `33c7105`, `673fa2b`, `4ef7bee` - runbooks de beta/staging/suporte | J, K, L, M | Playbooks de beta assistido, staging release drill e suporte/LGPD fecham os ritos minimos para operar alpha/beta sem improviso. |
| `edbf334` - `feat: capture public contact submissions` | B, I, L | Contatos publicos passaram a ser persistidos e triados no admin, reduzindo perda de leads fora da waitlist. |
| `369fa81` - `feat: add admin audit log viewer` | I, J, K | Admin ganhou viewer de auditoria e link no painel, deixando mudancas sensiveis mais rastreaveis. |

---

## 3. Roadmap detalhado por frente

### Frente A - Narrativa, posicionamento e launch mode

Problema da auditoria:

- A promessa "+30% receita via IA" ainda nao e comprovavel.
- Sem `PriceSnapshot`, ocupacao, preco aplicado e cases, a narrativa quantitativa fica arriscada.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| A1 | P0 | Reescrever copy publica para promessa segura: eventos proximos + recomendacao de preco + beta controlado | Nenhuma | Landing nao promete ROI percentual sem prova. |
| A2 | P0 | Definir oficialmente launch mode: `prelaunch`, `closed_beta`, `paid_beta`, `public` | Decisao interna | Documento/flag de ambiente reflete modo atual. |
| A3 | P0 | Criar matriz de mensagens por modo de lancamento | A2 | Copy aprovada para landing, e-mail, pitch socios e vendas. |
| A4 | P1 | Criar pagina/FAQ explicando como a recomendacao funciona, em linguagem nao tecnica | F3 | Usuario entende fontes, limites e modo manual/auto. |
| A5 | P1 | Atualizar `docs/base-socios.md` com estado honesto pos-auditoria | Este roadmap | Socios veem diferenca entre fundacao pronta e produto validado. |

Gate:

- Nenhum canal publico usa promessa quantitativa ate existirem 3 cases auditados.

---

### Frente B - Pre-lancamento, waitlist e analytics

Problema da auditoria:

- Waitlist existe, mas producao esta vazia.
- GA4 e Meta Pixel ausentes.
- Convite de waitlist ainda tinha pendencia no runbook.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| B1 | P0 | Validar runtime de `PRELAUNCH_MODE` backend e frontend | Railway env | `/create` mostra waitlist quando flag ativa. |
| B2 | P0 | Testar fluxo completo: `/lancamento -> /create -> waitlist -> admin -> invite -> aceite` | B1 | Usuario convidado consegue virar `User` real ou pendencia e documentada como bloqueante. |
| B3 | P0 | Fechar endpoint/fluxo de aceite definitivo se ainda nao existir | B2 | Magic link cria usuario real, marca waitlist como `converted` e faz login/redirect. |
| B4 | P0 | Configurar GA4 e Meta Pixel via env | IDs externos | Eventos basicos aparecem nos dashboards: page_view, waitlist_signup, invite_accept. |
| B5 | P0 | Adicionar eventos de analytics no frontend com consentimento | B4 | GA/Pixel so disparam apos consentimento. |
| B6 | P1 | Criar dashboard admin de funil de waitlist por source/referral/status | Dados waitlist | Admin ve total, pending, invited, converted, source e top referrers. |
| B7 | P1 | Criar UTMs padrao para campanhas | B4 | Waitlist registra `source`/utm de forma consistente. |
| B8 | P1 | Criar e-mails de waitlist: cadastro, convite, lembrete de convite expirando | Mailersend | Templates testados em ambiente real. |
| B9 | P2 | A/B test simples de headline/oferta | B4 | Pelo menos duas variantes rastreaveis. |

Gate M1:

- 5 inscricoes teste entram na waitlist com source correto.
- 1 convite teste converte ponta-a-ponta.
- GA4/Pixel registram eventos principais.

---

### Frente C - Eventos e cobertura

Problema da auditoria:

- Apenas 2 eventos futuros.
- Nenhum evento criado nos ultimos 7 dias.
- Sources novas quase vazias.
- Firecrawl/SerpAPI/Tavily/API Football nao configurados no backend.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| C1 | P0 | Diagnosticar por que coletores nao criaram eventos nos ultimos 7 dias | Railway logs, webscraping, pipeline | Causa raiz registrada: credencial, cron, ingest, auth, filtro, deploy ou fonte vazia. |
| C2 | P0 | Validar `run_all_collectors.sh` em ambiente controlado | C1 | Script retorna sucesso/falha real por coletor, sem engolir erro critico. |
| C3 | P0 | Corrigir cron/orquestracao dos coletores | C1/C2 | Pelo menos 1 execucao diaria registrada por fonte ativa. |
| C4 | P0 | Criar alerta para `events.created24h = 0` e `events.future < alvo` | Admin/observabilidade | Alerta visivel em admin ou Sentry/log estruturado. |
| C5 | P0 | Ativar fallback de curadoria manual para SP | Admin events | Admin consegue inserir/importar eventos de SP e gerar dedup. |
| C6 | P0 | Popular calendario manual inicial de SP para 30 dias | C5 | >= 100 eventos futuros qualificados se APIs ainda nao estiverem prontas. |
| C7 | P1 | Configurar API Football, SerpAPI, Tavily, Firecrawl conforme budget | API keys externas | Coletores aparecem com `source` e `lastSeen < 48h`. |
| C8 | P1 | Substituir/reativar fontes gratuitas: SP Cultura, USP, Marcha, Ticketmaster, Sympla/Eventbrite quando possivel | C1 | Minimo 5 sources ativas. |
| C9 | P1 | Criar health de coletores com erro real por fonte | C2 | Painel mostra lastSeen, created24h, errorRate, stale. |
| C10 | P1 | Revisar `CoverageRegion` Grande SP e raio de imoveis | Dados de endereco | Eventos relevantes de SP nao ficam indevidamente fora de escopo. |
| C11 | P1 | Adicionar dedup/qualidade: venueType, capacity, expectedAttendance, officialUrl | C5-C8 | Eventos futuros tem campos suficientes para explicar impacto. |
| C12 | P2 | Mapear termos de uso, frequencia e fallback por fonte | Juridico/produto | Tabela de fontes documentada. |

Gate M2 parcial:

- >= 200 eventos futuros em SP/30d ou >= 100 via fallback manual enquanto APIs sao configuradas.
- Pelo menos 5 sources ativas ou justificativa de fallback.
- `lastSeen` por source critica < 48h.
- Pending geocode controlado e sem backlog travado.

---

### Frente D - Recomendacoes de preco

Problema da auditoria:

- Nenhuma recomendacao criada nos ultimos 30 dias.
- Apenas 14 recomendacoes futuras.
- Apenas 10/29 imoveis ativos com recomendacao futura.
- `lastCreated` de recomendacao e 2025-09-20.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| D1 | P0 | Diagnosticar fluxo atual de geracao: evento -> analise_endereco_evento -> analise_preco | C1, dados prod | Mapa de falhas por etapa: sem evento, sem coords, sem preco Airbnb, sem comps, sem match, duplicate update. |
| D2 | P0 | Corrigir job por propriedade para reportar contadores reais | D1 | Endpoint retorna analises criadas, atualizadas, puladas e motivos. |
| D3 | P0 | Garantir que reprocessamento gera/atualiza `AnalisePreco` com `criado_em` atual quando houver match | D1/D2 | Recomens novas aparecem com data atual em ambiente teste/prod controlado. |
| D4 | P0 | Criar metrica diaria `activeWithFuturePricing / activeAddresses` | D2 | Admin ve cobertura de recomendacao por imovel. |
| D5 | P0 | Criar alerta quando `pricing.created24h = 0` em dia com eventos futuros | D4 | Operador recebe alerta antes do usuario perceber. |
| D6 | P0 | Criar empty state honesto: "sem evento relevante nos proximos X dias" | D4 | Usuario sem sugestao entende o motivo e proximo check. |
| D7 | P1 | Explicar recomendacao em linguagem simples no card | Dados de motivo_ia | Card mostra evento, distancia, preco atual, preco sugerido, variacao, guardrail e razao. |
| D8 | P1 | Criar historico de sugestoes aceitas, rejeitadas e aplicadas por propriedade | `AnalisePreco` | Usuario e admin veem timeline. |
| D9 | P1 | Separar estados: sugerida, aceita, aplicada manual, aplicada via Stays, rejeitada, expirada | D8 | Status consistente no banco/UI. |
| D10 | P1 | Criar expiracao/validade da recomendacao | D8 | Recomendacao antiga nao aparece como atual sem aviso. |
| D11 | P1 | Criar teste unitario/integ para guardrails de preco | Codigo pricing | Variação fora do limite e bloqueada/ajustada. |
| D12 | P2 | Criar simulador admin de recomendacao por imovel/evento | Admin jobs | Operador testa sem tocar producao em massa. |

Gate M2:

- Recomendacoes criadas nas ultimas 24/48h.
- >= 70% dos imoveis ativos em regioes cobertas com recomendacao futura ou empty state explicativo.
- Nenhuma recomendacao fora de guardrail.
- Usuario consegue aceitar/rejeitar recomendacao sem erro.

---

### Frente E - Dataset, IA, qualidade e ROI

Problema da auditoria:

- `price_snapshots = 0`.
- `occupancy_history = 0`.
- `event_proximity_features = 0`.
- `preco_aplicado = 0`.
- Sem MAPE e sem cases auditados.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| E1 | P0 | Verificar migrations/tabelas de dataset em prod | DB/migrations | `price_snapshots`, `occupancy_history`, `event_proximity_features` existem com schema correto. |
| E2 | P0 | Ativar e validar cron `DatasetCollectorService.handleDailySnapshot` | E1, Airbnb price fetch | Snapshots `self_cron` sao criados diariamente. |
| E3 | P0 | Persistir comps em cada nova recomendacao | D3, E1 | `comp_extraction` cresce quando recomendacao roda. |
| E4 | P0 | Criar UI para registrar preco aplicado manualmente | D8 | Usuario informa preco aplicado; `preco_aplicado` e `aplicado_em` populam. |
| E5 | P0 | Criar fluxo de captura de ocupacao minimo manual | Produto/UX | Host marca booked/available ou importa CSV simples. |
| E6 | P1 | Criar `EventProximityFeature` diario por imovel | C/D/E1 | Features de proximidade sao persistidas diariamente. |
| E7 | P1 | Expor dashboard de qualidade com sample size, MAPE, coverage e gaps | E4/E5 | Admin quality deixa de ser vazio e mostra qualidade real. |
| E8 | P1 | Definir metrica interina antes de MAPE robusto: uplift sugerido vs aplicado, aceite, aplicacao | E4 | Relatorio beta semanal tem metricas mesmo com amostra baixa. |
| E9 | P1 | Importar dataset externo inicial AirROI/Base dos Dados quando keys estiverem prontas | API/GCP externo | `manual_import` populado com fonte, licenca e data. |
| E10 | P1 | Configurar `PRICING_STRATEGY=adaptive` explicitamente em prod/staging quando dataset estiver validado | E2-E7 | Estrategia ativa visivel no admin. |
| E11 | P2 | Shadow mode XGBoost com dataset minimo | E7/E9 | Predicoes shadow comparadas com rule-based sem afetar usuario. |
| E12 | P2 | Definir metodologia dos 3 cases de ROI | E4/E5 | Template de caso aprovado antes do beta. |

Gate M2/M3:

- 7 dias consecutivos de `PriceSnapshot`.
- Pelo menos 1 preco aplicado capturado por beta tester ativo.
- Admin quality mostra sample size real.
- 3 cases em andamento antes de promessa quantitativa.

---

### Frente F - Billing, planos e Stripe

Problema da auditoria:

- 0/8 env vars de Price IDs configuradas, apesar de IDs no banco.
- Status de pagamento inconsistente (`peding`).
- KYC nao confirmado.
- Precisa smoke checkout/webhook/quota/cancelamento.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| F1 | P0 | Confirmar fonte oficial dos Price IDs: banco vs env fallback | Codigo Payments/Plans | Um unico contrato documentado e validado por `/admin/stripe/sync-check`. |
| F2 | P0 | Criar/configurar os 8 Stripe Price IDs se faltarem | Stripe Dashboard | Sync check retorna 8/8 ok. |
| F3 | P0 | Confirmar Stripe KYC/live mode | Acao humana | Documento de status: test/live, conta PJ, payout. |
| F4 | P0 | Smoke checkout mensal/trimestral/semestral/anual para Starter e Profissional | F2/F3 | Checkout cria session e webhook atualiza assinatura. |
| F5 | P0 | Smoke quota: contratar N, cadastrar N, bloquear N+1 | F4 | 403 amigavel e paywall correto. |
| F6 | P0 | Smoke cancelamento e subscription updated/deleted | F4 | Payment e UI refletem cancelamento. |
| F7 | P0 | Saneamento de status `peding` -> `pending` ou migracao controlada | Backup DB | Relatorios nao contam status errado. |
| F8 | P1 | Melhorar UI de plano/quota/status de assinatura | F5 | Usuario entende plano, limite e proxima cobranca. |
| F9 | P1 | E-mails transacionais: assinatura ativa, falha, cancelada, quota warning/exceeded | Mailersend | Templates e disparos mockados de assinatura/cancelamento/falha/quota testados nos eventos certos; falta MailerSend real em staging/prod. |
| F10 | P2 | Fluxo de upsell de quantity via Stripe Portal ou update direto | F5 | Usuario aumenta limite sem recriar conta. |

Gate M3:

- Checkout e webhook testados em ambiente adequado.
- Quota validada server-side e front-side.
- Pagamentos ativos/trial/pending consistentes.

---

### Frente G - Stays e modo automatico

Problema da auditoria:

- Sem `STAYS_API_BASE_URL`.
- Sem `STAYS_TOKEN_ENCRYPTION_KEY`.
- Nenhuma conta/listing/push.
- Sem tabela/log de push em prod.
- Sem smoke real.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| G1 | P0 | Decidir exposicao de Stays no produto: hidden, coming soon ou beta privado | Produto | UI nao vende automatico como pronto. |
| G2 | P0 | Configurar `STAYS_TOKEN_ENCRYPTION_KEY` em staging/prod antes de qualquer token real | Secret externo | Persistir token nao falha e grava criptografado. |
| G3 | P0 | Confirmar migration/tabela `price_updates` em prod | DB/migrations | Tabela existe e entity sincroniza via migration. |
| G4 | P0 | Configurar `STAYS_API_BASE_URL` em staging/sandbox quando credencial existir | Credencial Stays | Connector aponta para ambiente correto. |
| G5 | P0 | Smoke connect -> ping -> sync listings | G2/G4 | Conta ativa e listings aparecem. |
| G6 | P0 | Implementar/validar preview antes de push | G5 | Usuario ve preco anterior, novo, data e guardrail antes de aplicar. |
| G7 | P0 | Smoke push manual e rollback | G5/G6 | `PriceUpdate` success e rollback success registrados. |
| G8 | P1 | Configurar modo automatico apenas por allowlist/beta | G5-G7 | Apenas usuarios beta conseguem ativar auto. |
| G9 | P1 | UI de status da conta: ultima sync, ultimo erro, listings, modo por imovel | G5 | Tela de integracoes e autoexplicativa. |
| G10 | P1 | Consentimento Stays persistido em `User.consents` ou AuditLog | LGPD | Consentimento rastreavel. |
| G11 | P1 | Recriptografar tokens legados se existirem | G2 | Nenhum token plaintext remanescente. |
| G12 | P2 | Auto-match Stays listing <-> Urban property | G5 | Match sugerido por titulo/endereco/coords com confirmacao. |

Gate:

- Stays so sai de beta privado depois de connect/sync/push/rollback e consentimento auditavel.

---

### Frente H - Onboarding, dashboard e confianca do usuario

Problema da auditoria:

- 16/29 imoveis com cidade "A definir" e estado "A ".
- Usuario pode terminar onboarding sem recomendacao e sem entender motivo.
- Empty states e mensagens de erro pendentes.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| H1 | P0 | Corrigir/backfill cidade/estado dos imoveis "A definir" | Maps/geocoding | 29/29 imoveis ativos com localidade confiavel ou status de falha. |
| H2 | P0 | Melhorar validacao de endereco no onboarding | H1 | Novo imovel nao entra com localidade invalida sem aviso. |
| H3 | P0 | Dashboard empty state por motivo: processando, sem evento, sem preco Airbnb, erro, quota, sem plano | D4 | Usuario sabe o que acontece e proxima acao. |
| H4 | P1 | Estados de loading/progresso do processamento por propriedade | D2 | Usuario ve andamento real, nao apenas completed generico. |
| H5 | P1 | Mensagens amigaveis de 403/quota/acesso negado | F5 | Sem telas brutas ou silenciosas. |
| H6 | P1 | Revisar reset, confirmacao de e-mail, login e cadastro | Auth atual | Textos claros e sem fluxo legado confuso. |
| H7 | P1 | Consolidar guards client-side em `/auth/me` | AuthContext | Sessao consistente, menos dependencia de localStorage legado. |
| H8 | P2 | Auditoria mobile das principais rotas: landing, create, onboarding, dashboard, plans, settings | Browser/Playwright | Sem overflow ou CTA quebrado em mobile. |
| H9 | P2 | Onboarding e-mails D1/D3/D7 | Mailersend | Usuario beta recebe orientacao depois do cadastro. |

Gate:

- Usuario beta nunca fica "sem resposta"; sempre ve recomendacao, motivo de ausencia ou acao necessaria.

---

### Frente I - Admin, operacao e suporte interno

Problema da auditoria:

- Painel admin existe, mas dados cruciais estao vazios.
- Faltam jobs self-service, audit log e drill-down por propriedade.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| I1 | P0 | Criar dashboard executivo de readiness: eventos, recomendacoes, dataset, billing, Stays, waitlist | Frentes C-G | Admin ve sem SQL se esta pronto ou quebrado. |
| I2 | P0 | Criar painel admin de jobs: eventos, geocode, recomendacoes, dataset snapshot, Stays sync | Services existentes | Operador dispara jobs allowlisted sem Swagger/terminal. |
| I3 | P0 | Jobs devem mostrar fila, duracao, sucesso, falha e motivo | I2 | Historico operacional auditavel. |
| I4 | P1 | Criar AuditLog para acoes admin sensiveis | Auth/admin | Mudanca de role, invite, delete, pricing config, job trigger ficam rastreados. |
| I5 | P1 | Drill-down de propriedade: eventos, recomendacoes, aceite, aplicado, status processamento | D/E/H | Suporte entende um imovel sem SQL. |
| I6 | P1 | Admin de dados vazios/gaps: dataset zero, occupancy zero, Stays zero, future events baixo | I1 | Alertas visuais no admin. |
| I7 | P1 | Links externos organizados: Railway, Sentry, Stripe, GA4, Mailersend, Uptime | Credenciais humanas | Operador encontra dashboards em 1 clique. |
| I8 | P2 | Area de suporte/NPS/tickets | Beta | Feedback de beta vira registro estruturado. |

Gate:

- Operador consegue diagnosticar top 5 problemas sem abrir terminal: sem eventos, sem recomendacoes, checkout quebrado, Stays quebrado, dataset zerado.

---

### Frente J - Infra, release process e observabilidade

Problema da auditoria:

- Producao precisou de hotfixes diretos.
- Staging/release gate nao comprovado.
- Pipeline publico retornava 502 por ser worker sem HTTP.
- KNN/webscraping root 401 pode gerar ruido.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| J1 | P0 | Criar/validar staging Railway espelhando prod | Railway | Backend/front/db staging rodam smoke. |
| J2 | P0 | Definir release gate: PR -> CI -> staging smoke -> prod | GitHub/Railway | Nenhum merge grande direto sem checks. |
| J3 | P0 | Branch protection em `main` | GitHub | PR + CI obrigatorios. |
| J4 | P0 | Smoke automatizado: login, waitlist, onboarding, dashboard, checkout mock/test, recomendacao | Playwright/API | Roda antes de release. |
| J5 | P1 | Health endpoints apropriados por servico | Backend/webscraping/pipeline | Worker sem HTTP nao exposto ou tem health real. |
| J6 | P1 | Ajustar dominios publicos desnecessarios | Railway | Pipeline worker nao gera 502 publico. |
| J7 | P1 | Separar Sentry prod/staging e eventos custom de produto | Sentry/env | Alertas nao misturam ambientes. |
| J8 | P1 | Alertas para Stripe webhook, eventos stale, pricing stale, Stays fail, DB backup | Observabilidade | Incidentes criticos geram alerta. |
| J9 | P1 | Backup off-site e restore drill | Infra | Restore testado e documentado. |
| J10 | P2 | Load/performance test em staging | J1/J4 | P95 e gargalos documentados. |
| J11 | P2 | Revisar logs para PII e ruido operacional | Logger/Sentry | Logs seguros e pesquisaveis. |

Gate M3:

- Staging + branch protection + smoke sao obrigatorios para lancamento pago.

---

### Frente K - Legal, LGPD e governanca

Problema da auditoria:

- Termos/privacidade existem, mas DPAs e processo LGPD ainda pendentes.
- Consentimento Stays precisa ser persistido.
- Promessa quantitativa sem prova cria risco.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| K1 | P0 | Revisar copy para remover promessa quantitativa sem prova | A1 | Site e pitch seguros. |
| K2 | P1 | Revisao juridica de termos e privacidade | Advogado | Versoes finais publicadas. |
| K3 | P1 | Assinar/registrar DPAs prioritarios: Stripe, Mailersend, AWS, Railway, Upstash, Sentry | Socios/contas | Checklist LGPD atualizado. |
| K4 | P1 | Processo de solicitacao LGPD: acesso, exclusao, portabilidade | Admin/AuditLog | Runbook com prazo e owner. |
| K5 | P1 | Persistir consentimentos: cookies, Stays, comunicacoes, termos | Front/backend | Usuario tem versao e timestamp de consentimento. |
| K6 | P2 | Parecer sobre fontes/scraping de eventos e Airbnb | Advogado | Fontes classificadas por risco e fallback. |
| K7 | P2 | Politica de retencao de logs, price updates e dados de ocupacao | Produto/legal | Retencao documentada e implementavel. |

Gate:

- Beta pago exige termos/privacidade revisados, DPAs prioritarios em andamento e consentimentos auditaveis.

---

### Frente L - Marketing, vendas e beta fechado

Problema da auditoria:

- Canal de aquisicao nao validado.
- Waitlist vazia.
- Sem cases reais.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| L1 | P0 | Definir ICP beta: Superhost SP, bairro/evento, quantidade de imoveis, disponibilidade para feedback | Produto/vendas | Lista de perfil aprovada. |
| L2 | P0 | Recrutar 20-30 leads para formar 5-10 beta testers | Waitlist/canais | Pipeline de candidatos com status. |
| L3 | P0 | Criar playbook de onboarding assistido | H/D | Checklist por imovel. |
| L4 | P1 | Criar relatorio semanal de beta | E/D/F | Recomendacoes, aceite, aplicado, feedback, bugs. |
| L5 | P1 | Criar template de case de ROI/uplift | E12 | Mesmo formato para todos os cases. |
| L6 | P1 | Definir oferta beta: gratuito, desconto, meses inclusos, contrapartida de dados | Socios | Termos claros para beta. |
| L7 | P2 | Criar materiais sociais e cadencia | A/B | Conteudo alinhado a promessa segura. |
| L8 | P2 | Experimento pago pequeno com budget controlado | B4/B7 | CAC preliminar e taxa waitlist medidos. |

Gate beta:

- 5-10 beta testers com imoveis revisados.
- Pelo menos 3 imoveis com recomendacoes e registro de preco aplicado em andamento.

---

### Frente M - Qualidade frontend e testes E2E

Problema da auditoria:

- Front tem muitos fluxos, mas precisa smoke real e limpeza de contratos.
- UX mobile e mensagens de erro ainda pendentes.

Tarefas:

| ID | Prioridade | Tarefa | Dependencia | Criterio de aceite |
|---|---|---|---|---|
| M1 | P0 | Smoke Playwright: login/logout, waitlist, onboarding, dashboard, propriedades, plans | Staging | Login/post-login/logout, onboarding import/registro/configuracao/checkout payload e propriedades/preco base mockados cobertos; falta staging real. |
| M2 | P1 | Smoke de reset de senha e confirmacao de e-mail | Mailersend/test env | Reset e confirmacao de e-mail mockados cobertos; falta fluxo real com MailerSend. |
| M3 | P1 | Smoke checkout com Stripe test mode | F2/F4 | Readiness e payload de onboarding mockados cobertos; falta checkout/retorno com Stripe test mode. |
| M4 | P1 | Smoke dashboard com recomendacao e empty state | D6/D7 | Ambos cenarios cobertos. |
| M5 | P1 | Dividir `api.ts` por dominio: auth, properties, pricing, admin, stays, waitlist, payments | Sem bloqueio | Contratos mais seguros e rastreaveis. |
| M6 | P1 | Remover wrappers/rotas legadas sem controller correspondente | M5 | Menos chamadas mortas. |
| M7 | P2 | WCAG/mobile audit das paginas publicas e core app | Browser | Sem bloqueios criticos de usabilidade. |

Gate:

- Nenhum release pago sem smoke E2E minimo verde.

---

## 4. Sequenciamento recomendado

### Semana 1 - Recuperar valor basico e pre-lancamento

Objetivo: pre-lancamento seguro + diagnostico/correcao de eventos e recomendacoes.

Entregas:

- A1-A3: narrativa e launch mode.
- B1-B5: waitlist e analytics.
- C1-C5: diagnostico e fallback de eventos.
- D1-D5: diagnostico e metricas de recomendacao.
- H1-H3: localidades e empty states basicos.
- J1-J4: staging/release gate inicial, se viavel.

Gate:

- Waitlist funcionando.
- Eventos e recomendacoes com causa raiz identificada.
- Pelo menos um caminho de geracao de recomendacao nova provado em ambiente controlado.

### Semana 2 - Beta fechado tecnicamente viavel

Objetivo: fazer o core rodar de forma repetivel para imoveis reais.

Entregas:

- C6-C10: eventos futuros e coletores.
- D2-D9: recomendacoes novas, status e historico.
- E1-E5: dataset minimo e preco aplicado.
- I1-I3: readiness e jobs admin.
- M1-M4: smoke E2E.

Gate:

- >= 70% dos imoveis ativos em regioes cobertas com recomendacao ou empty state.
- Snapshots iniciados.
- Preco aplicado capturavel.

### Semana 3 - Preparar beta pago e operacao

Objetivo: reduzir risco de cobranca e operacao manual.

Entregas:

- F1-F8: Stripe, plano, quota, status.
- J5-J9: health, alertas, backup.
- K1-K5: LGPD minimo.
- L1-L6: recrutamento e playbook beta.
- H4-H7: confianca/UX.

Gate:

- Checkout/webhook/quota/cancelamento testados.
- Admin diagnostica sistema sem SQL.
- 5-10 beta testers prontos.

### Semana 4 - Stays beta privado e cases

Objetivo: ativar automacao com risco controlado e iniciar provas de ROI.

Entregas:

- G1-G8: Stays beta privado.
- E6-E12: qualidade, MAPE inicial, template de cases.
- L4-L5: relatorios semanais e cases.
- I4-I8: audit log, drill-down e suporte.

Gate:

- Push/rollback Stays validado ou feature continua escondida.
- 3 cases em andamento.
- Produto pronto para beta pago limitado se billing e ROI minimo estiverem ok.

---

## 5. Gates formais de lancamento

### Gate M1 - Pre-lancamento publico

Obrigatorio:

- Copy sem promessa quantitativa.
- Waitlist ponta-a-ponta.
- GA4/Pixel configurados com consentimento.
- Admin waitlist funcionando.
- Termos/privacidade publicados em versao minima.

Nao obrigatorio:

- Stripe live.
- Stays.
- ROI.

### Gate M2 - Beta fechado

Obrigatorio:

- Eventos futuros suficientes ou curadoria manual ativa.
- Recomendacoes novas com `criado_em` atual.
- Empty states claros.
- Preco aplicado capturavel.
- Resultado real capturavel: diaria praticada, receita real mensal, noites/status e observacao de feedback.
- Snapshot diario ativo.
- Smoke E2E basico verde.
- Painel alpha/ROI/admin audit validado com conta admin real.
- 5-10 beta testers acompanhados.

Nao obrigatorio:

- Billing live.
- Stays auto.
- MAPE estatisticamente robusto.

### Gate M3 - Beta pago limitado

Obrigatorio:

- Stripe KYC/live ou test mode claramente separado, conforme decisao.
- Checkout/webhook/quota/cancelamento testados.
- Pelo menos 3 cases qualitativos ou quantitativos em andamento.
- Admin readiness, audit log, contatos e alertas criticos.
- Branch protection/staging/release gate.
- Termos/privacidade revisados.

Opcional:

- Stays beta privado.

### Gate M4 - Go-live publico

Obrigatorio:

- >= 85% dos imoveis em regioes cobertas com recomendacao futura ou justificativa.
- Eventos SP/30d acima do alvo.
- Dataset e qualidade com amostra minima.
- 3 cases auditados publicados/aprovados.
- Billing e suporte prontos.
- Observabilidade e incident response.
- Narrativa comercial alinhada aos dados reais.

---

## 6. Dependencias externas que podem ficar para configuracao posterior

Estas dependencias nao precisam bloquear desenvolvimento, mas bloqueiam ativacao da respectiva feature em producao:

| Dependencia | Bloqueia | Como mitigar enquanto nao vem |
|---|---|---|
| GA4 ID | Analytics de aquisicao | Instrumentar codigo e deixar env vazio sem quebrar. |
| Meta Pixel ID | Ads/retargeting | Mesmo tratamento do GA4. |
| Firecrawl/SerpAPI/Tavily/API Football | Cobertura automatica ampla de eventos | Curadoria manual + fontes gratuitas. |
| AirROI/GCP BigQuery | Dataset externo para ML | PriceSnapshot proprio + comps. |
| Stripe KYC/Price IDs | Beta pago | Beta gratuito/manual. |
| Stays API/Base URL/token | Modo automatico | Modo recomendacao manual. |
| Mailersend dominio/DKIM | Entregabilidade | Usar e-mail transacional com cautela e testar spam. |
| Advogado/DPAs | Go-live pago amplo | Limitar beta e registrar consentimentos. |

---

## 7. Matriz de cobertura dos gaps da auditoria

| Gap da auditoria | Frente(s) que resolvem | IDs principais |
|---|---|---|
| Promessa "+30%" sem prova | A, E, L, K | A1, A3, E4-E12, L5, K1 |
| Waitlist vazia / prelaunch incompleto | B | B1-B9 |
| GA4/Pixel ausentes | B | B4, B5, B7 |
| Eventos futuros insuficientes | C, I, J | C1-C12, I1, J8 |
| Recomendacoes sem criacao recente | D, C | D1-D12, C1-C10 |
| Apenas 10/29 imoveis com recomendacao futura | D, H | D4-D6, H3 |
| Dataset zerado | E | E1-E12 |
| Sem preco aplicado | E, D | E4, D8-D10 |
| Sem historico de ocupacao | E | E5, E7, E12 |
| Sem MAPE/ROI | E, L | E7, E8, E12, L4, L5 |
| Stays nao pronto | G, K | G1-G12, K5 |
| Billing/Stripe precisa smoke | F, M | F1-F10, M3 |
| Status `peding` legado | F | F7 |
| Imoveis com localidade invalida | H | H1, H2 |
| Empty states fracos | H, D | H3, D6 |
| Admin sem jobs/audit/drill-down | I | I1-I8 |
| Hotfix direto em prod / release process | J, M | J1-J4, M1 |
| Pipeline/health ruidoso | J, C | J5-J8, C9 |
| LGPD/DPAs/consentimentos | K, G | K2-K7, G10 |
| Canal de aquisicao nao validado | B, L | B4-B9, L1-L8 |
| Qualidade frontend/testes E2E | M, H | M1-M7, H8 |

Cobertura: todos os gaps da auditoria tem pelo menos uma frente e tarefas associadas.

---

## 8. Ordem de ataque recomendada para Codex

Se a execucao for feita por mim, a ordem mais eficiente e:

1. Corrigir e instrumentar eventos/recomendacoes, porque isso destrava o core.
2. Criar readiness/admin jobs/alertas, porque evita operar no escuro.
3. Fechar waitlist/analytics/copy, porque libera pre-lancamento.
4. Ativar dataset/preco aplicado, porque cria prova de ROI.
5. Validar Stripe, porque prepara beta pago.
6. Deixar Stays escondido/beta ate credenciais.
7. Fechar staging/smoke/branch protection para reduzir regressao.

---

## 9. Definicao de pronto por feature critica

### Eventos pronto

- Fontes ativas tem `lastSeen`.
- Eventos futuros acima do alvo.
- Admin mostra stale/error.
- Curadoria manual funciona como fallback.
- Eventos entram com coords, source e escopo.

### Recomendacao pronta

- Recomendacoes novas aparecem diariamente ou por job manual.
- Usuario entende motivo da sugestao.
- Usuario entende ausencia de sugestao.
- Aceite/rejeicao/aplicacao ficam registrados.
- Guardrails impedem sugestoes absurdas.

### Dataset pronto

- Snapshot diario ativo.
- Comps persistidos.
- Preco aplicado capturado.
- Ocupacao capturavel.
- Admin quality mostra amostra e gaps.

### Billing pronto

- Price IDs/sync ok.
- Checkout funciona.
- Webhook atualiza DB.
- Quota funciona.
- Cancelamento funciona.
- Status legados saneados.

### Stays pronto para beta privado

- Token criptografado.
- Connect/sync/push/rollback testados.
- Consentimento registrado.
- Guardrails e preview visiveis.
- Allowlist/beta flag ativa.

### Go-live pronto

- Core de valor provado.
- Billing provado.
- Observabilidade e suporte prontos.
- Legal minimo ok.
- Narrativa comercial corresponde aos dados.

---

## 10. Atualizacao de execucao - 15/05/2026

### Resolvido para alfa assistido

- **Recomendacao/preco:** respostas mutantes foram saneadas e cobertas por teste para nao expor entidade de usuario, senha ou relacoes internas.
- **Propriedades/anfitriao:** `/propriedades/user/` e `/propriedades/:id` foram convertidos para DTO publico; achado critico de hash de senha aninhado foi corrigido no codigo.
- **Billing:** matriz Stripe F6.5 foi completada em producao e `/admin/stripe/sync-check` retornou 8/8 OK.
- **Alpha Gustavo:** 9 imoveis com diaria manual R$150, receita media mensal R$4.500 e localidades corrigidas de forma conservadora a partir dos dados internos.
- **Admin/release:** CI ganhou job `product-audit`; Playwright cobre paginas publicas, anonymous access, admin jobs e Meu Plano com quota.
- **Stays:** token encryption configurado e beta privado mantido; pronto para smoke controlado assim que a URL oficial da API Stays for definida.

### Ainda depende de configuracao ou dado real

- `STAYS_API_BASE_URL` precisa ser informado com base oficial/sandbox da Stays.
- GitHub Actions precisa receber `E2E_BASE_URL`, `E2E_API_URL`, `E2E_EMAIL`, `E2E_PASSWORD` para ativar o gate no CI.
- O aprendizado evolutivo precisa de 3 a 5 ciclos reais com resultado observado de reserva/receita; isso nao deve ser simulado como sucesso.
- Apos deploy desta rodada, revalidar em producao que endpoints de propriedades e sugestoes nao retornam `password`, `user` completo ou `usuarioProprietario`.
