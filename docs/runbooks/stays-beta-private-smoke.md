# Runbook - Stays beta privado

Data: 2026-05-15
Escopo: validar Stays como beta privado antes de permitir qualquer aplicacao automatica de preco em conta real.

## Principio de release

Stays nao deve aparecer como automacao pronta enquanto qualquer item abaixo estiver pendente:

- credencial sandbox ou conta real aprovada;
- `STAYS_API_BASE_URL` definido por ambiente;
- `STAYS_TOKEN_ENCRYPTION_KEY` configurada antes de token real;
- consentimento rastreavel do anfitriao;
- connect, sync, push manual, push automatico e rollback testados;
- evidencia de `PriceUpdate` para sucesso, rejeicao e rollback.

Se algo falhar, manter o produto em modo recomendacao manual e tratar Stays como beta privado.

Nota operacional: o backend esta em fail-closed. Sem `STAYS_API_BASE_URL`, o conector nao chama a API Stays; sem `STAYS_TOKEN_ENCRYPTION_KEY`, `POST /stays/connect` bloqueia antes de validar ou persistir token real.

Nota do auto-apply: `STAYS_AUTO_APPLY_ENABLED` tambem e fail-closed e deve ficar ausente/false por padrao. Para qualquer teste de modo automatico, ligar primeiro em dry-run com allowlist:

```text
STAYS_AUTO_APPLY_ENABLED=true
STAYS_AUTO_APPLY_DRY_RUN=true
STAYS_AUTO_APPLY_ALLOWED_USER_IDS=<user-id-beta>
STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS=<listing-id-beta>
STAYS_AUTO_APPLY_COHORT=event-safe-beta
STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION=true
STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS=true
STAYS_AUTO_APPLY_MIN_CONFIDENCE=medium
STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY=0.45
STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER=1.00
STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER=1.25
STAYS_AUTO_APPLY_BLOCKED_RISK_FLAGS=low_confidence,past_event,property_unavailable,property_unavailable_for_event_window,previous_recommendation_rejected,previous_recommendation_expired
```

So mudar `STAYS_AUTO_APPLY_DRY_RUN=false` depois de aprovacao humana explicita, em staging/sandbox ou conta real assistida, e depois de conferir nos logs que o cron tentaria aplicar apenas o usuario/listing allowlisted e que o audit do cron mostra `decisionSnapshotId`, `confidence`, `bookingProbability`, `recommendedMultiplier`, `riskFlags=[]` e `rollbackReady=true`.

Guardrail P2 para recomendacoes de eventos: o live auto-apply agora exige `PricingDecisionSnapshot` auditavel por `AnalisePreco`, consentimento Stays na conta, baseline de preco anterior para rollback, confidence minima, probabilidade minima, multiplicador dentro do cohort e ausencia de flags criticas. Sem isso, a recomendacao continua visivel para revisao manual, mas nao vira push externo.

## Pre-condicoes

- Ambiente controlado: staging ou sandbox Stays.
- Conta Stays de teste com Open API habilitada.
- Usuario Urban AI beta allowlisted.
- `STAYS_AUTO_APPLY_ENABLED` desligado por padrao; se for testar auto, `STAYS_AUTO_APPLY_DRY_RUN=true` e allowlists de usuario/listing preenchidas.
- `PricingDecisionSnapshot` gerado para a `AnalisePreco` candidata, com `inputSignals.idempotencyKey`, `confidence`, `bookingProbability` e `recommendedMultiplier`.
- Conta Stays com `consentAcceptedAt` e `consentVersion` preenchidos.
- Pelo menos 1 listing Stays sem risco comercial real.
- Pelo menos 1 imovel Urban AI mapeavel ao listing Stays.
- Recomendacao recente aprovada pelo produto.
- Admin com acesso a `/admin/stays` e logs.

## Passo a passo

1. Abra `/admin/dashboard` e registre:
   - `stays.apiBaseConfigured`;
   - `stays.tokenEncryptionConfigured`;
   - `stays.betaPrivate`;
   - contas/listings Stays;
   - PriceUpdates recentes.
2. Confirme que `STAYS_TOKEN_ENCRYPTION_KEY` esta presente antes de colar qualquer token real.
3. Conecte a conta em `/settings/integrations` usando `clientId` e `accessToken` de sandbox.
4. Confirme que o backend valida credencial e cria `StaysAccount` ativa.
5. Confirme que o token salvo tem prefixo criptografado `enc:v1:` no banco; nunca registrar o token em print/log.
6. Rode sync de listings pela UI.
7. Confirme que ao menos 1 `StaysListing` foi criado e pode ser associado a um imovel Urban AI.
8. Revise consentimento exibido ao usuario e registre versao/data quando o mecanismo estiver disponivel.
9. Com uma recomendacao aprovada, faca push manual de preco para o listing sandbox.
10. Confirme `PriceUpdate.status='success'`, `origin='user_accepted'` ou equivalente, preco e data corretos.
11. Rode rollback do `PriceUpdate` bem-sucedido.
12. Confirme novo `PriceUpdate.origin='rollback'` apontando para o update original.
13. Para testar modo automatico, confirme `STAYS_AUTO_APPLY_ENABLED=true`, `STAYS_AUTO_APPLY_DRY_RUN=true` e allowlists apontando para um unico usuario/listing.
14. Rode o cron em dry-run e confirme log `Stays auto-apply dry-run: would push... audit=...`; nenhum `PriceUpdate` real deve ser criado por esse passo. Se o ambiente permitir apenas acionamento pelo scheduler, aguarde o tick de `5 * * * *` e acompanhe logs; nao force `STAYS_AUTO_APPLY_DRY_RUN=false` para "acelerar" o smoke.
15. Se o dry-run bloquear, classifique o motivo: `missing_pricing_decision_snapshot`, `confidence_below_medium`, `booking_probability_below_floor`, `recommended_multiplier_above_ceiling`, `blocked_risk_flag:*`, `missing_stays_auto_apply_consent` ou `missing_rollback_baseline`.
16. Se houver aprovacao explicita para push real, troque somente `STAYS_AUTO_APPLY_DRY_RUN=false`, mantenha allowlists de usuario e listing preenchidas, rode um push auto controlado e confirme `PriceUpdate.origin='ai_auto'`.
17. Confirme que o `PriceUpdate.userAgent` contem `urban-ai-auto-apply/1`, cohort, `decision=<id>`, confidence, multiplier, probability e `rollback=ready`.
18. Execute rollback do push real controlado e confirme novo `PriceUpdate.origin='rollback'` ligado ao update original.
19. Desligue o modo automatico ao final do smoke, salvo se o beta privado ja tiver aprovacao explicita.
20. Registre evidencia no release gate.

## Criterios de aceite

O smoke passa quando:

- credenciais sao validadas sem expor segredo;
- token fica criptografado em repouso;
- sync cria/lista listings coerentes;
- push manual gera `PriceUpdate.success`;
- rollback gera `PriceUpdate.rollback` associado ao original;
- modo automatico, se testado, respeita kill switch, dry-run, allowlist, consentimento e guardrails;
- recomendacao de evento so vira push quando passa no cohort seguro (`PricingDecisionSnapshot`, confidence, probabilidade, multiplicador, risk flags e rollback);
- dashboard admin mostra saude da Stays sem falso "pronto".

O smoke bloqueia Stays quando:

- token real seria salvo sem `STAYS_TOKEN_ENCRYPTION_KEY`;
- UI vende "automatico" para usuario fora da allowlist;
- `STAYS_AUTO_APPLY_ENABLED` fica ligado sem dry-run/allowlist durante beta;
- push funciona, mas rollback nao;
- `PriceUpdate` nao guarda origem/status suficientes para auditoria;
- `PriceUpdate` de auto-apply nao contem trilha `urban-ai-auto-apply/1` em `userAgent`;
- consentimento nao fica rastreavel antes de automacao real;
- falhas da Stays aparecem como sucesso no painel.

## Triage rapido

| Sintoma | Provavel causa | Acao |
|---|---|---|
| `apiBaseConfigured=false` | Env ausente | Manter beta privado e configurar sandbox antes do teste. |
| `tokenEncryptionConfigured=false` | Segredo ausente | Nao conectar token real; configurar segredo e redeploy. |
| Connect bloqueado antes do ping | `STAYS_API_BASE_URL` ou `STAYS_TOKEN_ENCRYPTION_KEY` ausente | Configurar envs e redeploy; nao usar fallback para prod. |
| Connect falha | Token invalido ou API fora | Validar no painel Stays e checar `/admin/stays`. |
| Sync retorna zero listings | Conta sem Open API/listings ou filtro errado | Confirmar conta sandbox e permissao. |
| Push rejected | Guardrail, data, listing inativo ou regra Stays | Registrar motivo e manter recomendacao manual. |
| Rollback falha | Falta preco anterior ou endpoint indisponivel | Bloquear automacao e corrigir antes de beta. |
| Admin mostra pronto sem envs | Readiness incorreto | Bloquear release e corrigir alerta. |

## Registro de evidencia

```text
Smoke Stays beta privado
Data/hora:
Ambiente:
Responsavel:
Conta/listing Stays:
Usuario Urban AI:
apiBaseConfigured:
tokenEncryptionConfigured:
staysAutoApplyEnabled:
staysAutoApplyDryRun:
allowedUserIds:
allowedListingIds:
cohort:
minConfidence:
minBookingProbability:
minRecommendedMultiplier:
maxRecommendedMultiplier:
Token criptografado? sim/nao
Sync listings: criados/atualizados:
Imovel mapeado:
PricingDecisionSnapshot id/status/confidence/probability/multiplier:
Risk flags:
Rollback ready? sim/nao
Push manual PriceUpdate id/status:
Rollback PriceUpdate id/status:
Push automatico testado? sim/nao
Push automatico PriceUpdate id/userAgent:
Consentimento registrado? sim/nao
Resultado: aprovado/bloqueado
Pendencias:
```

## Saida esperada

Para continuar como beta privado:

- Stays pode ficar visivel apenas para usuarios allowlisted;
- recomendacao manual continua sendo o modo seguro padrao;
- modo automatico so fica ativo por listing depois de kill switch ligado, dry-run revisado, allowlist preenchida, consentimento e rollback testados;
- qualquer falha volta para modo manual, sem perda de recomendacao.

Para sair de beta privado:

- smoke passa em sandbox e em uma conta real assistida;
- consentimento versionado esta persistido;
- suporte tem trilha de auditoria por `PriceUpdate`;
- existem alertas para falha de sync/push/rollback;
- termos e politica de privacidade citam a integracao de forma revisada.
