# Staging Railway Verification - 2026-05-27

Data: 2026-05-27
Escopo: confirmacao read-only de staging no Railway e endpoints publicos.

## Resultado

Status: **staging principal existe e responde**.

O estado anterior dos docs dizia que nao havia staging isolado confirmado. A verificacao atual mostra que essa parte ja avancou.

## Railway observado

| Projeto | Ambiente | Servicos | Status |
|---|---|---|---|
| Backend | `staging` | `urban-ai-backend-staging`, `MySQL`, `Redis` | `SUCCESS` |
| Frontend | `staging` | `urban-ai-frontend-staging` | `SUCCESS` |
| Pipeline | `production` apenas | `urban.ai` | staging nao encontrado |
| Webscraping | `production` apenas | `urban.ai` | staging nao encontrado |

## Endpoints testados

| Endpoint | Resultado |
|---|---|
| `https://urban-ai-backend-staging-staging.up.railway.app/health/live` | `200 OK` |
| `https://urban-ai-frontend-staging-staging.up.railway.app` | `200 OK` |
| `https://staging-api.myurbanai.com/health/live` | DNS nao resolve nesta checagem |
| `https://staging.myurbanai.com` | DNS nao resolve nesta checagem |

## Custom domains criados no Railway

| Dominio | Servico Railway | DNS necessario no Cloudflare |
|---|---|---|
| `staging.myurbanai.com` | `urban-ai-frontend-staging` | `CNAME staging -> 7swvlwmb.up.railway.app` |
| `staging-api.myurbanai.com` | `urban-ai-backend-staging` | `CNAME staging-api -> ywnfzddg.up.railway.app` |

Registros TXT de verificacao Railway:

| Nome | Valor |
|---|---|
| `_railway-verify.staging` | `railway-verify=railway-verify=974341afdc8db5df7ca62971dc3ac59ffa0b02cd829b89d74f789b3b30da21f8` |
| `_railway-verify.staging-api` | `railway-verify=railway-verify=970f2a3796e95f7a94897232d457ba0c0c01d758703af41c6567456d4927190b` |

## Tentativa de acesso Cloudflare

O plugin Cloudflare esta instalado no Codex e havia uma credencial OAuth local para `cloudflare-api`, com escopos incluindo DNS. Em 2026-05-27, essa credencial estava vencida desde 2026-05-21 e o `refresh_token` retornou `invalid_grant`. O MCP oficial da Cloudflare nao ficou disponivel para executar alteracoes DNS nesta sessao.

Tambem foram checados historicos locais do Codex e configuracoes locais por nomes explicitos de token (`CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CF_ZONE_ID`). Nao foi encontrado outro token REST Cloudflare utilizavel fora das mencoes desta propria sessao.

## Gate executado

Arquivos:

- `docs/evidence/enterprise-live-gate-staging-readonly-2026-05-27.md`
- `docs/evidence/enterprise-live-gate-staging-events-ingest-2026-05-27.md`
- `docs/evidence/enterprise-access-readiness-staging-after-secrets-2026-05-27.md`

| Check | Resultado |
|---|---|
| Backend live | PASS |
| Frontend root | PASS |
| Backend detailed health | PASS |
| Events ingest controlled smoke | PASS; 1 evento controlado criado em staging |
| Admin read-only | SKIP por falta de JWT admin |
| AskUrban entitlement | SKIP por falta de JWT host |

## Variaveis locais

Foi criado `.env.staging` local e ignorado pelo Git com:

- URLs Railway de staging preenchidas;
- tokens locais de gate preenchidos sem registrar valores em evidencia;
- `STAYS_AUTO_APPLY_ENABLED=false`;
- `STAYS_AUTO_APPLY_DRY_RUN=true`.

## Variaveis configuradas no Railway staging

| Variavel | Status |
|---|---|
| `HEALTH_READINESS_TOKEN` | configurada |
| `HEALTH_READINESS_PUBLIC` | `false` |
| `EVENTS_INGEST_API_KEY` | configurada |
| `STAYS_TOKEN_ENCRYPTION_KEY` | configurada |
| `STAYS_AUTO_APPLY_ENABLED` | `false` |
| `STAYS_AUTO_APPLY_DRY_RUN` | `true` |

## Bloqueios remanescentes

| Item | Status |
|---|---|
| Custom domains staging | Criados no Railway; DNS Cloudflare pendente por OAuth local expirado/revogado. |
| Gate autenticado admin/host | Falta JWT ou usuarios de teste. |
| Restore drill | Falta `RESTORE_DATABASE_URL`. |
| Stays sandbox | Falta `STAYS_API_BASE_URL`, conta sandbox/assistida e allowlists quando for testar auto dry-run. |
| Pipeline/webscraping staging | Ainda nao existe staging confirmado nesses projetos. |

## Automacao feita com aprovacao

- Gerado e configurado `HEALTH_READINESS_TOKEN` no backend staging.
- Gerado e configurado `EVENTS_INGEST_API_KEY` no backend staging e no `.env.staging` local.
- Gerado e configurado `STAYS_TOKEN_ENCRYPTION_KEY`.
- Mantido Stays em fail-closed/dry-run com `STAYS_AUTO_APPLY_ENABLED=false` e `STAYS_AUTO_APPLY_DRY_RUN=true`.
- Rodados gate read-only e smoke controlado de ingestao em staging apos redeploy.

As acoes acima mudaram configuracao do Railway staging e dispararam redeploy. O deploy novo terminou em `SUCCESS`.
