# Runbook - Backup MySQL local/off-site

**Owner:** Gustavo · **Status:** Operacional · **Script:** `urban-ai-backend-main/scripts/mysql-backup.js`

---

## Objetivo

O script gera um dump MySQL com `mysqldump`, comprime em `.sql.gz` e envia para um destino off-site S3 ou Backblaze B2.

Por segurança, o modo padrão é `--dry-run`: ele monta o plano e os comandos sanitizados, mas não exige credenciais reais e não executa nada.

---

## Uso rápido

```bash
cd urban-ai-backend-main

# Seguro por padrão: não executa e não exige secrets reais
node scripts/mysql-backup.js

# Dry-run explícito
node scripts/mysql-backup.js --dry-run --target=s3 --label=pre-migration

# Execução real para S3 ou B2
node scripts/mysql-backup.js --execute --target=s3 --label=pre-deploy-v3 --out-dir=/tmp
node scripts/mysql-backup.js --execute --target=b2 --label=pre-deploy-v3 --out-dir=/tmp
```

O arquivo segue o padrão:

```text
urban-ai-<label>-YYYYMMDDTHHMMSSZ.sql.gz
```

---

## Variáveis de ambiente

### Banco

Use `DATABASE_URL`:

```bash
DATABASE_URL=mysql://user:password@host:3306/database
```

Ou variáveis separadas:

```bash
DB_HOST=...
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

No modo real (`--execute`), host, usuário, senha e nome do banco são obrigatórios. No dry-run, o script usa placeholders se nada estiver configurado.

### S3

```bash
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=urban-ai-backups
BACKUP_PREFIX=mysql
```

`AWS_REGION` assume `us-east-1` quando ausente. `BACKUP_PREFIX` assume `mysql`.

### Backblaze B2

```bash
B2_APPLICATION_KEY_ID=...
B2_APPLICATION_KEY=...
B2_BUCKET=urban-ai-backups
BACKUP_PREFIX=mysql
```

O script chama `b2 authorize-account` usando as variáveis de ambiente e depois `b2 upload-file`.

---

## Segurança

- `--dry-run` é o modo padrão.
- O script nunca imprime `DATABASE_URL`, `DB_PASSWORD`, `AWS_SECRET_ACCESS_KEY`, `B2_APPLICATION_KEY` ou `B2_APPLICATION_KEY_ID`.
- A senha do MySQL é passada para `mysqldump` via `MYSQL_PWD`, evitando `-p<senha>` na linha de comando exibida.
- Os comandos mostrados na tela são equivalentes e sanitizados, com segredos substituídos por `<redacted>`.

---

## Pré-requisitos do modo real

Na máquina/runner que executar `--execute`, precisam existir:

- `node`
- `mysqldump`
- `aws` CLI, se o destino for S3
- `b2` CLI, se o destino for Backblaze B2

Exemplo com arquivo `.env` dedicado:

```bash
node scripts/mysql-backup.js --env=.env.backup --dry-run --target=s3
node scripts/mysql-backup.js --env=.env.backup --execute --target=s3 --label=manual
```

---

## Validação esperada

Antes de uma execução real, rode:

```bash
node scripts/mysql-backup.js --env=.env.backup --dry-run --target=s3 --label=smoke
```

Verifique:

- O banco exibido aponta para o host/database correto.
- O destino exibido aponta para o bucket/prefixo correto.
- Nenhum segredo aparece na saída.
- O label está claro o suficiente para auditoria.

Depois do `--execute`, confirme o objeto no bucket:

```bash
aws s3 ls s3://urban-ai-backups/mysql/
b2 ls urban-ai-backups mysql/
```
