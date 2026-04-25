# Urban AI — Roadmap Pós-Sprint
**Versão 2.4 · Atualizado: 24/04/2026 · Base: Sprint de migração encerrado em D14 (20/03/2026)**

> 🆕 **v2.4 (24/04/2026) — Sprint técnico de hardening + fundação Stays + repricing.** Em uma única sessão de trabalho foram entregues 29 commits cobrindo: F5C inteira (CRIT, P1, Operação, P2 — exceto execução manual de staging/load test), F6.4 (fundação técnica do Stays — domínio, conector, service, cron auto-apply, paywall por imóvel), F6.5 (matriz de cobrança por imóvel × 4 ciclos), itens F5C.4 de docs (5 ADRs, LGPD, SLO, runbooks). Backend cresceu de 0 para **75 testes unitários verdes**. Estado da IA explicitado em **F6.1** com 4 tiers de maturidade — hoje estamos no **Tier 0** (engine matemática rodando com dataset mock).
>
> 🆕 **v2.3 (22/04/2026) — Norte Estratégico e confirmação do parceiro Airbnb (Stays S.A.).** Mantido.
>
> 🆕 **v2.2 (22/04/2026) — Auditoria técnica completa.** Mantido.
>
> 🔄 **v2.1 (21/04/2026) — F5B Entregas Extras (E1–E7).** Mantido.

---

## Legenda
- ✅ Concluído
- 🔄 Em andamento
- ⬜ Pendente
- 🔴 Bloqueante — impede avanço
- 💰 Há custo envolvido
- 🧠 Tier de maturidade da IA (Tier 0/1/2/3/4)

---

## 📌 Norte Estratégico — 8 Gaps Para Atingir o Objetivo

> **Objetivo Urban AI (brand book):** virar a plataforma líder de otimização de receita para hospedagem na América Latina, começando por anfitriões de Airbnb em SP, com a promessa quantificável de "+30% de receita via IA".

| # | Gap | Estado em 24/04/2026 |
|---|-----|---|
| 1 | **Prova numérica de ROI** | ⬜ Sem cases auditados ainda |
| 2 | **Dataset real para o KNN** | ⬜ Engine roda com 3 imóveis mock (Tier 0) |
| 3 | **Ação automatizada via canal oficial** | 🔄 Fundação Stays pronta; canal não conectado em prod |
| 4 | **Unit economics que fechem conta** | ✅ Repricing F6.5 implementado (cobrança por imóvel × 4 ciclos) |
| 5 | **Confiança operacional** | ✅ F5C.1 + F5C.2 completas (bcrypt, throttler, helmet, JWT cookie, env hardening, refresh rotation) |
| 6 | **Canal de aquisição validado** | ⬜ Aguarda aprovação de orçamento + start de F5.3 |
| 7 | **Time com capacidade real** | ⬜ Decisão de contractor pendente |
| 8 | **Compliance e LGPD mínimo** | 🔄 Política interna escrita; DPAs pendentes; consentimento Stays já no código |

> 💡 **Resumo da posição em 24/04:** lançamento (#5, #6, #7, #8) está 50% destravado — segurança técnica está sólida, faltam decisões comerciais. Objetivo estratégico de liderança (#1, #2, #3, #4) está 25% — repricing pronto, mas IA ainda no Tier 0 e sem prova de ROI.

---

## PENDÊNCIAS EM ABERTO (carryover do sprint)

| Status | Item | Responsável | Prazo estimado | Observação |
|--------|------|-------------|----------------|------------|
| 🔄 | **KYC Stripe** | Gustavo + Sócios | Semana 6 | Bloqueia cobrança real. Test mode funciona até lá. |
| 🔄 | **Transferência domínio urbanai.com.br** | Gustavo + Lumina | 2–5 dias úteis | Apontamento temporário ativo. |
| 🔄 | **Transferência domínio myurbanai.com** | Lumina Lab | 2–5 dias úteis | `app.myurbanai.com` operacional. |

---

## F5A — Validação de Produto, UX e Fluxos Reais ⚡
**Status:** ~60% (sem mudança nesta sprint).
**Pendências:** mensagens de erro acionáveis, onboarding D1/D3/D7 e-mails, responsividade mobile completa.

### Resumo

Itens de UX e fluxo (5A.1 a 5A.6 da v2.3) seguem **majoritariamente pendentes**. Esta sprint focou em hardening técnico, não em UX. Próxima sprint: priorizar 5A.1 (erros de form) + 5A.6 (mobile) antes de F7 beta.

| Bloco | % | Próximo passo |
|---|---|---|
| 5A.1 Cadastro/Auth UX | 30% (paywall corrigido) | Mensagens acionáveis, estados de botão |
| 5A.2 Onboarding | 40% (rota /profile feita) | E-mails D1/D3/D7 via Mailersend |
| 5A.3 Cadastro de imóveis | 20% | Audit de form, validação, refresh imediato no dashboard |
| 5A.4 Dashboard + recomendação | 30% | Estado de loading, fallback "dados insuficientes" |
| 5A.5 Stripe fluxo real | bloqueado em KYC | — |
| 5A.6 Responsividade mobile | 0% | Audit em iOS/Android |

---

## F5 — Presença Digital
**Status:** Landing 95% pronta (técnico). Aguarda IDs analytics + domínio.

| Item | Status |
|---|---|
| Landing principal Glassmorphism + SEO | ✅ |
| Página de planos com Stripe | ✅ (toggle binário antigo) + ✅ /plans/v2 (4 ciclos F6.5) |
| GA4 + Meta Pixel via `next/script` | ✅ Código pronto, env vars vazias |
| Formulário de pré-cadastro (`WaitlistForm`) | ✅ Componente pronto, endpoint vazio |
| Publicar em `urbanai.com.br` | ⬜ Aguarda DNS |
| Redes sociais (4/12 posts criados) | ⬜ Aguarda 8 posts + cadência |
| Tráfego pago (F5.3 — experimento com pivot) | 🔴 Aguarda aprovação orçamento |

**Sua ação:** criar property GA4 + Pixel Meta + form Formspark/Formspree → setar `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_WAITLIST_ENDPOINT` no Railway.

---

## F5B — Entregas Extras 07–21/04 (✅ todas no código)

E1 toggle billing mensal/anual · E2 captura `airbnbHostId` no onboarding · E3 cron Gemini hourly · E4 cron de análises aceitas · E5 `/my-plan` + cancelamento · E6 landing `/lancamento` · E7 `PaymentCheckGuard`. **Dívidas D1–D6 (testes ausentes) parcialmente atacadas em F5C.4 #2.**

---

## F5C — Hardening Operacional ✅ (4/4 sub-blocos)

### 5C.1 CRIT (5/6 + KYC)

| # | Item | Status |
|---|---|---|
| 1 | RapidAPI key → env var | ✅ Commit `890ae85` |
| 2 | `console.log` de senha/Auth removidos (4 leaks) | ✅ Commit `6d1d9c5` |
| 3 | `synchronize:true` controlado por env | ✅ Commit `cfc1bc4` (cutover manual em runbook) |
| 4 | `.env.example` em 4 serviços | ✅ Commit `f1bdff4` |
| 5 | `.gitignore` + 29 arquivos lixo removidos | ✅ Commit `22434e2` |
| 6 | KYC Stripe | ⬜ Sua ação |

### 5C.2 P1 (10/10) ✅

Todos os 10 itens entregues nesta sprint (commits `9cbf053`, `2430ffb`, `f960825`, `26da4a9`, `b9f5d1f`, `2d6b3a6`, `d1c1bc1`):

- ✅ IP hardcoded → `NEXT_PUBLIC_CHAINLIT_URL`
- ✅ CORS fail-closed
- ✅ `@nestjs/throttler` global + 5/min em /auth/*
- ✅ `helmet` + CSP (Stripe + Sentry + GMaps)
- ✅ SHA-256 → bcrypt(12) com **lazy rehash transparente** no login
- ✅ `Dockerfile copy` removido
- ✅ ESLint reativado no build (rules-of-hooks errors corrigidos)
- ✅ `UrbanAIPricingEngine` via DI
- ✅ Suite de testes expandida (11 → 75 testes)
- ✅ JWT httpOnly cookie + refresh rotation **(Fase 1 backend; Fase 2 frontend pendente)** + bônus crítico: `JWT_SECRET` hardcoded `"mysecretkey"` removido em 2 arquivos

### 5C.3 Operação (5/5) ✅

Commit `b4fd7ea`:

- ✅ `docs/runbooks/access-onboarding.md` — checklist por sistema (10 ferramentas)
- ✅ `docs/adr/0006-secrets-vault-strategy.md` — Railway Secrets escolhido
- ✅ `docs/adr/0007-aposentar-knn-microservice.md` + `DEPRECATED.md`
- ✅ READMEs raiz + backend + frontend reescritos
- ✅ 5 runbooks de incidente (`docs/runbooks/incident-response/`)

### 5C.4 P2 (8/8 — código + docs) ✅

Commits `604141e`, `62357ca`:

- ✅ JWT httpOnly + refresh rotation (entregue junto com #5C.2 #10)
- ✅ Cobertura de testes (75 testes; serviços críticos cobertos; gap global em `propriedades/` documentado)
- ✅ 5 ADRs retroativos (`docs/adr/0001` a `0005`)
- ✅ Política LGPD interna + DPA checklist
- ✅ `docs/slo.md` (uptime 99.5%, RTO 2h, RPO 24h, error budget)
- ✅ `docs/runbooks/backup-restore.md` com drill trimestral
- ✅ `load-tests/` k6 (smoke + login flow + pricing recommendation)
- ✅ `e2e/a11y.spec.ts` axe-core + `docs/runbooks/wcag-audit-checklist.md`

**Pendente sua execução manual:**
- Provisionar staging Railway (runbook em `docs/runbooks/staging-provisioning.md`)
- Submeter KYC Stripe
- Disparar primeiro drill de restore + load test em staging

---

## F6 — Inteligência Artificial e Produto

### 6.1 Motor KNN com Dados Reais — 🧠 **Ainda no Tier 0**

> **Estado real (24/04/2026):** o motor existe, é testável (9 testes), aplica multiplicadores corretos, mas **roda com dataset mock**. Sem treinamento com dados reais, a recomendação é uma regra de negócio sofisticada — não uma IA que aprende. Esta seção foi reescrita explicitando os 4 tiers de maturidade necessários para a IA "funcionar de verdade".

#### Tiers de maturidade da IA

| Tier | O que muda | Esforço dev | Quando |
|---|---|---|---|
| **🧠 Tier 0** (atual) | Engine matemática + 3 imóveis mock | ✅ Pronto | — |
| **🧠 Tier 1** | Engine treina ao boot com TODOS os imóveis cadastrados; cron semanal re-treina; lat/lng/metroDistance/amenities resolvidos automaticamente | 1–2 sprints | S6–7 |
| **🧠 Tier 2** | Dataset histórico externo (AirROI grátis, depois Stays trade) com ≥200 imóveis × 12 meses | 2–3 sprints + parcerias | S7–10 |
| **🧠 Tier 3** | Backtesting com hold-out + MAPE ≤15% como gate de qualidade | 1 sprint | S9–10 |
| **🧠 Tier 4** | Loop de receita real (Stays Reservations API alimenta histórico de ocupação por imóvel × dia × preço) | 2–3 sprints + parceria fechada | S11+ |

#### F6.1 — Tarefas concretas (revisadas v2.4)

##### Tier 1 — Treinar o KNN com o que temos hoje (S6–7)

| Status | Tarefa | Resp. |
|---|---|---|
| ⬜ | **Chamar `aiEngine.initialize(properties)` no boot do backend** com TODOS os imóveis cadastrados (`addressRepository.find()` → mapear para o shape esperado). Hoje o método existe mas não é invocado. | Gustavo / Dev |
| ⬜ | **Cron semanal** `0 4 * * 0` (domingo 04h BRT) que re-chama `initialize()` após o scraping da semana terminar. Adicionar em `cron.module.ts`. | Gustavo / Dev |
| ⬜ | **Resolver lat/lng** automaticamente para todos os imóveis sem coordenada via Google Geocoding API (já temos `GOOGLE_MAPS_API_KEY`). One-off + on-create. | Gustavo / Dev |
| ⬜ | **Calcular `metroDistance`** via cost-matrix (a estação mais próxima). Persistir em coluna nova `address.metro_distance_km`. | Gustavo / Dev |
| ⬜ | **Estimar `amenitiesCount`** a partir do título do anúncio Airbnb via Gemini API (mesmo client de events-enrichment). Persistir em `list.amenities_count`. | Gustavo / Dev |
| ⬜ | **Estimar `category`** (0/1/2) inicial heurística por preço base + bairro até termos histórico real para o KNN aprender sozinho. | Gustavo / Dev |
| ⬜ | Smoke test: boot do backend + chamada `/propriedades/:id/analise-preco` retorna recomendação **diferente** do fallback Standard | Gustavo |

##### Tier 2 — Dataset externo (S7–10)

| Status | Tarefa | Resp. |
|---|---|---|
| ⬜ | **AirROI API gratuita** — testar cobertura SP, criar conta, integrar como fonte secundária no scraping pipeline. Persistir snapshot diário em S3 + tabela `airroi_listings`. | Gustavo |
| ⬜ | **Stays Modelo 1 (trade)** — após validação parceria, importar dataset agregado anonimizado mensal. Sem PII, formato CSV. | Gustavo + Sócios |
| ⬜ | **Comunidade Superhost SP** — recrutar 20–30 voluntários beta que cedem histórico em troca de acesso antecipado. Form de coleta + import script. | Gustavo |
| ⬜ | **Sympla API + Prefeitura SP** — substituir scraping de eventos por APIs oficiais (mitigação jurídica F9.2). | Gustavo / Dev |
| ⬜ | **Critério mínimo de treinamento documentado:** ≥200 imóveis × 12 meses. Abaixo disso, KNN cai no fallback matemático declarado. | — |

##### Tier 3 — Backtesting + qualidade (S9–10)

| Status | Tarefa | Resp. |
|---|---|---|
| ⬜ | **Hold-out 20%** do dataset para teste fora do treino. | Gustavo / Dev |
| ⬜ | **Função `calculateMAPE`** que mede erro % entre `precoSugerido` e o preço real que teve reserva no hold-out. | Gustavo / Dev |
| ⬜ | **Job semanal de qualidade** que recalcula MAPE e abre alerta no Sentry se passar de 15%. | Gustavo / Dev |
| ⬜ | **Gate de release**: MAPE ≤ 15% antes de F7 (beta fechado). Sem isso, beta usa fallback matemático com aviso explícito. | Gustavo |
| ⬜ | **Dashboard interno** mostrando MAPE histórico, distribuição de erro por bairro/categoria. | Gustavo / Dev |

##### Tier 4 — Loop de receita (S11+)

| Status | Tarefa | Resp. |
|---|---|---|
| ⬜ | **Stays Reservations API** — consumir via `StaysConnector.listReservations` (a implementar — método não existe ainda no conector). | Gustavo / Dev |
| ⬜ | **Tabela `revenue_history`** — uma linha por imóvel/data/preço/status (booked/free/blocked). | Gustavo / Dev |
| ⬜ | **Job diário** que cruza `AnalisePreco` aceito × reserva real × revenue por noite e calcula uplift. | Gustavo / Dev |
| ⬜ | **Endpoint `/propriedades/:id/uplift`** que mostra "antes Urban AI vs depois Urban AI" — alimenta dashboard do anfitrião + 3 cases de F7.1. | Gustavo / Dev |
| ⬜ | **Retraining alimentado por feedback real** — modelo aprende quais sugestões resultaram em reserva e ajusta multiplicadores. | Gustavo / Dev (Pós go-live) |

#### Resumo F6.1 com tradução comercial

| Hoje | Após Tier 1 | Após Tier 2 | Após Tier 3 | Após Tier 4 |
|---|---|---|---|---|
| "Engine de regras com mock" | "IA treinada na minha carteira" | "IA treinada com dados de mercado SP" | "IA validada com MAPE conhecido" | "IA que cresce a receita comprovada" |
| **+0% prova** | +baseline interna | +contexto SP | +qualidade quantificada | +ROI comprovado em número |

---

### 6.2 Fontes de Dados e APIs

Mesmas tarefas da v2.3, sem grandes mudanças. AirROI/Stays se sobrepõem com F6.1 Tier 2. PriceLabs reunião segue prevista.

### 6.3 Produto e Painel Administrativo

Sem mudança nesta sprint. Painel admin básico ainda pendente — fila para semana 9.

### 6.4 Integração Oficial Airbnb via Stays — 🔄 **Fundação ✅, ativação pendente**

> **Estado em 24/04/2026:** todo o código do lado Urban AI está pronto e testado (13 specs do `StaysService`). Falta apenas: (1) parceria comercial com Stays + credenciais reais; (2) auto-match listing↔imóvel (UI); (3) OAuth flow se Stays oferecer.

| Status | Tarefa | Quando |
|---|---|---|
| ✅ | Domínio: entities `StaysAccount`, `StaysListing`, `PriceUpdate` (com idempotency, audit trail, rollback) | Commit `c634805` |
| ✅ | `StaysConnector` (REST client com retry exponencial 3x, 4xx não-retry) | ✅ |
| ✅ | `StaysService` (connect, sync, pushPrice com guardrails ±25%/-20%, rollback) | ✅ |
| ✅ | 6 endpoints REST `/stays/*` | ✅ |
| ✅ | Cron `stays-auto-apply` (hora em hora) — modo automático | ✅ |
| ✅ | UI `/settings/integrations` (conectar com checkbox LGPD, sync, listings) | ✅ |
| ✅ | 13 testes unitários | ✅ |
| ✅ | Runbook `docs/runbooks/stays-integration-setup.md` | ✅ |
| 🔴 | **Parceria comercial Stays** (one-pager pronto em `docs/outreach/stays-one-pager.md`) | S5–6 |
| ⬜ | OAuth 2.0 flow (se Stays disponibilizar) | S9 |
| ⬜ | Auto-match listing Stays ↔ imóvel Urban AI por similaridade de título/endereço | S10 |
| ⬜ | UI de histórico de PriceUpdate por imóvel (com botão Reverter) | S10 |
| ⬜ | Confirmar shape real da API Stays + ajustar `StaysConnector` se necessário | Após reunião |
| ⬜ | Tela de configuração de guardrails por anfitrião (max increase/decrease %) | S10 |

### 6.5 Repricing por Imóvel — ✅ **Implementado**

> **Estado em 24/04/2026:** todo o backend + UI da matriz de cobrança está pronta e testada. 8 novos Stripe Price IDs precisam ser criados manualmente no Dashboard.

| Status | Tarefa | Status |
|---|---|---|
| ✅ | Entity `Plan` estendida com 12 campos novos (4 ciclos × preços/IDs/descontos) | Commit `5e60be9` |
| ✅ | Entity `Payment` com `billingCycle`, `listingsContratados`, `planName` | ✅ |
| ✅ | `seedPlans` com matriz F6.5 (Starter R$ 97→58, Profissional R$ 197→118 anual) | ✅ |
| ✅ | `createCheckoutSession` aceita 4 ciclos + quantity | ✅ |
| ✅ | Webhook persiste billingCycle + listingsContratados via metadata | ✅ |
| ✅ | `customer.subscription.updated` trata mudança de quantity (upsell) | ✅ |
| ✅ | Endpoint `GET /payments/listings-quota` | ✅ |
| ✅ | UI `/plans/v2` com `PricingCalculatorV2` (seletor de 4 ciclos + quantidade + calculadora) | ✅ |
| ✅ | `ListingsQuotaGuard` componente | ✅ |
| ✅ | Testes (8 novos, 75 totais) | ✅ |
| 🔴 | **Criar 8 Stripe Price IDs no Dashboard** + setar env vars no Railway | Sua ação |
| ⬜ | Rota `/plans/v2/upsell` para mudança de quantity sem recriar subscription (Stripe Customer Portal ou subscription.update direto) | S8 |
| ⬜ | E-mails transacionais por ciclo (Mailersend templates) | S9 |
| ⬜ | Grandfathering 3 meses para usuários ativos pré-F6.5 | S10 |
| ⬜ | Simulação financeira ARR cenários conservador/base/otimista | S7 |
| ⬜ | Substituir toggle binário em `/plans` antiga ou redirect para `/plans/v2` | S8 |

---

## F7 — Beta Fechado e Go-Live Oficial

**Status:** preparação técnica essencialmente pronta; **execução depende de IA Tier 2/3 + KYC + parceria Stays + dataset**.

### 7.1 Beta com 3 cases auditados de ROI

Sem mudanças vs v2.3. Reforço: **gate explícito** que beta não abre antes de:
- 🧠 IA no Tier 2 mínimo (algum dataset real)
- ✅ Staging rodando smoke test ponta-a-ponta
- ✅ KYC aprovado
- ✅ MAPE medido

### 7.2 Go-Live Oficial

Recalibrado: **S15–17** (mid–late julho/2026).

---

## F9 — Time, Compliance e Observabilidade Transversal

### 9.1 Time

Sem mudança. Decisão de contractor segue pendente — agora ainda mais urgente porque F6.1 Tiers 1–3 são 4–6 sprints de dev e o Gustavo está acumulando tudo.

### 9.2 Compliance e LGPD

| Status | Item |
|---|---|
| ✅ | Política de Privacidade interna (`docs/lgpd/politica-privacidade-interna.md`) |
| ✅ | DPA checklist com cronograma (`docs/lgpd/dpa-checklist.md`) |
| ✅ | Consentimento Stays no código (UI `/settings/integrations`) |
| ⬜ | Persistir log do consentimento em `User.consents` (campo novo) |
| ⬜ | Assinar 6 DPAs prioritários (Stripe, Mailersend, AWS, Railway, Upstash, Sentry) — meta S7 |
| ⬜ | Posicionamento jurídico sobre scraping (`docs/legal-scraping.md`) — após advogado externo |
| ⬜ | Template + processo de resposta a solicitação LGPD em ≤15 dias |
| ⬜ | Página pública `/privacidade` sincronizar com a interna |

### 9.3 Observabilidade Estendida

| Status | Item |
|---|---|
| ✅ | Sentry com `APP_ENV` separando prod/staging |
| ✅ | UptimeRobot apontado para `app.myurbanai.com/health` |
| ⬜ | Eventos custom no Sentry (`user.signed_up`, `pricing.suggestion_accepted`, `stays.price_pushed` etc.) — código pronto para adicionar nos services |
| ⬜ | Alertas Sentry (webhook Stripe falhando, push Stays falhando >5%, Prefect 2 dias seguidos) |
| ⬜ | Dashboard de métricas de produto (NPS, ativação, retenção, MRR, churn) — Grafana ou PostHog free |
| ⬜ | Adicionar `GET /health` ao backend se ainda não existe (referenciado em load-tests + UptimeRobot) |

---

## Resumo de Custos Pós-Sprint (atualizado)

| Fase | Custo estimado | Status |
|------|----------------|--------|
| F5 — Presença Digital | R$ 4.340–8.170/mês | 🔴 Bloqueado em aprovação |
| F5C — Hardening | ✅ Entregue (~120h dev consumidas nesta sprint) | ✅ |
| F6.1 Tier 1 | ~80h dev | S6–7 |
| F6.1 Tier 2 (dataset) | R$ 0 (trade Stays) ou R$ 5–15k (PMC) | S7–10 |
| F6.1 Tier 3 (MAPE) | ~40h dev | S9–10 |
| F6.1 Tier 4 (loop receita) | ~120h dev (depende Stays) | S11+ |
| F6.4 Stays — fundação | ✅ Entregue (~150h dev consumidas) | ✅ |
| F6.4 Stays — ativação | depende parceria | S5–11 |
| F6.5 Repricing | ✅ Entregue | ✅ |
| F7 Beta + Go-Live | R$ 5–10k mídia | S13–16 |
| F9 — Time/Compliance/Obs | contractor R$ 12–20k/mês · advogado R$ 3–8k · ferramentas R$ 200/mês | S5–14 |
| Infra Railway | ~R$ 1.000/mês | recorrente |

> 💡 **Decisão urgente 1:** Aprovar orçamento marketing (semana 5).
> 💡 **Decisão urgente 2:** Validar Stays + iniciar parceria (semana 5–6).
> 💡 **Decisão urgente 3:** Decidir contractor dev (semana 5–6).
> 💡 **Decisão urgente 4:** Submeter KYC Stripe (semana 6).
> 💡 **Decisão urgente 5 (NOVA):** Aceitar publicamente que **a IA está no Tier 0 hoje** e definir até quando subir para Tier 1/2 — isso afeta a narrativa do go-live e o que a landing pode prometer.

---

## Marcos Críticos — Próximas Semanas (revisados v2.4)

| Quando | Marco | Impacto se atrasar |
|--------|-------|--------------------|
| Semana 5 | F5C.1 CRIT 100% (KYC enviado) | Cobrança real bloqueada |
| Semana 5 | Aprovar orçamento marketing | F5.3 não inicia |
| Semana 5 | Validar Stays + contato comercial | F6.4 ativação não inicia |
| Semana 5–6 | Decisão de time (contractor) | F6.1 trava em uma única pessoa |
| Semana 6 | **Tier 1 da IA implementado** (initialize + lat/lng + amenities) | Continua "fallback Standard" para todo mundo |
| Semana 6 | Staging Railway provisionado | F5C.4 testes não rodam |
| Semana 6–7 | Stripe Price IDs F6.5 criados + ativos no Railway | Repricing fica como código sem efeito |
| Semana 7 | DPAs assinados (6 prioritários) | Risco LGPD em incidente |
| Semana 7–8 | **Tier 2 dataset** (AirROI + Stays trade) | IA continua sem base de mercado |
| Semana 9–10 | **Tier 3 MAPE ≤ 15%** | Beta abre sem qualidade quantificada |
| Semana 11 | F6.4 ativação (push Stays em prod) | Fica em modo recomendação manual |
| Semana 11–12 | Beta fechado iniciado | Atraso em F7 |
| Semana 12 | 3 cases auditados de ROI | Landing não converte |
| **Semana 15–17** | **Go-Live oficial** | — |

---

## Estrutura de Relatórios ao Cliente

Mantida da v2.3.

---

*Urban AI © 2026 · Uso interno · v2.4*

---

## Changelog do Roadmap

| Data | Versão | Autor | Mudanças |
|------|--------|-------|----------|
| 20/03/2026 | v1.0 | Gustavo | Criação pós-D14 |
| 13/04/2026 | v2.0 | Gustavo | F5/F5A/F6/F7 |
| 21/04/2026 | v2.1 | Roadmap-Manager Squad | F5B (E1–E7) |
| 22/04/2026 | v2.2 | Gustavo + Claude | F5C, F6.4, F6.5 |
| 22/04/2026 | v2.3 | Gustavo + Claude | Norte Estratégico, F9, sequenciamento |
| 24/04/2026 | **v2.4** | **Gustavo + Claude** | **Sprint técnico de 29 commits.** F5C inteira marcada como ✅ (1/2/3/4). F6.4 fundação ✅. F6.5 ✅. F6.1 reescrita explicitando os 4 Tiers de maturidade da IA — esclarecendo que hoje estamos no **Tier 0**. Marcos recalibrados; go-live S15–17. |
