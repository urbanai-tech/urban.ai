# [SEC] Auditoria OWASP e trust boundary

## 1. Critico - `/auth/google` permite login por e-mail sem validar token Google

Evidencia:

- `urban-ai-backend-main/src/auth/auth.controller.ts:280`
- `urban-ai-backend-main/src/auth/auth.controller.ts:283`
- `urban-ai-backend-main/src/auth/auth.service.ts:301`
- `urban-ai-backend-main/src/auth/auth.service.ts:335`

Trust boundary quebrado: o controller recebe `email`, `name` e `picture` do body, e o service cria/converte usuario usando esse e-mail. A varredura local nao encontrou validacao de `id_token`, assinatura, `aud`, `iss`, `exp` ou `email_verified`.

Impacto: risco de account takeover se um atacante chamar `/auth/google` com e-mail de outra pessoa.

Recomendacao: aceitar apenas `id_token`; validar assinatura com Google; checar `aud`, `iss`, `exp` e `email_verified`; nao converter conta local existente sem fluxo forte de vinculacao.

## 2. Alto - `/health` publico expoe readiness detalhado de segredos

Evidencia:

- `urban-ai-backend-main/src/health/health.controller.ts:8`
- `urban-ai-backend-main/src/health/health.service.ts:99`
- `urban-ai-backend-main/src/health/health.service.ts:111`
- `urban-ai-backend-main/src/health/health.service.ts:125`

Trust boundary: `/health` e publico e retorna presenca de variaveis como `DATABASE_URL`, `JWT_SECRET`, Stripe, Brevo, Google/Gemini e Stays. O valor nao vaza, mas o mapa operacional vaza.

Impacto: enumera integracoes, dependencias faltantes e estado operacional.

Recomendacao: manter apenas `/health/live` publico e minimalista; proteger readiness detalhado com token interno/IP allowlist/admin role; remover nomes de variaveis da resposta publica.

## 3. Alto - audit trail admin existe, mas ainda e incompleto e fail-open

Evidencia:

- `urban-ai-backend-main/src/admin-audit/admin-audit.service.ts:34`
- `urban-ai-backend-main/src/admin/admin.controller.ts:71`
- `urban-ai-backend-main/src/admin/admin.controller.ts:134`
- `urban-ai-backend-main/src/admin/admin.controller.ts:262`
- `urban-ai-backend-main/src/admin/admin.controller.ts:392`

Root-cause: `AdminAuditService.record` engole erro e so emite warning. Ha mutacoes admin sem trilha `AdminAuditLog` explicita, como onboarding drip, reprocess alpha, dedup approve/reject e recompute intelligence.

Impacto: nao ha trilha enterprise completa de "quem mudou o que, antes/depois, quando".

Recomendacao: todo `POST/PATCH/DELETE` admin deve gravar auditoria transacional com actor, before/after e metadata. Falha de auditoria em acao critica deve bloquear ou gerar incidente explicito.

## 4. Alto - service account de ingestao ainda e segredo estatico compartilhado

Evidencia:

- `urban-ai-backend-main/src/evento/events-ingest-api-key.guard.ts:20`
- `urban-ai-backend-main/src/evento/events-ingest-api-key.guard.ts:26`
- `urban-ai-backend-main/src/evento/events-ingest-api-key.guard.ts:31`
- `urban-ai-backend-main/src/evento/events-ingest.controller.ts:79`

O guard e fail-closed e usa comparacao em tempo constante. Ponto restante: uma unica key por header, com actor auditado vindo do proprio cliente.

Impacto: vazamento da key permite poisoning de eventos e spoofing de coletor na auditoria.

Recomendacao: usar key id + HMAC por request com timestamp/nonce, rotacao por coletor, identidade derivada da key no servidor, replay cache e escopos por fonte.

## 5. Medio/Alto - graficos e relatorios ainda podem misturar persistido com derivado

Evidencia:

- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:1547`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:1553`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:1555`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:1556`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts:2022`

Impacto: relatorio pode parecer definitivo mesmo quando esta derivado, sem snapshot/modelo/job auditavel.

Recomendacao: todo grafico executivo deve exibir `dataStatus`, `jobRunId`, `modelVersion`, `metricVersion` e `dataQualityFlags`, bloqueando selo enterprise quando faltar snapshot persistido.
