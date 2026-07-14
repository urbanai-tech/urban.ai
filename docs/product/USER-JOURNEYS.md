# Jornadas de Usuário — Urban AI

**Versão:** 1.0 (extraída dos specs E2E Playwright em `Urban-front-main/e2e/` + 2026-06-21)
**Base:** cada jornada abaixo é coberta por um teste E2E real (spec citado). Não é aspiracional — é o que o produto faz hoje.

---

## 1. Jornada feliz completa (do primeiro contato ao ROI)

```
DESCOBERTA          CONVERSÃO           ONBOARDING            PAGAMENTO         OPERAÇÃO            ROI
waitlist  ───────▶  convite/senha  ──▶  importa Airbnb   ──▶  checkout    ──▶  recomendação  ──▶  registra
(/lancamento)       (/waitlist/        + config motor       Stripe          por evento          resultado
                     aceitar)           + guardrails                         (dashboard)         → ROI
  ~1 min              ~5 min              ~7 min              ~10 min          ~15 min            dias/semanas
```

### Fase 1 — Descoberta e espera (`f8-waitlist-to-login.spec.ts`)
Host entra em `/lancamento`, vê a campanha, deixa e-mail → `POST /waitlist` retorna **posição na fila + código de referral**. Recebe e-mail com link `/waitlist/aceitar?token=…`.

### Fase 2 — Conversão (`f8-waitlist-to-login.spec.ts`, `login-post-login.spec.ts`)
No link, define senha (hash SHA-256 no front) → `POST /auth/waitlist/accept` → vira usuário ativo → redireciona a `/dashboard`. Login normal: `/auth/login` → checa estado do usuário, endereço, perfil, assinatura, imóveis e recomendações. Token em localStorage + cookie httpOnly. (Há também **login Google**.)

### Fase 3 — Onboarding / primeiro valor (`onboarding-airbnb-import.spec.ts`)
`/onboarding` → "Conecte seus imóveis" → cola **URL do Airbnb** → sistema busca `quick-info` (foto, bairro, tipo, rating, reviews) → "Registrar imóvel" (`/connect/register`) → tela "Ajustar recomendações" define o motor: `pricingStrategy=balanced`, `operationMode=notifications`, guardrails **−10%/+20%** → salva (`PUT /auth/profile`) → "Continuar para pagamento".

### Fase 4 — Pagamento (`plans-checkout-readiness.spec.ts`, `my-plan-billing.spec.ts`)
Checkout Stripe (`/payments/create-checkout-session`). Resiliência testada: plano sem preço válido → botão **desabilitado**; erro 500 → toast honesto; plano Enterprise (custom) → "Falar com comercial" em vez de checkout.

### Fase 5 — Operação (`dashboard-recommendations.spec.ts`)
No `/dashboard`, card por evento mostra: nome, **preço sugerido vs. atual + diferença %**, `motivo_ia`, badge "Sugestão da IA". "Aplicar sugestão" → `POST /sugestoes-preco/{id}/aceito`. "Registrar resultado" → modal (preço aplicado, status da reserva booked/not-booked, receita real, noites, observação) → `POST /sugestoes-preco/{id}/aplicado`.

### Fase 6 — ROI e retenção (`my-plan-billing.spec.ts`)
`/my-roi` mostra lift; `/my-plan` mostra quota (contratados/ativos/livres) com upsell "ainda pode cadastrar mais imóveis"; "Gerenciar cobrança" → portal Stripe.

---

## 2. Jornadas especializadas

- **Stays** (`stays-integrations.spec.ts`): `/settings/integrations` → código + chave + **consentimento** → `POST /stays/connect` → "Conectada e ativa" + quota de vínculos + modo por anúncio (auto/manual).
- **Event Radar** (`event-radar.spec.ts`): host vê `/events` (catálogo), `/events/:id` (interpretação IA + tabela imóveis impactados com cenários Conservador/Recomendado/Agressivo/Extremo, ex. "R$ 850 · 2,7x · 63%"), `/event-radar` (oportunidades + KPIs). Admin `/admin/event-radar`: radar de demanda, imóveis impactados, "alta demanda sem recomendação", "eventos sem coordenada".
- **AskUrban** (`ask-urban-entitlement.spec.ts`): plano não permitido → dialog "Disponível no plano Profissional" e drawer não abre; autorizado → drawer abre. Entitlement é **server-side** (não confia no localStorage).
- **Propriedades** (`properties-pricing.spec.ts`): editar diária base e renda média (`/propriedades/{id}/pricing-inputs`), ver histórico de alterações, excluir imóvel com confirmação.
- **Admin Jobs** (`admin-jobs.spec.ts`): `/admin/jobs` mostra readiness, fila do geocoder, histórico de `AdminJobRun`; "Rodar geocoder" → resultado `{attempted, succeeded, failed}`.
- **Tema** (`theme-preference.spec.ts`): dark/light/system persistido em `urban-ai-theme` no localStorage.

---

## 3. Time-to-first-value e fricções (com prioridade)

| Etapa | Tempo | Fricção | Severidade |
|-------|-------|---------|-----------|
| Waitlist → e-mail | 1 min | e-mail em spam; sem reenvio óbvio | baixa |
| Convite → conta | 5 min | token pode expirar; sem fallback claro | média |
| Onboarding setup | 7 min | busca Airbnb falha silenciosa se URL inválida | média |
| Paywall | 10 min | plano hardcoded `auto`, quantidade 1, ciclo não escolhível na UI | média |
| **Primeira recomendação** | 15 min–dias | **EMPTY STATE: sem evento futuro → "Sem sugestões" → host acha que não funciona** | **alta (morte do onboarding)** |
| Primeiro ROI | semanas | depende de evento real ocorrer + host registrar resultado manual | média |

**A métrica que mais importa:** recomendações aparecerem em **< 48h após o onboarding**. Mitigações sugeridas: garantir cobertura de eventos antes de convidar host, empty states que expliquem "estamos monitorando, próxima janela em X", e seed de eventos na região do imóvel no onboarding.

---

## 4. PWA / webapp (verificado em `pwa-mobile.spec.ts`)

- **Instalável** (manifest standalone): ícones 192/512/maskable, `start_url=/dashboard`, shortcuts Dashboard e Calendário, theme `#E8500A` / bg `#080A0F`.
- **Offline**: service worker `sw.js` network-first + navigation preload, fallback `/offline.html`, bloqueia POST e `/api` offline (não corrompe dados).
- **Mobile** (390×844): rotas públicas e autenticadas sem overflow horizontal; alvos de toque adequados.
- **Web push**: existe no backend (módulo `push`, `GET /push/public-key`) e há opt-in simplificado no front; **o E2E não cobre push** — validar manualmente em Android/iOS.

---

## 5. O que os testes NÃO cobrem (riscos)
Fluxo multi-imóvel completo; Stays com sync real (E2E usa mock); Event Radar com dado real; AskUrban com LLM (só entitlement); performance em produção (FCP/TTL); segurança a nível de endpoint (CSRF/rate-limit/injection); erro de importação Airbnb (URL inválida/imóvel privado). Priorizar testes desses caminhos antes do beta pago.
