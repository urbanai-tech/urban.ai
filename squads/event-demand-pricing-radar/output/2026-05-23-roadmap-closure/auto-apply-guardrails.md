# Auto-apply & Guardrails - Roadmap closure

Data: 2026-05-23
Frente: Auto-Apply & Guardrails
Escopo: `stays-auto-apply`, cohorts seguros, auditabilidade e runbooks Stays

## Resumo executivo

A frente P2 de auto-apply saiu do estado "kill switch + dry-run + allowlist" para um cohort seguro de recomendacoes de eventos. O cron `stays-auto-apply` continua fail-closed, mas agora exige uma decisao auditavel antes de qualquer push real via Stays.

Percentual recomendado da frente: **72% do P2 de auto-apply**.

Leitura honesta:

- O caminho tecnico de guardrails/cohort esta implementado e coberto por spec local.
- Ainda faltam smoke em staging/DB real, evidencia de rollback real em Stays e outcomes de reserva/receita para calibracao estatistica.
- A entrega total de P2 continua dependente de volume real de `PriceUpdate`, reservas e outcomes.

## Cohort seguro implementado

Defaults operacionais:

- `STAYS_AUTO_APPLY_COHORT=event-safe-beta`
- `STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION=true`
- `STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS=true`
- `STAYS_AUTO_APPLY_MIN_CONFIDENCE=medium`
- `STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY=0.45`
- `STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER=1.00`
- `STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER=1.25`

Criterios elegiveis para push real:

- listing em modo auto efetivo e conta Stays ativa;
- `AnalisePreco` aceita, recente e sem `PriceUpdate.success` anterior;
- usuario e listing em allowlist quando `dryRun=false`;
- conta com `consentAcceptedAt` e `consentVersion`;
- `PricingDecisionSnapshot` ligado a `AnalisePreco`;
- status da decisao `suggested` ou `accepted`;
- confidence minima, booking probability minima e multiplicador dentro do cohort;
- preco novo nao acima do preco auditado na decisao, com tolerancia de 1%;
- ausencia de risk flags criticas;
- `previousPriceCents > 0` para rollback confiavel.

## Guardrails e bloqueios

Bloqueios cobertos:

- `missing_user_allowlist_for_live_cohort`
- `missing_listing_allowlist_for_live_cohort`
- `missing_pricing_decision_snapshot`
- `confidence_below_medium`
- `booking_probability_below_floor`
- `recommended_multiplier_below_floor`
- `recommended_multiplier_above_ceiling`
- `new_price_above_audited_decision_price`
- `blocked_risk_flag:*`
- `missing_stays_auto_apply_consent`
- `missing_rollback_baseline`

Flags criticas padrao:

- `low_confidence`
- `past_event`
- `property_unavailable`
- `property_unavailable_for_event_window`
- `previous_recommendation_rejected`
- `previous_recommendation_expired`

## Auditabilidade

O push real preserva:

- `PriceUpdate.origin='ai_auto'`;
- `PriceUpdate.analise_preco_id`;
- idempotencia final do `StaysService`;
- `PriceUpdate.userAgent` tecnico com cohort, decision id, confidence, multiplier, probability e rollback status;
- `PricingDecisionSnapshot.inputSignals.idempotencyKey`, quando presente.

Importante: esta frente nao sobrescreve outcomes economicos. A captura de aceite, aplicacao, reserva e receita continua no helper de outcome de `PricingCalculateService` e deve ser conectada por fluxo proprio.

## Validacoes

Comandos executados:

```powershell
node node_modules\jest\bin\jest.js stays/stays-auto-apply.service.spec.ts --runInBand
```

Resultado: **1 suite, 11 testes verdes**.

```powershell
node node_modules\typescript\bin\tsc --noEmit
```

Resultado: **typecheck backend verde**.

Observacao: `npm` nao estava disponivel no PATH desta sessao; os comandos foram rodados via `node` local com permissao elevada porque o sandbox retornou `Acesso negado` ao executar `node.exe`.

## Pendencias para 100%

- Rodar smoke Stays em staging/sandbox com DB real.
- Confirmar `PriceUpdate.userAgent` persistido em banco real para `ai_auto`.
- Executar rollback real do `PriceUpdate` aplicado automaticamente.
- Verificar que dashboards/admin conseguem localizar a cadeia `PriceUpdate -> AnalisePreco -> PricingDecisionSnapshot`.
- Conectar outcomes reais de reserva/receita para calibrar `bookingProbability` e teto de multiplicador por cidade/evento.
