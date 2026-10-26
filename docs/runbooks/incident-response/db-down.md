# Incidente — MySQL Railway indisponível

**Severidade:** SEV1 (produto inteiro depende do DB).
**RTO alvo:** 2h (ver `docs/ops/slo.md`).

## Detecção

- Monitor HTTP em `GET /health` do backend (host da API) com o header `Authorization: Bearer <HEALTH_READINESS_TOKEN>`: devolve **503** com `checks.db.status: "down"`. Sem o token, `/health` devolve 401 e não serve como monitor.
- **`GET /health/live` NÃO detecta este incidente**: é só liveness do processo e continua **200** com o MySQL fora do ar (confirmado no ensaio de 25/10/2026; o healthcheck do container também segue `healthy`). Um monitor só em `/health/live` não alerta.
- Sentry recebe enxurrada de `QueryFailedError` ou `ConnectionRefusedError` em poucos minutos.
- Logs do backend: `Health check DB falhou` seguido de `getaddrinfo ENOTFOUND <host>` ou `connect ECONNREFUSED <host>:<port>`, e `ExceptionsHandler` com o mesmo erro nas rotas que usam o banco. Rotas como `POST /auth/login` respondem **500** (`Internal server error`) em ~3 s.
- Painel Railway → MySQL → status mostra "Crashed", "Restarting" ou "Stopped".

## Triagem (primeiros 5 min)

1. **Anotar hora de início do incidente.**
2. Confirmar no painel Railway: o serviço MySQL está fora? CPU em 100%? OOM?
3. Confirmar no Status do Railway (https://status.railway.app) se há outage da plataforma — se sim, é fora da nossa alçada (esperar + comunicar).
4. Se o problema é **só nosso projeto** (provider OK), prosseguir.

## Mitigação

### Caso 1 — MySQL parou por OOM (out-of-memory)

Sintoma: logs do MySQL mostram OOM kill, restart loop.

**Ação:** subir o plano do Railway temporariamente (Pro → Team) para dobrar a memória. Painel → MySQL → Settings → Plan.

Após estabilizar, investigar query culpada (geralmente um JOIN sem índice ou cron rodando no cron diário com volume crescente).

### Caso 2 — MySQL indisponível por mudança de plano / billing

Sintoma: serviço pausado pelo Railway por billing falhar.

**Ação:** verificar billing no painel; pagar/atualizar cartão; o serviço retoma sozinho. Comunicar ao usuário que houve breve interrupção.

### Caso 3 — Schema corrompido após migration

Sintoma: backend conecta mas queries falham com `Unknown column` / `Table doesn't exist`.

**Ação:** seguir `docs/runbooks/backup-restore.md` § 3 — restore de emergência. Snapshot mais recente no painel Railway → Backups.

### Caso 4 — DDoS ou conexões esgotadas

Sintoma: `Too many connections` ou backend timeout ao conectar.

**Ação:**
- Pausar deploys (uma rolling update pode estar criando picos de conexão).
- No painel Railway → MySQL → Connections, ver quantas estão ativas.
- Reduzir o tamanho da pool do backend. Hoje **não há** `connectionLimit`/`extra` configurado no código (conferido em 25/10/2026): vale o default do driver. Limitar exige uma mudança de código (`extra: { connectionLimit: N }` na config do TypeORM) e redeploy, então não é mitigação de minutos.
- Se for ataque, ativar Cloudflare na frente (não temos hoje — fila futura).

### Caso 5 — Redis (Upstash) indisponível

Não há runbook dedicado; comportamento observado no ensaio local (25/10/2026) ao parar o Redis:

- `GET /health` (com Bearer) devolve **503** com `status: "degraded"` e `checks.redis.status: "down"`; `GET /health/live` continua 200.
- O app **continua servindo**: `POST /auth/login` e `POST /auth/register` responderam 201. A fila Bull (`processos`) fica sem conexão e o log traz `[ioredis] Unhandled error event: Error: connect ETIMEDOUT` e `Health check Redis falhou`.
- Ação: checar o painel Upstash e `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`/`REDIS_TLS` no Railway. Ao voltar o Redis, o `/health` voltou a `ok` sem reiniciar o backend.
- Cuidado ao diagnosticar: com o **MySQL** parado, o `/health` também marcou `redis: "down"` mesmo com o Redis saudável (`redis-cli ping` = `PONG` e conexão `ioredis` direta ok). Trate Redis como suspeito só depois de o banco estar de pé.

## Resolução

- Backend volta a responder com 2xx em `/health` (com o Bearer; `status: "ok"`). No ensaio o backend **reconectou sozinho**, sem restart nem redeploy, ~14 s depois de o MySQL voltar a `healthy`, e o login voltou a responder 201.
- O monitor fecha o alerta automaticamente.
- Confirmar com smoke test: login → dashboard → assinatura.

## Após estabilizar

1. **Postmortem** se o downtime > 15 min ou perda de dados > 0.
2. Comunicar usuários via e-mail se o downtime > 1h.
3. Atualizar este runbook se aprendemos algo novo.
4. Avaliar se este caso vira um teste no `load-tests/` (simular conexões esgotadas etc.).

## O que NÃO fazer

- ❌ Restaurar backup sem snapshot do estado atual antes (você pode precisar do estado corrompido para forensic).
- ❌ Aumentar `max_connections` indefinidamente — o problema raramente é falta de conexões, é uma query mal feita ou cron com loop.
- ❌ Deletar logs do MySQL "para liberar espaço" sem verificar se backup automático rodou.

---

*Última atualização: 24/04/2026*

## Ensaio local (25/10/2026)

Executado por quem não escreveu o runbook, no stack local (`docker-compose.yml`), com `docker compose stop mysql` (e depois `stop redis`) como "incidente" e `start` como recuperação. Alvo: `http://localhost:10000`, `HEALTH_READINESS_TOKEN` de desenvolvimento.

**MySQL parado (Detecção, Mitigação, Resolução).**

| Verificação | Resultado observado |
|---|---|
| `GET /health/live` | `200 {"status":"ok"}`, inalterado; healthcheck do container segue `healthy` |
| `GET /health` sem token | `401 Invalid health readiness token` |
| `GET /health` com Bearer | `503`, `status: "degraded"`, `checks.db.status: "down"`, `checks.crons.status: "skipped"` |
| `POST /auth/login` | `500 Internal server error` em ~3 s |
| Logs | `Health check DB falhou`, `getaddrinfo ENOTFOUND mysql` (no Compose o nome some do DNS; no Railway espere `ECONNREFUSED`/timeout), `ExceptionsHandler` |
| Recuperação | `docker compose start mysql`: `healthy` em 14 s; `/health` voltou a `200 status ok, db ok` e o login a `201`, **sem restart do backend** (RestartCount 0) |

**Redis parado (Caso 5, adicionado neste ensaio).** `/health` = 503 com `redis: down`; `/health/live` = 200; login e registro = 201; log `[ioredis] Unhandled error event: Error: connect ETIMEDOUT`. Recuperou sozinho ao religar.

**Correções feitas neste ensaio:** a Detecção dizia que o UptimeRobot alerta em `/health` 5xx, mas `/health` exige token (401 sem ele) e `/health/live` não enxerga o banco; os sintomas de log (`Cannot connect to MySQL at ...` não existe no código) foram trocados pelas mensagens reais; a Resolução agora exige o Bearer; a mitigação do Caso 4 citava `connectionLimit`, que não está configurado no código; foi adicionado o Caso 5 (Redis), que não existia em nenhum runbook de incidente.

**Achado para o backend (fora do escopo de documentação):** com o MySQL parado, o `/health` reporta `redis: "down"` mesmo com o Redis saudável (`redis-cli ping` = `PONG` e conexão `ioredis` direta funcionando a partir do container do backend); com o MySQL de pé, `redis` fica `ok`. Parece falso-positivo do check de Redis em `src/health/health.service.ts` quando o banco está fora; vale investigar.

**Não ensaiável localmente (e o acesso necessário):**

- Caso 1 (OOM), Caso 2 (billing pausado) e a triagem no painel/Status do Railway: precisam de Railway real.
- Caso 3 (schema corrompido após migration): o restore em si foi ensaiado em `backup-restore.md`, mas não o "restore de emergência em prod".
- Caso 4 (conexões esgotadas / `Too many connections`): não provocado; precisaria de teste de carga contra staging.
- Monitor externo (UptimeRobot) com o header `Authorization` e envio de alerta: precisa da conta UptimeRobot; confirmar também que o monitor aponta para o host da API (o `/health` do front `app.myurbanai.com` não é o do backend; ver `ARQUITETURA-ATUAL.md`).
- Sentry recebendo `QueryFailedError`/`ConnectionRefusedError`: precisa de `SENTRY_DSN` e do projeto Sentry.
