# Ensaios de runbooks

Registro dos runbooks executados por quem **não os escreveu**, só com o que é possível ensaiar localmente (stack do `docker-compose.yml`; sem produção, staging, Railway, AWS nem contas reais de terceiros). Roadmap H7. Cada runbook ensaiado tem, no fim, a seção "Ensaio local (25/10/2026)" com o que foi executado, o resultado e o que não pôde ser ensaiado.

Legenda: **ensaiado** (executado de ponta a ponta no que é local), **ensaiado parcialmente** (parte local executada, parte exige acesso externo), **só conferido** (comandos, caminhos e variáveis verificados, sem executar o procedimento), **não ensaiável localmente**.

| Runbook | Status | Data | Achados |
|---|---|---|---|
| [`backup-restore.md`](./backup-restore.md) | ensaiado parcialmente | 25/10/2026 | Dump manual, `DROP`/`CREATE DATABASE`, restore e verificador funcionam: contagens idênticas antes e depois (user 3, payment 3, plans 3, migrations 57 ...), `restore-drill-verify` 5/5, `/health/live` 200. Query de validação usava tabelas inexistentes (`address`, `event`, `plan`); `mysql-backup.js --execute` exige S3/B2 (não há destino local); verificador falha com `admin_*` vazias e recusa URL com "prod"; `db-full-export.sh` não existe no repo; dump sem `--out-dir` cai no diretório atual e `*.sql.gz` não está no `.gitignore`. Faltam Railway, S3/KMS e staging. |
| [`disaster-recovery.md`](./disaster-recovery.md) | ensaiado parcialmente | 25/10/2026 | Volume do MySQL apagado, dump do `mysql-backup.js` importado em ~60 s, backend subiu com "No migrations are pending" e verificador 5/5. Migrations a partir do zero criam 46 tabelas / 57 migrations: o bloqueio "DR-1" do runbook estava desatualizado. Passo 6 tinha `-p DBNAME` ambíguo; iniciar o backend antes do import faz o `migration:run` criar o schema e colidir com o dump. Faltam credencial AWS de leitura, Railway e RTO real. |
| [`incident-response/db-down.md`](./incident-response/db-down.md) | ensaiado | 25/10/2026 | Com MySQL parado: `/health/live` continua 200 (não detecta o incidente), `/health` com Bearer = 503 `db: down`, login = 500, recuperação automática em ~14 s sem restart. Detecção citava UptimeRobot em `/health` (exige token) e uma mensagem de log que não existe; `connectionLimit` citado não está configurado. Caso 5 (Redis) adicionado. Possível falso-positivo: `redis: down` no `/health` quando só o MySQL está parado. Casos 1, 2 e 4 não ensaiáveis. |
| [`incident-response/README.md`](./incident-response/README.md) | só conferido | 25/10/2026 | Template de postmortem já existe (texto dizia "a criar"); índice atualizado com o Caso 5. Os runbooks `scrapyd-travado`, `prefect-flow-falhando`, `brevo-rate-limit` e `stripe-price-id-mudou` não foram executados (dependem de Scrapyd/Prefect/Brevo/Stripe). Nenhum runbook de incidente tratava Redis. |
| [`go-live-checklist.md`](./go-live-checklist.md) | só conferido | 25/10/2026 | Preflight roda mas precisa de `--env=`; `MARKETING_BASE_URL` não é lida pelo backend; monitor em `/health/live` não pega banco fora do ar. Rotas, páginas admin, variáveis e links conferidos. Todo o resto exige Stripe, Railway, Cloudflare, Brevo, Google, Sentry e GitHub reais. |
| [`access-onboarding.md`](./access-onboarding.md) | só conferido | 25/10/2026 | Setup local citava `yarn` (o repo usa npm/Compose) e "67 testes"; Hostinger virou Cloudflare; `docs/onboarding/` não existe. Concessões de acesso não ensaiáveis sem Admin de cada provedor. |
| Demais runbooks de [`README.md`](./README.md) | não ensaiado | n/a | Fora do escopo desta rodada. Os que dependem de provedores externos (Stripe, Brevo, Stays, Railway, Scrapyd, Prefect) são **não ensaiáveis localmente**. |

## Pendências de acesso (para fechar o H7 de verdade)

- Railway Admin (staging ou projeto descartável): restore nativo, `Restore to...`, troca de `DATABASE_URL`, `MIGRATIONS_RUN=false`.
- AWS: credencial de escrita para o workflow de backup e credencial **read-only** guardada fora do GitHub Secrets (download no DR); confirmar o nome do bucket.
- Staging com Sentry e Stripe de teste para os smokes funcionais pós-restore.
- UptimeRobot (ou equivalente) com monitor em `/health` com Bearer.
- Admin dos provedores listados em `access-onboarding.md` para validar as concessões.
