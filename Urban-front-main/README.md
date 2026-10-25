# Urban AI — Frontend (Next.js 15)

UI do produto Urban AI: site de marketing (`myurbanai.com`) e app autenticado (`app.myurbanai.com`), separados por host em `src/middleware.ts`. Produção roda no Railway atrás do Cloudflare.

> Estado de infra e ambientes: [`../docs/ARQUITETURA-ATUAL.md`](../docs/ARQUITETURA-ATUAL.md). Variáveis: [`../docs/runbooks/matriz-env-operacional.md`](../docs/runbooks/matriz-env-operacional.md). Revisado em 2026-10-23.

## Stack

| Tecnologia | Uso |
|---|---|
| Next.js 15 (App Router, output standalone) | framework SSR/SSG |
| React 19 + Tailwind 4 + tokens do design system | UI (Chakra UI foi removido; ver `../docs/product/DESIGN-SYSTEM.md`) |
| NextAuth + JWT do backend | auth (cookie httpOnly desde F5C.2 #10, fase 2 do front pendente) |
| Stripe Elements | checkout |
| Sentry NextJS | observabilidade |
| Leaflet + react-leaflet | mapa |
| i18next + react-i18next | traduções (pt-BR base) |
| Playwright + axe-core | smoke + a11y |

## Porta

`3000` em dev (`npm run dev`).

## Setup local

```bash
npm ci --legacy-peer-deps
cp .env.example .env.local
# preencha NEXT_PUBLIC_API_URL, GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET, etc.
npm run dev
```

O projeto usa **npm** (`package-lock.json`), igual ao CI.

Backend local em `http://localhost:10000` (porta do `.env.example` do backend) ou `NEXT_PUBLIC_API_URL` apontando para o backend de **staging** no Railway. As `NEXT_PUBLIC_*` são embutidas no build: mudar exige rebuild.

## Variáveis de ambiente críticas

Ver `.env.example`. As principais:

| Var | Onde se usa |
|---|---|
| `NEXT_PUBLIC_API_URL` | base da API (axios em `src/app/service/api.ts`) |
| `NEXT_PUBLIC_APP_ENV` | `production` / `staging` / `development` — controla banner amarelo + Sentry |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Elements |
| `NEXTAUTH_URL` + `NEXTAUTH_SECRET` | NextAuth |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry |
| `NEXT_PUBLIC_GA4_ID` + `NEXT_PUBLIC_META_PIXEL_ID` | Analytics (vazios = scripts não carregam) |
| `SEO_GSC_SITE_URL` + `SEO_GA4_PROPERTY_ID` + `SEO_GOOGLE_CLIENT_EMAIL` + `SEO_GOOGLE_PRIVATE_KEY` | conectores server-side SEO/GEO para Search Console e GA4 Data API |
| `SEO_BOT_LOG_*` + `SEO_AI_MONITOR_*` | readiness server-side para logs de bots e monitoramento de respostas de IA |
| `NEXT_PUBLIC_WAITLIST_ENDPOINT` | URL onde o `WaitlistForm` posta (Formspark, Formspree, ou backend próprio) |

## Comandos úteis

```bash
npm run dev              # next dev
npm run build            # next build
npm run start            # next start (depois de build)
npm run lint             # eslint
npm run typecheck        # tsc
npm run test:unit        # testes unitários e de contrato
npm run test:e2e         # playwright (smoke + a11y)
npm run test:e2e:ui      # playwright UI mode
```

## Estrutura

```
src/
└── app/
    ├── (home)/                  # / — login + intro
    ├── (institucional)/         # /sobre, /contato, /privacidade
    ├── (marketing)/lancamento/  # /lancamento — landing pública
    ├── api/                     # NextAuth + handlers
    ├── componentes/             # Analytics, StagingBanner, WaitlistForm,
    │                            # GlobalPaywallModal, ...
    ├── context/                 # AuthContext, LanguageContext, PaymentCheckGuard
    ├── confirm-email/, reset-password/, request-reset-password/
    ├── onboarding/              # wizard 5 passos
    ├── dashboard/, properties/, maps/, event-log/, near-events/
    ├── plans/, my-plan/         # tier, billing, cancelar
    ├── settings/integrations/   # conectar Stays (F6.4)
    ├── notificacao/, painel/
    ├── service/api.ts           # axios + helpers tipados (auth, plans, stays, ...)
    ├── globals.css
    ├── layout.tsx               # root: monta StagingBanner, Analytics, Providers
    └── providers.tsx            # NextAuth + i18n providers
```

## E2E + a11y tests

Specs em `e2e/`:

- `smoke.spec.ts` — home/landing/plans + waitlist form + staging banner
- `authenticated-smoke.spec.ts` — login host + dashboard e login admin + admin/alpha/ROI; cada bloco pula sem sua credencial
- `a11y.spec.ts` — axe-core nas 3 rotas públicas, falha em violations critical/serious

Rodar contra dev local:

```bash
# terminal 1
npm run dev

# terminal 2
npm run test:e2e
```

Rodar contra staging (use o domínio de serviço Railway do front de staging; `staging.myurbanai.com` falha em TLS hoje):

```bash
E2E_BASE_URL=<url-railway-do-front-staging> npm run test:e2e
```

Smoke autenticado contra staging:

```bash
E2E_BASE_URL=<url-railway-do-front-staging> \
E2E_API_URL=<url-railway-do-backend-staging> \
E2E_ADMIN_EMAIL=<admin-email> \
E2E_ADMIN_PASSWORD='senha-real-admin' \
E2E_HOST_EMAIL=<host-email> \
E2E_HOST_PASSWORD='senha-real-host' \
E2E_ALPHA_EMAIL=<alpha-email> \
node scripts/staging-gate-preflight.mjs --gate authenticated-smoke

E2E_BASE_URL=<url-railway-do-front-staging> \
E2E_API_URL=<url-railway-do-backend-staging> \
E2E_ADMIN_EMAIL=<admin-email> \
E2E_ADMIN_PASSWORD='senha-real-admin' \
E2E_HOST_EMAIL=<host-email> \
E2E_HOST_PASSWORD='senha-real-host' \
npm run test:e2e -- --grep "Smoke autenticado"
```

Sem credenciais de host ou admin, os blocos correspondentes usam `test.skip` e a suite pública continua rodando normalmente. O CI também aceita `ENTERPRISE_GATE_ADMIN_EMAIL/PASSWORD` e `ENTERPRISE_GATE_HOST_EMAIL/PASSWORD`; os aliases legados `E2E_AUTH_EMAIL/PASSWORD` ou `E2E_EMAIL/PASSWORD` ficam restritos ao bloco admin.

## Build production

`npm run build` gera `.next/standalone/`. O Dockerfile do Railway empacota apenas isso.

ESLint roda no build (desde F5C.2 #13). Se quebrar, ver `../docs/runbooks/eslint-debt.md` para a estratégia de redução gradual.

## Rotas que precisam ser limpas

A auditoria flagrou rotas duplicadas ou órfãs:
- `/maps-bkp` (já removida)
- `/painel` coexistindo com `/dashboard`
- backups e configurações que sobraram do tempo Lumina

Não removidas ainda — fila para next sprint.

## Troubleshooting

- **Banner amarelo aparecendo em prod**: setar `NEXT_PUBLIC_APP_ENV=production` no Railway. Banner só some quando o valor for exatamente `production`.
- **CORS na chamada à API**: backend precisa ter `CORS_ALLOWED_ORIGINS` incluindo a URL do front (com protocolo, sem barra final).
- **Sentry não captura nada em dev**: por design — `instrumentation-client.ts` exige `APP_ENV=production` ou `staging` para habilitar.
- **`@axe-core/playwright` falha**: rodar `npx playwright install --with-deps chromium` na primeira vez.

## Documentação relacionada

- `../docs/runbooks/jwt-cookie-migration.md` — Fase 2 (frontend) ainda não migrada
- `../docs/runbooks/eslint-debt.md`
- `../docs/runbooks/wcag-audit-checklist.md`
- `../docs/runbooks/stays-integration-setup.md`
