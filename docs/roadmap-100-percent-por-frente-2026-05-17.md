# Roadmap 100% por frente - Urban AI

Data: 2026-05-17
Base: `docs/roadmap-4-tracks-2026-05-17.md`, `docs/roadmap-execucao-restante-2026-05-17.md`, `docs/roadmap-consolidado-gaps-manuais-2026-05-17.md` e runbooks operacionais.

Este arquivo transforma os percentuais atuais em uma lista objetiva do que falta para cada frente chegar a 100%. A regra usada aqui e simples: 100% nao significa "o codigo existe"; significa codigo pronto, ambiente certo, evidencia salva, owner definido, smoke executado e criterio de rollback conhecido.

## Regra global de 100%

Uma frente so vira 100% quando todos os itens abaixo estiverem verdadeiros:

- [ ] Codigo ou configuracao necessaria esta na branch que sera promovida.
- [ ] Build, typecheck, lint/testes ou smoke da area passaram.
- [ ] Mudanca esta deployada no ambiente-alvo quando a frente depender de producao.
- [ ] Evidencia foi registrada em `docs/evidence/`, `docs/e2e-reports/` ou no runbook correspondente.
- [ ] Dono operacional esta claro.
- [ ] O que depende de terceiros esta validado no painel externo ou registrado como fora de escopo.
- [ ] Existe criterio de rollback ou fail-closed.

## Separacao entre execucao autonoma e bloqueios externos

### Posso executar sozinho agora

- [ ] Consolidar roadmaps e runbooks.
- [ ] Adicionar testes, scripts de preflight, gates e verificacoes locais.
- [ ] Rodar builds, typechecks e suites locais sem rede externa.
- [ ] Melhorar readiness, mensagens de erro, fail-closed e evidencias sem expor segredos.
- [ ] Criar checklists de smoke para humano executar em Stripe, MailerSend, Stays, Railway, GitHub e Cloudflare.
- [ ] Corrigir bugs de UX, PWA, mobile, admin e host que aparecam em codigo local.
- [ ] Melhorar scripts de scraping/pipeline quando nao exigirem credencial externa.

### Dependem de acesso humano, credencial ou conta externa

- [ ] Merge e deploy em Railway.
- [ ] Branch protection e GitHub Secrets.
- [ ] Stripe Dashboard: KYC, test/live, checkout real, webhooks e portal.
- [ ] MailerSend: dominio, DKIM, SPF, DMARC e envio real.
- [ ] Stays: sandbox/API oficial, token e conta controlada.
- [ ] Google Cloud: Geocoding API/billing/restricoes de chave.
- [ ] Cloudflare/DNS e caixas reais de suporte/privacidade.
- [ ] GA4, Meta Pixel, campanhas, leads reais e cases.

## Ordem de ataque recomendada

1. Fechar gates locais finais.
2. Mergear e deployar a branch atual.
3. Rodar smokes publicos, autenticados, mobile e PWA pos-deploy.
4. Ativar CI obrigatorio, branch protection e secrets autenticados.
5. Rodar Stripe mutante controlado.
6. Validar MailerSend real.
7. Validar Stays em beta privado ou manter explicitamente fora do go-live publico.
8. Resolver Google Geocoding e rodar backfill/reprocess.
9. Coletar 7 dias de dados reais, MAPE e 3 cases.
10. Fechar legal/LGPD/suporte, backup/restore, analytics e go/no-go publico.

---

## 1. Codigo/local geral - 98% para 100%

### Ja existe

- Builds e typechecks principais passaram em rodadas recentes.
- Suites backend, frontend e pipeline estao documentadas como verdes.
- PWA MVP, mobile smoke e auditorias admin/host ja tem base em codigo.

### Passos para 100%

- [ ] Rodar `npm run build` no frontend.
- [ ] Rodar `npx tsc --noEmit` no frontend.
- [ ] Rodar subset Playwright local/mockado do frontend.
- [ ] Rodar `npm test` no backend.
- [ ] Rodar `npm run build` no backend.
- [ ] Rodar auditoria de migrations strict.
- [ ] Rodar `npm run preflight:track3` e `npm run preflight:track3:strict` com env do alvo quando disponivel.
- [ ] Rodar testes do pipeline.
- [ ] Rodar testes do webscraping ou registrar bloqueio de ambiente com causa exata.
- [ ] Salvar evidencia da rodada final.

### Validacao/evidencia

- `docs/evidence/` para status de gates.
- `docs/e2e-reports/` para Playwright/auditorias.
- Logs locais sem segredos.

### Bloqueios externos

- Nenhum para gates locais, exceto testes que dependam de credenciais reais.

### Execucao autonoma

- [ ] Rodar e registrar todos os comandos locais possiveis.
- [ ] Corrigir falhas de teste quando forem de codigo e nao de credencial.

---

## 2. Producao deployada - 84% para 100%

### Ja existe

- Railway saudavel em commit anterior.
- Health publico e smokes de producao ja passaram no commit deployado.
- Branch atual contem fixes posteriores ainda pendentes de producao.

### Passos para 100%

- [ ] Abrir/atualizar PR da branch atual.
- [ ] Garantir CI verde no remoto principal.
- [ ] Mergear para a branch observada pelo Railway.
- [ ] Aguardar deploy `SUCCESS` para backend, frontend, pipeline e webscraping.
- [ ] Confirmar commit deployado igual ao commit esperado.
- [ ] Rodar `/health` e `/health/live` no backend.
- [ ] Rodar smoke publico.
- [ ] Rodar smoke autenticado.
- [ ] Rodar product audit admin/host.
- [ ] Salvar evidencia pos-deploy.

### Validacao/evidencia

- `docs/evidence/railway-status-YYYY-MM-DD.md`.
- `docs/evidence/prod-smoke-YYYY-MM-DD.md`.
- Relatorios em `docs/e2e-reports/`.

### Bloqueios externos

- Acesso GitHub/Railway para merge/deploy.

### Execucao autonoma

- [ ] Preparar checklist de deploy e scripts de smoke.
- [ ] Rodar verificacoes locais antes do merge.

---

## 3. Track 1 Release/CI/Railway - 99% para 100%

### Ja existe

- Release gate e runbooks existem.
- CI ja foi endurecido com subset E2E e fallback de secrets autenticados.
- Health e evidencias de release estao estruturados.

### Passos para 100%

- [ ] Confirmar todos os checks remotos verdes no repo principal.
- [ ] Configurar `E2E_AUTH_EMAIL` e `E2E_AUTH_PASSWORD` em GitHub Secrets.
- [ ] Tornar obrigatorios CI, build frontend, backend, pipeline e release gate.
- [ ] Rodar release gate contra staging ou ambiente controlado.
- [ ] Rodar release gate contra producao apos deploy.
- [ ] Configurar rollback minimo por servico.
- [ ] Registrar owners de release e janela de monitoramento de 30 minutos.

### Validacao/evidencia

- Checks GitHub verdes.
- Screenshot/log de branch protection.
- `docs/runbooks/release-gate.md` preenchido na promocao.

### Bloqueios externos

- Permissao GitHub para branch protection e secrets.
- Acesso Railway para observar deploys.

### Execucao autonoma

- [ ] Verificar scripts e workflows versionados.
- [ ] Rodar release dry-run local quando disponivel.

---

## 4. Track 2 Core de valor - 94% para 100%

### Ja existe

- AskUrban, pricing, ROI, recomendacoes, market intelligence e APIs core avancadas.
- Admin/Alpha e APIs autenticadas responderam em auditorias recentes.
- Geocoder e pricing ja tem melhorias de diagnostico.

### Passos para 100%

- [ ] Resolver Google Geocoding `REQUEST_DENIED` no ambiente alvo.
- [ ] Rodar backfill geocoder em dry-run.
- [ ] Rodar backfill real dos imoveis pendentes.
- [ ] Reprocessar um imovel real do Gustavo.
- [ ] Confirmar recomendacao nova no dashboard com evento futuro e motivo claro.
- [ ] Confirmar limites e monetizacao do AskUrban por plano.
- [ ] Validar coletores com eventos futuros em SP/30d.
- [ ] Coletar snapshots por 7 dias.
- [ ] Criar ground truth de preco aplicado, ocupacao e resultado.
- [ ] Calcular MAPE inicial e registrar criterio de qualidade.

### Validacao/evidencia

- `docs/runbooks/recomendacao-nova-smoke.md`.
- `docs/runbooks/dataset-ground-truth-smoke.md`.
- Evidencia de backfill e reprocess.
- Relatorio MAPE.

### Bloqueios externos

- Google Cloud Geocoding.
- Dados reais de ocupacao/preco.

### Execucao autonoma

- [ ] Fortalecer scripts de backfill/dry-run.
- [ ] Adicionar checks que evitem sucesso falso quando geocoding falhar.
- [ ] Documentar criterio de MAPE e coverage.

---

## 5. Track 3 Monetizacao/integracoes - 97% codigo / 82% operacional para 100%

### Ja existe

- Stripe sync-check em producao retornou matriz 8/8 OK.
- Billing, MailerSend, Stays, suporte/LGPD e preflight estao estruturados.
- Canais publicos tem fallback operacional.

### Passos para 100%

- [ ] Rodar `npm run preflight:track3:strict` no ambiente alvo.
- [ ] Confirmar Stripe test/live sem mistura de modo.
- [ ] Executar checkout test mode.
- [ ] Confirmar webhook atualizando banco.
- [ ] Validar portal do cliente.
- [ ] Validar cancelamento.
- [ ] Validar quota contratada e bloqueio N+1 sem dado parcial.
- [ ] Confirmar MailerSend dominio/DKIM/SPF/DMARC.
- [ ] Enviar email transacional real.
- [ ] Validar Stays beta privado: connect, sync, preview, push manual e rollback.
- [ ] Confirmar owners suporte/LGPD e inbox real.

### Validacao/evidencia

- `docs/runbooks/stripe-billing-smoke.md`.
- `docs/runbooks/mailersend-transactional-smoke.md`.
- `docs/runbooks/stays-beta-private-smoke.md`.
- `docs/runbooks/suporte-lgpd-beta-pago.md`.

### Bloqueios externos

- Stripe Dashboard e webhook real.
- MailerSend/DNS.
- Stays API/token/sandbox.
- Caixas de email e owners.

### Execucao autonoma

- [ ] Melhorar preflight/readiness sem imprimir segredo.
- [ ] Garantir fail-closed em Stays e billing.
- [ ] Adicionar testes para quota/cancelamento quando possivel localmente.

---

## 6. Track 4 UX/Admin/QA/PWA - 98% para 100%

### Ja existe

- Admin read-only 100%.
- PWA MVP em codigo.
- Smoke mobile autenticado passou.
- Host footer fix existe em codigo.

### Passos para 100%

- [ ] Deployar footer fix e PWA.
- [ ] Rerodar auditoria host em producao.
- [ ] Rodar Lighthouse PWA em `https://app.myurbanai.com`.
- [ ] Testar instalacao Android/Chrome.
- [ ] Testar Add to Home Screen iOS/Safari.
- [ ] Rodar smoke mobile autenticado pos-deploy.
- [ ] Rodar auditoria visual desktop/mobile das rotas core.
- [ ] Rodar fluxos mutantes em staging.
- [ ] Promover gates visuais e read-only ao CI obrigatorio.

### Validacao/evidencia

- Relatorios Playwright em `docs/e2e-reports/`.
- Lighthouse PWA.
- Screenshots mobile pos-deploy.

### Bloqueios externos

- Deploy.
- Dispositivos reais ou emulacao confiavel para install.
- Staging para mutacoes.

### Execucao autonoma

- [ ] Melhorar testes Playwright.
- [ ] Corrigir overflow, links e metadata PWA.
- [ ] Adicionar seletores estaveis nos fluxos criticos.

---

## 7. Admin read-only - 100% sustentado

### Ja existe

- `/admin`, `/admin/properties` e detalhe real foram auditados com sucesso.

### Passos para manter 100%

- [ ] Manter admin read-only no release gate.
- [ ] Rerodar auditoria pos-deploy.
- [ ] Garantir que falha de uma API apareca como bloqueio, nao como sucesso parcial.
- [ ] Registrar screenshot/log por rota critica.

### Validacao/evidencia

- Auditoria admin em `docs/e2e-reports/`.

### Bloqueios externos

- Credencial autenticada em CI/producao.

### Execucao autonoma

- [ ] Expandir cobertura read-only quando novas rotas admin entrarem.

---

## 8. Admin mutante/ops - 87% para 100%

### Ja existe

- Jobs, readiness, logs, dashboard admin e runbooks operacionais estao encaminhados.

### Passos para 100%

- [ ] Provisionar staging/fixtures para mutacoes sem risco.
- [ ] Testar import CSV.
- [ ] Testar alteracao de plano/quota.
- [ ] Testar jobs de coleta/reprocess.
- [ ] Testar backup dry-run e restore drill.
- [ ] Testar rollback de operacoes mutantes.
- [ ] Conferir audit logs por acao critica.
- [ ] Confirmar que admin nunca mostra sucesso quando integracao falha.

### Validacao/evidencia

- `docs/runbooks/smoke-tests-operacionais.md`.
- `docs/runbooks/backup-restore.md`.
- Relatorio mutante staging.

### Bloqueios externos

- Ambiente staging e base controlada.
- Acesso a DB/ops.

### Execucao autonoma

- [ ] Criar ou fortalecer testes unitarios para guardrails mutantes.
- [ ] Melhorar mensagens de readiness e erro.

---

## 9. Host read-only - 86% antes do redeploy do footer fix para 100%

### Ja existe

- APIs autenticadas do anfitriao passaram 100%.
- Falha conhecida era CORS/RSC em links legais/contato cross-domain.
- Footer fix foi feito em codigo.

### Passos para 100%

- [ ] Deployar footer fix.
- [ ] Rerodar auditoria host read-only em producao.
- [ ] Confirmar dashboard, propriedades, calendario, plano, integracoes, settings e links legais.
- [ ] Confirmar ausencia de overflow desktop/mobile.
- [ ] Salvar evidencia comparando antes/depois.

### Validacao/evidencia

- `docs/e2e-reports/` com auditoria host.
- Smoke mobile autenticado.

### Bloqueios externos

- Deploy em producao.
- Credencial autenticada.

### Execucao autonoma

- [ ] Rodar localmente testes de links absolutos e rotas host.
- [ ] Adicionar cobertura para links do footer se ainda faltar.

---

## 10. Mobile web - 95% para 100%

### Ja existe

- Smoke autenticado mobile real passou nas rotas core.
- Layouts responsivos e drawers estao em boa forma.

### Passos para 100%

- [ ] Rerodar smoke mobile pos-deploy.
- [ ] Cobrir dashboard, propriedades, detalhe, calendario, plano, integracoes, settings e admin properties.
- [ ] Anexar screenshots mobile.
- [ ] Garantir `overflow-x` zero nas rotas core.
- [ ] Promover gate mobile ao CI quando possivel.
- [ ] Revisar tap targets, foco, contraste e estados vazios mobile.

### Validacao/evidencia

- Relatorio Playwright mobile.
- Screenshots de viewport mobile.

### Bloqueios externos

- Deploy atual.
- Credencial autenticada em CI.

### Execucao autonoma

- [ ] Rodar Playwright mobile local/mockado.
- [ ] Corrigir regressao visual/responsiva encontrada.

---

## 11. PWA instalavel - 90% para 100%

### Ja existe

- Manifest, icons, maskable icon, Apple touch icon, theme color, service worker e offline fallback.
- Gate Playwright PWA/mobile existe.

### Passos para 100%

- [ ] Deployar build com PWA.
- [ ] Confirmar `manifest.webmanifest`, `sw.js`, icons e `offline.html` com HTTP 200 em producao.
- [ ] Rodar Lighthouse PWA.
- [ ] Instalar no Android/Chrome.
- [ ] Validar Add to Home Screen no iOS/Safari.
- [ ] Testar offline fallback.
- [ ] Confirmar service worker sem cache quebrado em deploy novo.
- [ ] Salvar evidencia.

### Validacao/evidencia

- Lighthouse.
- Print/relatorio de instalacao.
- Playwright PWA.

### Bloqueios externos

- Deploy.
- Dispositivo ou emulador confiavel.

### Execucao autonoma

- [ ] Validar assets PWA localmente.
- [ ] Fortalecer teste contra manifest, SW e offline fallback.

---

## 12. Billing/Stripe - 82% para 100%

### Ja existe

- Price IDs de producao passaram sync-check 8/8.
- Codigo de checkout, webhook, portal, quota e cancelamento existe.

### Passos para 100%

- [ ] Documentar modo Stripe usado: test ou live.
- [ ] Confirmar chaves e Price IDs no mesmo modo.
- [ ] Executar checkout Starter mensal.
- [ ] Executar checkout Starter anual.
- [ ] Executar checkout Profissional mensal.
- [ ] Executar checkout Profissional anual.
- [ ] Confirmar webhooks recebidos e persistidos.
- [ ] Validar quota contratada.
- [ ] Validar bloqueio N+1.
- [ ] Validar portal.
- [ ] Validar cancelamento.
- [ ] Confirmar que status legado incorreto nao existe em dados ativos.

### Validacao/evidencia

- `docs/runbooks/stripe-billing-smoke.md` preenchido.

### Bloqueios externos

- Stripe Dashboard.
- Webhook e checkout reais.

### Execucao autonoma

- [ ] Testar servicos localmente com mocks.
- [ ] Checar preflight e mensagens de erro.

---

## 13. MailerSend - 78% para 100%

### Ja existe

- Codigo e preflight estao encaminhados.
- Setup evita token hardcoded e usa env.

### Passos para 100%

- [ ] Verificar dominio no MailerSend.
- [ ] Confirmar DKIM, SPF e DMARC no DNS.
- [ ] Confirmar `MAILERSEND_API_KEY`.
- [ ] Confirmar `EMAIL_SENDER` no dominio aprovado.
- [ ] Confirmar `RESET_PASS_URL` e `FRONT_URL`.
- [ ] Enviar reset de senha real para caixa de teste.
- [ ] Confirmar entrega, remetente, assunto e link.
- [ ] Confirmar status no painel MailerSend sem bounce/reject.
- [ ] Registrar evidencia sem API key.

### Validacao/evidencia

- `docs/runbooks/mailersend-transactional-smoke.md` preenchido.

### Bloqueios externos

- DNS.
- Painel MailerSend.
- Caixa de email real.

### Execucao autonoma

- [ ] Rodar preflight local.
- [ ] Melhorar warnings quando `FRONT_URL` ou sender estiverem inconsistentes.

---

## 14. Stays - 42% para 100%

### Ja existe

- Stays esta em beta privado/fail-closed.
- Readiness e runbook existem.
- Sem env essencial, o conector nao deveria fingir automacao pronta.

### Passos para 100%

- [ ] Obter sandbox/API oficial Stays.
- [ ] Configurar `STAYS_API_BASE_URL`.
- [ ] Configurar `STAYS_TOKEN_ENCRYPTION_KEY`.
- [ ] Confirmar allowlist beta privado.
- [ ] Conectar conta controlada.
- [ ] Confirmar token criptografado em repouso.
- [ ] Sincronizar listings.
- [ ] Associar listing Stays a imovel Urban AI.
- [ ] Gerar preview de preco.
- [ ] Fazer push manual controlado.
- [ ] Registrar `PriceUpdate.success`.
- [ ] Rodar rollback.
- [ ] Registrar `PriceUpdate.rollback`.
- [ ] Testar falha/rejeicao sem falso sucesso.
- [ ] Revisar consentimento e termos antes de automacao.

### Validacao/evidencia

- `docs/runbooks/stays-beta-private-smoke.md` preenchido.

### Bloqueios externos

- Credencial/API/sandbox Stays.
- Conta/listing controlado.

### Execucao autonoma

- [ ] Fortalecer fail-closed, readiness e testes com mocks.
- [ ] Garantir que UI comunique beta privado e nao automacao pronta.

---

## 15. Legal/LGPD/suporte - 68% para 100%

### Ja existe

- Termos e privacidade publicados.
- Canais publicos tem fallback.
- Runbooks e checklist DPA existem.

### Passos para 100%

- [ ] Confirmar `SUPPORT_EMAIL` e `PRIVACY_EMAIL` reais.
- [ ] Confirmar `SUPPORT_OWNER_EMAIL` e `PRIVACY_OWNER_EMAIL`.
- [ ] Enviar mensagem real para suporte.
- [ ] Enviar mensagem real para privacidade/LGPD.
- [ ] Confirmar recebimento e SLA.
- [ ] Revisar termos e politica com juridico/socios.
- [ ] Fechar DPAs prioritarios: Stripe, MailerSend, Railway, Upstash, Sentry e provedores relevantes.
- [ ] Documentar fluxo de solicitacao LGPD.
- [ ] Confirmar retencao, exclusao e exportacao de dados quando solicitado.
- [ ] Registrar owner e processo de incidente.

### Validacao/evidencia

- `docs/runbooks/suporte-lgpd-beta-pago.md`.
- `docs/lgpd/dpa-checklist.md`.
- Evidencia de inbox sem dados sensiveis.

### Bloqueios externos

- Caixas de email.
- Juridico/socios.
- DPAs nos provedores.

### Execucao autonoma

- [ ] Revisar consistencia entre textos publicados e runbooks.
- [ ] Melhorar preflight de owner/canal sem bloquear fallback publico.

---

## 16. Marketing/prelaunch - 82% para 100%

### Ja existe

- Landing, waitlist, copy e funil basico existem.
- Prelaunch mode tem runbook.

### Passos para 100%

- [ ] Confirmar `PRELAUNCH_MODE` e fluxo de `/create`.
- [ ] Confirmar landing publica no dominio correto.
- [ ] Configurar GA4 real.
- [ ] Configurar Meta Pixel real.
- [ ] Confirmar eventos de conversao.
- [ ] Recrutar 5 leads reais iniciais.
- [ ] Registrar origem, status e conversao desses leads.
- [ ] Criar cadencia de contato e criterio de qualificacao.
- [ ] Fechar pelo menos 3 relatos/cases ou entrevistas com potencial ROI.
- [ ] Alinhar campanha paga/organica com mensagem comprovavel.

### Validacao/evidencia

- `docs/runbooks/prelaunch-mode.md`.
- Relatorio de leads/campanha.
- Prints de analytics sem dados sensiveis.

### Bloqueios externos

- GA4/Meta.
- Leads reais.
- Decisao de campanha/orcamento.

### Execucao autonoma

- [ ] Revisar rotas/copy existentes.
- [ ] Adicionar checks para eventos de analytics quando IDs estiverem presentes.

---

## 17. Dados, ROI e cases - 76% para 100%

### Ja existe

- ROI usuario/admin, snapshots e ocupacao manual existem.
- Dataset e recomendacoes ja tem base.

### Passos para 100%

- [ ] Resolver geocoding para completar base.
- [ ] Rodar backfill/reprocess.
- [ ] Coletar 7 dias de snapshots reais.
- [ ] Registrar preco recomendado.
- [ ] Registrar preco aplicado.
- [ ] Registrar ocupacao/reserva real quando disponivel.
- [ ] Calcular MAPE inicial.
- [ ] Definir threshold aceitavel para beta.
- [ ] Criar 3 cases auditados com antes/depois.
- [ ] Separar case publico de dados sensiveis.
- [ ] Confirmar cobertura minima de recomendacoes por imovel beta.

### Validacao/evidencia

- `docs/runbooks/dataset-ground-truth-smoke.md`.
- Relatorio de MAPE.
- Case studies revisados.

### Bloqueios externos

- Dados reais.
- Google Geocoding.
- Anfitrioes/cases.

### Execucao autonoma

- [ ] Preparar estrutura de evidencia e calculo.
- [ ] Garantir que falta de dado gere motivo claro, nao recomendacao falsa.

---

## 18. Webscraping/eventos - 68% para 100%

### Ja existe

- Pipeline, coletores, spiders e fallback manual existem.
- Runbook de saude de cron/coleta existe.

### Passos para 100%

- [ ] Resolver ambiente local/teste do webscraping.
- [ ] Rodar testes dos spiders.
- [ ] Rodar crawls pequenos por fonte principal.
- [ ] Confirmar normalizacao de schema.
- [ ] Confirmar `lastSeen` por fonte menor que 48h.
- [ ] Confirmar volume de 100-200 eventos SP/30d ou criterio atualizado.
- [ ] Confirmar fallback manual se fonte falhar.
- [ ] Confirmar pipeline consumindo eventos.
- [ ] Adicionar alerta de fonte stale.
- [ ] Registrar evidencia de cobertura por fonte.

### Validacao/evidencia

- `docs/runbooks/webscraping-cron-health.md`.
- Relatorio de volume/fonte.

### Bloqueios externos

- Sites de origem, anti-bot e ambiente Railway.
- Credenciais quando fontes exigirem.

### Execucao autonoma

- [ ] Melhorar testes offline/parsers.
- [ ] Corrigir scripts de saude que nao dependam de rede.
- [ ] Documentar bloqueio exato quando anti-bot impedir coleta.

---

## 19. Go-live publico - 63% para 100%

### Ja existe

- Base tecnica forte para alpha assistido e beta controlado.
- Produto, PWA, mobile, admin, billing e runbooks estao avancados.

### Passos para 100%

- [ ] Producao no commit atual.
- [ ] CI obrigatorio e branch protection.
- [ ] Admin/host/product audit completo pos-deploy.
- [ ] PWA installavel validado.
- [ ] Stripe checkout/webhook/portal/cancel/quota validado.
- [ ] MailerSend real validado.
- [ ] Stays validado ou removido explicitamente do escopo publico.
- [ ] Suporte/LGPD com owners, inbox e DPAs.
- [ ] Backup off-site e restore drill.
- [ ] Observabilidade/alertas configurados.
- [ ] GA4/Meta e eventos de conversao.
- [ ] 7 dias de dados reais.
- [ ] MAPE inicial.
- [ ] 3 cases auditados.
- [ ] Go/no-go assinado com evidencias.

### Validacao/evidencia

- `docs/runbooks/release-gate.md`.
- `docs/runbooks/go-live-checklist-final.md`.
- Relatorio final de go/no-go.

### Bloqueios externos

- Todos os externos anteriores: deploy, GitHub, Railway, Stripe, MailerSend, Stays, Google, legal, marketing e dados reais.

### Execucao autonoma

- [ ] Manter checklist final atualizado.
- [ ] Executar tudo que for codigo/teste/doc local.
- [ ] Bloquear go-live publico quando evidencia real ainda estiver ausente.

---

## Checkpoint multiagente desta rodada

Os agentes desta rodada foram separados por responsabilidade para evitar conflito de escrita:

- Planejamento/read-only: consolidar lacunas por frente a partir dos docs existentes.
- Frontend/PWA/UX: atuar somente em `Urban-front-main/**`.
- Backend/integracoes: atuar somente em `urban-ai-backend-main/**`.
- Dados/scraping/ops: atuar somente em `urban-webscraping-main/**`, `urban-pipeline-main/**` e `load-tests/**`.

### Resultado executado

- [x] Arquivo-mestre criado com passos para 100% por frente: `docs/roadmap-100-percent-por-frente-2026-05-17.md`.
- [x] Frontend/PWA/UX: adicionados scripts de gate no `package.json`, cobertura Playwright de PWA/read-only, registro de service worker mais robusto, ajuste mobile do footer e acessibilidade no menu admin.
- [x] Backend/integracoes: ampliado `track3-preflight.js` com readiness offline para Admin/Ops e Dados/ROI/Cases; normalizado resolver de Stripe Price IDs para evitar nomes de env com underscores duplicados; adicionada spec dedicada.
- [x] Dados/scraping/ops: parsing de `MYSQL_URL` ficou robusto para credenciais encoded e schemes invalidos; load tests k6 agora recusam alvo fora de staging/local e exigem senha de teste nos fluxos autenticados.

### Arquivos alterados

- `Urban-front-main/package.json`
- `Urban-front-main/e2e/pwa-mobile.spec.ts`
- `Urban-front-main/e2e/readonly-gates.spec.ts`
- `Urban-front-main/src/app/admin/_components/AdminShell.tsx`
- `Urban-front-main/src/app/componentes/PwaInstaller.tsx`
- `Urban-front-main/src/app/componentes/ui/AppFooter.tsx`
- `urban-ai-backend-main/scripts/track3-preflight.js`
- `urban-ai-backend-main/src/payments/stripe-price-id.resolver.ts`
- `urban-ai-backend-main/src/payments/stripe-price-id.resolver.spec.ts`
- `urban-pipeline-main/raw_data_pipeline/config/database/config.py`
- `urban-pipeline-main/raw_data_pipeline/config/database/credentials.py`
- `urban-pipeline-main/tests/raw_data_pipeline_tests/test_database_config.py`
- `load-tests/config.js`
- `load-tests/smoke.js`
- `load-tests/login-flow.js`
- `load-tests/pricing-recommendation.js`

### Validacoes reportadas pelos agentes

- [x] Frontend: `node_modules\\.bin\\tsc.cmd --noEmit` passou.
- [x] Frontend: Playwright serial de PWA + read-only gates ficou em 11 passed / 1 failed; a falha remanescente foi timeout/`ERR_ABORTED` em `/termos` no Next dev local, sem assercao de overflow falhando.
- [x] Backend: `node scripts\\track3-preflight.js --env=.env.example` rodou e apontou bloqueios esperados de env/segredos ausentes.
- [x] Backend: Jest dedicado passou com 3 suites e 52 testes.
- [x] Backend: `tsc -p tsconfig.json --noEmit` passou.
- [x] Pipeline: `python -m pytest tests\\raw_data_pipeline_tests\\test_database_config.py` passou com 18 testes.
- [x] Pipeline/scraping base: `python -m pytest tests\\test_collector_run_all.py tests\\test_base_collector.py tests\\test_html_venue_base.py` passou com 32 testes.
- [x] Pipeline: `python -m py_compile` nos arquivos de config de banco passou.

### Validacoes rerodadas na integracao

- [x] Frontend: `node_modules\\.bin\\tsc.cmd --noEmit` passou com `NODE_OPTIONS=--max-old-space-size=4096`. Sem heap extra, o Node encerrou por falta de memoria antes de reportar erro de tipo.
- [x] Backend: `node node_modules\\typescript\\bin\\tsc -p tsconfig.json --noEmit` passou.
- [x] Backend: `node node_modules\\jest\\bin\\jest.js --runInBand src/payments/stripe-price-id.resolver.spec.ts src/payments/payments.service.spec.ts src/admin/admin.service.spec.ts` passou com 3 suites e 52 testes.
- [x] Backend: `node scripts\\track3-preflight.js --env=.env.example` rodou e retornou 0/6 ready, com bloqueios esperados por ausencia de segredos/configuracoes reais no arquivo exemplo.
- [x] Pipeline: `python -m pytest tests\\raw_data_pipeline_tests\\test_database_config.py` passou com 18 testes.
- [x] Pipeline: `python -m py_compile raw_data_pipeline\\config\\database\\credentials.py raw_data_pipeline\\config\\database\\config.py` passou.
- [x] Varredura simples de segredos nos arquivos alterados encontrou apenas placeholders, tokens fake de teste e nomes de variaveis.

### Pendencias que continuam externas ou de ambiente

- [ ] Deploy/merge Railway e smokes pos-deploy.
- [ ] Branch protection e GitHub Secrets autenticados.
- [ ] Stripe checkout/webhook/portal/cancel/quota em ambiente controlado.
- [ ] MailerSend real com DNS/DKIM/SPF/DMARC.
- [ ] Stays sandbox/API oficial, connect/sync/preview/push/rollback.
- [ ] Google Geocoding 403, backfill e 7 dias de dados reais.
- [ ] Lighthouse/install PWA em HTTPS e dispositivo/emulador confiavel.
- [ ] `ruff` e `k6` nao estavam disponiveis no ambiente local desta rodada.
- [ ] `npm`/`npx` nao estavam no PATH para o agente de front; foram usados binarios locais quando possivel.
