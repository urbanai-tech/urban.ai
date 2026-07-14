# Runbook - staging auth fixtures

Atualizado em 2026-05-26.

## Objetivo

Criar ou corrigir contas tecnicas `admin` e `host` no banco de staging para
smoke tests autenticados, auditoria admin/host e enterprise live gate. O fluxo
nao deve ser executado em producao e nao imprime senha nem JWT no console.

## Script

Arquivo:

```powershell
urban-ai-backend-main/scripts/staging-auth-fixtures.js
```

No container Railway, o boot tambem chama
`scripts/provision-staging-smoke-users.js`. Esse provisionador e propositalmente
mais permissivo no modo "skip": ele nao derruba o app quando a flag nao esta
ativa, mas cria/atualiza as mesmas contas quando `APP_ENV=staging` e
`STAGING_SMOKE_USERS_ENABLED=true` ou `STAGING_AUTH_FIXTURES_ENABLED=true`.

O script:

- exige `APP_ENV=staging` ou `NODE_ENV=staging`;
- exige `STAGING_AUTH_FIXTURES_ENABLED=true`;
- recusa alvos de banco com marcador aparente de producao no host/database;
- cria ou atualiza, de forma idempotente, um usuario `admin` e um usuario
  `host`;
- grava senha como `bcrypt(12)` sobre o SHA-256 da senha em texto puro, que e
  o formato enviado pelo frontend atual;
- reativa usuarios tecnicos (`ativo=true`) e ajusta `role`;
- opcionalmente emite JWTs curtos apenas para `GITHUB_OUTPUT` ou arquivo
  efemero fora do repo.

## Variaveis obrigatorias

```powershell
$env:APP_ENV="staging"
$env:STAGING_AUTH_FIXTURES_ENABLED="true"
$env:STAGING_AUTH_ADMIN_EMAIL="<admin-staging-email>"
$env:STAGING_AUTH_ADMIN_PASSWORD="<senha-admin-em-texto-puro>"
$env:STAGING_AUTH_HOST_EMAIL="<host-staging-email>"
$env:STAGING_AUTH_HOST_PASSWORD="<senha-host-em-texto-puro>"
```

Aliases aceitos pelo provisionador de boot:

```text
STAGING_SMOKE_USERS_ENABLED=true
STAGING_SMOKE_ADMIN_EMAIL / STAGING_SMOKE_ADMIN_PASSWORD
STAGING_SMOKE_HOST_EMAIL / STAGING_SMOKE_HOST_PASSWORD
```

Tambem e necessario configurar `DATABASE_URL` ou o conjunto `DB_HOST`,
`DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

Aliases aceitos para compatibilidade com o release gate:

- `ENTERPRISE_GATE_ADMIN_EMAIL`
- `ENTERPRISE_GATE_ADMIN_PASSWORD`
- `ENTERPRISE_GATE_HOST_EMAIL`
- `ENTERPRISE_GATE_HOST_PASSWORD`

## Validar configuracao sem abrir conexao

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\urban-ai-backend-main"
node scripts/staging-auth-fixtures.js --check-config
```

## Dry-run contra staging

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\urban-ai-backend-main"
node scripts/staging-auth-fixtures.js --dry-run
```

O dry-run consulta o banco e informa apenas `would_create`, `would_update` ou
`unchanged`, sem gravar dados.

## Aplicar fixtures

```powershell
cd "C:\Users\gusta\OneDrive\Documentos\GitHub\Urban AI\urban-ai-backend-main"
node scripts/staging-auth-fixtures.js
```

Saida esperada:

```text
[staging-auth-fixtures] label=admin email=... role=admin status=created|updated|unchanged userId=...
[staging-auth-fixtures] label=host email=... role=host status=created|updated|unchanged userId=...
```

## Emitir JWTs controlados

Preferencia operacional: usar login com as credenciais de staging nos gates.
Quando um gate precisar de JWT pronto, use TTL curto:

```powershell
$env:JWT_SECRET="<jwt-secret-de-staging>"
$env:STAGING_AUTH_EMIT_TOKENS="true"
$env:STAGING_AUTH_JWT_TTL_SECONDS="900"
$env:STAGING_AUTH_TOKEN_OUTPUT="$env:TEMP\urban-staging-auth-tokens.json"
node scripts/staging-auth-fixtures.js --emit-tokens
```

Regras:

- o script nao imprime o token;
- por padrao, arquivos de token dentro do repo sao recusados;
- em GitHub Actions, se `GITHUB_OUTPUT` existir, os outputs
  `ENTERPRISE_GATE_ADMIN_JWT` e `ENTERPRISE_GATE_HOST_JWT` sao escritos ali;
- nunca anexar token em `docs/evidence`, issue, PR ou print.

## GitHub Secrets recomendados

Depois de aplicar as fixtures em staging, configurar:

```text
E2E_AUTH_EMAIL=<admin-staging-email>
E2E_AUTH_PASSWORD=<senha-admin>
ENTERPRISE_GATE_ADMIN_EMAIL=<admin-staging-email>
ENTERPRISE_GATE_ADMIN_PASSWORD=<senha-admin>
ENTERPRISE_GATE_HOST_EMAIL=<host-staging-email>
ENTERPRISE_GATE_HOST_PASSWORD=<senha-host>
```

Com isso:

- `Playwright - authenticated smoke` deixa de ser skipped;
- `Produto - E2E audit admin/host` pode ser ativado com
  `E2E_PRODUCT_AUDIT_ENABLED=true`;
- `Enterprise live gate` consegue autenticar dinamicamente sem armazenar JWT
  fixo.

## Confirmacoes de seguranca

- Nao rodar se `APP_ENV`/`NODE_ENV` nao for `staging`.
- Nao usar banco restaurado de producao sem mascaramento e aprovacao explicita.
- Nao salvar senhas no repo.
- Nao commitar output de token.
- Rotacionar as senhas tecnicas se algum log externo mostrar valor sensivel.
