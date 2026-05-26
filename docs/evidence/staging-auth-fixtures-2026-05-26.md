# Evidence - staging auth fixtures - 2026-05-26

## Escopo

Frente backend/staging auth fixtures para habilitar smoke tests autenticados
admin/host sem tocar em producao.

## Entrega

- Criado script `urban-ai-backend-main/scripts/staging-auth-fixtures.js`.
- Script gated por `APP_ENV=staging` ou `NODE_ENV=staging` e
  `STAGING_AUTH_FIXTURES_ENABLED=true`.
- Upsert idempotente de dois usuarios tecnicos:
  - `admin`, role `admin`;
  - `host`, role `host`.
- Senha armazenada como `bcrypt(12)` sobre SHA-256 da senha em texto puro,
  compatibilizando login UI e API.
- Opcao de JWT curto para gates, sem imprimir token no console e recusando
  arquivo de saida dentro do repo por padrao.
- Runbook criado em `docs/runbooks/staging-auth-fixtures.md`.

## Validacoes locais executadas

- `node --check` nos scripts de staging/auth e product audit.
- `node scripts/staging-auth-fixtures.js --check-config` com variaveis dummy de
  staging, sem abrir conexao com banco.
- `node Urban-front-main/scripts/staging-gate-preflight.mjs --gate authenticated-smoke`
  com variaveis dummy de staging: ready.
- `node Urban-front-main/scripts/staging-gate-preflight.mjs --gate product-audit`
  com variaveis dummy de staging: ready.
- `node Urban-front-main/scripts/staging-gate-preflight.mjs --gate enterprise-live-gate`
  com variaveis dummy de staging: ready.
- `node node_modules/typescript/bin/tsc --noEmit` no backend: passou.

Observacao: `npm run build` local do backend nao rodou porque o `nest` CLI nao
esta instalado no `node_modules` atual desta maquina. O `tsc --noEmit` passou e
o CI instala dependencias limpas antes do build.

## Configuracao aplicada

- Railway backend staging recebeu variaveis de fixtures admin/host e
  `STAGING_SMOKE_USERS_ENABLED=true`/`STAGING_AUTH_FIXTURES_ENABLED=true`.
- GitHub Secrets de auth admin/host foram configurados para os gates de staging.
- GitHub Vars `E2E_PRODUCT_AUDIT_ENABLED`,
  `E2E_AUTHENTICATED_SMOKE_ENABLED` e `ENTERPRISE_GATE_ENABLED` foram ativadas.
- Nenhum valor sensivel foi registrado em docs/evidence.

## Pendencias reais

- Deployar esta branch no backend staging para que o boot execute o
  provisionador contra o MySQL staging.
- Confirmar nos logs do Railway que os usuarios tecnicos foram
  `created`, `updated` ou `unchanged`.
- Rodar/reexecutar `release-gate` contra staging para validar authenticated
  smoke, product audit e enterprise live gate com credenciais reais.
