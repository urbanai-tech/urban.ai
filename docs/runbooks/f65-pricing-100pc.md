# Runbook — F6.5 (Cobrança por imóvel) 100% configurada

**Data:** 25/04/2026 · **Status:** Encerrado.

> Este doc documenta a auditoria que revelou que F6.5 estava parcialmente
> configurada e o que foi feito para fechar.

---

## O que estava errado

Auditoria de 25/04 (resposta à pergunta direta do Gustavo "F6.5 está 100%?")
revelou que estava em **~50%**:

| Componente | Estado |
|---|---|
| Backend (entity Plan, Payment, createCheckoutSession 4 ciclos + quantity, webhook persiste, getListingsQuota) | ✅ |
| `/plans/v2` página | ✅ |
| `PricingCalculatorV2` componente | ✅ |
| `ListingsQuotaGuard` componente | ❌ criado mas **nunca usado em lugar nenhum** |
| `/plans` (rota oficial usada por header e por todo lugar) | ❌ usava toggle binário antigo |
| `/onboarding` step de planos | ❌ chamava checkout sem `quantity` |
| `GlobalPaywallModal` → redireciona para | ❌ `/plans` antigo |
| Bloqueio efetivo de cadastrar imóvel além da quota | ❌ não existia — anfitrião podia cadastrar quantos quisesse |

**Consequência prática se tivesse ido para produção assim:**
- Anfitrião assinava `/plans` antigo → checkout com `quantity=1` mesmo com 5 imóveis → cobrança errada (subcobrança).
- Mesmo após assinar, podia cadastrar 47 imóveis no plano de 3 sem nenhum bloqueio.

## O que foi feito

### 1. `/plans` (rota oficial) substituída pela matriz F6.5

`Urban-front-main/src/app/plans/page.tsx` agora renderiza o
`PricingCalculatorV2` para todos os planos ativos. Toggle binário antigo
removido. `/plans/v2` virou um redirect para `/plans` (compat com links históricos).

### 2. Onboarding passa `quantity` corretamente

`Urban-front-main/src/app/onboarding/page.tsx:522-540`:
```ts
const quantity = Math.max(1, Number(selectedCount) || 1);
const { sessionId } = await createCheckoutSession(planId, billingCycle, quantity);
```

`selectedCount` é o número de imóveis Airbnb que o anfitrião selecionou
no step anterior. Antes ia hardcoded como 1.

### 3. GlobalPaywallModal idem

`Urban-front-main/src/app/componentes/GlobalPaywallModal.tsx:88-93`:
```ts
const quantity = Math.max(1, Number(propertyCount) || 1);
const { sessionId } = await createCheckoutSession(plan.name, billingCycle, quantity);
```

`propertyCount` vem da listagem de propriedades do user (cadastradas).

### 4. Bloqueio server-side em `POST /connect/addresses`

`urban-ai-backend-main/src/connect/connect.controller.ts:194-220`. O guard:

1. Pega quota atual via `paymentsService.getListingsQuota(userId)`.
2. Soma `quota.ativos + addresses.length` (tentativa de criação).
3. Se exceder `quota.contratados`, retorna 403 com payload:

```json
{
  "code": "LISTINGS_QUOTA_EXCEEDED",
  "message": "Quota de imóveis excedida...",
  "contratados": 3,
  "ativos": 3,
  "tentando": 1
}
```

Frontend pode interceptar esse código e mostrar modal de upsell.

### 5. ConnectModule importa PaymentsModule

Para o controller ter acesso ao `PaymentsService.getListingsQuota`.

---

## O que ainda é responsabilidade humana (Stripe)

A F6.5 prevê **8 Stripe Price IDs** (2 planos × 4 ciclos):

```
STARTER_PRICE_MONTHLY     STARTER_PRICE_QUARTERLY
STARTER_PRICE_SEMESTRAL   STARTER_PRICE_ANNUAL
PROFISSIONAL_PRICE_MONTHLY    PROFISSIONAL_PRICE_QUARTERLY
PROFISSIONAL_PRICE_SEMESTRAL  PROFISSIONAL_PRICE_ANNUAL
```

Esses precisam ser **criados no Dashboard Stripe** primeiro, depois
setados no Railway. Sem eles, o `resolveStripePriceId` cai nos legados
(apenas mensal e anual). Quarterly e semestral simplesmente não funcionam
sem essa configuração manual.

Página `/admin/pricing-config` mostra os Price IDs atuais (read-only) para
referência rápida.

---

## Como verificar que está OK

1. Login com user A
2. Ir em `/plans` → ver matriz F6.5 com 4 ciclos (Mensal/Trimestral/Semestral/Anual)
3. Selecionar quantidade > 1 → preço atualiza em tempo real
4. Clicar Assinar → Stripe Checkout abre com `quantity=N`
5. Após webhook, Payment row tem `billingCycle` e `listingsContratados`
6. Tentar cadastrar mais imóveis que `listingsContratados` → 403 do servidor

---

*Última atualização: 25/04/2026.*
