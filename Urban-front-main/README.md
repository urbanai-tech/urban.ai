# Urban AI — Frontend (Next.js 15)

UI completa do produto Urban AI: home/login, landing de lançamento, onboarding, dashboard, planos, integrações.

## Stack

| Tecnologia | Uso |
|---|---|
| Next.js 15 (App Router, output standalone) | framework SSR/SSG |
| Chakra UI 2 + Tailwind 4 | UI (coexistem; Chakra herdado, Tailwind nas páginas novas) |
| NextAuth + JWT do backend | auth (cookie httpOnly desde F5C.2 #10, fase 2 do front pendente) |
| Stripe Elements | checkout |
| Sentry NextJS | observabilidade |
| Leaflet + react-leaflet | mapa |
| i18next + react-i18next | traduções (pt-BR base) |
| Playwright + axe-core | smoke + a11y |

## Porta

`3000` em dev (`yarn dev`).

## Setup local

```bash
yarn install
cp .env.example .env.local
# preencha NEXT_PUBLIC_API_URL, GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET, etc.
yarn dev
```

Backend precisa estar de pé em `http://localhost:10000` ou apontar `NEXT_PUBLIC_API_URL` para staging/prod.

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
| `NEXT_PUBLIC_WAITLIST_ENDPOINT` | URL onde o `WaitlistForm` posta (Formspark, Formspree, ou backend próprio) |
| `NEXT_PUBLIC_CHAINLIT_URL` | rewrites do copilot (vazio = rewrites omitidos) |

## Comandos úteis

```bash
yarn dev              # next dev
yarn build            # next build
yarn start            # next start (depois de build)
yarn lint             # eslint
yarn test:e2e         # playwright (smoke + a11y)
yarn test:e2e:ui      # playwright UI mode
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
    │                            # GlobalPaywallModal, ChainlitCopilot, ...
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
    └── providers.tsx            # NextAuth + Chakra + i18n providers
```

## E2E + a11y tests

Specs em `e2e/`:

- `smoke.spec.ts` — home/landing/plans + waitlist form + staging banner
- `a11y.spec.ts` — axe-core nas 3 rotas públicas, falha em violations critical/serious

Rodar contra dev local:

```bash
# terminal 1
yarn dev

# terminal 2
yarn test:e2e
```

Rodar contra staging:

```bash
E2E_BASE_URL=https://staging.myurbanai.com yarn test:e2e
```

## Build production

`yarn build` gera `.next/standalone/`. O Dockerfile do Railway empacota apenas isso.

ESLint roda no build (desde F5C.2 #13). Se quebrar, ver `../docs/runbooks/eslint-debt.md` para a estratégia de redução gradual.

## Rotas que precisam ser limpas

A auditoria flagrou rotas duplicadas ou órfãs:
- `/maps` + `/maps-bkp` (a remover)
- `/painel` coexistindo com `/dashboard`
- backups e configurações que sobraram do tempo Lumina

Não removidas ainda — fila para next sprint.

## Troubleshooting

- **Banner amarelo aparecendo em prod**: setar `NEXT_PUBLIC_APP_ENV=production` no Railway. Banner só some quando o valor for exatamente `production`.
- **CORS na chamada à API**: backend precisa ter `CORS_ALLOWED_ORIGINS` incluindo a URL do front (com protocolo, sem barra final).
- **Sentry não captura nada em dev**: por design — `instrumentation-client.ts` exige `APP_ENV=production` ou `staging` para habilitar.
- **`@axe-core/playwright` falha**: rodar `yarn playwright install --with-deps chromium` na primeira vez.

## Documentação relacionada

- `../docs/runbooks/jwt-cookie-migration.md` — Fase 2 (frontend) ainda não migrada
- `../docs/runbooks/eslint-debt.md`
- `../docs/runbooks/wcag-audit-checklist.md`
- `../docs/runbooks/stays-integration-setup.md`
