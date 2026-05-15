# Relatorio E2E Produto - 2026-05-15T13:45:31.301Z

Base app: https://app.myurbanai.com
Base API: https://urbanai-production-85fd.up.railway.app
Usuario testado: gustavo8gouveia@hotmail.com

## Resumo executivo

| Modulo | Entrega funcional estimada | Rotas UI | APIs | Problemas criticos |
|---|---:|---:|---:|---:|
| Anfitriao | 100% | 100% | 100% | 0 |

## Anfitriao

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
| `/` | Login entry | 200 | OK | - |
| `/post-login` | Post-login router | 200 | OK | - |
| `/dashboard` | Host dashboard | 200 | OK | - |
| `/onboarding` | Onboarding | 200 | OK | - |
| `/onboarding/payment/price` | Onboarding pricing step | 200 | OK | - |
| `/plans` | Plan selection | 200 | OK | - |
| `/plans/v2` | Plan selection alias | 200 | OK | - |
| `/my-plan` | My plan | 200 | OK | - |
| `/my-roi` | Host ROI | 200 | OK | - |
| `/settings/integrations` | Stays integrations | 200 | OK | - |
| `/event-log` | Event log | 200 | OK | - |

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
