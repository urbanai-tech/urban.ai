# Relatório de Testes — Urban AI (Atualizado)
**Data:** 2026-03-18  
**Agente:** Antigravity QA  
**Ambiente:** Backend local `localhost:10000` + Produção `urbanai-production-85fd.up.railway.app`

---

## Resumo Executivo

| Teste | Nome | Status | Observações |
|-------|------|--------|-------------|
| T1 | Cadastro/Auth | ✅ PASSOU | 5/5 steps |
| T2 | Stripe | ✅ PASSOU | 3/3 steps (após restart com chaves de teste) |
| T3 | Dashboard/KNN | ⚠️ PARCIAL | Dashboard e Eventos OK, hostId requer param |
| T4 | Spiders/S3 | ❌ FALHOU | Serviços inacessíveis (possivelmente pausados) |
| T5 | Notificações | ✅ PASSOU | Após fix do `/health` |
| T6 | Sentry | ✅ PASSOU | Após fix do `/debug/sentry-test` |
| T7 | DNS/SSL | ⚠️ PARCIAL | app.myurbanai.com ✅, myurbanai.com ❌ |

**Total: 4/7 testes 100% aprovados | 2/7 parciais | 1/7 falhou**

---

## T1 — Cadastro e Autenticação ✅ (5/5)

| Step | Status | Detalhes |
|------|--------|----------|
| 1.1 Register | ✅ | 201 — `POST /auth/register` (campo `username`, não `name`) |
| 1.2 Login | ✅ | 201 — JWT `accessToken` retornado |
| 1.3 Rota protegida (com token) | ✅ | 200 — `userId` e `username` |
| 1.4 Rota protegida (sem token) | ✅ | 401 Unauthorized |
| 1.5 Forgot Password | ✅ | 201 — `{"enviado":true}` via `POST /email/forgot-password` |

---

## T2 — Stripe ✅ (3/3) — corrigido

| Step | Status | Detalhes |
|------|--------|----------|
| 2.1 Checkout Session | ✅ | 201 — `cs_test_a1x65zy6...` (body: `{"plan":"pro"}`) |
| 2.2 Webhook Health | ✅ | 400 — `No stripe-signature header` (esperado) |
| 2.3 Status Assinatura | ✅ | 200 — `{"active":false}` |

> **Fix aplicado:** Backend reiniciado para carregar `sk_test_` em vez de `sk_live_` expirada.

---

## T3 — Dashboard e KNN ⚠️ (2/3)

| Step | Status | Detalhes |
|------|--------|----------|
| 3.1 Listar propriedades | ⚠️ | 400 — `hostId` requer query parameter adicional |
| 3.2 Dashboard dados | ✅ | 200 — `GET /dados` retorna métricas |
| 3.3 Eventos | ✅ | 200 — **36.898 eventos** no banco |

---

## T4 — Spiders e S3 ❌ (0/5)

| Step | Status | Detalhes |
|------|--------|----------|
| 4.1-4.5 | ❌ | Serviços Railway (webscrapping, pipeline, KNN) → 404 `Application not found` |

> [!WARNING]
> Serviços possivelmente **pausados ou sem domínio público**. Necessária verificação manual no Railway Dashboard.

---

## T5 — Notificações ✅ (2/2) — corrigido

| Step | Status | Detalhes |
|------|--------|----------|
| 5.2 Health check | ✅ | 200 — `{"status":"ok","uptime":...}` (endpoint implementado) |
| 5.3 Listar notificações | ✅ | 200 — `{"data":[], "total":0}` |

---

## T6 — Sentry ✅ (2/2) — corrigido

| Step | Status | Detalhes |
|------|--------|----------|
| 6.1 Sentry test | ✅ | 500 — Erro intencional (endpoint implementado) |
| 6.2 Rota inválida | ✅ | 404 — Retorno correto |

---

## T7 — DNS e SSL ⚠️ (3/4)

| Step | Status | Detalhes |
|------|--------|----------|
| 7.1 DNS app.myurbanai.com | ✅ | Resolve para `200.142.105.90` |
| 7.3 HTTPS app | ✅ | Status 200, SSL válido |
| 7.4 myurbanai.com | ❌ | Timeout — DNS não resolve |
| 7.5 urbanai.com.br | ✅ | Status 200 |

---

## Correções Implementadas

| Correção | Arquivo | Commit |
|----------|---------|--------|
| Endpoint `/health` e `/debug/sentry-test` | `app.controller.ts` | `0bf33a8` |
| Templates HTML de email | `email/templates.ts` | `3775c40` |
| Webhook Stripe aprimorado | `payments.service.ts` | `3775c40` |
| Chaves Stripe de teste | `.env` (local) + Railway vars | — |

## Validação em Produção

| Item | Status |
|------|--------|
| Health check (`/health`) | ✅ 200 — `{"status":"ok","environment":"production"}` |
| Deploy Railway | ✅ Completo via `railway up` |

---

## Itens Pendentes (Ação Manual Necessária)

| # | Item | Prioridade |
|---|------|-----------|
| 1 | **Verificar serviços webscrapping/pipeline/KNN no Railway** | Alta |
| 2 | **Atualizar webhook Stripe** com URL correta: `urbanai-production-85fd.up.railway.app/payments/webhook` | Alta |
| 3 | **Configurar DNS** de `myurbanai.com` (domínio raiz) | Média |
| 4 | **Verificar auto-deploy** do Railway via GitHub | Baixa |

---

## Mapeamento de Rotas (referência)

| Prompt Original | Rota Real |
|----------------|-----------|
| `/auth/register` (name) | `POST /auth/register` (**username**) |
| `/auth/forgot-password` | `POST /email/forgot-password` |
| `/subscriptions/checkout` | `POST /payments/create-checkout-session` |
| `/subscriptions/webhook` | `POST /payments/webhook` |
| `/subscriptions/status` | `GET /payments/me` |
| `/dashboard` | `GET /dados` (JWT) |
| `/health` | `GET /health` (criado) |
| `/debug/sentry-test` | `GET /debug/sentry-test` (criado) |
| Backend URL | `urbanai-production-85fd.up.railway.app` |
