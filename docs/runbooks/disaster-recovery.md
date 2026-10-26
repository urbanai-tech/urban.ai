# Runbook — Disaster Recovery (perda do MySQL de produção)

> Criado em 02/07/2026 (DR-2). Complementa `backup-restore.md` (drill em staging)
> e `backup-offsite.md` (workflow de dump). Este arquivo cobre o pior caso:
> **o MySQL de produção foi perdido** (volume/serviço, não só corrupção lógica).
>
> ⚠️ **Este procedimento NUNCA foi ensaiado em produção.** O RTO de 2h do
> `slo.md` só será crível depois do primeiro drill real (ver `backup-restore.md §5`).
> Trate os tempos abaixo como estimativa.

## Pré-requisitos que PRECISAM existir antes do incidente

Se algum destes faltar, o restore trava — resolver **agora**, não no incidente:

- [ ] **Credencial AWS read-only** (`s3:GetObject`, `s3:ListBucket` no bucket de backup),
      guardada fora do GitHub Secrets (cofre de senhas da organização). A credencial do workflow de
      backup é **write-only** (`s3:PutObject`) — não serve para baixar.
- [ ] **Acesso ao console AWS** (ou credencial) para localizar o último dump em `s3://<bucket>/mysql/`.
- [ ] **Acesso ao Railway** com permissão de provisionar banco e editar variáveis.
- [ ] Nome do bucket confirmado (unificar `backup-offsite.md` × `backup-restore.md`).

## Cenário: "MySQL de produção perdido às 14h"

| Passo | Ação | Onde pode travar |
|---|---|---|
| 1 | Detectar (Sentry/`/health` DB down), declarar incidente, **pausar deploys** | — |
| 2 | Tentar restore nativo do Railway (Backups → Restore) | Se o volume foi perdido, os snapshots podem ter ido junto |
| 3 | **Fallback off-site:** baixar o último dump de `s3://<bucket>/mysql/` com a credencial read-only | Sem credencial de leitura → travado (ver pré-requisitos) |
| 4 | Validar o dump baixado: `gzip -t arquivo.sql.gz` e conferir o `sha256` contra o registrado na notificação do backup | Dump corrompido → tentar o dump do dia anterior |
| 5 | Provisionar MySQL novo no Railway (~10 min) | — |
| 6 | `gunzip -c arquivo.sql.gz \| MYSQL_PWD=<senha> mysql -h HOST -P PORT -u USER DBNAME` (o banco `DBNAME` precisa existir e estar vazio; o dump não traz `CREATE DATABASE`; mantenha o backend parado até terminar) | `DEFINER` de routines/triggers pode falhar por privilégio; tempo de import desconhecido |
| 7 | Atualizar `DATABASE_URL` no backend (Railway) **e** no GitHub Secret do backup; redeploy com **`MIGRATIONS_RUN=false`** na primeira subida | — |
| 8 | Validar: `cd urban-ai-backend-main && npm ci && node scripts/restore-drill-verify.js` (precisa `RESTORE_DATABASE_URL`; a URL não pode conter `prod`/`production`/`myurbanai.com`, ou o script recusa) + smoke manual (login, listar imóveis, criar análise, `/my-plan`) | Verificador bloqueado se `RESTORE_DATABASE_URL` não setado; falha se `admin_job_runs`/`admin_audit_logs` restaurarem vazias |
| 9 | Reabrir deploys, comunicar resolução | — |

## Se o dump estiver inutilizável

O **schema** pode ser reconstruído só por migrations: no ensaio de 25/10/2026, um MySQL vazio + `npm run migration:run` criaram 46 tabelas e registraram 57 migrations (as tabelas core nascem em `1783400000000-CatchupCoreEntities` e `1745800000000-CatchupFeatureEntities`; `npm run audit:migrations:strict` passa). O antigo bloqueio "DR-1" (11 tabelas core sem `CREATE TABLE`) não se aplica mais.
Isso recupera a **estrutura**, não os **dados**: sem dump válido, usuários, imóveis, pagamentos e histórico são perdidos (só `plans`, `coverage_regions` e demais seeds de boot voltam). Mantenha ≥2 dumps válidos (versioning no bucket).

## RPO/RTO

- **RPO:** backup diário 03:00 UTC → perda máxima ~24h (dentro do SLO). Depende de o
  dump ser **íntegro** (agora verificado no workflow — DR-2).
- **RTO 2h:** não crível até o primeiro drill. Estimativa real na 1ª execução: 4–8h+.

## Validação automatizada segura

Antes de release, `npm run audit:resilience-dr` valida de forma determinística o workflow de backup, os guardrails read-only dos scripts e os contratos deste runbook. Os self-tests `npm run backup:mysql:self-test` e `npm run restore:verify:self-test`, executados em `urban-ai-backend-main/`, não carregam `.env`, não conectam a banco e não executam comandos externos.

O gate automatizado não substitui o drill: existência do objeto off-site, restauração integral, permissões, consistência dos dados e RTO só podem ser comprovados em staging ou banco temporário com evidência datada.

## Pós-incidente

- Registrar `docs/postmortems/incident-db-loss-<data>.md` com timeline e tempo real vs RTO.
- Se algum passo travou por pré-requisito ausente, criar tarefa para resolvê-lo.

## Ensaio local (25/10/2026)

Executado por quem não escreveu o runbook, no stack local (`docker-compose.yml`, MySQL 8.4). Só a parte local foi ensaiada; o resto está listado abaixo.

**Perda do volume simulada.** Para não apagar o volume de `node_modules` (custa ~10 min de `npm ci`): `docker compose stop backend mysql`, `docker compose rm -f mysql backend` e `docker volume rm urban-ai_mysql-data`. Depois `docker compose up -d mysql redis`: o MySQL ficou `healthy` em ~2 min e `information_schema` mostrava **0 tabelas** em `ai_urban`.

**Passos 4 e 6 (validar e importar o dump).** O dump usado foi o gerado por `scripts/mysql-backup.js` no ensaio de `backup-restore.md` (`urban-ai-ensaio-20261026T003959Z.sql.gz`, 14,7 KB, sha256 `d6c98df1...ef5c` igual antes e depois de copiar). `gzip -t` ok; `gunzip -c ... | mysql -uroot ... ai_urban` em ~60 s, exit 0. Contagens iguais às do banco original (user 3, payment 3, plans 3, migrations 57, admin_audit_logs 1, admin_job_runs 1, coverage_regions 1, process_status 1); a única diferença foi `refresh_tokens 1`, do login feito antes do dump.

**Passos 7 e 8 (subir o backend e validar).** `docker compose up -d backend`: o boot rodou `migration:run` ("No migrations are pending") e `GET /health/live` = 200 (uptime do processo 33 s; a primeira compilação do `nest start --watch` domina o tempo). `node scripts/restore-drill-verify.js` com `RESTORE_DATABASE_URL` apontando para o MySQL local: `Pass: 5, Fail: 0`. `GET /health` com Bearer: `status ok`, `db ok`, `redis ok`.

**Migrations a partir do zero (fallback "dump inutilizável").** No primeiro `up` (volume virgem), o `migration:run` do boot criou o schema inteiro: 57 migrations aplicadas e 46 tabelas, sem `synchronize` (`DB_SYNCHRONIZE=false`). O texto antigo do runbook ("11 tabelas core sem CREATE TABLE, ticket DR-1") estava desatualizado e foi corrigido. Ressalva: o schema volta, os dados não.

**Armadilha encontrada.** Se o backend for iniciado com o banco vazio e antes do import, o `migration:run` do boot cria as tabelas e o import do dump colide. No ensaio isso exigiu parar o backend, recriar o banco e importar de novo. O passo 6 agora manda manter o backend parado.

**Correções feitas neste ensaio:** passo 6 (`-p DBNAME` ambíguo; banco precisa existir e estar vazio; backend parado); passo 8 (`npm ci`, bloqueio de URL com "prod", falha se `admin_*` voltarem vazias); seção "Se o dump estiver inutilizável" (DR-1 não procede mais).

**Não ensaiável localmente (e o acesso necessário):**

- Passos 1-3: detecção em Sentry/health de produção, restore nativo do Railway e download do objeto em `s3://<bucket>/mysql/` com a credencial read-only. Precisa de Railway Admin e de credencial AWS de leitura (e do nome real do bucket, ainda não unificado).
- Passo 4, conferência do `sha256` contra a notificação do workflow de backup: precisa de um backup real gerado pelo workflow de GitHub Actions.
- Passo 5: provisionar MySQL novo no Railway (~10 min) e `DEFINER` de routines/triggers com os privilégios do Railway; localmente o usuário é `root`, então o risco de privilégio não foi exercitado.
- Passo 7: trocar `DATABASE_URL` no Railway e no GitHub Secret do backup e redeploy com `MIGRATIONS_RUN=false`.
- RTO de 2h e import de um dump do tamanho real: não mensuráveis com 14 KB.
