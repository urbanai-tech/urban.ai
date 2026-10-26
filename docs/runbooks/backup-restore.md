# Runbook — Backup e Restore do MySQL

**Contexto:** o DB de produção roda no Railway (plano Pro, snapshot automático, retenção 7 dias). Até 24/04/2026 nunca testamos restaurar de verdade. Este runbook documenta o drill trimestral de restauração, que é exigência do SLO (RPO 24h) e da F5C.4 item #6 da auditoria.

---

## 1. Tipos de backup disponíveis

### Automático (Railway Pro)

- Snapshot diário, retenção 7 dias, executado pelo Railway por volta das 04:00 UTC.
- Acesso: painel Railway → projeto → serviço MySQL → Backups.
- Formato: restore point-in-time dentro da janela de 7 dias.

### Manual (mysqldump)

- Executado pelo time em momentos críticos: antes de migration destrutiva, antes de mudança de infra, pré-incidente que vá exigir downtime prolongado.
- Comando:
  ```bash
  mysqldump --single-transaction --routines --triggers --events --no-tablespaces \
    -h <host> -P <port> -u <user> -p<pass> railway \
    > backup-prod-$(date +%Y%m%d-%H%M).sql
  gzip backup-prod-*.sql
  ```
  Requer o cliente MySQL (`mysqldump`) instalado na máquina; sem ele, rode o mesmo comando dentro de um container `mysql:8.4`. `--no-tablespaces` evita o erro de privilégio `PROCESS` com usuários não-root.
- Alternativa com o script do repositório (mesmas flags, mais checksum/validação de destino): `cd urban-ai-backend-main && node scripts/mysql-backup.js --execute --label=pre-migration --out-dir=<pasta fora do repositório>`. **Exige destino remoto** (`S3_BUCKET` + `AWS_*` ou `B2_BUCKET` + `B2_*`; não há destino só-local) e `mysqldump` + `aws`/`b2` no PATH. Use sempre `--out-dir` fora do repositório: o padrão é o diretório atual e o dump contém dados reais.
- Armazenar no S3 com bucket separado (sugestão: `urbanai-db-backups`, ciclo de vida 90 dias, KMS encrypted):
  ```bash
  aws s3 cp backup-prod-*.sql.gz \
    s3://urbanai-db-backups/manual/$(date +%Y/%m)/ \
    --sse aws:kms
  ```

### Antes de migration destrutiva

Obrigatório. Ver também `docs/runbooks/migrations-cutover.md`.

---

## 2. Drill trimestral de restore

Alvo: fazer em staging, medir tempo total, validar que o dump restaurado sobe um backend saudável. Periodicidade: **início de cada trimestre** (última semana de mar/jun/set/dez).

### Passo a passo

1. **Anotar a hora de início**: o RTO publicado é 2h. Se passar disso, documentar a causa.

2. **Escolher o snapshot a restaurar:**
   - No painel Railway do MySQL de prod → Backups → pegar o snapshot de **7 dias atrás** (máximo do plano). Isso força o exercício no limite RPO+RTO.

3. **Criar DB vazio em staging:**
   - Se já existe o MySQL de staging (F5C.2 item #11), usá-lo depois de um `DROP DATABASE railway; CREATE DATABASE railway;` para ter certeza que não tem schema pré-existente contaminando.
   - Se não existe ainda, criar provisório: novo MySQL no projeto `urban-ai-staging`.

4. **Restaurar o snapshot:**

   **Opção A (Railway UI, mais rápido):**
   - No painel do MySQL de prod → Backups → snapshot escolhido → "Restore to…" → selecionar o MySQL staging. Aguardar.

   **Opção B (mysqldump manual, fallback se A não funcionar):**
   - Do snapshot Railway, exportar dump SQL (Railway oferece download).
   - Baixar `.sql.gz`, descompactar.
   - Aplicar no staging:
     ```bash
     gunzip -c backup-prod-XXXXXXXX.sql.gz | \
       mysql -h <staging-host> -P <staging-port> \
       -u <staging-user> -p<staging-pass> railway
     ```
   - O dump de um único banco não traz `CREATE DATABASE`: o banco de destino precisa existir e estar **vazio**. Mantenha o backend parado/pausado durante o import; se ele subir antes, o `migration:run` do boot cria o schema do zero e o import colide com tabelas já existentes.

5. **Validar schema:**
   ```sql
   -- Contagem por tabela esperada (ajustar com números da prod do dia)
   SELECT 'user' AS tabela, COUNT(*) FROM user
   UNION ALL SELECT 'addresses', COUNT(*) FROM addresses
   UNION ALL SELECT 'list', COUNT(*) FROM list
   UNION ALL SELECT 'events', COUNT(*) FROM events
   UNION ALL SELECT 'payment', COUNT(*) FROM payment
   UNION ALL SELECT 'plans', COUNT(*) FROM plans
   UNION ALL SELECT 'analise_preco', COUNT(*) FROM analise_preco;
   ```

   (Os nomes de tabela são os reais do schema: `addresses`, `events` e `plans` no plural. A versão anterior deste runbook usava `address`, `event` e `plan` e a query falhava.)

   Tambem rode o verificador automatizado read-only contra o banco restaurado (requer `npm ci` em `urban-ai-backend-main/`, pois usa `mysql2`; a URL não pode conter `prod`, `production` ou `myurbanai.com`, senão o script recusa o alvo):

   ```bash
   cd urban-ai-backend-main
   RESTORE_DATABASE_URL="mysql://<staging-user>:<staging-pass>@<staging-host>:3306/<database>" \
     node scripts/restore-drill-verify.js \
       --output ../docs/evidence/restore-drill-YYYY-QX.md
   ```

   O script valida conexao, tabelas operacionais esperadas, contagens, timestamps recentes e leitura das tabelas de auditabilidade (`admin_job_runs` e `admin_audit_logs`). Ele redige a URL do banco no markdown e nao executa escrita. **Atenção:** a checagem `auditability.tables_nonempty` falha (exit 1) se `admin_job_runs` ou `admin_audit_logs` estiverem vazias; num banco local recém-criado, insira uma linha em cada uma antes (ver "Ensaio local" no fim).

6. **Subir backend staging apontando pro DB restaurado:**
   - Atualizar `DATABASE_URL` do serviço backend staging temporariamente.
   - Fazer redeploy.
   - Checar logs: zero exceção no boot, `TypeOrmModule` conecta, Sentry recebe um evento de teste sem erro.

7. **Smoke test funcional** (≤ 10 min):
   - Login com um usuário cujo e-mail conhecemos (escolher do dump).
   - Listar imóveis.
   - Solicitar uma `analise_preco` nova (vai criar uma linha nova → confirma que write path funciona).
   - Acessar `/my-plan`.

8. **Anotar o tempo total** desde início até smoke test OK. Publicar no slack/doc interno.

9. **Limpar:**
   - Reverter `DATABASE_URL` do staging apontando para o MySQL staging normal.
   - Drop do schema restaurado se usou banco provisório.

10. **Documentar resultado** em `docs/postmortems/drill-restore-YYYY-QX.md`:
    - Duração total
    - Qualquer snag encontrado
    - Ajustes ao runbook propostos

---

## 3. Restore de emergência em prod

**Quando usar:** banco corrompido, migration que destruiu dados, incident com perda de dados.

**Critério de decisão:** só fazer se for claramente mais rápido que tentar recuperar in-place. Na dúvida, chamar todos os responsáveis antes de iniciar.

### Passo a passo

1. **Declarar o incidente** (se ainda não declarou). Postar no canal de comunicação interno + pausar deploys.

2. **Cortar o tráfego:** ativar maintenance mode no Railway (Service → Settings → Pause Deployments + atualizar DNS para página de manutenção se disponível). O objetivo é não piorar com mais escrita enquanto avaliamos.

3. **Snapshot adicional do estado corrompido atual:**
   ```bash
   mysqldump --single-transaction ... > emergency-pre-restore-$(date +%Y%m%d-%H%M).sql
   ```
   Esse snapshot **não** é para restaurar, é para forensic analysis depois.

4. **Identificar o ponto de restore:**
   - Qual foi o último snapshot "limpo"?
   - Railway UI → Backups.

5. **Restore em prod:**
   - Railway UI → "Restore to…" → mesmo projeto MySQL de prod.
   - Essa operação **substitui** o DB de prod. Não há undo depois.

6. **Subir backend:**
   - Deixar `MIGRATIONS_RUN=false` na primeira subida para não bater em migrations novas que o snapshot não tem.
   - Verificar schema (query da seção 2 passo 5).

7. **Rodar migrations se necessário:** se o snapshot for anterior a uma migration já aplicada, vai precisar reaplicar.

8. **Validar funcionalidade crítica:**
   - Login com conta de teste → OK
   - Dashboard carrega
   - Webhook Stripe aceita payload fake (via `stripe trigger checkout.session.completed` no CLI)

9. **Reabrir tráfego:**
   - Retomar deploys
   - Comunicar aos usuários (e-mail + status page) sobre a janela de dados perdidos e os próximos passos.

10. **Postmortem obrigatório** em `docs/postmortems/<YYYY-MM-DD>-db-restore.md`.

---

## 4. Script pronto para download completo (export de tudo)

`scripts/db-full-export.sh` (**não existe no repositório**; crie quando necessário. O conteúdo abaixo foi executado no ensaio de 25/10/2026 contra um MySQL 8.4 local e gerou o `.sql.gz` corretamente):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Requer env vars: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
# Uso: ./scripts/db-full-export.sh /tmp/out.sql.gz

OUT=${1:-/tmp/urbanai-dump-$(date +%Y%m%d-%H%M).sql.gz}

mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --no-tablespaces \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  "$DB_NAME" | gzip > "$OUT"

echo "Dump gerado em: $OUT ($(du -h "$OUT" | cut -f1))"
```

---

## 5. Gate automatizado sem credenciais

O gate local valida os guardrails do workflow, dos scripts e dos runbooks sem abrir conexão, gerar dump ou acessar Railway/S3/B2:

```bash
# Na raiz do repositório
npm run audit:resilience-dr:self-test
npm run audit:resilience-dr

# No backend
npm run backup:mysql:self-test
npm run restore:verify:self-test
npm run backup:mysql:dry
npm run restore:verify:dry
npm run audit:migrations:strict
```

O gate cobre concorrência e timeout do backup, execução agendada/manual, dump transacional, integridade `gzip`, tamanho/tabelas mínimos, checksum, destinos off-site, fail-closed sem credenciais, redação de segredos, bloqueio de alvo aparente de produção, consultas read-only do verificador, RPO/RTO, evidência, rollback e preservação forense.

Esse resultado prova a consistência estática e os guardrails locais. Ele **não** prova que um backup remoto existe, que o dump é restaurável ou que o RTO foi alcançado; essas evidências continuam dependendo do drill trimestral em staging/DB temporário.

## 6. Aceitação

Este runbook é considerado "aprovado" somente depois do **primeiro drill real**. Quando Gustavo executar os passos da seção 2 pela primeira vez (semana 7–8, após staging estar de pé), atualizar:

- [ ] Tempo total observado (vs. RTO 2h)
- [ ] Ajustes ao runbook
- [ ] Status ✅ na tabela do `docs/ops/slo.md` § Error budget
- [ ] Evidencia gerada por `node scripts/restore-drill-verify.js` em `docs/evidence/`

---

*Última atualização: 15/07/2026 · Responsável: Gustavo Macedo*

---

## Ensaio local (25/10/2026)

Executado por quem não escreveu o runbook, contra o stack local do `docker-compose.yml` (MySQL 8.4, banco `ai_urban`, senha fictícia de dev). Nada de produção, staging, Railway ou AWS real foi tocado.

**Ambiente.** O host Windows não tem `mysqldump`, `mysql` nem `aws`; por isso os comandos do MySQL foram rodados com `docker compose exec -T mysql ...` (mesmos binários e flags do runbook). `docker compose up -d mysql redis backend` levou ~2 min até o MySQL ficar `healthy` e ~10 min até `/health/live` responder 200 na primeira subida (`npm ci` + compilação); o `migration:run` do boot criou o schema do zero (57 migrations, 46 tabelas).

**Dados semeados.** 3 usuários via `POST /auth/register` (o corpo exige `termsAccepted: true` e `termsVersion` igual a `TERMS_VERSION` de `src/auth/terms.constants.ts`; sem eles a API devolve 400) e 1 linha em cada uma de `admin_audit_logs` e `admin_job_runs` por SQL.

**1. Backup manual (seção 1).** `mysqldump --single-transaction --routines --triggers --events -h 127.0.0.1 -P 3306 -u root -p... ai_urban | gzip` gerou `backup-local-manual.sql.gz` (14,7 KB, `gzip -t` ok, 46 `CREATE TABLE`, 8 tabelas com `INSERT`).

**2. Drop + restore (seção 2, opção B).** Backend parado; `DROP DATABASE ai_urban; CREATE DATABASE ai_urban;` (0 tabelas depois); `gunzip -c ... | mysql ... ai_urban` (exit 0). Contagens de linhas antes x depois, idênticas:

```
admin_audit_logs 1 | admin_job_runs 1 | coverage_regions 1 | migrations 57
payment 3 | plans 3 | process_status 1 | user 3
```

**3. Verificador.** Com o backend de volta (o boot rodou `migration:run`: "No migrations are pending"), `node scripts/restore-drill-verify.js` com `RESTORE_DATABASE_URL=mysql://root:***@mysql:3306/ai_urban` (executado dentro do container do backend, que tem `node_modules`): `Pass: 5, Fail: 0` (connection, schema.expected_tables 18/18, row_counts, latest_timestamps, auditability.tables_nonempty). `GET /health/live` = 200 `{"status":"ok"}`; `GET /health` com o Bearer de readiness = 200 com `db: ok`, `redis: ok`; login do usuário restaurado = 201 com cookie.

**4. Script `mysql-backup.js` (seção 5).** `npm run backup:mysql:dry` imprime o plano e não grava nada. `--execute` **não tem destino local**: sem `S3_BUCKET`+`AWS_*` ou `B2_BUCKET`+`B2_*` ele aborta. Para exercitar o fluxo inteiro (dump, gzip, nome do arquivo, upload) rodei dentro do container do backend com `mariadb-client` instalado (shim `mysqldump` que descarta `--set-gtid-purged`, flag que o `mariadb-dump` não conhece) e um shim `aws` que copia para `/tmp/fake-s3`. Resultado: "Backup gerado: .../urban-ai-ensaio-20261026T003959Z.sql.gz (14.3 KB)", upload simulado, exit 0. Esse dump foi depois restaurado no ensaio do `disaster-recovery.md`.

**5. Gates estáticos.** `node scripts/resilience-dr-gate.js` (65/65 contratos), `mysql-backup.js --self-test` (6/6), `restore-drill-verify.js --self-test` (6/6) e `--dry-run` passaram.

**6. Snippet da seção 4 (`db-full-export.sh`).** Executado com `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` apontando para o MySQL local: "Dump gerado em: /tmp/out.sql.gz (16K)".

**Correções feitas neste ensaio:** nomes de tabela da query de validação (`address`/`event`/`plan` → `addresses`/`events`/`plans`); `--no-tablespaces` no comando manual; pré-requisitos do verificador (`npm ci`, bloqueio de URL com "prod", exigência de linhas em `admin_*`); aviso de que o script de backup exige destino remoto e de usar `--out-dir` fora do repositório; aviso de manter o backend parado durante o import; nota de que `db-full-export.sh` não existe no repo.

**Não ensaiável localmente (e o acesso necessário):**

- Snapshot automático e "Restore to..." do Railway (seções 1, 2.4 opção A e 3.5): precisa de acesso Admin ao projeto Railway.
- `aws s3 cp --sse aws:kms` para `urbanai-db-backups` e upload/`b2` reais do script: precisa de credencial AWS/B2 de escrita (e a de leitura para o DR). O shim só prova a orquestração do script, não permissões, KMS nem retenção.
- Passos 6 e 7 completos (Sentry recebendo evento, listar imóveis, criar `analise_preco`, `/my-plan`) e o `stripe trigger` da seção 3: só foram checados `/health/live`, `/health`, login e o verificador; o restante exige staging com Sentry/Stripe de teste e dados de imóvel.
- Tempo real contra o RTO de 2h: o tempo local (restore de 14 KB em ~60 s numa VM lenta) não é representativo do volume de produção.
- Seção 3 (restore de emergência em prod, maintenance mode no Railway): por definição só em produção.
