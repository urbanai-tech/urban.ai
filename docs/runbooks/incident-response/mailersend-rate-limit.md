# Incidente — Mailersend rate-limited / e-mails não chegam

**Severidade:** SEV2 (afeta confirmação de e-mail, reset de senha, notificações). Escala para SEV1 se bloqueia signup novo.
**RTO alvo:** 4h.

## Detecção

- Sentry mostra exceções `MailerSendError: Too many requests` ou `429`.
- Painel Mailersend → Activity → muitos `dropped` ou `bounce`.
- Usuário relata que confirmação de e-mail não chegou.
- `email.service.ts` logs falham em `send`.

## Triagem

1. **Anotar hora.**
2. Painel Mailersend → Activity:
   - **Volume estranho?** Pode ser bug nosso disparando spam.
   - **Bounces alto?** Pode ser e-mails inválidos no banco (limpar lista).
   - **Domain reputation baixou?** Verificar SPF/DKIM/DMARC.
3. Painel Mailersend → Quotas:
   - Atingiu o limite do plano? Se sim, é o caso 1.

## Mitigação

### Caso 1 — Quota mensal estourada

**Ação curta:** ativar plano superior no Mailersend (planos crescem em fatias de 50k e-mails/mês).
**Ação longa:** investigar por que volume cresceu — geralmente é re-tentativa de e-mail em loop por bug.

### Caso 2 — Rate limit de minuto

Mailersend tem limite de **1 e-mail por segundo** no plano gratuito (60/min). Se um cron disparar 200 notificações de uma vez, bate o teto.

**Ação:** adicionar `p-limit` ou queue (BullMQ) na chamada para o Mailersend, com `concurrency=1`. Ver `email.service.ts` — precisa ser refatorado para enfileirar em vez de mandar paralelo.

### Caso 3 — DKIM/SPF quebrado

Sintoma: e-mails saem mas chegam em spam ou são rejeitados.

**Ação:**
- Painel Mailersend → Domains → verificar `notify.myurbanai.com` está com status `Verified`.
- Se não, refazer DNS no Hostinger (TXT records SPF + DKIM).
- Aguardar 30min de propagação.

### Caso 4 — Conta suspensa por abuse

Sintoma: API retorna 403 com mensagem do Mailersend abuse team.

**Ação:** abrir ticket no Mailersend imediatamente. Mostrar que o volume é legítimo (transacional, opt-in). Em paralelo, ter como fallback o SendGrid (já temos estrutura legacy em `email.service.ts`) — flip a env `SENDGRID_API_KEY` e mude o caller.

## Resolução

- Painel Mailersend → Activity mostra envios sucesso voltando a 0% bounce.
- Smoke: criar conta nova de teste e confirmar que e-mail de confirmação chega em inbox real.

## Após estabilizar

- Adicionar alerta no Sentry: > 5 erros `MailerSendError` em 5 min → notificação WhatsApp Gustavo.
- Auditar lista de e-mails inválidos: query `SELECT email FROM user WHERE bounce_count > 3` (campo a criar).
- Se aconteceu por bug nosso: postmortem.

## O que NÃO fazer

- ❌ Ignorar bounces — Mailersend pune domain reputation se persistir.
- ❌ Mandar e-mail "de teste" para validação no domain real (vai pra Activity log; usar conta dummy).
- ❌ Trocar para outro provedor sem confirmar SPF/DKIM/DMARC primeiro — domain pode ficar marcado como spammer.

---

*Última atualização: 24/04/2026*
