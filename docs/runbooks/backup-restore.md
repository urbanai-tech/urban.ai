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
  mysqldump --single-transaction --routines --triggers --events \
    -h <host> -P <port> -u <user> -p<pass> railway \
    > backup-prod-$(date +%Y%m%d-%H%M).sql
  gzip backup-prod-*.sql
  ```
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

5. **Validar schema:**
   ```sql
   -- Contagem por tabela esperada (ajustar com números da prod do dia)
   SELECT 'user' AS tabela, COUNT(*) FROM user
   UNION ALL SELECT 'address', COUNT(*) FROM address
   UNION ALL SELECT 'list', COUNT(*) FROM list
   UNION ALL SELECT 'event', COUNT(*) FROM event
   UNION ALL SELECT 'payment', COUNT(*) FROM payment
   UNION ALL SELECT 'plan', COUNT(*) FROM plan
   UNION ALL SELECT 'analise_preco', COUNT(*) FROM analise_preco;
   ```

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

**Critério de decisão:** só fazer se for claramente mais rápido que tentar recuperar in-place. Na dúvida, chamar todos os sócios antes de iniciar.

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

`scripts/db-full-export.sh` (a criar quando necessário):

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

## 5. Aceitação

Este runbook é considerado "aprovado" somente depois do **primeiro drill real**. Quando Gustavo executar os passos da seção 2 pela primeira vez (semana 7–8, após staging estar de pé), atualizar:

- [ ] Tempo total observado (vs. RTO 2h)
- [ ] Ajustes ao runbook
- [ ] Status ✅ na tabela do `docs/slo.md` § Error budget

---

*Última atualização: 24/04/2026 · Responsável: Gustavo Macedo*
