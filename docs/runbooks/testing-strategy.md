# Runbook — Estratégia de Testes

**Contexto:** a auditoria de 16/04/2026 identificou cobertura efetiva ~0% nos 5 serviços. O F5C.2 item 10 pede suite E2E mínima do fluxo crítico (signup → imóvel → recomendação → assinar → cancelar). Este documento descreve a estratégia em camadas, o que está no ar hoje e como evoluir.

---

## O que existe hoje (24/04/2026 — atualizado pós-F5C.4 #2)

### Backend (`urban-ai-backend-main/`)

- **Tipo:** Jest unit tests com mocks (sem DB, sem rede)
- **Config:** `package.json → jest` — `moduleFileExtensions: ["ts", "js", "json"]`, `modulePaths: [rootDir/..]`
- **Specs ativas:**
  - `src/auth/auth.service.spec.ts` — register/login (bcrypt + lazy rehash), rotate, revoke, getProfileById (13 casos)
  - `src/auth/jwt.strategy.spec.ts` — fail-fast sem JWT_SECRET, ordem cookie > header, validate payload (6 casos)
  - `src/knn-engine/knn-classifier.spec.ts` — untrained fallback, classificação, naming (6 casos)
  - `src/knn-engine/pricing-engine.spec.ts` — multiplicadores (categoria, atratividade, travel time, relevância) (9 casos)
  - `src/payments/payments.service.spec.ts` — webhook (8 casos) + cancelSubscription (4 casos) + createCheckoutSession (4 casos) = 16 casos
  - `src/plans/plans.service.spec.ts` — seed, env vars, getPlanByName (5 casos)
- **Como rodar:**
  ```
  cd urban-ai-backend-main
  npm test                    # rápido
  npm test -- --coverage      # com relatório de cobertura
  ```
- **Cobertura global atual:** ~10.6% statements / 10.57% lines (de ~5% antes).
  - **Cobertura dos fluxos críticos:** alta —
    - `AuthService`: register, login (bcrypt + legado SHA-256), rotação de refresh, revocação — 100% dos caminhos principais
    - `PaymentsService`: webhook (5 tipos de evento), cancelSubscription, createCheckoutSession (monthly + annual + trial + new customer)
    - `UrbanAIPricingEngine`: todos os multiplicadores + combinações
    - `PlansService`: seed com env vars, destaque, custom price
  - **Gap global**: `PropriedadeService` (1672 linhas), `ConnectService`, `CronService`, `EmailService`, scraping/event enrichment — ainda sem cobertura.
  - **Meta do roadmap (≥50%)** só será atingida quando um dos serviços pesados (PropriedadeService) ganhar testes — planejado em Pass 1 do plano abaixo.

### Frontend (`Urban-front-main/`)

- **Tipo:** Playwright smoke (navegação real)
- **Config:** `playwright.config.ts` — baseURL dinâmica (localhost para dev, staging em CI)
- **Specs iniciais:** `e2e/smoke.spec.ts`
  - Home carrega e título bate
  - Landing `/lancamento` mostra "Síndrome da Casa Barata" + CTA
  - `/plans` é acessível (ou redireciona para auth sem quebrar)
  - Banner de STAGING aparece quando rodando contra staging
- **Como rodar:**
  ```
  # dev local (Next em outro terminal)
  cd Urban-front-main
  npm run dev      # terminal 1
  npm run test:e2e # terminal 2
  ```
- **Cobertura atual:** 4 testes de smoke, fluxo autenticado ainda pendente.

### CI (`.github/workflows/ci.yml`)

- Roda em push/PR para `main` e `staging`
- Jobs: backend-unit (jest + tsc), frontend-lint (tsc), frontend-smoke (playwright — só se `vars.E2E_BASE_URL` estiver configurado no GitHub)

---

## Próximos passos — ordem de implementação

### Fase 1 (S6, enquanto F5C.2 rola) — Cobrir o coração

1. **`auth.service` — bcrypt migration path.** Quando o hash passar para bcrypt (F5C.2 item 7), adicionar testes que validem o caminho "senha legada SHA-256 ainda autentica" + "nova senha bcrypt autentica" + "rehash invisível no login".
2. **`payments.service` — webhook Stripe.** Criar specs que tratam os 5 eventos (`checkout.session.completed`, `payment_intent.succeeded`, `customer.subscription.updated/deleted`, `invoice.payment_failed`) com payloads realistas (copiar de `https://stripe.com/docs/webhooks/test`). Mock do Stripe SDK.
3. **`urban-ai-pricing-engine` (quando for extraído do `PropriedadeService`).** Testes dos multiplicadores: categoria (+10–20%), atratividade (+20–50%), travel time (<15min → +30%), relevância de evento (até +50%). Cada multiplicador em um teste, + um teste do cálculo combinado.

### Fase 2 (S7–8 — quando staging existir) — Playwright contra staging

1. **Signup → confirmação de e-mail.** Criar usuário novo, interceptar e-mail de confirmação via inbox Mailersend API, clicar no link.
2. **Onboarding 5 passos.** Wizard completo até imóvel cadastrado.
3. **Recomendação de preço aparece.** Verificar que o dashboard mostra sugestão (mesmo com fallback mock) e o texto não é "erro".
4. **Checkout Stripe.** Usar cartão teste `4242 4242 4242 4242`, completar fluxo até `/my-plan` mostrar plano ativo.
5. **Cancelar subscription.** Clicar "Cancelar" no `/my-plan`, confirmar que estado muda.

Cada um desses é um arquivo `e2e/<fluxo>.spec.ts` separado — facilita retry individual em CI.

### Fase 3 (S8+) — Integração backend

1. **supertest contra instância real de staging.** Rodar `jest-e2e.json` (já configurado) apontando para `staging-api.myurbanai.com`, validar auth + endpoints críticos.
2. **Contract tests.** Se expusermos Swagger, validar com `dredd` ou `schemathesis` que a spec OpenAPI bate com o runtime.

### Fase 4 (S10+) — Load + a11y

- `k6` simulando 100 VUs no fluxo crítico (F5C.2 item 26).
- `axe-core` via Playwright para WCAG 2.1 AA (F5C.2 item 28).

---

## Convenções

- **Arquivo de spec:** `.spec.ts` para unit (Jest), `.spec.ts` dentro de `e2e/` para Playwright.
- **Mocks:** usar apenas para infra externa (DB, HTTP, Stripe). Nunca mockar código próprio sendo testado.
- **Dados de teste:** emails `teste+<id>@urbanai.com.br` — evita colisão se alguém esquecer de limpar.
- **Nome do teste:** fala o que VERIFICA, não o que FAZ. Bom: `"rejects duplicate email with ConflictException"`. Ruim: `"test register duplicate"`.

---

## Métricas de progresso

| Alvo | Quando | Hoje |
|---|---|---|
| Cobertura de linhas ≥ 20% (backend) | S7 | ~5% |
| Cobertura de linhas ≥ 50% (backend, serviços críticos) | S10 | — |
| 100% do fluxo crítico coberto por Playwright | S9 | 0/5 cenários |
| CI verde em todos os PRs | S6 | ✅ (workflows ci.yml) |
| Load test baseline documentado | S10 | — |

---

*Última atualização: 24/04/2026 — suite inicial criada junto com item 9 do plano F5C.*
