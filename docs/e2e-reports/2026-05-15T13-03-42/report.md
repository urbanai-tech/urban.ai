# Relatorio E2E Produto - 2026-05-15T13:03:42.989Z

Base app: https://app.myurbanai.com
Base API: https://urbanai-production-85fd.up.railway.app
Usuario testado: gustavo8gouveia@hotmail.com

## Resumo executivo

| Modulo | Entrega funcional estimada | Rotas UI | APIs | Problemas criticos |
|---|---:|---:|---:|---:|
| Anfitriao | 59% | 37% | 100% | 1 |

## Anfitriao

Entrega funcional estimada: **59%**

### Problemas encontrados

- **P1** `/post-login`: Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=xif8e') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/post-login`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/post-login`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/privacidade. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:
- **P1** `/post-login`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=xif8e') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/post-login`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/dashboard`: Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/dashboard`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/dashboard`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/privacidade. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:
- **P1** `/dashboard`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/dashboard`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/plans`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=1r3zm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/plans`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/plans`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/contato. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:2523
- **P1** `/plans`: Console: error: Access to fetch at 'https://myurbanai.com/sobre' (redirected from 'https://app.myurbanai.com/sobre?_rsc=1r3zm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/plans`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/plans/v2`: Console: error: Access to fetch at 'https://myurbanai.com/sobre' (redirected from 'https://app.myurbanai.com/sobre?_rsc=1w2zr') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/plans/v2`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/plans/v2`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/sobre. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:25231

- **P1** `/plans/v2`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=1w2zr') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/plans/v2`: Console: error: Failed to load resource: net::ERR_FAILED
- **P0** `/my-plan`: Visible error pattern: /Internal Server Error/i
- **P2** `/my-plan`: Console: error: TypeError: Cannot read properties of undefined (reading 'amount')
    at https://app.myurbanai.com/_next/static/chunks/app/my-plan/page-aed60e51441546b4.js:1:4707
    at Array.map (<anonymous>)
    at y (https://app.myurbanai.com/_next/static/chunks/app/my-plan/page-aed60e51441546b4.js:1:3982)
    at l9 (https://app.myurbanai.com/_next/static/chunks/4bd1b696-100b9d70ed4e49c1.js:1:51130)
    at o_ (https://app.myurbanai.com/_next/static/chunks/4bd1b696-100b9d70ed4e49c1.js:1:70990)
    at oq (http
- **P1** `/my-roi`: Console: error: Access to fetch at 'https://myurbanai.com/sobre' (redirected from 'https://app.myurbanai.com/sobre?_rsc=1dsi3') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/my-roi`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/my-roi`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/sobre. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:25231

- **P1** `/my-roi`: Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=1dsi3') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/my-roi`: Console: error: Failed to load resource: net::ERR_FAILED
- **P1** `/event-log`: Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=795tn') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- **P2** `/event-log`: Console: error: Failed to load resource: net::ERR_FAILED
- **P2** `/event-log`: Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/privacidade. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:
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
| `/post-login` | Post-login router | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=xif8e') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/privacidade. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=xif8e') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |
| `/dashboard` | Host dashboard | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/privacidade. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=skepm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |
| `/onboarding` | Onboarding | 200 | OK | - |
| `/onboarding/payment/price` | Onboarding pricing step | 200 | OK | - |
| `/plans` | Plan selection | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=1r3zm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/contato. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:2523<br>Console: error: Access to fetch at 'https://myurbanai.com/sobre' (redirected from 'https://app.myurbanai.com/sobre?_rsc=1r3zm') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |
| `/plans/v2` | Plan selection alias | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/sobre' (redirected from 'https://app.myurbanai.com/sobre?_rsc=1w2zr') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/sobre. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:25231
<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=1w2zr') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |
| `/my-plan` | My plan | 200 | FALHA | Visible error pattern: /Internal Server Error/i<br>Console: error: TypeError: Cannot read properties of undefined (reading 'amount')
    at https://app.myurbanai.com/_next/static/chunks/app/my-plan/page-aed60e51441546b4.js:1:4707
    at Array.map (<anonymous>)
    at y (https://app.myurbanai.com/_next/static/chunks/app/my-plan/page-aed60e51441546b4.js:1:3982)
    at l9 (https://app.myurbanai.com/_next/static/chunks/4bd1b696-100b9d70ed4e49c1.js:1:51130)
    at o_ (https://app.myurbanai.com/_next/static/chunks/4bd1b696-100b9d70ed4e49c1.js:1:70990)
    at oq (http |
| `/my-roi` | Host ROI | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/sobre' (redirected from 'https://app.myurbanai.com/sobre?_rsc=1dsi3') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/sobre. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:25231
<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=1dsi3') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |
| `/settings/integrations` | Stays integrations | 200 | OK | - |
| `/event-log` | Event log | 200 | FALHA | Console: error: Access to fetch at 'https://myurbanai.com/privacidade' (redirected from 'https://app.myurbanai.com/privacidade?_rsc=795tn') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED<br>Console: error: Failed to fetch RSC payload for https://app.myurbanai.com/privacidade. Falling back to browser navigation. TypeError: Failed to fetch (app.myurbanai.com)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:20749
    at m (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:4445)
    at _ (https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:6:3315)
    at https://app.myurbanai.com/_next/static/chunks/3284-914ae3bec3858c11.js:18:<br>Console: error: Access to fetch at 'https://myurbanai.com/contato' (redirected from 'https://app.myurbanai.com/contato?_rsc=795tn') from origin 'https://app.myurbanai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.<br>Console: error: Failed to load resource: net::ERR_FAILED |

### APIs lidas

| Endpoint | Status | Resultado | Resumo |
|---|---:|---|---|
| `/propriedades/dropdown/list` | 200 | OK | array(9) |
| `/payments/getSubscription` | 200 | OK | object(id,status,metadata) |
| `/payments/getSubscription` | 200 | OK | object(id,status,metadata) |
| `/roi/me` | 200 | OK | object(windowDays,generatedAt,user,subscription,money,activity,dataQuality,perProperty) |
| `/stays/listings` | 200 | OK | array(0) |

## Observacoes de escopo

- Esta passada evita acoes destrutivas: deletar usuario, alterar plano, apagar custo, importar CSV real ou disparar push Stays.
- Fluxos mutantes devem rodar em staging ou com fixtures isoladas antes de virar gate de producao.
