# Go-live — checklist único

Revisado: 2026-10-23 · Owner: Gustavo

> Consolida os antigos checklists de go-live (itens manuais e DNS/subdomínios). Estado atual de hosts e ambientes: [`../ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md). Variáveis: [`matriz-env-operacional.md`](./matriz-env-operacional.md). Tudo aqui depende de acesso externo, decisão de negócio, CNPJ/cartão ou assinatura humana. Nunca registrar valores de segredos.

Antes de começar, rode o preflight do backend e o release gate ([`release-gate.md`](./release-gate.md)):

```bash
cd urban-ai-backend-main
npm run preflight:track3:strict -- --env=<arquivo .env do ambiente alvo, fora do repositório>
```

Sem `--env=` o preflight lê só o ambiente do shell e sai com código 1 (no ensaio local de 25/10/2026: `Summary: 0/6 ready`, 22 blockers, 11 warnings, por falta de `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY` etc.). Isso é esperado fora de produção; o comando é somente leitura.

## P0 — bloqueia produção

- [ ] **Stripe: Price IDs da matriz de planos.** Criar os prices recurring (mensal, trimestral, semestral, anual) de cada plano no Stripe e preencher no Railway as variáveis `*_PRICE_*` (nomes em `matriz-env-operacional.md`). Conferir em `/admin/pricing-config` e testar um checkout por ciclo com cartão de teste. Sem isso, trimestral e semestral falham no Checkout.
- [ ] **Stripe: webhook.** Criar o endpoint `POST /payments/webhook` no domínio da API, selecionar `checkout.session.completed`, `customer.subscription.*` e `invoice.payment_*`, e gravar o signing secret em `STRIPE_WEBHOOK_SECRET`. Smoke: [`stripe-billing-smoke.md`](./stripe-billing-smoke.md).
- [ ] **Migrations em produção.** Rodar as migrations versionadas (`MIGRATIONS_RUN=true` no boot ou `npm run migration:run`), conferir a tabela `migrations` e só então definir `DB_SYNCHRONIZE=false`. Procedimento e rollback: [`migrations-cutover.md`](./migrations-cutover.md).
- [ ] **Custos default.** Em `/admin/finance`, usar "Popular default" e revisar os valores com a fatura real; sem isso a margem aparece inflada.
- [ ] **Segredos fortes.** `JWT_SECRET` e `NEXTAUTH_SECRET` gerados com `openssl rand -base64 64`, distintos e fora do repositório.

## P1 — partes do produto dependem disso

- [ ] **Brevo.** Verificar o domínio, publicar DKIM/SPF/DMARC no DNS, definir `BREVO_API_KEY`, `EMAIL_SENDER` e `EMAIL_SENDER_NAME`. Smoke: [`brevo-transactional-smoke.md`](./brevo-transactional-smoke.md). Pendência: sem MX, caixas como `suporte@` não recebem e-mail.
- [ ] **Google Cloud.** Billing ativo; APIs Geocoding/Places/Generative Language; chaves distintas com restrição; alerta de orçamento. Variáveis `GOOGLE_MAPS_API_KEY` e `GEMINI_API_KEY`.
- [ ] **Sentry.** DSN do backend (`SENTRY_DSN`) e do front (`NEXT_PUBLIC_SENTRY_DSN`); domínios permitidos `*.myurbanai.com`.
- [ ] **Monitoramento.** Monitores HTTP em `GET /health/live` do backend e na raiz do front; alerta por e-mail/canal de operação. `/health/live` só prova que o processo está de pé e **continua 200 com o MySQL fora do ar**; para detectar banco/Redis fora, adicione um monitor em `GET /health` com o header `Authorization: Bearer <HEALTH_READINESS_TOKEN>` (devolve 503 quando `db` ou `redis` estão `down`; ver [`incident-response/db-down.md`](./incident-response/db-down.md)). SLOs: [`../ops/slo.md`](../ops/slo.md).
- [ ] **Analytics.** `NEXT_PUBLIC_GA4_ID` e `NEXT_PUBLIC_META_PIXEL_ID` no serviço de frontend do Railway.
- [ ] **Stays.** Credenciais Preferred+ e OAuth por conta cliente; teste de push de preço em listing de teste. Ver [`stays-integration-setup.md`](./stays-integration-setup.md) e [`stays-beta-private-smoke.md`](./stays-beta-private-smoke.md).

## DNS, domínios e variáveis (Cloudflare + Railway)

- [ ] SSL/TLS do Cloudflare em **Full (Strict)**; registros em **DNS only** (cinza) até haver decisão de proxy; MX/TXT (SPF/DKIM/DMARC) preservados.
- [ ] Railway, frontend: domínios `myurbanai.com`, `www.myurbanai.com` e `app.myurbanai.com` ativos com SSL. Variáveis `NEXT_PUBLIC_APP_URL=https://app.myurbanai.com`, `NEXT_PUBLIC_MARKETING_URL=https://myurbanai.com`, `NEXTAUTH_URL=https://app.myurbanai.com` (mudar `NEXT_PUBLIC_*` exige rebuild).
- [ ] Railway, backend: `CORS_ALLOWED_ORIGINS` com os três hosts, `COOKIE_DOMAIN=.myurbanai.com` (com ponto inicial, para compartilhar sessão). (`MARKETING_BASE_URL` constava aqui, mas o backend não lê essa variável; ver `matriz-env-operacional.md`. Quem define a URL do marketing é o front, via `NEXT_PUBLIC_MARKETING_URL`.)
- [ ] Callbacks externos: Customer Portal do Stripe apontando para `https://app.myurbanai.com/my-plan`; redirect URIs do Google OAuth; domínios permitidos no Sentry.
- [ ] Hostname canônico da API (`api.myurbanai.com` ainda não existe; ver pendência 3 de `ARQUITETURA-ATUAL.md`).

### Smoke final (janela anônima)

- [ ] `myurbanai.com/` serve a landing; `/precos`, `/sobre`, `/termos`, `/privacidade`, `/contato` respondem.
- [ ] `myurbanai.com/dashboard` redireciona (301) para `app.myurbanai.com/dashboard` e cai no login; `app.myurbanai.com/sobre` redireciona para o apex.
- [ ] Login em `app.` funciona e a sessão persiste ao abrir `myurbanai.com` em outra aba (valida `COOKIE_DOMAIN`).
- [ ] `robots.txt`: apex com `Allow: /` e `Sitemap:`; `app.` com `Disallow: /`. `sitemap.xml` do apex lista as URLs públicas.
- [ ] Reset de senha chega por e-mail (valida MX/SPF/DKIM de envio).

### Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Erro de SSL em host recém-adicionado | Railway ainda emitindo o certificado | Aguardar 5 a 10 min |
| Apex mostra login em vez da landing, ou não redireciona | Deploy antigo do middleware no front | Redeploy forçado do front |
| Erro de CORS no console | `CORS_ALLOWED_ORIGINS` incompleta | Conferir os três valores e reiniciar o backend |
| Sessão cai entre subdomínios | `COOKIE_DOMAIN` sem ponto inicial, ou backend não reiniciou | Usar `.myurbanai.com` e reiniciar |
| E-mail parou | Registros MX/SPF/DKIM perdidos na migração de DNS | Recriar os registros no Cloudflare |

### Reverter

1. Voltar os nameservers no registrador (originais registrados no snapshot pré-Cloudflare).
2. Remover `COOKIE_DOMAIN` no backend e `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_MARKETING_URL` no front.
3. Reverter o commit do middleware, se necessário, via Pull Request.

## P2 — higiene, governança e escala

- [ ] **CNPJ, conta PJ e Stripe Brasil** em modo produção (2 a 4 semanas).
- [ ] **LGPD.** Revisão jurídica de Termos e Privacidade (versões em [`../legal/`](../legal/)), DPO designado, banner de consentimento e fluxo de direitos do titular ([`lgpd-data-subject-requests.md`](./lgpd-data-subject-requests.md), [`suporte-lgpd-beta-pago.md`](./suporte-lgpd-beta-pago.md)).
- [ ] **GitHub.** Proteção da `main` (PR + checks obrigatórios + histórico linear), secret scanning e alertas Dependabot.
- [ ] **Backup off-site** com retenção definida; ver [`backup-offsite.md`](./backup-offsite.md) e [`backup-restore.md`](./backup-restore.md).
- [ ] **WhatsApp Business** com número de vendas dedicado; substituir o placeholder `seunumerodevendas` nos links do front.
- [ ] **Modo pré-lançamento.** `PRELAUNCH_MODE=true` mantém `/create` em waitlist; desligar (`false` ou remover) no go-live oficial. Detalhes: [`prelaunch-mode.md`](./prelaunch-mode.md).
- [ ] **ADRs** revisados e aprovados pela equipe de decisão ([`../adr/README.md`](../adr/README.md)).

## Como usar

Marque `[x]` ao concluir. Com todo o P0 e o smoke final verdes, rode o [release gate](./release-gate.md) e os [smoke tests operacionais](./smoke-tests-operacionais.md) antes de considerar produção pronta.

## Ensaio local (25/10/2026)

Só conferência de referências; nenhum passo de produção foi executado (todos dependem de Railway, Stripe, Cloudflare, Brevo, Google, Sentry ou GitHub reais).

**Conferido e correto:**

- `npm run preflight:track3:strict` existe em `urban-ai-backend-main/package.json` (`scripts/track3-preflight.js`) e roda; aceita `--env=<arquivo>`.
- Rota do webhook: `POST /payments/webhook` (`@Controller('payments')` + `@Post('webhook')`). Páginas admin `/admin/pricing-config` e `/admin/finance` existem no front, e o botão "Popular default" está em `admin/finance/page.tsx`.
- Variáveis citadas e lidas no código: `COOKIE_DOMAIN`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, `EMAIL_SENDER_NAME`, `PRELAUNCH_MODE` (backend); `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXTAUTH_SECRET` (front). `NEXTAUTH_URL` é lida pela própria biblioteca NextAuth (documentada em `Urban-front-main/README.md`). Os nomes `*_PRICE_*` batem com `matriz-env-operacional.md`.
- Rotas públicas do smoke final existem em `Urban-front-main/src/app/(public)/`: `precos`, `sobre`, `termos`, `privacidade`, `contato`; `robots.ts` e `sitemap.ts` existem.
- Links relativos (`ARQUITETURA-ATUAL`, `matriz-env-operacional`, `release-gate`, `migrations-cutover`, `stripe-billing-smoke`, `brevo-transactional-smoke`, `stays-*`, `ops/slo`, `legal/`, `adr/README`, `lgpd-*`, `backup-*`, `prelaunch-mode`) existem e passam em `node scripts/audit-document-links.js`.

**Corrigido:** o comando do preflight (agora com `--env=`, e a explicação do exit 1 fora de produção: `0/6 ready`, 22 blockers no ambiente local); `MARKETING_BASE_URL` removida da lista de variáveis do backend (não é lida no código; a matriz já a tinha removido); o item Monitoramento agora avisa que `/health/live` não detecta MySQL/Redis fora do ar e pede um monitor em `/health` com Bearer.

**Não ensaiável localmente:** todos os itens P0/P1/P2 e o smoke final (Stripe live/teste, migrations em produção, Brevo/DNS, Cloudflare/SSL, Railway, Sentry, GA4/Pixel, Stays, LGPD/jurídico, proteção da `main`). Precisam de acesso Admin ao respectivo provedor e de decisão de negócio.
