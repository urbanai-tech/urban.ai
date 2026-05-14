# Runbook - smoke Stripe e billing

Data: 2026-05-14
Escopo: validar o minimo para beta pago controlado: Price IDs, checkout, webhook, quota e cancelamento sem misturar test/live.

## Quando rodar

Rode este smoke:

- antes de qualquer M3/beta pago;
- apos alterar planos, checkout, webhook, quota ou status de assinatura;
- apos configurar novas variaveis Stripe em staging/producao;
- antes de ativar campanha com plano pago.

## Pre-condicoes

- Ambiente definido como `staging`, `production` ou equivalente controlado.
- Conta Stripe com modo escolhido documentado: test ou live.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUCCESS_URL`, `CANCEL_URL` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` configurados no mesmo modo.
- Os 8 Price IDs da matriz Starter/Profissional x mensal/trimestral/semestral/anual criados ou mapeados.
- Usuario de teste autenticado, sem dados reais sensiveis.
- Acesso ao Stripe Dashboard para confirmar eventos e assinaturas.

## Passo a passo

1. Abra `/admin/dashboard` e registre se `billing.stripeSecretConfigured` e `billing.stripeWebhookConfigured` estao ok.
2. Abra `/admin/pricing-config` e rode o sync check de Stripe.
3. Confirme que o sync check mostra todos os Price IDs esperados como validos.
4. Verifique se nao existe status legado `peding` em relatorios/admin. Se existir, bloqueie M3 ate saneamento.
5. Para cada plano/ciclo critico, crie uma sessao em `POST /payments/create-checkout-session` via UI ou fluxo normal.
6. Complete ao menos um checkout em test mode com cartao de teste do Stripe.
7. No Stripe Dashboard, confirme `checkout.session.completed` e `customer.subscription.updated`.
8. No backend/admin, confirme que o `Payment` local ficou com:
   - `subscriptionId`;
   - status coerente com Stripe;
   - ciclo de cobranca correto;
   - quantidade/listings contratados correta.
9. Consulte `/payments/listings-quota` para o usuario testado.
10. Cadastre imoveis ate a quota contratada e confirme sucesso.
11. Tente cadastrar o imovel N+1 e confirme bloqueio amigavel `LISTINGS_QUOTA_EXCEEDED`, sem criar `List` parcial.
12. Cancele a assinatura pelo produto ou pelo Stripe Dashboard.
13. Confirme que o webhook `customer.subscription.deleted` ou fluxo de cancelamento local atualiza status para cancelado.
14. Reabra o produto e confirme que plano/quota/status refletem o cancelamento.
15. Registre evidencias no release gate.

## Criterios de aceite

O smoke passa quando:

- sync check Stripe retorna a matriz esperada sem missing/not-configured;
- checkout cria assinatura e webhook atualiza o banco;
- quota contratada e quota ativa batem com o plano;
- N+1 e bloqueado com mensagem amigavel e sem dado parcial;
- cancelamento atualiza Stripe e banco;
- test/live nao estao misturados em chave, Price ID, webhook ou publishable key.

O smoke bloqueia M3 quando:

- `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` ausente;
- Price ID de test mode usado com chave live, ou inverso;
- checkout cria sessao, mas webhook nao atualiza `Payment`;
- status `peding` ainda aparece em dados ativos;
- quota permite cadastrar acima do contratado;
- cancelamento fica divergente entre Stripe e banco.

## Matriz minima de ciclos

| Plano | Ciclos obrigatorios antes de M3 | Evidencia |
|---|---|---|
| Starter | Mensal e anual | Checkout + webhook + quota. |
| Profissional | Mensal e anual | Checkout + webhook + quota. |
| Trimestral/semestral | Pelo menos sync check validado; checkout completo antes de campanha especifica | Price IDs corretos e sem modo misturado. |

## Triage rapido

| Sintoma | Provavel causa | Acao |
|---|---|---|
| Sync check sem Price ID | Env/Plan sem campo preenchido | Preencher Price ID correto e rodar sync novamente. |
| Price ID existe, mas ciclo errado | Price criado com recurring interval incorreto | Criar novo Price no Stripe; nao editar price antigo. |
| Checkout abre, webhook falha | `STRIPE_WEBHOOK_SECRET` errado ou raw body quebrado | Conferir endpoint e assinatura no Dashboard. |
| Assinatura ativa, quota errada | Metadata/quantity nao persistida | Revisar retorno de webhook e `listingsContratados`. |
| Cancelamento no Stripe nao reflete no app | Webhook nao recebido/processado | Reenviar evento pelo Dashboard e revisar logs. |
| N+1 cria dado parcial | Bloqueio de quota tarde demais | Bloquear release e corrigir criacao antes do insert. |

## Registro de evidencia

```text
Smoke Stripe/billing
Data/hora:
Ambiente:
Modo Stripe: test/live
Responsavel:
Sync check: ok/bloqueado
Price IDs faltantes:
Plano/ciclo testado:
Checkout session id:
Subscription id:
Webhook recebido:
Payment status local:
Quota contratada:
Quota ativa:
Teste N+1: bloqueado/nao bloqueado
Cancelamento: ok/bloqueado
Resultado: aprovado/bloqueado
Pendencias:
```

## Saida esperada para M3

Para beta pago controlado:

- pelo menos Starter mensal/anual e Profissional mensal/anual passam de ponta a ponta;
- todos os 8 Price IDs estao validados pelo sync check;
- KYC/live mode tem responsavel e decisao registrada;
- quota e cancelamento nao dependem de ajuste manual no banco;
- qualquer plano ainda nao testado fica oculto ou fora da campanha.
