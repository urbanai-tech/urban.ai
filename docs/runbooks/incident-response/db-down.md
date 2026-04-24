# Incidente — MySQL Railway indisponível

**Severidade:** SEV1 (produto inteiro depende do DB).
**RTO alvo:** 2h (ver `docs/slo.md`).

## Detecção

- UptimeRobot dispara alerta de `app.myurbanai.com/health` 5xx.
- Sentry recebe enxurrada de `QueryFailedError` ou `ConnectionRefusedError` em poucos minutos.
- Logs Railway do backend: `Cannot connect to MySQL at <host>:<port>` repetido.
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
- Reduzir `max_connections` da pool no backend (`TypeOrmModule.forRoot({ extra: { connectionLimit: ... } })`) — exige redeploy.
- Se for ataque, ativar Cloudflare na frente (não temos hoje — fila futura).

## Resolução

- Backend volta a responder com 2xx em `/health`.
- UptimeRobot fecha o alerta automaticamente.
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
