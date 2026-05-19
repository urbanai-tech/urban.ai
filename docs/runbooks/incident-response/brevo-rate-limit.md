# Incidente — Brevo rate-limited / e-mails não chegam

**Severidade:** SEV2 (afeta confirmação de e-mail, reset de senha, notificações). Escala para SEV1 se bloqueia signup novo.
**RTO alvo:** 4h.

## Detecção

- Sentry mostra exceções do `MailerService` com `429`, `too many requests`, `dropped` ou `bounce`.
- Painel Brevo → Transactional → Logs/Statistics → muitos `dropped`, `deferred` ou `bounce`.
- Usuário relata que confirmação de e-mail não chegou.
- `email.service.ts` logs falham em `send`.

## Triagem

1. **Anotar hora.**
2. Painel Brevo → Transactional → Logs/Statistics:
   - **Volume estranho?** Pode ser bug nosso disparando spam.
   - **Bounces alto?** Pode ser e-mails inválidos no banco (limpar lista).
   - **Domain reputation baixou?** Verificar SPF/DKIM/DMARC.
3. Painel Brevo → Billing/Plan/Transactional quotas:
   - Atingiu o limite do plano? Se sim, é o caso 1.

## Mitigação

### Caso 1 — Quota mensal estourada

**Ação curta:** ativar plano superior na Brevo ou aumentar o limite transacional.
**Ação longa:** investigar por que volume cresceu — geralmente é re-tentativa de e-mail em loop por bug.

### Caso 2 — Rate limit de minuto

Planos/contas podem ter limite transacional por minuto ou por dia. Se um cron disparar muitas notificações de uma vez, pode bater o teto.

**Ação:** adicionar `p-limit` ou queue (BullMQ) na chamada para a Brevo, com concorrência baixa e backoff exponencial.

### Caso 3 — DKIM/SPF quebrado

Sintoma: e-mails saem mas chegam em spam ou são rejeitados.

**Ação:**
- Painel Brevo → Senders & IP → Domains → verificar `myurbanai.com` está com status verificado.
- Se não, refazer DNS no Hostinger (TXT records SPF + DKIM).
- Aguardar 30min de propagação.

### Caso 4 — Conta suspensa por abuse

Sintoma: API retorna 401/403 com mensagem de IP, autenticação, compliance ou abuse.

**Ação:** abrir ticket na Brevo imediatamente. Mostrar que o volume é legítimo (transacional, opt-in), conferir whitelist de IP e rotação segura de `BREVO_API_KEY`.

## Resolução

- Painel Brevo → Transactional mostra envios sucesso voltando a 0% bounce.
- Smoke: criar conta nova de teste e confirmar que e-mail de confirmação chega em inbox real.

## Após estabilizar

- Adicionar alerta no Sentry: > 5 erros do `MailerService` em 5 min → notificação WhatsApp Gustavo.
- Auditar lista de e-mails inválidos: query `SELECT email FROM user WHERE bounce_count > 3` (campo a criar).
- Se aconteceu por bug nosso: postmortem.

## O que NÃO fazer

- ❌ Ignorar bounces — a reputação do domínio piora se persistir.
- ❌ Mandar e-mail "de teste" para validação no domain real (vai pra Activity log; usar conta dummy).
- ❌ Trocar para outro provedor sem confirmar SPF/DKIM/DMARC primeiro — domain pode ficar marcado como spammer.

---

*Última atualização: 24/04/2026*
