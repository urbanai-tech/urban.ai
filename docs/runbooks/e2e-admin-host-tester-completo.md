# E2E completo Admin + Host para tester

Atualizado em 2026-05-17.

Este roteiro cobre a auditoria read-only completa do Admin e do Host, mais os
smokes complementares de PWA/mobile. Ele foi desenhado para rodar sem gravar
senha em arquivo, sem expor token em log e sem executar fluxo destrutivo em
producao.

## Escopo

| Area | O que cobre | Tipo |
| --- | --- | --- |
| Admin UI | `/admin`, dashboard, usuarios, alpha, ROI, auditoria, contatos, waitlist, eventos, coletores, jobs, cobertura, financeiro, pricing config, Stays, funil, qualidade e propriedades | Read-only |
| Admin API | Endpoints usados pelas telas acima, incluindo `/admin/stripe/sync-check` e `/admin/properties` | Read-only |
| Host UI | login, post-login, dashboard, onboarding, planos, my-plan, ROI, integracoes Stays e event-log | Read-only |
| Host API | propriedades, assinatura, ROI e listings Stays | Read-only |
| Mobile | rotas core autenticadas em viewport mobile, sem overflow horizontal | Read-only |
| PWA | manifest, icons, service worker, offline fallback e metadata | Read-only |

Fluxos mutantes como checkout Stripe, cancelamento, import CSV, push Stays,
alteracao de role e disparo de jobs devem ser rodados em staging/fixture
seguindo runbooks especificos.

## Pre-requisitos

1. Node e dependencias instaladas em `Urban-front-main`.
2. Acesso ao app alvo, preferencialmente `https://app.myurbanai.com`.
3. API alvo, preferencialmente `https://urbanai-production-85fd.up.railway.app`.
4. Usuario tester/admin autorizado.
5. Nao salvar senha em `.env`, docs, prints ou mensagens de erro.

## Variaveis

No PowerShell:

```powershell
$env:E2E_BASE_URL="https://app.myurbanai.com"
$env:E2E_API_URL="https://urbanai-production-85fd.up.railway.app"
$env:E2E_EMAIL="<email-do-tester>"
$env:E2E_PASSWORD="<senha-informada-fora-do-repo>"
$env:E2E_AUDIT_MODE="all"
```

Alternativa compativel com CI:

```powershell
$env:E2E_AUTH_EMAIL="<email-do-tester>"
$env:E2E_AUTH_PASSWORD="<senha-informada-fora-do-repo>"
```

## Rodada principal: auditoria Admin + Host

Diretorio:

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\Urban-front-main"
node .\scripts\e2e-product-audit.js
```

Saida esperada:

- relatorio `.md` e `.json` em `docs/e2e-reports/<timestamp>/`;
- score separado para Admin e Host;
- lista de rotas e APIs com `ok: true`;
- nenhum `Application error`, `Internal Server Error`, `Acesso negado`,
  redirecionamento inesperado para login ou erro visual critico.

## Smokes Playwright complementares

Rodar depois da auditoria principal:

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\Urban-front-main"
npm run test:e2e -- authenticated-smoke.spec.ts authenticated-mobile-smoke.spec.ts pwa-mobile.spec.ts
```

Para testar contra build local em vez de producao, iniciar app local primeiro e
ajustar `E2E_BASE_URL` para `http://127.0.0.1:3000`.

## Checklist manual Admin

| Rota | O que conferir | Aceite |
| --- | --- | --- |
| `/admin` | home admin, cards de navegacao e ausencia de erro visual | Carrega sem erro |
| `/admin/dashboard` | KPIs, readiness, billing, dados e alertas coerentes | Sem alerta falso conhecido |
| `/admin/users` | tabela, filtros, paginacao e roles | Lista aparece |
| `/admin/alpha` | cohort alpha e recomendacoes | Dados ou estado vazio claro |
| `/admin/roi` | ROI agregado | Carrega sem 500 |
| `/admin/audit-logs` | logs e filtros | Sem vazamento de segredo |
| `/admin/contacts` | submissions de contato | Estado claro |
| `/admin/waitlist` | stats e lista | Estado claro |
| `/admin/events` | analytics e inventario | Contagens coerentes |
| `/admin/events/new` | formulario manual | Nao submeter em prod |
| `/admin/events/import` | import CSV | Nao submeter em prod |
| `/admin/collectors-health` | saude dos coletores | Stale data destacado |
| `/admin/jobs` | historico de jobs | Nao disparar job em prod sem aprovacao |
| `/admin/coverage` | regioes/cobertura | Estado claro |
| `/admin/finance` | custos e financeiro | Sem segredo exposto |
| `/admin/pricing-config` | planos e Stripe sync-check | Price IDs sem problemas |
| `/admin/stays` | readiness Stays | Fail-closed quando nao configurado |
| `/admin/funnel` | funil | Dados ou vazio claro |
| `/admin/quality` | qualidade pricing e ocupacao | Gate explicavel |
| `/admin/properties` | lista de imoveis | Lista ou vazio claro |
| `/admin/properties/{id}` | detalhe dinamico de imovel real | Saude do imovel legivel |

## Checklist manual Host

| Rota | O que conferir | Aceite |
| --- | --- | --- |
| `/` | login | Autentica com usuario tester |
| `/post-login` | roteamento por estado do usuario | Vai para destino correto |
| `/dashboard` | recomendacoes, propriedades e cards principais | Sem erro visual |
| `/properties` | lista e acoes de propriedades | Sem overflow mobile |
| `/portfolio` | calendario/portfolio quando disponivel | Estado claro |
| `/onboarding` | fluxo inicial | Sem bloquear usuario ja ativo |
| `/plans` e `/plans/v2` | planos | Nao iniciar checkout real sem aprovacao |
| `/my-plan` | assinatura atual | Dados coerentes |
| `/my-roi` | ROI do anfitriao | Dados ou vazio claro |
| `/settings/integrations` | Stays | Mostra conectado, pendente ou fail-closed |
| `/event-log` | historico/eventos | Estado claro |

## Checklist mobile/PWA

| Item | Como validar | Aceite |
| --- | --- | --- |
| Mobile authenticated | Playwright `authenticated-mobile-smoke.spec.ts` | Sem overflow horizontal |
| Manifest | Abrir `/manifest.webmanifest` | HTTP 200 e icons validos |
| Service worker | Abrir `/sw.js` | HTTP 200 |
| Offline fallback | Abrir `/offline.html` | HTTP 200 |
| Lighthouse PWA | Rodar contra app pos-deploy | Installable sem erro critico |
| Android install | Chrome Android, Add to Home Screen | Icone e standalone OK |
| iOS install | Safari iOS, Add to Home Screen | Icone e tela OK |

## Evidencia obrigatoria

O tester deve anexar:

- caminho do relatorio em `docs/e2e-reports/<timestamp>/report.md`;
- prints mobile de dashboard, propriedades, plano, integracoes e admin;
- resultado dos comandos Playwright;
- lista de falhas com rota, screenshot e horario;
- confirmacao de que nenhum segredo foi copiado para docs/logs.

## Criterio de aprovacao

| Frente | Aprovado quando |
| --- | --- |
| Admin read-only | Score 100% ou falha justificada sem P0/P1 |
| Host read-only | Score acima de 95% apos footer fix em producao |
| Mobile | Rotas core sem overflow e sem redirect indevido |
| PWA | Manifest/SW/offline OK e Lighthouse installable pos-deploy |
| Release | Health API 200, DB ok, CI/release gate verde e relatorios anexados |

## Falhas que bloqueiam release

- `Application error`, 500 ou crash em rota core.
- Login valido redirecionando para login durante rota autenticada.
- Admin acessivel para usuario comum.
- Segredo, token ou webhook secret visivel em UI/log.
- Checkout/webhook alterando assinatura de usuario real sem aprovacao.
- PWA quebrando navegacao normal ou cacheando erro.
