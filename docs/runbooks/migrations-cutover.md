# Runbook — Cutover de `synchronize: true` para migrations versionadas

**Por que existe:** O backend rodava com `synchronize: true` do TypeORM, que altera schema do MySQL automaticamente a cada boot baseado nas entities. Qualquer renomeação/remoção acidental de coluna executa `ALTER TABLE` / `DROP COLUMN` em produção. Ver `docs/avaliacao-projeto-2026-04-16.md` §3.1 CRIT #4.

**Estado após o patch (CRIT #3, 24/04/2026):**
- `synchronize` e `migrationsRun` agora são controlados por env vars (`DB_SYNCHRONIZE`, `MIGRATIONS_RUN`).
- Enquanto não houver setagem explícita, ambos ficam `false` (comportamento "desligado").
- Existe `src/data-source.ts` + scripts `migration:*` no `package.json` + baseline vazia em `src/migrations/1745500000000-Baseline.ts`.

**Estado de produção hoje (Railway):** se `DB_SYNCHRONIZE` estiver **ausente ou "false"**, o backend já está rodando com synchronize DESLIGADO desde o próximo deploy. Se ainda estiver `true`, precisamos fazer o cutover abaixo.

---

## Pré-requisitos

1. **Staging environment existe e é a cópia viva da prod.** Sem staging, não faça cutover direto em prod. (Ver F5C.2 item 11 do roadmap.)
2. **Backup recente do MySQL de produção.** Railway Pro já faz snapshot automático; confirme no painel que existe um snapshot das últimas 24h.
3. **Dump manual em mão:** `mysqldump -h <host> -P <port> -u <user> -p railway > backup-pre-migrations-$(date +%F).sql` guardado localmente.

---

## Passo 1 — Rodar em staging primeiro

No serviço backend-**staging** do Railway:

```
DB_SYNCHRONIZE=false
MIGRATIONS_RUN=true
```

Deploy. No boot, o TypeORM vai:
1. Detectar que não existe a tabela `migrations`, criar.
2. Inserir a linha do `Baseline1745500000000` (no-op — não altera nenhum schema).
3. Subir normalmente.

Logs esperados:
```
Running migration: Baseline1745500000000
Migration Baseline1745500000000 has been executed successfully.
```

Se subir limpo, prosseguir. Se aparecer erro de "column X not found" ou similar, significa que o schema de staging divergiu das entities — **NÃO PROSSEGUIR EM PROD**. Investigar e alinhar staging antes.

## Passo 2 — Fazer o mesmo em produção

Após staging rodar por ≥24h sem incidente:

No serviço backend (prod) do Railway:

```
DB_SYNCHRONIZE=false
MIGRATIONS_RUN=true
```

Deploy. Confirmar nos logs que o Baseline foi aplicado.

## Passo 3 — A partir daí, fluxo padrão de migrations

Alterou uma entity (adicionou campo, renomeou coluna, etc.):

```bash
# Em desenvolvimento (com .env apontando para um banco dev local):
npm run migration:generate --name=AddCampoXNaTabelaY
# -> gera src/migrations/<timestamp>-AddCampoXNaTabelaY.ts
# Revisar manualmente o SQL gerado antes de commitar.
git add src/migrations/<timestamp>-AddCampoXNaTabelaY.ts
git commit -m "feat(db): add campo X in tabela Y"

# No deploy, MIGRATIONS_RUN=true faz rodar automaticamente ao subir.
# Ou rodar manualmente via Railway CLI:
railway run npm run migration:run
```

## Rollback rápido

Se um deploy aplicar uma migration que deu problema:

```bash
# 1) Reverter código no git (voltar para o commit anterior).
# 2) Forçar revert da última migration:
railway run npm run migration:revert
# 3) Redeployar o commit anterior.
```

Em último caso (corrupção grave): desligar `MIGRATIONS_RUN`, restaurar snapshot do MySQL pelo painel do Railway, investigar com calma.

## Emergência: preciso voltar para synchronize

Só em incidente grave. No Railway:

```
DB_SYNCHRONIZE=true
MIGRATIONS_RUN=false
```

Deploy. Volta a aceitar alteração ad-hoc de schema até resolver o problema. **Não deixar assim** — é regressão do CRIT.

---

## Dependências removidas ao concluir esse cutover
- `docs/avaliacao-projeto-2026-04-16.md` §3.1 CRIT #4 resolvido ✅
- Bloqueio da `F5C.1` item CRIT #3 no roadmap.

*Última atualização: 24/04/2026 — CRIT #3 aplicado no código, cutover manual pendente.*
