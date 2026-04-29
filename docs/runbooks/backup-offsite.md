# Runbook — Backup off-site MySQL

**Owner:** Gustavo · **Status:** Implementado · **Workflow:** `.github/workflows/backup-db.yml`

---

## O que faz

GitHub Actions agendado todo dia às **03:00 UTC (00:00 BRT)** que:
1. Conecta no MySQL Railway via `DATABASE_URL`
2. Roda `mysqldump --single-transaction --routines --triggers`
3. Comprime gzip (~10× menor)
4. Sobe pra **S3** ou **Backblaze B2** (config via secrets)
5. Notifica Slack/Discord em sucesso e falha

Backup totalmente fora do container do app — se o Railway pifar, o GitHub
Actions roda mesmo assim.

---

## Setup inicial (uma vez)

### Opção A — AWS S3 (~$1/mês)

1. AWS Console → S3 → criar bucket `urban-ai-backups` (us-east-1 recomendado, mais barato)
2. Bucket → Properties → habilitar **Versioning** (proteção contra delete)
3. Bucket → Management → criar **Lifecycle rule**:
   - Transição para `STANDARD_IA` em 30 dias
   - Transição para `GLACIER` em 90 dias
   - Expiração em 365 dias
4. IAM → criar usuário `urban-ai-backup-bot` com policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:PutObjectAcl"],
       "Resource": "arn:aws:s3:::urban-ai-backups/mysql/*"
     }]
   }
   ```
5. Gerar access key + secret
6. GitHub → Settings → Secrets → adicionar:
   - `DATABASE_URL` (URL Railway completa)
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (ex: `us-east-1`)
   - `S3_BUCKET` (`urban-ai-backups`)

**Custo estimado:** ~$0.50/mês para 10GB de dumps comprimidos.

### Opção B — Backblaze B2 (~$0.25/mês)

1. backblaze.com/b2 → criar bucket `urban-ai-backups` (Private)
2. App Keys → criar key restrita ao bucket com permissão `writeFiles`
3. GitHub Secrets:
   - `DATABASE_URL`
   - `B2_APPLICATION_KEY_ID`
   - `B2_APPLICATION_KEY`
   - `B2_BUCKET` (`urban-ai-backups`)

**Custo estimado:** ~$0.06 por GB/mês. Mais barato que S3 na maior parte dos casos.

> **Use só uma das duas.** Workflow detecta qual destino está configurado.

### Opcional — Notificação Slack

1. Slack → Apps → criar webhook para canal `#urban-ai-alertas`
2. Copiar URL `https://hooks.slack.com/services/...`
3. GitHub Secret: `SLACK_BACKUP_WEBHOOK`

---

## Como verificar que está OK

1. GitHub → Actions → workflow `Backup MySQL DB` → ver runs diários verdes
2. S3/B2 → bucket → ver arquivos `urban-ai-cron-YYYYMMDDTHHMMSSZ.sql.gz`
3. Disparar manual em Actions → "Run workflow" → label `pre-deploy-vX`

---

## Como restaurar de um backup

### Local (dev/staging)

```bash
# Baixa do S3
aws s3 cp s3://urban-ai-backups/mysql/urban-ai-cron-20260425T030000Z.sql.gz .

# OU do B2
b2 download-file-by-name urban-ai-backups mysql/urban-ai-cron-20260425T030000Z.sql.gz ./

# Descomprime e restaura
gunzip urban-ai-cron-*.sql.gz
mysql -h localhost -u root -p ai_urban < urban-ai-cron-*.sql
```

### Em produção (rollback de incident)

> **Ação destrutiva. NUNCA rodar sem aprovação por escrito do Gustavo.**
> Procedimento documentado em `docs/runbooks/disaster-recovery.md` (TODO).

Resumo:
1. Pausar tráfego (Railway settings → Disable)
2. Backup do estado atual antes (sempre — pode ser pior depois)
3. Drop database + recreate
4. Importar dump
5. Smoke test
6. Religar tráfego

---

## Como rodar manualmente

GitHub → Actions → Backup MySQL DB → Run workflow → setar label opcional
(ex: `pre-migration-platform-costs`).

Útil antes de:
- Rodar migration nova em prod
- Refactor grande de schema
- Deploy de feature crítica

---

## O que NÃO está incluído

- **Backup de R2/S3 de uploads de usuário** — Urban AI não tem upload de arquivos
  (fotos vêm do Airbnb por URL). Quando isso mudar, criar workflow paralelo.
- **Backup de Redis/Upstash** — fila BullMQ é efêmera, não precisa backup.
- **Backup de Stripe** — Stripe é fonte da verdade, não backupamos seu dado.
- **Backup de logs** — logs ficam no Sentry e no Railway, retention configurada lá.

---

*Última atualização: 25/04/2026.*
