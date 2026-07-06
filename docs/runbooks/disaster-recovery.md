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
      guardada fora do GitHub Secrets (cofre dos sócios). A credencial do workflow de
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
| 6 | `gunzip -c arquivo.sql.gz \| mysql -h HOST -u USER -p DBNAME` | `DEFINER` de routines/triggers pode falhar por privilégio; tempo de import desconhecido |
| 7 | Atualizar `DATABASE_URL` no backend (Railway) **e** no GitHub Secret do backup; redeploy com **`MIGRATIONS_RUN=false`** na primeira subida | — |
| 8 | Validar: `node scripts/restore-drill-verify.js` (precisa `RESTORE_DATABASE_URL`) + smoke manual (login, listar imóveis, criar análise, `/my-plan`) | Verificador bloqueado se `RESTORE_DATABASE_URL` não setado |
| 9 | Reabrir deploys, comunicar resolução | — |

## Se o dump estiver inutilizável

⚠️ Hoje **não há caminho de reconstrução só por migrations** — 11 tabelas core não têm
`CREATE TABLE` em migration (ver `auditorias-consolidadas-2026-07-02.md`, Auditoria 3, e o
ticket DR-1). Enquanto DR-1 não fechar, um dump inutilizável = **perda de dados**.
Prioridade: fechar DR-1 e manter ≥2 dumps válidos (versioning no bucket).

## RPO/RTO

- **RPO:** backup diário 03:00 UTC → perda máxima ~24h (dentro do SLO). Depende de o
  dump ser **íntegro** (agora verificado no workflow — DR-2).
- **RTO 2h:** não crível até o primeiro drill. Estimativa real na 1ª execução: 4–8h+.

## Pós-incidente

- Registrar `docs/postmortems/incident-db-loss-<data>.md` com timeline e tempo real vs RTO.
- Se algum passo travou por pré-requisito ausente, criar tarefa para resolvê-lo.
