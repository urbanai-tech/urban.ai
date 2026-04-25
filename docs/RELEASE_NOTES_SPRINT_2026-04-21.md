# Urban AI — Release Notes · Sprint 07–21/04/2026

**Versão:** 2026.04.21
**Escopo:** Entregas consolidadas no intervalo 07/04/2026 → 21/04/2026
**Autoria:** Daniela Documentação (Roadmap-Manager Squad · run 2026-04-21-175845)

> Este release notes cobre as **7 entregas extras** (E1–E7) identificadas pelo auditor Vitor Verificador no ciclo do roadmap manager. Nenhum item originalmente marcado `⬜` no `roadmap-pos-sprint.md` foi promovido a `✅` neste ciclo — o escopo desta release é puramente aditivo.

---

## E1 · Billing Mensal vs. Anual (end-to-end)

**Impacto:** Usuários passam a poder escolher entre cobrança mensal e anual ao assinar. O backend seleciona automaticamente o `stripePriceId` correspondente e o frontend expõe um toggle na página de planos.

### Entidade `Plan` — novos campos

Arquivo: `urban-ai-backend-main/src/entities/plan.entity.ts`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `priceAnnual` | `string` | Valor mensal equivalente quando cobrado anualmente (ex.: `"47,50"` para R$ 47,50/mês no plano anual) |
| `originalPriceAnnual` | `string` | Preço original de referência para mostrar desconto |
| `stripePriceIdAnnual` | `string` | Stripe Price ID correspondente ao plano anual |

### Backend — seleção do `stripePriceId`

Arquivo: `urban-ai-backend-main/src/payments/payments.service.ts`

```ts
async createCheckoutSession(
  data: { plan: string; billingCycle?: 'monthly' | 'annual' },
  userId: string,
) {
  const planEntity = await this.plansService.getPlanByName(
    data.plan === 'trial' ? 'profissional' : data.plan,
  );
  let stripePrice = planEntity?.stripePriceId || process.env.MENSAL_PLAN;
  if (data.billingCycle === 'annual') {
    stripePrice = planEntity?.stripePriceIdAnnual || process.env.ANUAL_PLAN;
  }
  const session = await this.stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: stripePrice, quantity: 1 }],
    // …
  });
  return { sessionId: session.id };
}
```

### Frontend — toggle visual

Arquivo: `Urban-front-main/src/app/plans/page.tsx`

- Componente `<Switch id="billing-toggle" isChecked={isAnnual} />` alterna entre as labels `Mensal` e `Anual`.
- Ao clicar no CTA: `createCheckoutSession(plan.name, isAnnual ? 'annual' : 'monthly')`.

### Seed automático dos planos

Arquivo: `urban-ai-backend-main/src/plans/plans.service.ts` — `onModuleInit → seedPlans()` popula `starter` e `profissional` no boot do backend, com ambos os `stripePriceId` (mensal + anual).

> ⚠️ **Atenção:** `seedPlans` hoje executa `planRepository.clear()` antes de popular. Isso é aceitável para o estágio atual, mas precisa virar uma migration idempotente antes do go-live.

---

## E2 · Captura automática do `airbnbHostId` no Onboarding

**Impacto:** No passo 3 do wizard de onboarding, o sistema captura o `hostUserId` extraído da URL do Airbnb fornecida pelo usuário e o persiste no perfil (campo `airbnbHostId`). Esse identificador viabiliza jobs automatizados de enriquecimento (cruzamento de listings do mesmo anfitrião, scraping direcionado, etc.).

### Endpoint atualizado

`PATCH /user/profile/:id` (via `updateProfileById` no client)

Payload estendido:

```ts
// Urban-front-main/src/app/service/api.ts
export type UpdateProfilePayload = {
  phone?: string;
  company?: string;
  distanceKm?: number;
  airbnbHostId?: string; // ← novo
};
```

### Fluxo no onboarding

Arquivo: `Urban-front-main/src/app/onboarding/page.tsx` (linhas 471–473)

```tsx
if (hostUserId) {
  try {
    await updateProfileById(undefined as any, { airbnbHostId: hostUserId });
  } catch (e) {
    console.error("Erro ao salvar airbnbHostId do usuário", e);
  }
}
```

> 📋 **Ação requerida pelo backend:** aceitar `airbnbHostId` no DTO de update do usuário (se ainda não aceitar) e validar com regex Airbnb user id antes de persistir.

---

## E3 · Cron de Enriquecimento de Eventos (Gemini)

**Impacto:** De hora em hora, eventos pendentes (scraped sem enriquecimento semântico) são processados pela API Google Generative AI (Gemini) para classificação, tagging e normalização textual. Isso prepara o terreno para o KNN consumir dados reais no futuro.

Arquivo: `urban-ai-backend-main/src/evento/events-enrichment.service.ts`

```ts
@Cron('0 * * * *') // a cada hora cheia
async handleCron() {
  if (this.isProcessing) return;
  this.isProcessing = true;
  try {
    await this.enrichPendingEvents();
  } catch (error) {
    this.logger.error('Erro geral no enriching de eventos', error);
  } finally {
    this.isProcessing = false;
  }
}
```

### Variável de ambiente

| Variável | Obrigatória? | Observação |
|----------|--------------|------------|
| `GEMINI_API_KEY` | Sim (mas com fallback) | Se ausente, o service loga warning e **não** processa eventos. O backend sobe normalmente. |

> ⚠️ **Dívida técnica:** sem teste unitário e sem métrica de custo por chamada Gemini. Incluir ambos antes de escalar volume.

---

## E4 · CronService de Análises de Preço Aceitas

**Impacto:** Todo dia, o `CronService` (`src/cron/cron.service.ts`) varre análises de preço com status "aceita" referentes ao dia e dispara e-mail + notificação para o anfitrião (via `MailerService` + `NotificationsService`).

```ts
async buscarAnalisesAceitas(): Promise<any> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataHoje = hoje.toISOString().split('T')[0];
  // …consulta repository AnalisePreco com TypeORM Raw…
}
```

Novos módulos wired em `app.module.ts`: `CronModule` (import + `ScheduleModule.forRoot()` já presente).

> 📋 **Observação:** esta rotina **não é** a sequência de onboarding D1/D3/D7 prevista no roadmap (F5A.2). Essa trilha continua pendente.

---

## E5 · Rota `/my-plan` + Cancelamento de Assinatura

**Impacto:** Usuário autenticado pode consultar o plano ativo e cancelar sua assinatura diretamente pela UI, sem contato com o suporte.

### Frontend

Arquivos: `Urban-front-main/src/app/my-plan/page.tsx` + `layout.tsx`

Chamada cliente:

```ts
// Urban-front-main/src/app/service/api.ts
export async function cancelSubscription(): Promise<void> {
  await api.delete("/payments/cancelSubscription");
}
```

### Backend

Endpoint: `DELETE /payments/cancelSubscription` (autenticado)

Arquivo: `urban-ai-backend-main/src/payments/payments.service.ts`

```ts
async cancelSubscription(userId: string) {
  // busca payment do usuário
  const payment = await this.findLastPaymentByUser(userId);
  if (!payment || !payment.subscriptionId) {
    throw new Error("Pagamento ou subscriptionId não encontrado");
  }
  const canceledSubscription = await this.stripe.subscriptions.cancel(
    payment.subscriptionId,
  );
  return canceledSubscription;
}
```

**Regras de negócio cobertas:**
- Só é possível cancelar uma subscription **existente** — se `subscriptionId` não estiver na tabela `payment`, o endpoint lança erro.
- O cancelamento é **imediato** (não no fim do ciclo). Se precisar "cancelar no fim do período", migrar para `stripe.subscriptions.update(..., { cancel_at_period_end: true })`.

---

## E6 · Landing `(marketing)/lancamento`

**Impacto:** Landing secundária com copy focado em "Síndrome da Casa Barata", destinada a campanhas de lançamento da F5.2/F5.3.

Arquivo: `Urban-front-main/src/app/(marketing)/lancamento/page.tsx`

- Rota pública em `/lancamento` (Next.js App Router, sem guarda de auth).
- Tema escuro (`bg-[#070B14]`), tipografia bold e CTA principal apontando para `/plans`.
- **Aguarda:** conectar pixel/GA4 quando a F5.1 finalizar a configuração de analytics.

---

## E7 · `PaymentCheckGuard` (rotas com assinatura obrigatória)

**Impacto:** HOC/context React que bloqueia acesso a rotas protegidas quando o usuário não possui assinatura ativa, exibindo o `GlobalPaywallModal` em vez de redirecionar para tela de erro.

Arquivo: `Urban-front-main/src/app/context/PaymentCheckGuard.tsx` — importado no layout das rotas privadas (dashboard, properties, create, etc.).

```tsx
<PaymentCheckGuard>
  <DashboardContent />
</PaymentCheckGuard>
```

Dispara `<GlobalPaywallModal />` (arquivo `componentes/GlobalPaywallModal.tsx`) que contém o CTA para a página `plans/`.

**Cobre parcialmente** a tarefa F5A.5 "Garantir CTA claro para usuário sem assinatura". Falta QA manual ponta a ponta para marcar como concluída.

---

## Dívidas Técnicas Abertas (pós-sprint)

| # | Dívida | Onde |
|---|--------|------|
| D1 | Nenhum teste unitário ou E2E nos novos módulos `plans/`, `payments/`, `cron/`, `evento/events-enrichment.service.ts` | Backend |
| D2 | Suite Jest/RTL do frontend permanece vazia — toolchain presente, testes ausentes | Frontend |
| D3 | `seedPlans` faz `clear()` antes de popular — substituir por migration idempotente antes do go-live | Backend |
| D4 | `events-enrichment.service.ts` sem telemetria de custo Gemini | Backend |
| D5 | `cancelSubscription` é imediato — decidir UX (cancelar agora vs. cancelar no fim do ciclo) | Produto/Backend |
| D6 | `ADENDO_TECNICO_KNN.md` (run 06/04) ainda válido — zero mudança no repo KNN neste sprint | KNN |

---

## Matriz de Arquivos Alterados

| Tipo | Arquivo |
|------|---------|
| docs/ | `docs/roadmap-pos-sprint.md` (v2.0 → v2.1, seção F5B adicionada) |
| docs/ | `docs/RELEASE_NOTES_SPRINT_2026-04-21.md` (este arquivo) |
| backend | `src/plans/*`, `src/payments/payments.service.ts`, `src/cron/*`, `src/evento/events-enrichment.service.ts`, `src/entities/plan.entity.ts`, `src/app.module.ts` |
| frontend | `src/app/onboarding/page.tsx`, `src/app/service/api.ts`, `src/app/plans/page.tsx`, `src/app/my-plan/*`, `src/app/componentes/GlobalPaywallModal.tsx`, `src/app/context/PaymentCheckGuard.tsx`, `src/app/(marketing)/lancamento/page.tsx` |

---

*Urban AI © 2026 · Documentação gerada automaticamente pelo Roadmap-Manager Squad · Para correções, reabra o `_opensquad/edit`.*
