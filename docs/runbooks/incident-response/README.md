# Runbooks de incidente

Procedimentos passo-a-passo para os 5 cenários mais prováveis de incidente em produção. Cada runbook segue o mesmo formato: **detecção → triagem → mitigação → resolução → postmortem**.

## Cenários cobertos

1. [`db-down.md`](./db-down.md) — MySQL Railway indisponível
2. [`scrapyd-travado.md`](./scrapyd-travado.md) — Scrapyd não responde / spiders travados
3. [`prefect-flow-falhando.md`](./prefect-flow-falhando.md) — flow Prefect falha por 2+ dias
4. [`mailersend-rate-limit.md`](./mailersend-rate-limit.md) — Mailersend rate-limited / e-mails não saem
5. [`stripe-price-id-mudou.md`](./stripe-price-id-mudou.md) — Price ID Stripe inválido / checkout quebrado

## Princípios gerais

- **Detectar antes de remediar.** Sempre conferir Sentry + UptimeRobot + logs Railway antes de mexer.
- **Cortar tráfego antes de mexer em prod.** Se for grave, ativar maintenance mode no Railway.
- **Anotar a hora.** Cada runbook tem campo "início do incidente" — começa a contar para o RTO de 2h (`docs/slo.md`).
- **Postmortem obrigatório** se o incidente ultrapassar 15 min de impacto ou causar perda de dados.

## Severidade

| Sev | Critério | Resposta |
|---|---|---|
| **SEV1** | produto inacessível para todos os usuários | acordar Gustavo a qualquer hora |
| **SEV2** | parte do produto quebrada (ex.: webhook Stripe não processa) | resposta em ≤ 1h em horário comercial |
| **SEV3** | degradação ou bug visível mas não bloqueia uso | próximo dia útil |

## Comunicação

- **Canal interno**: WhatsApp Gustavo (futuro: Slack #incidents)
- **Status público**: a configurar — proposta inicial é uma página estática no GitHub Pages com Status Page por scripts manuais.
- **Comunicação aos usuários**: e-mail via Mailersend (template a criar) + banner no app (a implementar).

## Postmortem

Salvar em `docs/postmortems/<YYYY-MM-DD>-<titulo-curto>.md` usando template em `docs/postmortems/_template.md` (a criar). Estrutura mínima:

- Linha do tempo
- Root cause
- Impacto
- O que fizemos certo / errado
- Action items com donos e prazos
