# Handoff de Staging - 2026-05-27

Este documento separa o que ja ficou pronto localmente do que depende de acesso humano, conta externa ou segredo.

## Ja pronto localmente

- Estrutura Opensquad validada por `scripts/opensquad-readiness-check.js`.
- Skills faltantes do runner cobertas por wrappers locais.
- CSVs de participantes padronizados para `id,name,role,path`.
- Template local criado em `.env.staging.example`.
- `.env.staging` local criado com URLs Railway de staging ja confirmadas e secrets em branco.
- Evidencias novas geradas em `docs/evidence/`.
- Typecheck local verde para backend, frontend e dashboard.

## Ordem recomendada para o Gustavo

1. Confirmar se os dominios customizados serao usados agora ou manter os dominios Railway:
   - backend atual: `https://urban-ai-backend-staging-staging.up.railway.app`
   - frontend atual: `https://urban-ai-frontend-staging-staging.up.railway.app`
2. Configurar DNS no Cloudflare para `staging.myurbanai.com` e `staging-api.myurbanai.com`.
3. Criar usuario admin staging e usuario host staging.
4. Configurar credenciais/JWTs de gate:
   - `ENTERPRISE_GATE_ADMIN_JWT`
   - `ENTERPRISE_GATE_HOST_JWT`
   - ou credenciais E2E equivalentes nos secrets de CI.
5. Definir `RESTORE_DATABASE_URL` apontando para banco restaurado/nao-producao.
6. Configurar integracoes sandbox/test:
   - Google Maps/Geocoding: `GOOGLE_MAPS_API_KEY`
   - Gemini: `GEMINI_API_KEY`
   - Stripe test keys e Price IDs
   - Brevo test/remetente validado
   - Stays sandbox: `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, dry-run e allowlists.

## Ja configurado no backend staging

- `HEALTH_READINESS_TOKEN`
- `HEALTH_READINESS_PUBLIC=false`
- `EVENTS_INGEST_API_KEY`
- `STAYS_TOKEN_ENCRYPTION_KEY`
- `STAYS_AUTO_APPLY_ENABLED=false`
- `STAYS_AUTO_APPLY_DRY_RUN=true`

## DNS pendente no Cloudflare

| Tipo | Nome | Conteudo | Proxy |
|---|---|---|---|
| CNAME | `staging` | `7swvlwmb.up.railway.app` | DNS only recomendado ate Railway validar SSL |
| TXT | `_railway-verify.staging` | `railway-verify=railway-verify=974341afdc8db5df7ca62971dc3ac59ffa0b02cd829b89d74f789b3b30da21f8` | N/A |
| CNAME | `staging-api` | `ywnfzddg.up.railway.app` | DNS only recomendado ate Railway validar SSL |
| TXT | `_railway-verify.staging-api` | `railway-verify=railway-verify=970f2a3796e95f7a94897232d457ba0c0c01d758703af41c6567456d4927190b` | N/A |

### Status de acesso Cloudflare

O Codex encontrou uma credencial OAuth local antiga do plugin Cloudflare, mas ela esta vencida/revogada. O refresh retornou `invalid_grant`, entao nao foi possivel aplicar os registros diretamente nesta sessao.

Para eu concluir sozinho depois, use uma das opcoes abaixo sem colar segredo no chat:

- Reautenticar o plugin Cloudflare no Codex/app e pedir para eu tentar novamente.
- Ou definir localmente `CLOUDFLARE_API_TOKEN` com permissoes `Zone:Read` e `DNS:Edit` para `myurbanai.com`; se possivel, definir tambem `CLOUDFLARE_ZONE_ID` para evitar autodiscovery.

## Comandos para rodar depois dos secrets

Rodar na raiz do repo:

```powershell
node scripts/opensquad-readiness-check.js
node scripts/enterprise-access-readiness.js --env-file .env.staging --output docs/evidence/enterprise-access-readiness-staging.md
node scripts/enterprise-auditability-live-gate.js --env-file .env.staging --env=staging --strict --skip-events-ingest --output docs/evidence/enterprise-live-gate-staging.md
```

Rodar no backend depois de configurar Stripe/staging:

```powershell
cd urban-ai-backend-main
npm run preflight:track3:strict
npm run restore:verify:dry
```

## Regras de seguranca

- Nao colar segredos em chat, docs ou evidencias.
- Usar apenas chaves test/sandbox em staging.
- Manter `STAYS_AUTO_APPLY_DRY_RUN=true` ate smoke assistido e rollback aprovados.
- Nao rodar gates com mutacao em producao.
- Qualquer push real de preco exige aprovacao humana e rollback testado.

## Criterio para seguir para beta assistido

- Staging front/backend respondendo.
- Enterprise read-only gate verde.
- Authenticated smoke admin/host sem skip.
- Stripe test, Brevo, Google/Gemini e Stays sandbox com evidencia.
- Pelo menos um ciclo de recomendacao -> aceite/rejeicao -> preco aplicado -> outcome registrado em staging.
