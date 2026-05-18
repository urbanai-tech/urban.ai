# Roadmap 4 Tracks - 2026-05-17

Status consolidado da squad multiagente para execucao do roadmap Urban AI.

Leitura complementar: `docs/roadmap-consolidado-gaps-manuais-2026-05-17.md`
consolida todos os roadmaps/checklists, recalibra porcentagens por area e
separa gaps de codigo, producao, manual/externo e PWA/mobile.
Plano de execucao restante: `docs/roadmap-execucao-restante-2026-05-17.md`.

Atualizado em 2026-05-17 apos leitura dos artefatos, commits recentes, smoke
de producao e auditoria autenticada com usuario real: `f56b46a..8600d48`.
Este arquivo consolida o "chat" de divisao dos devs sem
alterar o roadmap operacional grande durante a execucao paralela.

## Placar

| Track | Dev | Foco | Pronto | Leitura |
|---|---|---|---:|---|
| Track 1 | Dev 1 | Release, CI, deploy, Railway, coordenacao e evidencias | 99% | PR `urbanai-tech#2` foi mergeado em `main`, checks ficaram verdes, Railway frontend/backend/pipeline/webscraping ficaram `SUCCESS`, health/app 200 e smokes pos-deploy passaram. Falta branch protection e CI autenticado com secrets. |
| Track 2 | Dev 2 | Core de valor: eventos, geocoder, recomendacao, dataset e ROI | 94% | AskUrban drawer + Cmd+J, market intelligence, pricing rules, WCAG Track 2 e correcoes de pricing/geocoder avancaram bem. Auditoria autenticada leu Admin/Alpha e APIs do anfitriao com sucesso. Ainda faltam Geocoding API, backfill, reprocess com Gustavo, coletores e ground truth. |
| Track 3 | Dev 3 | Monetizacao e integracoes: Stripe, MailerSend, Stays, LGPD e suporte | 97% | Termos e privacidade revisados foram publicados no front; suporte/LGPD, Stays readiness, preflight e billing seguem bem estruturados. Falso blocker de suporte/privacidade foi reduzido: canais publicos tem fallback; owners operacionais seguem para confirmacao. Stripe sync-check autenticado em producao retornou 8/8 OK; smokes checkout/webhook/portal/cancel/quota e Stays ainda seguram 100%. |
| Track 4 | Dev 4 | UX, admin, QA, Playwright, design system, PWA e smokes | 99% | Host pos-deploy ficou 100% UI/API, Admin 96% por P2 intermitente no detalhe de imovel, release-gate publico passou, smoke autenticado/mobile passou, PWA endpoints 200 e CDP installability sem erros. Faltam instalacao Android/iOS, limpar P2 admin e mutacoes reais em staging. |

**Prontidao geral:** 99% em codigo/local; 94% em producao deployada.

## Entregas conferidas desde o ultimo placar

| Commit / fonte | Track | Entrega | Estado |
|---|---|---|---|
| smoke prod 2026-05-17 | 1 / 4 | Health API/app e release-gate publico contra producao | `/health` 200 DB ok, public smoke `5 passed/2 skipped`, release-gate publico `14 passed`. |
| smoke autenticado prod 2026-05-17 | 1 / 2 / 4 | Login real, admin e recomendacoes Alpha | Passou: `authenticated-smoke.spec.ts` `1 passed` contra `https://app.myurbanai.com`; usuario autenticou, acessou `/admin` e `/admin/alpha`. |
| auditoria produto prod 2026-05-17 | 2 / 3 / 4 | Auditoria read-only autenticada Admin + Anfitriao | Admin 100% UI/API, Anfitriao 71% geral com APIs 100%; falhas do host sao CORS/RSC em links para `termos`, `privacidade` e `contato` redirecionados para dominio diferente. Relatorio em `docs/e2e-reports/2026-05-17T21-17-29/report.md`. |
| host footer 2026-05-17 | 4 | Correcao CORS/RSC nos links legais do app autenticado | `AppFooter` passou a apontar `Termos`, `Privacidade` e `Contato` direto para o dominio publico configurado, sem prefetch interno do Next. Build passou e navegador local confirmou hrefs absolutos. |
| auditoria admin properties 2026-05-17 | 4 | Auditoria read-only agora cobre `/admin/properties` e detalhe real | Script passou a testar lista e detalhe dinamico de imovel; auditoria admin prod passou 100% UI/API. Relatorio em `docs/e2e-reports/2026-05-17T21-28-45/report.md`. |
| CI secrets 2026-05-17 | 1 / 4 | Product audit aceita o mesmo par de secrets do smoke autenticado | `e2e-product-audit.js` agora aceita `E2E_EMAIL`/`E2E_PASSWORD` ou `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD`; `ci.yml` usa fallback para evitar duplicar secrets. |
| Prefect local 2026-05-17 | 1 / pipeline | Remocao do endpoint externo Lumina do fluxo local/testes | Endpoint Lumina removido do repo, funcoes puras desacopladas de `@task`, `main_flow` mantido para deployment legado; pytest do pipeline passou `47 passed`. |
| `8600d48` | 4 / 1 | Login post-login estabilizado e promovido ao gate CI mockado | Feito em codigo e pushado nos dois remotos. |
| `74e6bf7` | 4 / 1 | Subset E2E local ampliado: dashboard, email, waitlist, login, logout, billing, pricing, Stays | `22 passed`, `1 skipped` no registro de evidencia. |
| `1d041a8` | 3 | Termos de uso e politica de privacidade revisados publicados no front | Feito em codigo; validar revisao juridica final/DPAs. |
| `0aed7f4` | 1 / 2 | Gaps automaticos de release fechados: migrations audit, logs Mailer, erros Google Maps, geocoder e pricing shadow/adaptive | Feito em codigo; producao ainda nao esta nesse commit. |
| `2efbc7b` | 1 | Health endpoints, release gate, evidencia automatizada, backup MySQL e auditoria de migrations | Feito em codigo; branch protection/staging continuam pendentes. |
| `2cd76e4` | 2 / 4 | WCAG Track 2: portfolio, pricing-rules, market e componentes AskUrban/design system | Feito; 22 arquivos auditados, 14 alterados, 1 novo `SkipLink`. |
| `62bf855` | 2 | AskUrban drawer, provider, upgrade modal, atalho Cmd+J e API de suporte | Feito em codigo; smoke autenticado real passou, falta fechar criterio de monetizacao/limite. |

## Verificacao local complementar - Codex 2026-05-17

Rodada feita sem credenciais externas, em porta local isolada `3100`, para nao interferir nos outros chats/dev servers.

| Check | Resultado |
|---|---|
| Backend `tsc --noEmit` | Passou. |
| Backend Jest completo | Passou: 27 suites, 213 testes. |
| Backend build Nest | Passou; `dist/main.js` gerado. |
| Auditoria de migrations strict | Passou: 26/26 entidades cobertas, 0 suspeitas. |
| Backup MySQL dry-run | Passou; nenhum comando real executado. |
| Release evidence dry-run | Passou para `878bdc7`. |
| Frontend `tsc --noEmit` | Passou. |
| Frontend `next build` | Passou; 57 rotas geradas, apenas warnings de lint ja conhecidos. |
| PWA MVP local | Passou: `manifest.webmanifest`, `sw.js` e `offline.html` retornaram 200 no build standalone; home contem manifest/theme/PWA installer. |
| Smoke mobile autenticado prod | Passou com usuario real: dashboard, properties, my-plan, integrations e admin properties sem overflow horizontal. |
| Stripe sync-check prod | Passou autenticado: 8/8 Price IDs OK, `missing: 0`, `problems: 0`. |
| E2E mockado local CI subset | Passou: 22 testes, 1 skip planejado. |
| Webscraping pytest | Bloqueado localmente: `PermissionError` ao carregar pytest da `.venv`. Nao houve instalacao/recriacao de ambiente. |
| Pipeline pytest | Passou apos remover o endpoint Prefect externo hardcoded e desacoplar funcoes puras do engine Prefect: 47 testes, 5 warnings. |
| Smoke autenticado producao | Passou com usuario real: login, `/admin` e `/admin/alpha`; 1 teste Playwright verde. |
| Auditoria produto autenticada | Admin 100%, Anfitriao 71%; APIs autenticadas do anfitriao 100%, mas quatro rotas UI registraram CORS/RSC por links legais/contato cross-domain. |
| Host footer local | Passou no navegador local: footer do dashboard renderiza hrefs absolutos para `https://myurbanai.com/termos`, `/privacidade` e `/contato`; `next build` e `tsc --noEmit` passaram. |
| Auditoria admin properties prod | Passou: Admin 100% com `/admin/properties` e `/admin/properties/{id}` incluidos no auditor read-only. |

## O que falta para 100%

| Area | Falta | Status |
|---|---|---|
| Deploy/release | Levar a branch atual para `main`/Railway e reconferir health pos-deploy. | Pode seguir; depende de merge/deploy. |
| CI obrigatorio | Tornar CI, release gate e smoke autenticado obrigatorios na branch principal. | Pode seguir; configuracao GitHub. |
| Segredos de CI | Salvar `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` no GitHub Secrets e rodar smoke/auditoria autenticados no pipeline. | Codigo ja aceita esse par unico; falta gravar no GitHub com aprovacao explicita. |
| Host UI | Deployar a correcao dos links `termos`, `privacidade` e `contato` e rerodar auditoria host em producao. | Corrigido em codigo; pendente de deploy/reteste. |
| PWA/mobile | Instalar em Android/iOS real. | PWA em producao: manifest/icons/SW/offline 200, Playwright passou e CDP installability sem erros. |
| Geocoder | Ativar/ajustar Google Geocoding API; producao ainda apontou `HTTP 403 REQUEST_DENIED`. | Travado por configuracao externa do Google Cloud. |
| Dados reais | Backfill geocoder, reprocess de imovel real do Gustavo, snapshots por 7 dias, coletores `lastSeen < 48h` e ground truth. | Pode seguir depois do Geocoding; parcialmente dependente de dados reais. |
| Monetizacao | Rodar Stripe checkout/webhook/portal/cancel/quota, MailerSend real e Stays sandbox/API oficial. | Stripe Price IDs ja confirmados 8/8 em prod; Stays depende de credencial/API oficial. |
| QA mutante | Fluxos que alteram plano, custo, import CSV, push Stays e rollback em staging. | Pode seguir em staging/fixtures; nao rodar destrutivo em prod. |
| Webscraping | Resolver `PermissionError` da `.venv` local para rodar pytest. | Travado por ambiente local, nao por codigo validado nesta rodada. |
| Prefect | Nao ha mais dependencia do Prefect Lumina para testes/dev. Prefect fica opcional apenas para deployment legado via `PREFECT_API_URL`/profile. | Resolvido para nao travar desenvolvimento. |

## Track 1 - Dev 1

### Bloqueios

- CI/local gate avancou ate `8600d48`, com login post-login promovido e subset E2E mockado expandido.
- Railway producao segue ativo em `f56b46a`; os commits `2efbc7b..8600d48` ainda precisam chegar em `main`/producao.
- Smoke autenticado real passou manualmente; falta gravar os segredos no CI sem expor senha em arquivo.
- Branch protection ainda precisa tornar CI/Release Gate obrigatorios em `main`.
- Artefato incremental de build `Urban-front-main/tsconfig.tsbuildinfo` foi restaurado para nao entrar no commit.

### Entregas

- Health endpoints e `/health/live` adicionados no backend.
- `release-gate.yml`, `scripts/release-evidence.js`, auditoria de migrations e runbook de backup entraram.
- CI passou a rodar subset E2E mockado maior, incluindo login/post-login reparado.
- Evidencia Railway/prod de 17/05 mostra prod saudavel em `f56b46a`: `/health` e `/health/live` 200, DB ok, 0 respostas 5xx na amostra.
- Smoke publico prod passou: `5 passed`, `2 skipped`; release-gate publico prod passou: `14 passed`.
- Smoke autenticado prod passou com usuario real: login, `/admin` e `/admin/alpha`.

### Proximas acoes

1. Abrir/atualizar PR de `feat/dev2-track2-semana-7-8-askurban`.
2. Conferir deploy/health no Railway apos merge/deploy dos commits novos.
3. Configurar `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` no GitHub Secrets e rodar smoke autenticado no CI.
4. Tornar branch protection/release gate obrigatorios.
5. Preparar evidencia do CI verde e do Release Gate para o handoff.

## Track 2 - Dev 2

### Bloqueios

- Geocoding API precisa ser ativada no Google Cloud antes do backfill real.
- Recomendacao nova e Alpha passaram no smoke autenticado; falta validar limites/monetizacao AskUrban por plano.
- Dataset/ROI ainda depende de preco aplicado, ocupacao/reserva real e snapshots por 7 dias.
- Coletores precisam comprovar `lastSeen < 48h` e eventos futuros SP/30d.
- Railway evidencia ainda aponta Google Geocoding `HTTP 403 REQUEST_DENIED`.

### Entregas

- AskUrban drawer + provider + upgrade modal + atalho Cmd+J entregues.
- Telas Track 2 semanas 5-8 ganharam market intelligence, pricing rules e polimento WCAG.
- Auditoria WCAG Track 2 fechou sem erro de tipo em `tsc --noEmit`.
- Geocoder ficou mais diagnostico para erros Google Maps e pricing shadow/adaptive teve ajustes/testes.
- Auditoria autenticada confirmou Admin/Alpha e APIs do anfitriao: propriedades, assinatura, ROI e Stays responderam 200.

### Proximas acoes

1. Rodar backfill geocoder em dry-run e depois real.
2. Decidir limites por plano e criterio de monetizacao do AskUrban.
3. Validar coletores e health operacional.
4. Reprocessar um imovel real do Gustavo.
5. Registrar preco aplicado, ocupacao/resultado e evidencia do gate M2.

## Track 3 - Dev 3

### Bloqueios

- Smoke Stripe ponta a ponta ainda nao foi executado em ambiente real de teste.
- KYC/separacao test-live precisa confirmacao.
- MailerSend precisa entrega real validada.
- Stays depende de URL/API oficial ou sandbox.
- LGPD/suporte tem triagem, painel, contrato de donos operacionais, termos/privacidade publicados e preflight; falta validar canais reais, DPAs e donos no ambiente.

### Entregas

- Termos de uso e politica de privacidade revisados foram publicados nas rotas publicas.
- Conteudo legal saiu de DOCX para `legalContent.ts`, reduzindo divergencia entre docs e site.
- Track 3 segue com preflight versionado e dashboard de readiness para Stripe, MailerSend, Stays e suporte.
- Auditoria autenticada confirmou `/payments/getSubscription`, `/roi/me` e `/stays/listings` com status 200.

### Proximas acoes

1. Rodar runbook Stripe em staging/test mode.
2. Fazer readiness MailerSend com dominio, DKIM e envios reais.
3. Executar smoke Stays beta privado.
4. Rodar `npm run preflight:track3:strict` com as envs do ambiente alvo.
5. Validar canais suporte/privacidade reais, DPAs prioritarios e preencher `SUPPORT_OWNER_EMAIL`/`PRIVACY_OWNER_EMAIL`.

## Track 4 - Dev 4

### Bloqueios

- Release gate visual/auditoria ainda nao e obrigatorio.
- Fluxos mutantes reais nao foram fechados.
- Smoke autenticado real passou; CORS/RSC em links legais/contato do host foi corrigido em codigo e precisa reteste apos deploy.
- Auditor E2E agora cobre `/admin/properties` e um detalhe dinamico; ainda falta ampliar os fluxos mutantes.
- Subset E2E CI e majoritariamente mock/read-only; ainda nao substitui staging real.

### Entregas

- WCAG 2.1 AA Track 2: 22 arquivos auditados, 14 modificados, 1 `SkipLink.tsx` novo, zero erro de tipo.
- Subset E2E local expandido para 22 testes verdes e 1 skip esperado.
- Login post-login reparado e promovido ao CI.
- Evidencia de estabilidade E2E documentada em `docs/evidence/e2e-stability-2026-05-17.md`.
- Smokes publicos de producao foram estabilizados contra banner de cookies e passaram.
- Admin autenticado auditado com 100% UI/API; auditor atualizado tambem passou com `/admin/properties` e detalhe real.
- Anfitriao estava 71% por CORS/RSC em rotas UI, com APIs 100%; bug corrigido em codigo no `AppFooter`.

### Proximas acoes

1. Deployar o patch do `AppFooter` e rerodar auditoria host/prod.
2. Manter `/admin/properties` e detalhe dinamico no gate read-only.
3. Rodar smoke mutante em staging.
4. Automatizar auditoria visual desktop/mobile.
5. Estabilizar seletores e `data-testid` nos fluxos criticos.

## Regra de Atualizacao

A cada rodada, atualizar:

- percentual por track;
- bloqueio principal;
- proxima acao;
- impacto no placar geral.
