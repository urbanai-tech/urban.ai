# Relatório de Auditoria — Vitor Verificador

**Run:** 2026-04-21-175845
**Janela auditada:** 2026-04-06 → 2026-04-21 (sprint quinzenal posterior ao último ciclo do roadmap-manager)
**Fonte da verdade:** `docs/roadmap-pos-sprint.md` v2.0 (13/04/2026)
**Repositórios verificados:** `urban-ai-backend-main`, `Urban-front-main`, `urban-ai-knn-main`, `urban-pipeline-main`, `urban-webscraping-main`

> ⚠️ **Aviso do auditor:** nenhum dos cinco repositórios possui a pasta `.git/` presente nesta working copy — não foi possível rodar `git log`. A auditoria foi feita com base em: (a) arquivos de evidência que o time mantém dentro dos repositórios (`last-commit.txt`, `CHANGELOG.md`), (b) análise estática do código modificado nos últimos 15 dias (`find -mtime -15`), (c) cruzamento dos artefatos com o roadmap. Quando a evidência foi forte o suficiente para identificar a feature, aprovo. Quando só há diff parcial ou dependência externa não verificável (ex.: validação em produção pós-KYC Stripe), classifico como **Pendente de Validação Técnica** conforme regra do step-02.

---

## 1. Evidências encontradas (aprovadas)

### 1.1 Backend — `urban-ai-backend-main`

| Arquivo / módulo | Evidência | Tarefa do roadmap |
|------------------|-----------|-------------------|
| `src/plans/*` (plans.controller.ts, plans.service.ts, plans.module.ts) | Novo módulo `PlansModule` com seed automático (`onModuleInit → seedPlans`) criando planos `starter` e `profissional`. `stripePriceId` + `stripePriceIdAnnual` no `plan.entity.ts`. | **F5.1** — "página de preços com CTA direto de assinatura (Stripe) — 2 planos incluídos" (já estava ✅ no roadmap, agora confirmada a backing store) |
| `src/payments/payments.service.ts` | `createCheckoutSession(data: { plan, billingCycle }, userId)` — aceita `monthly` ou `annual` e seleciona `stripePriceIdAnnual` quando `annual`. `cancelSubscription(userId)` chamando `stripe.subscriptions.cancel`. `getCurrentSubscription()` listando subs Stripe. | Nova capability (sem item correspondente no roadmap atual) — **registrar como entrega extra F5.1/5A.5** |
| `src/evento/events-enrichment.service.ts` | Novo cron `@Cron('0 * * * *')` consumindo `GoogleGenerativeAI` (Gemini) para enriquecer eventos pendentes. Flag `GEMINI_API_KEY` com fallback e logger. | Nova capability (não prevista no roadmap F6.2) — **registrar como entrega extra** |
| `src/cron/*` (controller, service, module) | Novo `CronService` com `buscarAnalisesAceitas()` rodando diariamente para disparar notificações via `MailerService` + `NotificationsService`. | Relaciona-se a **F5A.2 — sequência de e-mails de onboarding via Mailersend** (parcial — o cron foi criado, mas ainda não há trilha D1/D3/D7 de onboarding; ver pendências abaixo) |
| `src/entities/plan.entity.ts` | Campos `priceAnnual`, `originalPriceAnnual`, `stripePriceIdAnnual` presentes. | Suporte ao toggle mensal/anual — **entrega extra** |
| `src/app.module.ts` | `PlansModule`, `ScheduleModule.forRoot()` e novos wiring estão importados. | Integração dos novos módulos |

### 1.2 Frontend — `Urban-front-main`

| Arquivo | Evidência | Tarefa do roadmap |
|---------|-----------|-------------------|
| `src/app/onboarding/page.tsx` | Fluxo de 3 etapas (`TOTAL_STEPS` = 3, `step === 1/2/3` no JSX). Commit registrado no `last-commit.txt`: `feat(UX): track airbnbHostId during step 3 of onboarding for future automated enrichment jobs` (2026-04-03). Chama `updateProfileById(undefined, { airbnbHostId: hostUserId })`. | **F5A.2** — "Definir jornada do onboarding" e **F6.2** — Airbnb como fonte de dados (parcial — HostId captado mas enrichment futuro) |
| `src/app/service/api.ts` | `UpdateProfilePayload` expõe `airbnbHostId?: string`. `createCheckoutSession(planId, billingCycle='monthly'|'annual')` e `cancelSubscription()` em produção. | **F5A.5** — fluxos de assinatura Stripe (CTA + cancelamento) implementados |
| `src/app/plans/page.tsx` | Toggle `Switch` entre `monthly` / `annual` (`isAnnual` state, `billingCycle = isAnnual ? 'annual' : 'monthly'`). Chama `createCheckoutSession(plan.name, billingCycle)`. | **F5.1** — página de preços 2 planos (já ✅) — **novo**: toggle anual/mensal |
| `src/app/componentes/GlobalPaywallModal.tsx` | Paywall Global implementado. | **F5A.1** — "Revisar fluxo de recuperação de senha e Paywall Global Popup" (já ✅) — mantido. |
| `src/app/context/PaymentCheckGuard.tsx` | Guard que verifica pagamento do usuário antes de permitir acesso a rotas protegidas. | **F5A.5** — garantir que usuário sem assinatura vê CTA claro (parcial, ver abaixo) |
| `src/app/(marketing)/lancamento/page.tsx` | Nova landing page de lançamento ("A nova inteligência que blinda o seu calendário…"). | Entrega extra — **F5.1** (landing adicional não prevista — complemento ao home) |
| `src/app/my-plan/page.tsx` (layout + page) | Nova rota de gestão do plano atual do usuário. | **F5A.5** — "Testar cancelamento de assinatura — fluxo UI + atualização de status" (aprovado como rota UI, ver pendências sobre teste em produção) |

### 1.3 KNN Engine — `urban-ai-knn-main`

Nenhum arquivo `.js` modificado após 2026-03-11. **Sem entregas no sprint atual.** O serviço stand-alone (`ml-knn`, `kd-tree-javascript`) continua igual à última run. Sem itens do roadmap F6.1 fechados neste repo desta vez.

### 1.4 Pipeline — `urban-pipeline-main`

Último registro em `CHANGELOG.md`: versão **0.3.0 (2025-09-11)**. Sem entregas novas no sprint. **Fora do escopo desta run.**

### 1.5 Webscraping — `urban-webscraping-main`

Último registro em `CHANGELOG.md`: versão **0.11.1 (2025-08-07)**. Sem entregas novas no sprint. **Fora do escopo desta run.**

---

## 2. Matriz final de cruzamento (Roadmap ↔ Código)

### 2.1 Itens a marcar como ✅ (evidência técnica forte)

| Item do roadmap | Evidência | Ação para Ricardo |
|------------------|-----------|-------------------|
| *Nenhum item `⬜` do roadmap atual atingiu ✅ completo neste sprint.* Os itens encontrados já estavam ✅ (paywall, /profile, 2 planos na landing). | — | — |

**Observação ao Ricardo:** os itens do roadmap que ainda estavam ⬜ Pendente (ex.: "implementar checklist de setup do perfil", "sequência de e-mails D1/D3/D7", "testar login Google OAuth") **não têm evidência completa no código**. Ver seção 2.3.

### 2.2 Entregas novas sem item correspondente no roadmap (registrar como adendo)

| # | Entrega | Evidência | Fase sugerida |
|---|---------|-----------|----------------|
| E1 | **Toggle de billing mensal/anual** end-to-end (entidade `Plan` com `priceAnnual`/`stripePriceIdAnnual` + backend `createCheckoutSession` com `billingCycle` + UI `plans/page.tsx` com Switch) | `urban-ai-backend-main/src/plans/*`, `urban-ai-backend-main/src/payments/payments.service.ts:141-167`, `Urban-front-main/src/app/plans/page.tsx:80-84` | F5.1 (Presença Digital / Landing) |
| E2 | **Captura de `airbnbHostId` no step 3 do onboarding** para jobs automatizados de enriquecimento | `Urban-front-main/src/app/onboarding/page.tsx:471-473`, `Urban-front-main/src/app/service/api.ts:459-463`, `last-commit.txt` (03/04/2026) | F5A.2 + F6.2 (ponte entre onboarding e dados reais) |
| E3 | **Cron de enriquecimento de eventos via Gemini** (`events-enrichment.service.ts`) | `urban-ai-backend-main/src/evento/events-enrichment.service.ts:1-45` | F6.2 (Fontes de Dados e APIs) |
| E4 | **CronService de análises aceitas** (varre preços aceitos, dispara e-mail + notificação diária) | `urban-ai-backend-main/src/cron/cron.service.ts:1-40` | F6.3 (Produto e Painel) — automação operacional |
| E5 | **Rota `/my-plan`** com UI de cancelamento ligada a `DELETE /payments/cancelSubscription` | `Urban-front-main/src/app/my-plan/*`, `Urban-front-main/src/app/service/api.ts:186-189`, `urban-ai-backend-main/src/payments/payments.service.ts:67-101` | F5A.5 (Assinatura Stripe) |
| E6 | **Página `(marketing)/lancamento`** (landing secundária "Síndrome da Casa Barata") | `Urban-front-main/src/app/(marketing)/lancamento/page.tsx` | F5.1 (Landing Page) |
| E7 | **`PaymentCheckGuard`** — HOC/Context que bloqueia rotas privadas quando o usuário não tem assinatura ativa | `Urban-front-main/src/app/context/PaymentCheckGuard.tsx` | F5A.5 (CTA de assinatura) |

### 2.3 Itens ⬜ que seguem sem evidência — **não marcar como concluídos**

| Item do roadmap | Por que não passa |
|------------------|-------------------|
| F5A.1 — "Mapear erros de formulário sem feedback visual" | Sem artefato de mapeamento. Não é código, é documento — verificar com Gustavo. |
| F5A.1 — "Corrigir mensagens de erro genéricas" | Não há diff evidente ampliando mensagens de erro nos formulários em `(home)` nem em `properties/`. |
| F5A.1 — "Testar login com Google OAuth — edge cases" | `auth.controller.ts` e `auth.service.ts` sofreram alterações, mas não foi encontrado teste ou logs comprovando cobertura de edge cases OAuth. |
| F5A.2 — "Implementar checklist de setup do perfil (foto, nome, primeiro imóvel)" | O onboarding continua tendo 3 etapas (`TOTAL_STEPS = 3`), sem tela-checklist pós-cadastro. |
| F5A.2 — "Criar tooltip/guia contextual na primeira visita ao dashboard" | Nenhum arquivo `Tooltip`, `Guide`, `Onboarding` adicionado em `dashboard/`. |
| F5A.2 — "Sequência de e-mails de onboarding via Mailersend (D1, D3, D7)" | `MailerService` existe, `CronService` dispara e-mails de análises aceitas, mas **não há trilha D1/D3/D7 de onboarding** detectável. |
| F5A.3 — "Auditar formulário de cadastro de imóvel" | Sem artefato de auditoria. |
| F5A.3 — "Garantir que imóvel aparece imediatamente no dashboard (sem refresh)" | `properties/page.tsx` não foi modificado nesse ponto. |
| F5A.3 — "Testar upload de fotos (formato/tamanho/preview)" | `create/page.tsx` sem diff relacionado a upload. |
| F5A.4 — "Verificar se recomendação de preço exibe com imóvel real" | Depende do KNN, que não teve mudanças neste sprint. |
| F5A.5 — "Testar fluxo completo de assinatura em produção após KYC aprovado" | **KYC Stripe ainda 🔄 Em andamento** (seção "Pendências em aberto" do roadmap). Sem produção, sem teste real. |
| F5A.5 — "Validar página de checkout Stripe (logo, nome, valor)" | Depende de KYC aprovado. |
| F5A.5 — "Testar cancelamento de assinatura — fluxo UI + status" | UI existe (`my-plan/`) e endpoint existe, mas sem evidência de teste ponta a ponta. |
| F5A.5 — "Garantir CTA claro para usuário sem assinatura (não tela de erro)" | `PaymentCheckGuard` foi introduzido — **parcialmente coberto**, mas falta capturar screenshot do fluxo para validar o CTA. Manter ⬜ até QA manual. |
| F5.2 — "Criar conta Instagram @urbanai.oficial e LinkedIn" | Fora do código — responsabilidade de marketing. |
| F5.3 — "Aprovar orçamento de recursos com Fabrício e Rogério" | Bloqueante de negócio, não de código. |
| F6.1 — "Expor endpoints REST no backend para resultados do KNN" | Sem arquivos novos em `knn-engine/` roteando para REST dedicado neste sprint. |
| F6.1 — "Conectar dados reais de propriedades cadastradas ao treinamento do KNN" | KNN sem mudança este sprint. |
| F6.2 — "Pesquisar novas fontes de eventos em SP (Sympla API, Prefeitura SP)" | `events-enrichment.service.ts` usa Gemini para enriquecer eventos, mas **não adiciona fonte nova**. |
| F6.3 — "Implementar painel admin básico" | Sem arquivos novos em `dashboard/admin/` ou similar. |
| F7.x — Beta e Go-Live | Antecipado — não havia entregáveis previstos para este sprint. |

### 2.4 Tarefas flagradas como "Pendente de Validação Técnica" (regra do step-02)

Conforme determinação do step-02 ("Caso o ticket afirme 'Feito' mas nenhum código seja encontrado, a tarefa é imediatamente flagrada e removida dos itens a serem atualizados nesta run"), nenhum item do roadmap foi removido porque nenhum dos itens auditados estava **afirmado como feito verbalmente**. A auditoria operou de forma inversa: partimos do código entregue e confirmamos quais linhas do roadmap ele fecha.

---

## 3. Cobertura de testes (alerta mantido)

| Repo | Testes encontrados | Avaliação |
|------|--------------------|-----------|
| `urban-ai-backend-main` | 3 arquivos (`app.controller.spec.ts`, `maps/maps.controller.spec.ts`, `maps/maps.service.spec.ts`) | **Baixa** — nenhum teste novo nos módulos entregues (`plans/`, `payments/`, `cron/`, `evento/events-enrichment.service.ts`). |
| `Urban-front-main` | 0 arquivos `.test.*` / `.spec.*` | **Zero** — toolchain Jest/RTL presente em deps, mas sem suite ativa. |
| `urban-ai-knn-main` | 0 arquivos | **Zero** — persiste dívida já registrada no adendo `ADENDO_TECNICO_KNN.md` da run anterior. |
| `urban-pipeline-main` | Tem `pytest.ini` e `tests/` (não auditados este ciclo) | **A validar em próxima run** |
| `urban-webscraping-main` | N/A | **A validar em próxima run** |

**Veredito de testes:** a dívida técnica de cobertura **aumentou** neste sprint — 6 entregas (E1–E7 acima) sem suite de testes associada. Ricardo e Daniela devem registrar isso explicitamente.

---

## 4. Conclusão da Auditoria

```yaml
report: "Auditoria concluída em 2026-04-21. 7 entregas extras identificadas no código (E1-E7). Nenhum item ⬜ do roadmap passou para ✅ neste sprint — o roadmap precisa de um adendo para incorporar as entregas extras e reconhecer a pendência de itens de UX/QA ainda ⬜."
approved_items: []
extra_deliveries: [E1, E2, E3, E4, E5, E6, E7]
flagged_items:
  - "F5A.5: testes em produção dependentes de KYC Stripe (ainda 🔄)"
  - "F5A.2: checklist de setup e sequência D1/D3/D7 declarados mas sem código"
  - "F5A.1: edge cases de Google OAuth sem cobertura verificável"
technical_debt:
  - "0% de testes nos módulos plans/, payments/, cron/, events-enrichment."
  - "0 testes novos no frontend (Jest configurado, suite vazia)."
  - "KNN engine sem mudanças — dívida do adendo KNN anterior segue aberta."
next_owner: ricardo-roadmap
```

**Handoff para Ricardo Roadmap:** abrir `docs/roadmap-pos-sprint.md` e **adicionar uma nova seção "F5B — Entregas Extras Sprint 21/04"** com os itens E1–E7. Não alterar os itens `⬜` existentes a não ser que a evidência cobra 100% (não é o caso nesta run). Manter a dívida de testes visível.
