# Go-Live — Checklist do que ainda é manual (humano)

**Data:** 25/04/2026 · **Status:** Aberto · **Owner:** Gustavo

> Tudo que está aqui depende de **acesso externo**, **decisão de negócio**,
> **CNPJ/cartão** ou **assinatura humana**. Claude não consegue fazer porque não
> tem credenciais de produção, conta bancária, OAB ou autoridade pra contratar.

---

## P0 — Bloqueia ir para produção

### 1. Stripe — 8 Price IDs da matriz F6.5

**Por quê:** Sem isso, `quarterly` e `semestral` caem nos legados (mensal/anual).
A página `/plans` mostra os 4 ciclos mas Stripe Checkout falha em 2 deles.

**Como:**
1. Login Dashboard Stripe → `Products` → `Starter` (criar se não existe)
2. Criar 4 prices recurring para Starter (mensal, trimestral, semestral, anual)
3. Idem `Profissional`
4. Copiar os 8 `price_xxx` IDs
5. Setar no Railway env vars:
   ```
   STARTER_PRICE_MONTHLY=price_xxx
   STARTER_PRICE_QUARTERLY=price_xxx
   STARTER_PRICE_SEMESTRAL=price_xxx
   STARTER_PRICE_ANNUAL=price_xxx
   PROFISSIONAL_PRICE_MONTHLY=price_xxx
   PROFISSIONAL_PRICE_QUARTERLY=price_xxx
   PROFISSIONAL_PRICE_SEMESTRAL=price_xxx
   PROFISSIONAL_PRICE_ANNUAL=price_xxx
   ```
6. Conferir em `/admin/pricing-config` (read-only) que estão todos preenchidos
7. Testar checkout em cada ciclo com cartão de teste Stripe

**Tempo estimado:** 30min

---

### 2. Stripe Webhook signing secret

**Por quê:** Sem o `whsec_xxx`, `POST /payments/webhook` rejeita eventos como
inválidos e nada de subscription se persiste no DB.

**Como:**
1. Dashboard Stripe → `Developers` → `Webhooks` → criar endpoint
   `https://urban.ai/payments/webhook`
2. Selecionar eventos: `checkout.session.completed`, `customer.subscription.*`,
   `invoice.payment_*`
3. Copiar o `Signing secret`
4. Setar no Railway: `STRIPE_WEBHOOK_SECRET=whsec_xxx`

**Tempo:** 10min

---

### 3. Migration `platform_costs` em prod

**Por quê:** Tabela existe em dev pelo `synchronize:true`, mas o cutover pra
migrations versionadas (F5C.1) exige rodar pra registrar o estado.

**Como (uma das duas):**
- **Opção A — automatizado:** setar `MIGRATIONS_RUN=true` no Railway e
  reiniciar o serviço. A migration roda no boot.
- **Opção B — manual:**
  ```bash
  ssh railway-shell
  cd /app
  npm run migration:run
  ```

**Verificar:** `SELECT * FROM migrations` deve listar
`Baseline1745500000000` + `CreatePlatformCosts1745700000000`.

**Tempo:** 5min

---

### 4. Seed dos custos default

**Por quê:** Sem isso, `/admin/finance` mostra custos = 0 → margem fantasiosa
de 100%, decisões de pricing erradas.

**Como:**
1. Login como admin em prod
2. Ir em `/admin/finance`
3. Clicar **"Popular default"** → confirma → pronto (13 custos cadastrados)
4. Revisar valores no painel: ajustar Railway/Sentry/Gemini conforme fatura
   real do mês corrente

**Tempo:** 15min

---

### 5. Cutover `DB_SYNCHRONIZE=true → false`

**Por quê:** F5C.1 prevê schema só via migrations em prod. Hoje está
`synchronize:true` por compatibilidade.

**Como:**
1. Ter rodado P0 #3 com sucesso (migrations registradas)
2. Setar Railway env: `DB_SYNCHRONIZE=false`
3. Reiniciar serviço
4. Smoke test: criar usuário, criar listing, fazer análise

**Risco:** se faltar migration de alguma entity nova (ex: `PriceSnapshot`),
o boot quebra com "table doesn't exist". Manter `DB_SYNCHRONIZE=true` até
todas as entities terem migration (ver "O que ainda posso fazer" abaixo).

**Tempo:** 10min de cutover + monitoramento

---

## P1 — Sem isso, partes do produto não funcionam

### 6. NextAuth secret + JWT secret em prod

**Por quê:** Hoje tem default em dev. Em prod precisa de strings fortes
gerados aleatórios e nunca commitados.

**Como:**
```bash
openssl rand -base64 64  # rode 2x, uma para cada
```
Setar no Railway: `NEXTAUTH_SECRET=...` e `JWT_SECRET=...`

**Tempo:** 5min

---

### 7. Mailersend — domínio + DKIM

**Por quê:** Sem domínio verificado, e-mails caem em spam ou são rejeitados.

**Como:**
1. Mailersend Dashboard → Domains → adicionar `urban.ai`
2. Copiar DKIM/SPF/DMARC records
3. No DNS do `urban.ai` (registro ou Cloudflare), adicionar os 3 records
4. Aguardar verificação (até 24h)
5. Setar Railway env: `MAILERSEND_API_TOKEN=...` e `MAIL_FROM=noreply@urban.ai`

**Tempo:** 30min + 24h de espera

---

### 8. Google Cloud — Maps + Gemini billing

**Por quê:** APIs hoje rodam sem billing verdadeiro → quota grátis estoura
em ~1500 req/dia (Gemini) ou 28.500 maps/mês.

**Como:**
1. console.cloud.google.com → Project `urban-ai-prod`
2. Habilitar billing com cartão da PJ
3. Habilitar APIs: Geocoding, Places, Generative Language API
4. Criar API keys distintas (uma por API, com restrições por referer/IP)
5. Setar Railway: `GOOGLE_MAPS_API_KEY=...`, `GEMINI_API_KEY=...`
6. Configurar alerta de billing em $50/mês

**Tempo:** 45min

---

### 9. Sentry DSN

**Por quê:** Sem DSN, errors em prod desaparecem no console do Railway.

**Como:**
1. sentry.io → Create project → NestJS (backend) e Next.js (frontend)
2. Copiar DSN de cada
3. Setar Railway backend: `SENTRY_DSN=...`
4. Setar env Next.js: `NEXT_PUBLIC_SENTRY_DSN=...`

**Tempo:** 15min

---

### 10. UptimeRobot — monitors

**Como:**
- Backend: `https://api.urban.ai/health` (HTTP, 5min)
- Frontend: `https://urban.ai` (HTTP, 5min)
- Webhook Stripe: `https://api.urban.ai/payments/webhook` (HEAD, 10min)
- Notificação: e-mail Gustavo + Slack/WhatsApp do canal "Urban AI Alertas"

**Tempo:** 20min

---

### 11. GA4 + Meta Pixel — IDs reais

**Por quê:** Frontend tem hooks prontos mas IDs estão vazios em `.env.example`.

**Como:**
1. analytics.google.com → criar property `urban.ai`
2. Copiar Measurement ID `G-XXXX`
3. business.facebook.com → criar Pixel Urban AI
4. Setar env do Next.js (Vercel/Railway):
   ```
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXX
   NEXT_PUBLIC_META_PIXEL_ID=...
   ```

**Tempo:** 25min

---

### 12. Stays Open API — credenciais Preferred+

**Por quê:** F6 bimodal (recomendação + automático) precisa do token Stays
para o modo automático.

**Como:**
1. Solicitar a Maycon/Stays acesso à Open API de Preferred+ Partner
2. Receber `STAYS_CLIENT_ID` + `STAYS_CLIENT_SECRET`
3. Para cada conta cliente Stays: gerar OAuth flow → guardar `accessToken`
   e `refreshToken` no `StaysAccount` (já preparado no schema)
4. Testar push de preço de um listing teste

**Bloqueio:** depende da Stays liberar acesso. Está em conversação.

**Tempo:** 1-2 dias úteis

---

## P2 — Higiene, governança, escala

### 13. CNPJ + conta bancária PJ + Stripe Brasil

**Por quê:** Pra Stripe BR pagar, precisa de PJ verificada. Hoje pode estar
no Stripe pessoal ou em modo test.

**Como:**
1. Abrir CNPJ Urban AI (contador)
2. Conta corrente PJ (Itaú/Inter/Conta Simples)
3. Stripe Atlas Brasil ou onboarding direto Stripe BR com docs da PJ
4. Migrar para conta de produção Stripe (se hoje em test mode)

**Tempo:** 2-4 semanas

---

### 14. LGPD — termos, privacidade, DPO

**Como:**
1. Advogado revisa `Termos de Uso` + `Política de Privacidade` (drafts em
   `docs/legal/` se já existirem; senão preciso criar)
2. Designar DPO (Data Protection Officer) — pode ser o próprio Gustavo
3. Página `/termos` e `/privacidade` no front com versão final
4. Banner de cookies (consent) — ferramenta tipo Cookiebot ou implementação
   própria
5. Processo de "right to erasure" documentado em `docs/runbooks/lgpd-rte.md`

**Tempo:** 1 semana com advogado responsivo

---

### 15. GitHub — branch protection + CI

**Por quê:** Hoje qualquer commit vai direto pra `main`. Para sócios virem
contribuir, precisa de PR review.

**Como:**
1. Settings → Branches → Add rule `main`:
   - Require pull request before merging (1 approval)
   - Require status checks (CI verde)
   - Require linear history
2. Convidar Fabrício e Rogério como Maintainers
3. CI workflow GitHub Actions (Claude pode escrever — ver "O que ainda posso
   fazer" abaixo)

**Tempo:** 30min

---

### 16. Backup off-site MySQL

**Por quê:** Railway tem backup interno mas se a conta for suspensa, perde
tudo. Off-site = S3/B2/Drive.

**Como:**
1. Decidir destino: AWS S3 (~$1/mês) ou Backblaze B2 (~$0.25/mês)
2. Criar bucket `urban-ai-backups`
3. Cron job diário que faz `mysqldump` + sobe pro bucket (Claude pode escrever
   o script — ver abaixo)
4. Retention 30 dias + 1 anual

**Tempo:** 1h

---

### 17. Domínio + DNS + SSL

**Como:**
1. Confirmar registro `urban.ai` ativo (já comprado?)
2. Apontar para Railway/Vercel:
   - `urban.ai` → frontend (Vercel A record)
   - `api.urban.ai` → backend (Railway CNAME)
3. SSL automático pelas plataformas (Let's Encrypt)
4. (Opcional) Cloudflare na frente para WAF + cache + analytics

**Tempo:** 1h + propagação DNS (até 24h)

---

### 18. WhatsApp Business — número de vendas

**Por quê:** `GlobalPaywallModal.tsx:82` abre `wa.me/seunumerodevendas`
(placeholder). Plano "Escala" também leva pra WhatsApp.

**Como:**
1. Criar conta WhatsApp Business com número dedicado (chip novo)
2. Configurar perfil + horário + saudação automática
3. Atualizar todos os links no front (procurar `seunumerodevendas` no repo)

**Tempo:** 30min

---

### 19. Approve ADRs com sócios

**Por quê:** Decisões arquiteturais (KNN→XGBoost, AdaptivePricingStrategy,
captura passiva de dataset, etc.) estão documentadas mas não formalmente
aprovadas.

**Como:**
1. Imprimir/compartilhar ADRs em `docs/adrs/` (ADR-0008, 0009, etc.)
2. Reunião 1h com Fabrício + Rogério
3. Assinar (ou comentar dúvidas) → status `approved`

**Tempo:** 1 reunião

---

### 20. Apresentação aos sócios — abril/2026

Documento `docs/Relatorio Socios Abril 2026.pdf` está pronto. Falta:
- [ ] Marcar reunião 90min
- [ ] Apresentar
- [ ] Validar próximas fases (F7 Premium, F9 Stays Pro, etc.)
- [ ] Definir próximas 4 sprints

---

## O que **ainda posso fazer** (Claude) — sem precisar de você

Lista do que dá pra continuar mesmo enquanto você cuida do checklist acima.
Ranqueado por impacto:

### Alto impacto

1. **Migrations das outras entities novas** — `PriceSnapshot`,
   `OccupancyHistory`, `EventProximityFeature`, `Event` (se ainda não tiver),
   `StaysAccount`, etc. Sem isso, o cutover P0 #5 quebra.

2. **GitHub Actions CI/CD workflow** — `.github/workflows/ci.yml` que roda
   typecheck + jest + build em cada PR. Habilita o branch protection do P2 #15.

3. **Script de backup MySQL → S3/B2** — Node script + cron Railway. Resolve
   P2 #16. Você só precisa colar a access key no Railway env.

4. **Páginas legais drafts** — `/termos` e `/privacidade` com texto base
   gerado por Claude (advogado revisa depois). Mata 50% do P2 #14.

5. **Banner de consent LGPD** — componente React `<CookieConsent />`
   integrado com GA4/Pixel (não dispara antes de consent). Termina P2 #14
   no front.

### Médio impacto

6. **Validador de Stripe Price IDs** — endpoint `GET /admin/stripe/sync-check`
   que valida que os 8 IDs estão setados e que existem na conta Stripe.
   Vira um KPI no `/admin/pricing-config`.

7. **Health endpoints consolidados** — `GET /health` retorna status DB +
   Redis + Stripe + Gemini + tier IA atual. Alimenta UptimeRobot do P1 #10.

8. **Email templates Mailersend** — HTMLs de boas-vindas, recuperação de
   senha, alerta de quota excedida, recibo de pagamento. Falta dar `MAIL_FROM`
   e tokens (P1 #7).

9. **k6 load test scripts** — cenários `signup → onboarding → análise →
   checkout`. Roda em staging. Já tem k6 no projeto, falta cobrir mais
   fluxos.

10. **Smoke E2E completos** — Playwright/Cypress cobrindo o happy path
    F6.5 inteiro (anfitrião novo → assina → cadastra imóveis → vê quota →
    tenta exceder → bloqueia).

### Baixo impacto, mas nice

11. **Performance audit** — query slow log, lighthouse, otimização de
    imagens, lazy load de rotas pesadas.

12. **WCAG 2.1 AA audit** — runbook já existe, falta passar pelas páginas
    novas (`/admin/finance`, `/admin/pricing-config`).

13. **README atualizado** — refletir estado v2.10 do projeto.

14. **CHANGELOG.md** estruturado — mover info do `roadmap-pos-sprint.md`
    pra um CHANGELOG semver.

15. **OpenAPI Swagger refinement** — algumas rotas admin sem `@ApiResponse`.
    Gera SDK depois.

16. **Feature flag system** — pequeno service que liga/desliga features por
    user/role/percentual sem deploy.

17. **i18n scaffolding** — preparar estrutura `pt-BR/en` (mesmo que só
    use pt-BR no MVP).

---

## Como usar este doc

- Marque `[x]` em cada item conforme fizer
- Quando P0 estiver tudo `[x]`, podemos rodar smoke test e considerar
  produção pronta
- O que está em "O que ainda posso fazer" é tudo que dá pra eu adiantar
  agora, sem te bloquear

---

*Última atualização: 25/04/2026 — pós commit `0df8a85` (v2.10).*
