# Incidente — Price ID Stripe inválido / checkout quebrado

**Severidade:** SEV1 (bloqueia novos pagantes — receita em risco direto).
**RTO alvo:** 1h.

## Detecção

- Sentry mostra erro `StripeInvalidRequestError: No such price: 'price_xxx'`.
- Usuários relatam que clicar em "Assinar" mostra tela de erro.
- Logs Railway do backend: `createCheckoutSession` falhando.

## Triagem

1. **Anotar hora.**
2. Identificar qual Price ID está inválido:
   - O erro do Stripe traz o ID exato.
   - Comparar com env vars no Railway (`MENSAL_PLAN`, `ANUAL_PLAN`, `STARTER_*`, `PROFISSIONAL_*`).
3. Possíveis causas:
   - **Price ID foi arquivado no Stripe** (alguém clicou "Archive" no Dashboard sem pensar).
   - **Mudou de Test mode para Live mode** (KYC aprovado e migração mal feita).
   - **Conta Stripe foi desativada** (caso raro, mas possível em fraude).
4. Verificar Stripe → Products → Prices: o ID está lá? Status `active`?

## Mitigação

### Caso 1 — Price arquivado por engano

**Ação:** no Dashboard, restaurar (Stripe não permite "unarchive" direto, mas oferece "Duplicate"). Atualizar a env var no Railway com o **novo** ID.

### Caso 2 — Migração test → live

KYC aprovado e os Price IDs antigos eram do test mode.

**Ação:**
- Criar todos os Prices em Live mode no Dashboard, espelhando a estrutura test (mensal/anual de cada plano).
- Atualizar env vars no Railway: `STRIPE_SECRET_KEY=sk_live_*`, `STRIPE_PUBLIC_KEY=pk_live_*`, `STRIPE_WEBHOOK_SECRET=whsec_*` (do endpoint Live), e os Price IDs.
- Recriar o webhook endpoint no Live mode (o do Test não serve).
- Smoke test em modo Live com cartão real (cobrar R$ 1 em si mesmo).

### Caso 3 — Bug no `seedPlans`

Se o backend acabou de rodar `clear()` + reseed (ver `D3` em `RELEASE_NOTES_SPRINT_2026-04-21`), e o seed pegou os IDs errados:

**Ação:** atualizar `plans.service.ts → seedPlans` com os IDs corretos. Redeploy. Os dados antigos serão sobrescritos no próximo boot (porque hoje seedPlans faz `clear()` antes de seed — comportamento conhecido, ver D3).

### Caso 4 — Conta Stripe suspensa

**Ação:** abrir ticket no Stripe imediatamente. Em paralelo, exibir banner em produção avisando que o checkout está temporariamente indisponível. Não trocar de provider sem analisar — Stripe geralmente resolve em 24–48h.

## Resolução

- Smoke: criar conta nova → ir em /plans → clicar Assinar → checkout Stripe abre sem erro → completar com cartão `4242 4242 4242 4242` → webhook processa → /my-plan reflete plano ativo.
- Sentry para de receber `StripeInvalidRequestError`.

## Após estabilizar

- Documentar todos os Price IDs em `docs/stripe-price-matrix.md` (planejado em F6.5) com data de criação e responsável — para rastreabilidade.
- Adicionar alerta Sentry: > 1 erro `StripeInvalidRequestError` por hora → WhatsApp Gustavo.
- Considerar **smoke test de checkout** rodando todo dia em staging (cron simulando checkout flow).

## O que NÃO fazer

- ❌ Arquivar Prices no Dashboard sem auditoria — o backend pode estar usando.
- ❌ Trocar `STRIPE_SECRET_KEY` em prod sem ter o `STRIPE_WEBHOOK_SECRET` correspondente do mesmo modo (test ou live) — webhook quebra silenciosamente.
- ❌ Deletar customers órfãos no Dashboard "para limpar" — pode quebrar Payment rows que referenciam aquele customerId.

---

*Última atualização: 24/04/2026*
