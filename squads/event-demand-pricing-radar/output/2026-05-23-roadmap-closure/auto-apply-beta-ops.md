# Turing Auto-Apply Beta Ops - handoff

Data: 2026-05-23
Frente: Auto-apply event-safe beta
Escopo: flags/envs, allowlists, consentimento, rollback e smoke operacional seguro.

## Veredito operacional

A frente esta pronta para beta privado assistido em dry-run. Nao ha recomendacao para ativar push automatico real em producao ainda.

Status recomendado: **beta event-safe dry-run aprovado para staging/sandbox; live auto-apply bloqueado ate smoke real assistido com rollback comprovado**.

## O que foi confirmado

- Kill switch: `STAYS_AUTO_APPLY_ENABLED` e fail-closed; ausente/false nao processa nem chama Stays.
- Dry-run: `STAYS_AUTO_APPLY_DRY_RUN=true` registra `would push` e nao cria `PriceUpdate` real.
- Allowlists: usuarios e listings podem ser restringidos por `STAYS_AUTO_APPLY_ALLOWED_USER_IDS` e `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS`; aliases `STAYS_AUTO_APPLY_USER_ALLOWLIST` e `STAYS_AUTO_APPLY_LISTING_ALLOWLIST` tambem existem no codigo.
- Live cohort: com `STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS=true`, push live sem allowlist explicita e bloqueado.
- Decisao auditavel: `STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION=true` exige `PricingDecisionSnapshot` ligado a `AnalisePreco`.
- Consentimento: auto-apply bloqueia conta Stays sem `consentAcceptedAt` e `consentVersion`.
- Rollback: auto-apply exige `previousPriceCents > 0` e grava `rollback=ready` no `userAgent` tecnico quando elegivel.
- Cohort event-safe: defaults confirmados para confidence minima `medium`, booking probability minima `0.45`, multiplicador entre `1.00` e `1.25` e risk flags criticas bloqueadas.

## Artefatos ajustados

- `urban-ai-backend-main/.env.example`: adicionados envs operacionais do auto-apply beta privado com defaults seguros.
- `docs/runbooks/stays-beta-private-smoke.md`: smoke dry-run reforcado com `REQUIRE_*`, risk flags bloqueadas e aviso explicito de nao usar `dryRun=false` como atalho.
- `squads/event-demand-pricing-radar/output/2026-05-23-roadmap-closure/auto-apply-beta-ops.md`: este handoff.

## Runbook seguro

Sequencia minima para o proximo smoke:

1. Usar staging/sandbox Stays ou conta real assistida aprovada; nao rodar em producao aberta.
2. Manter `STAYS_AUTO_APPLY_ENABLED=false` por padrao.
3. Para smoke, setar `STAYS_AUTO_APPLY_ENABLED=true` e `STAYS_AUTO_APPLY_DRY_RUN=true`.
4. Preencher allowlist de exatamente um usuario beta e um listing beta.
5. Confirmar `STAYS_API_BASE_URL` de sandbox/staging e `STAYS_TOKEN_ENCRYPTION_KEY` antes de qualquer token real.
6. Confirmar consentimento persistido na conta Stays: `consentAcceptedAt` e `consentVersion`.
7. Confirmar `PricingDecisionSnapshot` com status seguro, confidence, probability, multiplier e risk flags.
8. Confirmar baseline de rollback: `previousPriceCents > 0`.
9. Aguardar/acionar o cron somente em dry-run e validar log `Stays auto-apply dry-run: would push... audit=...`.
10. Registrar evidencia no template do runbook e manter push real desligado.

## Bloqueadores para live

- Falta evidencia de smoke em DB real/staging.
- Falta rollback real comprovado de `PriceUpdate.origin='ai_auto'`.
- Falta confirmacao de persistencia do `userAgent` tecnico em banco real.
- Falta validacao operacional de suporte/admin para localizar a cadeia `PriceUpdate -> AnalisePreco -> PricingDecisionSnapshot`.
- Falta aprovacao humana explicita para trocar `STAYS_AUTO_APPLY_DRY_RUN=false`.

## Percentual da frente

Recomendacao Turing: **78% da frente Auto-apply event-safe beta**.

Justificativa: os guardrails de codigo e runbook estao fechados para dry-run operacional seguro, e os envs agora estao explicitados no exemplo. Os 22% restantes dependem de evidencia real controlada: smoke staging/sandbox, rollback real, observabilidade e decisao humana de beta assistido.
