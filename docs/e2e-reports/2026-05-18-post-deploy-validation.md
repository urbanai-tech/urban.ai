# Validacao pos-deploy - 2026-05-18

PR mergeado: `urbanai-tech/urban.ai#2`
Merge commit: `ed610eb446f6ffbec160b99d6567208ce982ad7a`
Branch de origem: `feat/dev2-track2-semana-7-8-askurban`

## Deploy

| Servico | Railway | Resultado |
| --- | --- | --- |
| Backend | production | `SUCCESS` apos merge |
| Frontend | production | `SUCCESS` apos merge |
| Pipeline | production | `SUCCESS` apos merge |
| Webscraping | production | `SUCCESS` apos merge |

Health backend: `https://urbanai-production-85fd.up.railway.app/health` retornou HTTP 200.
Home app: `https://app.myurbanai.com` retornou HTTP 200.

## Checks GitHub antes do merge

| Check | Resultado |
| --- | --- |
| Backend typecheck + Jest | Passou |
| Backend migrations dry-run | Passou |
| Backend Nest build | Passou |
| Frontend typecheck + build | Passou |
| Frontend Playwright mocked local E2E | Passou |
| Frontend Playwright public smoke | Passou |
| Release gate public smoke | Passou |
| Pipeline pytest | Passou |
| Webscraping pytest | Passou |
| Release evidence dry-run | Passou |

## E2E Admin + Host

Relatorio gerado em `docs/e2e-reports/2026-05-18T00-32-30/report.md`.

| Modulo | Combined | Rotas UI | APIs | Critico |
| --- | ---: | ---: | ---: | ---: |
| Admin | 96% | 94% | 100% | 0 |
| Anfitriao | 100% | 100% | 100% | 0 |

Observacao Admin: a rota de detalhe de imovel carregou com HTTP 200 e API 200,
mas a auditoria capturou dois 404 de console classificados como P2. Uma segunda
passada direta na mesma rota nao reproduziu URLs 404, entao o item fica como
ruido/intermitencia de asset, sem bloqueio funcional.

## Playwright pos-deploy

Rodada contra `https://app.myurbanai.com`:

| Suite | Resultado |
| --- | --- |
| `authenticated-smoke.spec.ts` | Passou |
| `authenticated-mobile-smoke.spec.ts` | Passou |
| `pwa-mobile.spec.ts` | Passou |
| `smoke.spec.ts` | Passou |
| `release-gate-public.spec.ts` | Passou |

Resumo: `24 passed`, `1 skipped` planejado para banner staging.

## PWA

Endpoints em producao:

| Recurso | Resultado |
| --- | --- |
| `/manifest.webmanifest` | HTTP 200 |
| `/pwa-icon-192.png` | HTTP 200 |
| `/pwa-icon-512.png` | HTTP 200 |
| `/maskable-icon-512.png` | HTTP 200 |
| `/apple-touch-icon.png` | HTTP 200 |
| `/sw.js` | HTTP 200 |
| `/offline.html` | HTTP 200 |

Checagem installability via Chrome DevTools Protocol:

```json
{
  "manifestName": "Urban AI",
  "display": "standalone",
  "startUrl": "/dashboard?source=pwa",
  "serviceWorkerAvailable": true,
  "serviceWorkerControlled": true,
  "installabilityErrors": []
}
```

Lighthouse PWA formal nao foi gerado porque o ambiente local nao possui `npm`/`npx`
disponivel no PATH nem pacote `lighthouse` instalado. A validacao equivalente
foi coberta por endpoints 200, Playwright PWA e CDP installability sem erros.

## Stripe

Checks read-only em producao:

```json
{
  "total": 8,
  "ok": 8,
  "missing": 0,
  "notConfigured": 0,
  "problems": 0,
  "stripeKeyConfigured": true
}
```

Readiness billing:

```json
{
  "stripeSecretConfigured": true,
  "stripeWebhookConfigured": true,
  "stripePublishableConfigured": true,
  "stripeSecretMode": "test",
  "stripePublishableMode": "test",
  "stripeModeMismatch": false,
  "legacyPedingPayments": 0
}
```

Nao foi executado checkout/cancelamento real nesta rodada para nao alterar a
assinatura do usuario de producao. O proximo passo seguro e rodar o runbook em
staging/test user dedicado ou com aprovacao explicita para mutacao em test mode.

## Stays

Readiness read-only:

```json
{
  "apiBaseConfigured": false,
  "tokenEncryptionConfigured": true,
  "betaPrivate": true,
  "missingEnv": ["STAYS_API_BASE_URL"]
}
```

Resultado: Stays permanece em beta privado/fail-closed. Nao ha push/sync real
seguro sem `STAYS_API_BASE_URL` e sandbox/conta assistida.

## Geocoding e dados

Sinais admin:

| Item | Resultado |
| --- | --- |
| Eventos pendentes de geocoding | 202 |
| Coletores stale >48h | 3 |
| Eventos futuros 30d | 106/200 |
| Cobertura futura de recomendacao | 62.1% |
| Enderecos ativos com cidade/UF invalidos | 7 |
| Occupancy history | 0 registros |

Dry-run local do geocoder foi tentado com `DRY_RUN=true` e `LIMIT=5`, mas ficou
inconclusivo porque nao ha `DATABASE_URL` local disponivel sem acessar segredo
bruto do Railway. Nao foi executado backfill real.

## Bloqueios restantes

| Frente | Bloqueio |
| --- | --- |
| Stripe mutante | precisa staging/test user dedicado ou aprovacao explicita para checkout/cancelamento test mode |
| Stays | falta `STAYS_API_BASE_URL` e credencial sandbox/oficial |
| Geocoding | precisa validar `DATABASE_URL` mascarado/seguro e rodar backfill `LIMIT=5`; producao ainda mostra pendencias |
| Dados/cases | falta occupancy history, MAPE/cases e coletores stale |
| GitHub pessoal | repo `Gustavogm9` segue com Actions bloqueadas por billing/spending |
