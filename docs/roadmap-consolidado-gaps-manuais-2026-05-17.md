# Roadmap consolidado, gaps manuais e PWA/mobile - 2026-05-17

Este documento consolida os roadmaps e checklists existentes para responder quatro perguntas:

- quanto esta pronto hoje;
- o que falta para 100%;
- o que esta travado por acesso humano, credencial, conta externa ou decisao;
- o estado real de PWA/mobile.

## Leitura executiva

| Dimensao | Pronto | Leitura honesta |
| --- | ---: | --- |
| Codigo/local gates | 98% | Build do front passou, typechecks front/backend passaram, PWA MVP entrou, pipeline Python passou, produto/admin audit foi ampliado e o bug de CORS/RSC do footer host foi corrigido em codigo. |
| Producao deployada | 84% | Railway esta saudavel em todos os servicos principais, mas producao ainda esta no commit `f56b46a`; as correcoes atuais ainda precisam merge/deploy e smoke pos-deploy. |
| Alpha assistido | 91% | Usuario real validado para smokes, admin 100% UI/API, host com APIs 100%; falta revalidar UI host apos deploy do footer e rodar fluxos mutantes controlados. |
| Beta pago controlado | 80% | Billing, MailerSend, Stays e suporte tem bastante codigo/runbook; Stripe Price IDs passaram 8/8 em producao, mas Stays/owners e smokes mutantes ainda precisam validacao. |
| Go-live publico | 63% | PWA, mobile real e Stripe readiness melhoraram, mas ainda depende de cases reais, dados/ROI auditaveis, analytics, legal/LGPD, branch protection, backup/restore e maturidade de operacao. |
| PWA/mobile combinado | 93% | PWA MVP entrou em codigo e smoke mobile autenticado passou em producao; falta deploy do PWA, Lighthouse e teste de instalacao Android/iOS. |

**Resumo:** desenvolvimento pode seguir. O que realmente trava 100% nao e Prefect nem Lumina; sao deploy/CI obrigatorio, credenciais/contas externas, dados reais, smokes mutantes controlados e PWA minimo se a experiencia mobile for tratada como app.

## Fontes revisadas

| Fonte | Uso atual |
| --- | --- |
| `docs/roadmap-4-tracks-2026-05-17.md` | Fonte operacional mais atual por dev/track. |
| `docs/roadmap-implementacao-gaps-produto-2026-05-14.md` | Fonte macro de produto; algumas porcentagens antigas foram recalibradas aqui. |
| `docs/go-live-manual-checklist.md` | Checklist humano/externo; ainda relevante para Stripe, MailerSend, Google, Stays, GitHub, backup, DNS e LGPD. |
| `docs/runbooks/track3-handoff-manual.md` | Ordem manual mais clara para monetizacao/integracoes. |
| `docs/e2e-reports/2026-05-17T21-17-29/report.md` | Auditoria autenticada Admin + Anfitriao; Admin 100%, Host 71% antes do fix de footer. |
| `docs/e2e-reports/2026-05-17T21-28-45/report.md` | Auditoria Admin ampliada com `/admin/properties` e detalhe real; Admin 100%. |
| `docs/auditoria-ui-ux-*-2026-05-16.md` | Base de UX/design e validacoes visuais recentes. |
| Railway MCP | Producao saudavel, mas ainda no commit `f56b46a`. |
| GitHub MCP | Status Railway verde em `main`; commit de feature atual ainda sem statuses combinados. |

## Placar por area

| Area | Pronto | O que ja temos | O que falta para 100% |
| --- | ---: | --- | --- |
| Track 1 - Release, CI, Railway | 88% | Railway verde, health OK, gates locais passaram, CI ja tem fallback para `E2E_AUTH_*`. | Merge/deploy da branch atual, branch protection, GitHub Secrets, smoke autenticado no CI e restore drill. |
| Track 2 - Core de valor | 86% | Recomendacoes, market/pricing, ROI, admin drill-down e APIs autenticadas respondendo. | Google Geocoding 403, backfill, reprocess Gustavo, coletores vivos e ground truth de ocupacao/preco. |
| Track 3 - Monetizacao/integracoes | 78% | Billing, Stripe resolver, MailerSend, Stays beta privado, suporte/LGPD e preflight existem em codigo; suporte/privacidade publicos agora usam fallback sem falso blocker; Stripe sync-check prod retornou 8/8 OK. | Stripe checkout/webhook/portal/cancel/quota, Stays API/token se ausentes no alvo, owners operacionais e MailerSend dominio/envio real. |
| Track 4 - UX, Admin, QA | 96% | Admin 100% UI/API, auditoria admin properties, footer host corrigido em codigo, PWA MVP em codigo, smoke mobile autenticado real passou, typecheck/build OK. | Deploy/reteste do host, Lighthouse PWA, instalacao mobile e fluxos mutantes em staging. |
| Admin read-only | 100% | `/admin`, `/admin/properties` e detalhe real auditados com sucesso. | Manter no CI e repetir pos-deploy. |
| Admin mutante/ops | 87% | Jobs, audit logs, readiness e operacao estao estruturados. | Rodar mutacoes controladas com fixtures/staging e comparar KPIs com banco. |
| Billing/Stripe | 82% | Codigo forte, chaves locais presentes, portal/checkout/webhook estruturados; `/admin/stripe/sync-check` prod confirmou 8/8 Price IDs OK. | Smoke checkout/webhook/portal/cancel/quota. |
| MailerSend | 78% | API key local presente e preflight indicou modulo pronto. | Configurar dominio/DKIM/SPF/DMARC, `FRONT_URL` e envio real monitorado. |
| Stays | 42% | Beta privado, fail-closed, consentimento/runbooks e readiness admin. | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, sandbox/oficial, connect/sync/preview/push/rollback. |
| Legal/LGPD/suporte | 68% | Termos/privacidade publicados no front, canais publicos com fallback do app, triagem e runbooks encaminhados. | Owners em env alvo, inbox testado, DPAs, processo LGPD e revisao final. |
| Marketing/prelaunch | 82% | Landing, waitlist, copy segura e funis basicos. | GA4/Meta reais, 5 leads reais, campanha/canais e evidencias de conversao. |
| Dados, ROI e cases | 76% | Snapshots, ROI usuario/admin e ocupacao manual existem. | 7 dias de dados reais, MAPE inicial, 3 cases auditados e cobertura de recomendacoes. |
| Webscraping/eventos | 68% | Pipeline/coletor/fallback manual e chaves locais de Gemini. | Resolver execucao do ambiente, lastSeen, 100-200 eventos SP/30d e monitoramento de stale data. |
| Mobile web | 95% | Shells responsivos, drawer mobile, cards/tabelas responsivas e smoke autenticado mobile real em producao sem overflow horizontal nas rotas core. | Manter gate no CI e anexar screenshots pos-deploy. |
| PWA installavel | 90% | Manifest, icons, apple touch icon, theme color, service worker, offline fallback e gate Playwright entraram e foram verificados localmente. | Deploy, Lighthouse PWA, teste de instalacao Android/iOS e ajustes finos. |

## Gaps manuais e externos

| Prioridade | Gap | Estado | Quem/onde | Trava |
| --- | --- | --- | --- | --- |
| P0 | Deploy da branch atual | Pendente | GitHub/Railway | Producao ainda nao tem footer fix, Prefect fix, auditor admin ampliado e roadmap atualizado. |
| P0 | GitHub Secrets de E2E | Pendente | GitHub repo settings | CI nao consegue rodar smoke autenticado sem `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` ou equivalentes. |
| P0 | Branch protection | Pendente | GitHub | Release gate nao fica obrigatorio. |
| P0 | Stripe smoke mutante | Parcial | Stripe + admin sync-check | Price IDs ja passaram 8/8 em producao; falta checkout/webhook/portal/cancel/quota. |
| P0 | Stays API/token | Bloqueado no preflight strict | Stays + Railway/backend env | Modo automatico e beta privado real. |
| P0 | Support/privacy owners | Parcial | Railway/backend env + caixas de email | Canais publicos tem fallback; owners operacionais ainda precisam confirmacao no alvo. |
| P0 | Google Geocoding | Bloqueado por 403 em evidencia Railway | Google Cloud | Backfill, coordenadas e qualidade de recomendacao. |
| P1 | MailerSend dominio/DKIM/SPF | Parcial | MailerSend + DNS | Envio transacional confiavel. |
| P1 | `FRONT_URL` | Warning no preflight | Railway/backend env | Links de email e redirecionamentos consistentes. |
| P1 | GA4/Meta Pixel reais | Pendente | Google/Meta + front env | Medicao de campanha/prelaunch. |
| P1 | Backup off-site e restore drill | Pendente/nao confirmado | Railway + storage externo | Recuperacao de desastre. |
| P1 | Staging real para mutacoes | Pendente/nao confirmado | Railway/GitHub | Testar Stripe/Stays/ops sem risco em prod. |
| P1 | Cases e ground truth | Pendente | Operacao/manual + produto | Venda publica com prova. |
| P2 | DPAs/revisao juridica | Pendente | Socios/juridico | Go-live amplo e governanca. |
| P2 | CNPJ/KYC Stripe live | Pendente | Socios/Stripe | Recebimento em producao. |

## Credenciais e segredos conferidos

Nao gravei valores sensiveis neste documento.

| Item | Estado |
| --- | --- |
| Usuario para smoke autenticado | Ja foi passado no chat e validado em auditorias reais. A senha nao deve ser documentada. |
| `Urban-front-main/.env` | `NEXT_PUBLIC_SENTRY_DSN` e `NEXTAUTH_SECRET` presentes localmente. |
| `urban-ai-backend-main/.env` | Google Maps, Gemini, Stripe secret/public/webhook, MailerSend e JWT presentes localmente. |
| `urban-webscraping-main/.env` | Gemini presente localmente. |
| Railway backend | MCP indicou 67 variaveis definidas, mas valores/nomes nao foram despejados por seguranca; precisa auditoria mascarada se quisermos confirmar par a par. |
| Pendentes no preflight local | Price IDs Stripe nao estao no `.env` local, mas producao confirmou 8/8 no banco/Stripe; Stays API/base/encryption e owners operacionais seguem sem evidencia local; `FRONT_URL` e canais publicos viraram warnings. |
| Segredos em docs/codigo | Busca por senha passada e URL antiga de Prefect/Lumina nao encontrou ocorrencias nos docs/front/pipeline/.github. |

## PWA/mobile

**Mobile web: 95%.** O produto ja tem bastante estrutura responsiva: shells de admin/anfitriao com drawer, paddings mobile, cards e tabelas responsivas. O smoke autenticado mobile real passou em producao cobrindo dashboard, propriedades, plano, integracoes e admin properties sem overflow horizontal.

**PWA installavel: 90%.** Agora existe manifest, icons dedicados, maskable icon, apple touch icon, metadata no layout, theme color, service worker e fallback offline. O smoke local do build confirmou `manifest.webmanifest`, `sw.js` e `offline.html` com HTTP 200 e a home contendo manifest/theme/PWA installer. Tambem entrou gate Playwright `pwa-mobile.spec.ts`. Falta deploy, Lighthouse e teste de instalacao em mobile real.

Para chamar de PWA pronto em producao, falta:

- deployar o build atual;
- rodar Lighthouse PWA em `https://app.myurbanai.com`;
- instalar em Android/Chrome;
- validar Add to Home Screen em iOS/Safari;
- repetir smoke mobile autenticado real.

## Estado Railway/GitHub

| Sistema | Estado |
| --- | --- |
| Railway backend | Deploy `SUCCESS` em producao no commit `f56b46a`. |
| Railway front | Deploy `SUCCESS` em producao no commit `f56b46a`. |
| Railway webscraping | Deploy `SUCCESS` em producao no commit `f56b46a`. |
| Railway pipeline | Deploy `SUCCESS` em producao no commit `f56b46a`. |
| Branch atual local | `feat/dev2-track2-semana-7-8-askurban`; branch publicada nos dois remotes. |
| GitHub statuses | `urbanai-tech` ja passou backend, frontend build, pipeline, release dry-run e scraping; Playwright publico/mocked ainda deve ser conferido antes do merge. `Gustavogm9` esta bloqueado por billing/spending do GitHub Actions. |

## Ordem recomendada para fechar o restante

1. Merge/deploy da branch atual para Railway.
2. Retestar health, smoke publico, smoke autenticado e product audit completo em prod.
3. Gravar GitHub Secrets de E2E e tornar CI/release gate obrigatorios.
4. Rodar Track 3 preflight no ambiente alvo e preencher Price IDs, suporte/privacidade/owners, Stays e `FRONT_URL`.
5. Validar Stripe em test mode: checkout, webhook, portal, cancelamento e quota.
6. Configurar MailerSend dominio/DKIM/SPF/DMARC e enviar email real.
7. Resolver Google Geocoding 403 e rodar backfill/reprocess do usuario Gustavo.
8. Ativar staging ou fixtures para mutacoes controladas de admin, billing, ocupacao, import CSV e Stays.
9. Implementar PWA minimo ou decidir explicitamente que a meta atual e apenas mobile web.
10. Coletar 7 dias de dados reais, MAPE inicial e 3 cases auditados antes do go-live publico.

## O que esta travado versus o que pode seguir

| Item | Situacao |
| --- | --- |
| Desenvolvimento de produto, QA, UX e docs | Pode seguir. |
| Host footer bug | Corrigido em codigo; falta deploy/reteste. |
| Prefect Lumina | Removido dos pontos que travavam testes/desenvolvimento; pipeline local passou. |
| Beta pago | Travado por Stripe Price IDs/smoke, suporte/LGPD e ambiente alvo. |
| Stays automatico | Travado por API/base/token/sandbox e smoke real. |
| Go-live publico | Travado por prova de valor, cases, legal, suporte, observabilidade e billing live. |
| PWA | Implementado em codigo; falta deploy, Lighthouse e instalacao em Android/iOS. |

## Decisao sugerida

O caminho mais seguro e tratar os proximos dias como fechamento de **alpha assistido + beta pago controlado**, nao como go-live publico amplo. O produto esta bem perto para operacao acompanhada, mas ainda precisa que as dependencias manuais saiam do caminho e que os smokes reais parem de depender de execucao manual avulsa.
