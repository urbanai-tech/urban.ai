# ADR 0014 — Guarda de assinatura (402) e registro central de políticas por controller

**Status:** Aceito (26/10/2026) — registra o que já vigora.

## Contexto

O valor pago (recomendações, radar de eventos, portfólio, Stays etc.) precisa ser bloqueado no servidor para quem não tem direito de uso, sem quebrar o onboarding, que acontece **antes** da cobrança (passo 5). Esconder botões no front não protege a API.

## Opções consideradas

1. **Checar assinatura dentro de cada serviço.** Espalhado, fácil esquecer uma rota.
2. **Só decorators por rota.** Obriga editar todos os controllers e dificulta auditar o conjunto.
3. **Guard global + política declarada por rota, com mapa central auditável e teste que reprova rota sem classificação** (escolhida).

## Decisão

- `SubscriptionGuard` (`urban-ai-backend-main/src/subscription/subscription.guard.ts`, registrado como `APP_GUARD` em `subscription.module.ts`) devolve **HTTP 402** com `{ code: 'SUBSCRIPTION_REQUIRED', reason, ... }` quando a rota é `paid` e o usuário não tem direito de uso (assinatura ativa/trial/alpha/admin). Casos cobertos em `subscription.guard.spec.ts`: `past_due` após a carência, `canceled`, sem assinatura.
- Políticas: `paid`, `free` e `role` (decidida pelo `RolesGuard`). Precedência: decorators `@RequiresSubscription()` / `@SubscriptionFree()` e depois o mapa `CONTROLLER_POLICIES` em `subscription-policy.ts` (por **nome de classe + método**, com `default` e exceções em `routes`).
- Livres: identidade, LGPD, cobrança, planos, waitlist, institucional e o onboarding pré-pagamento (importar anúncio, cadastrar imóveis, estratégia). Pagas: o que entrega o valor (recomendações, radar, portfólio, Ask, Stays, ROI, aplicar sugestão, `POST /processos`).
- Rota sem classificação **não** é bloqueada em runtime, mas `subscription-policy.coverage.spec.ts` **reprova o CI** até ela ser classificada.
- O front trata o 402 do onboarding como "a análise começa quando o plano for ativado".

## Consequências

- (+) Todo o contrato de acesso pago cabe num arquivo revisável; esquecer uma rota derruba o CI.
- (−) Rota nova não classificada fica **aberta** em produção se o CI for ignorado (fail-open em runtime, escolhido para não quebrar o onboarding).
- (−) A chave do mapa é o nome da classe: renomear um controller exige atualizar o mapa (o teste de cobertura avisa).
- (−) As tabelas de preço divergem entre site, tabela `plans` e `plans.service.ts` (pendência 12 de [`ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md)); a guarda decide por direito de uso, não por preço.
