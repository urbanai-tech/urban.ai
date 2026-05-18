# Relatorio E2E Produto - 2026-05-17T21:17:29.266Z

Base app: https://app.myurbanai.com
Base API: https://urbanai-production-85fd.up.railway.app
Usuario testado: gustavo8gouveia@hotmail.com

## Resumo executivo

| Modulo | Entrega funcional estimada | Rotas UI | APIs | Problemas criticos |
|---|---:|---:|---:|---:|
| Admin | 100% | 100% | 100% | 0 |
| Anfitriao | 71% | 56% | 100% | 0 |

## Admin

Entrega funcional estimada: **100%**

### Problemas encontrados

- Nenhum problema bloqueante detectado nesta passada.

### Melhorias potenciais

- Transformar esta auditoria em job CI/staging antes de cada deploy.
- Separar smoke read-only de fluxos mutantes com massa de teste e rollback.
- Criar seletores `data-testid` nas telas principais para testes menos frageis.
- Adicionar medicao de tempo de carregamento por tela e alertas para rotas lentas.

### Rotas UI

| Rota | Feature | Status | Resultado | Problemas |
|---|---|---:|---|---|
| `/admin` | Admin home | 200 | OK | - |
| `/admin/dashboard` | Executive dashboard | 200 | OK | - |
| `/admin/users` | Users and roles | 200 | OK | - |
| `/admin/alpha` | Alpha ops | 200 | OK | - |
| `/admin/roi` | Admin ROI | 200 | OK | - |
| `/admin/audit-logs` | Audit logs | 200 | OK | - |
| `/admin/contacts` | Contact inbox | 200 | OK | - |
| `/admin/waitlist` | Waitlist ops | 200 | OK | - |
| `/admin/events` | Events inventory | 200 | OK | - |
| `/admin/events/new` | Manual event creation | 200 | OK | - |
| `/admin/events/import` | Event CSV import | 200 | OK | - |
| `/admin/collectors-health` | Collectors health | 200 | OK | - |
| `/admin/jobs` | Admin jobs | 200 | OK | - |
| `/admin/coverage` | Coverage regions | 200 | OK | - |
| `/admin/finance` | Finance | 200 | OK | - |
| `/admin/pricing-config` | Pricing config | 200 | OK | - |
| `/admin/stays` | Stays admin health | 200 | OK | - |
| `/admin/funnel` | Product funnel | 200 | OK | - |
| `/admin/quality` | Pricing quality | 200 | OK | - |

### APIs lidas

| Endpoint | Status | Resultado | Resumo |
|---|---:|---|---|
| `/admin/dashboard-summary` | 200 | OK | object(generatedAt,health,alerts,events,waitlist,coverage,pricing,dataset) |
| `/admin/users` | 200 | OK | object(data,total,page,limit,totalPages) |
| `/admin/alpha/dashboard` | 200 | OK | object(generatedAt,user,properties,recommendations,events,recentRecommendations) |
| `/admin/alpha/recommendations` | 200 | OK | object(generatedAt,user,total,rows) |
| `/admin/roi` | 200 | OK | object(windowDays,generatedAt,totals,leaderboard) |
| `/admin/audit-logs` | 200 | OK | object(items,total,page,limit) |
| `/admin/contact-submissions` | 200 | OK | object(page,limit,total,byStatus,byCategory,bySeverity,items) |
| `/admin/waitlist` | 200 | OK | object(page,limit,total,items) |
| `/admin/waitlist/stats` | 200 | OK | object(total,byStatus,bySource,topReferrers) |
| `/admin/events/analytics` | 200 | OK | object(summary,upcoming,byCategory,byCity,byRelevance,topUpcoming,lastCrawlAt) |
| `/admin/events/list` | 200 | OK | object(page,limit,total,scope,items) |
| `/admin/events/collectors-health` | 200 | OK | object(generatedAt,sources) |
| `/admin/jobs/runs` | 200 | OK | array(7) |
| `/admin/coverage` | 200 | OK | array(1) |
| `/admin/coverage/stats` | 200 | OK | object(activeRegions,bootstrapRegions,addresses,addressRadiusKm) |
| `/admin/finance/overview` | 200 | OK | object(currency,activeListings,activePayments,revenue,costs,margin,perListing) |
| `/admin/finance/costs` | 200 | OK | array(0) |
| `/admin/plans-config` | 200 | OK | array(3) |
| `/admin/stripe/sync-check` | 200 | OK | object(summary,entries) |
| `/admin/stays/health` | 200 | OK | object(readiness,accountsByStatus,listings,pushLast30d,recent) |
| `/admin/funnel` | 200 | OK | object(windowDays,stages,rates) |
| `/admin/pricing/quality` | 200 | OK | object(windowDays,sampleSize,discarded,mapePercent,rmse,medianAbsoluteError,qualityGate) |
| `/admin/occupancy/coverage` | 200 | OK | object(byStatus,byOrigin,distinctListings) |

## Anfitriao

Entrega funcional estimada: **71%**

### Problemas encontrados

- **P1** `/dashboard`: Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/dashboard`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/dashboard`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/termos. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:11815
    at m (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:4855)
    at _ (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:3725)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:19353
- **P1** `/dashboard`: Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/dashboard`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/my-plan`: Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/my-plan`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/my-plan`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/termos. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:11815
    at m (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:4855)
    at _ (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:3725)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:19353
- **P1** `/my-plan`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/my-plan`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/my-roi`: Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/my-roi`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/my-roi`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/my-roi`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/my-roi`: Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P1** `/event-log`: Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=795tn') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/event-log`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/event-log`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/termos. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:11815
    at m (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:4855)
    at _ (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:3725)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:19353
- **P1** `/event-log`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=795tn') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/event-log`: Console: error: Failed to load resource: net::ERR_FAILED

### Melhorias potenciais

- Transformar esta auditoria em job CI/staging antes de cada deploy.
- Separar smoke read-only de fluxos mutantes com massa de teste e rollback.
- Criar seletores `data-testid` nas telas principais para testes menos frageis.
- Adicionar medicao de tempo de carregamento por tela e alertas para rotas lentas.

### Rotas UI

| Rota | Feature | Status | Resultado | Problemas |
|---|---|---:|---|---|
| `/` | Login entry | 200 | OK | - |
| `/post-login` | Post-login router | 200 | OK | - |
| `/dashboard` | Host dashboard | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/termos. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:11815
    at m (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:4855)
    at _ (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:3725)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:19353<br>Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |
| `/onboarding` | Onboarding | 200 | OK | - |
| `/onboarding/payment/price` | Onboarding pricing step | 200 | OK | - |
| `/plans` | Plan selection | 200 | OK | - |
| `/plans/v2` | Plan selection alias | 200 | OK | - |
| `/my-plan` | My plan | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/termos. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:11815
    at m (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:4855)
    at _ (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:3725)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:19353<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |
| `/my-roi` | Host ROI | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=kejxe') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource. |
| `/settings/integrations` | Stays integrations | 200 | OK | - |
| `/event-log` | Event log | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/termos' (redirected from 'https://app.myurbanai.com/termos?_rsc=795tn') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/termos. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:11815
    at m (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:4855)
    at _ (https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:6:3725)
    at https://app.myurbanai.com/_next/static/chunks/5030-9129bf3400ab3ea7.js:18:19353<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=795tn') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |

### APIs lidas

| Endpoint | Status | Resultado | Resumo |
|---|---:|---|---|
| `/propriedades/dropdown/list` | 200 | OK | array(9) |
| `/payments/getSubscription` | 200 | OK | object(id,status,currency,start_date,metadata,plan) |
| `/payments/getSubscription` | 200 | OK | object(id,status,currency,start_date,metadata,plan) |
| `/roi/me` | 200 | OK | object(windowDays,generatedAt,user,subscription,money,activity,dataQuality,perProperty) |
| `/stays/listings` | 200 | OK | array(0) |

## Observacoes de escopo

- Esta passada evita acoes destrutivas: deletar usuario, alterar plano, apagar custo, importar CSV real ou disparar push Stays.
- Fluxos mutantes devem rodar em staging ou com fixtures isoladas antes de virar gate de producao.
