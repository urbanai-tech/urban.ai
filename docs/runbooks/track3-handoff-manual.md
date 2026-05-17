# Track 3 - Handoff manual de monetizacao e integracoes

Data: 2026-05-17

Escopo: fechar o que depende de acesso humano a Stripe, MailerSend, Stays,
Railway e caixas de suporte/privacidade.

## Estado deixado pelo Dev 3

- Dashboard admin mostra go-live Track 3 para Stripe, MailerSend, Stays e Suporte/LGPD.
- Stays tem preview de preco antes de qualquer push real.
- Suporte/LGPD tem triagem, SLA, canais e donos operacionais no readiness.
- Backend tem preflight local sem chamadas externas:

```bash
cd urban-ai-backend-main
npm run preflight:track3
npm run preflight:track3:strict
```

Para testar um arquivo especifico:

```bash
node scripts/track3-preflight.js --env=.env.staging --strict
```

## Ordem manual recomendada

1. Railway backend: confirmar os canais publicos de suporte/privacidade.
   `SUPPORT_EMAIL` e `PRIVACY_EMAIL` podem usar os fallbacks do app se as caixas
   `suporte@myurbanai.com` e `privacidade@myurbanai.com` estiverem operando;
   preencher `SUPPORT_OWNER_EMAIL` e `PRIVACY_OWNER_EMAIL` para roteamento interno.
2. MailerSend: validar dominio, DKIM/SPF e preencher `MAILERSEND_API_KEY`,
   `EMAIL_SENDER`, `RESET_PASS_URL` e, quando disponivel, `MAILERSEND_DOMAIN_ID`.
   `FRONT_URL` pode usar fallback operacional, mas deve ser confirmado no smoke
   real de links.
3. Stripe test mode: preencher `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`,
   `STRIPE_WEBHOOK_SECRET` e os 8 `*_PRICE_*`. Se a publishable key ficar apenas
   no frontend (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`), validar pelo checkout real
   em vez de tratar a ausencia no backend como bloqueio isolado.
4. Stays: preencher `STAYS_API_BASE_URL` e `STAYS_TOKEN_ENCRYPTION_KEY`.
5. Rodar `npm run preflight:track3:strict` no backend com as envs do ambiente.
6. Abrir `/admin/dashboard` e confirmar Go-live Track 3 sem bloqueios.
7. Executar:
   - `docs/runbooks/stripe-billing-smoke.md`
   - `docs/runbooks/mailersend-transactional-smoke.md`
   - `docs/runbooks/stays-beta-private-smoke.md`
   - `docs/runbooks/suporte-lgpd-beta-pago.md`
8. Anexar evidencias de Stripe webhook, envio MailerSend, preview/push Stays e inbox suporte/LGPD.

## Criterio de pronto

Track 3 pode ir para 90%+ quando:

- preflight strict sai com exit code 0 no ambiente alvo, sem imprimir valores de segredo;
- `/admin/dashboard` mostra Stripe, MailerSend, Stays e Suporte/LGPD como ready;
- checkout test mode cria assinatura e webhook atualiza banco;
- MailerSend entrega ao menos um e-mail real;
- Stays conecta conta controlada, sincroniza listing e executa preview antes do push;
- canais suporte/privacidade recebem mensagens e donos responderam dentro do SLA combinado.

## O que ainda nao da para automatizar daqui

- KYC/conta Stripe live.
- DNS DKIM/SPF no provedor do dominio.
- Credenciais oficiais ou sandbox Stays.
- Confirmacao humana de caixa de suporte/privacidade.
- Evidencias visuais nos dashboards externos.
