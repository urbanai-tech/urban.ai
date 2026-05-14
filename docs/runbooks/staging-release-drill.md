# Runbook - staging release drill

Data: 2026-05-14
Escopo: executar uma janela de release controlada passando por staging, smokes operacionais e decisao explicita antes de promover para producao.

## Objetivo

Tirar o release de "deploy e torcer" para um ritual repetivel: PR, checks, deploy staging, smokes por frente, aprovacao, producao e monitoramento.

## Pre-condicoes

- Branch ou commit candidato definido.
- Lista de arquivos e frentes alteradas conhecida.
- Staging disponivel ou ambiente controlado equivalente documentado.
- Banco de staging separado de producao.
- `APP_ENV`/`NEXT_PUBLIC_APP_ENV` diferenciando staging e prod.
- Stripe staging usando `sk_test`/`pk_test`, nunca chaves live.
- Sentry com ambiente separado por tag ou projeto.
- Responsavel de release e responsavel de rollback definidos.

## Checklist antes do deploy em staging

1. Conferir `git status` e garantir que mudancas paralelas nao entram sem dono.
2. Confirmar que CI/checks locais da area alterada passaram.
3. Revisar migrations: forward-only, idempotentes ou com plano manual.
4. Conferir env vars alteradas contra `docs/runbooks/matriz-env-operacional.md`.
5. Conferir se o release toca algum gate critico:
   - waitlist/prelaunch;
   - eventos;
   - recomendacoes;
   - dataset/ROI;
   - billing;
   - Stays;
   - admin/ops.
6. Definir quais smokes do release gate serao obrigatorios.

## Deploy em staging

1. Promover o commit candidato para o ambiente staging.
2. Aguardar frontend, backend e jobs ficarem saudaveis.
3. Abrir `/admin/dashboard` e confirmar que os blocos carregam sem erro.
4. Conferir logs de boot por 5 minutos.
5. Confirmar que staging nao aponta para URL/API/Stripe/prod por engano.

## Smokes obrigatorios por release

Rode sempre:

- `/admin/dashboard`;
- `/admin/jobs`;
- login/logout;
- waitlist ou signup conforme modo ativo;
- health/config publico;
- smoke da frente alterada.

Smokes por frente:

| Frente alterada | Runbook |
|---|---|
| Eventos | `docs/runbooks/eventos-fallback-manual.md` quando `next30d < 100`. |
| Recomendacoes | `docs/runbooks/recomendacao-nova-smoke.md`. |
| Dataset/ROI | `docs/runbooks/dataset-ground-truth-smoke.md`. |
| Billing | `docs/runbooks/stripe-billing-smoke.md`. |
| Stays | `docs/runbooks/stays-beta-private-smoke.md`. |
| Beta fechado | `docs/runbooks/beta-fechado-assistido.md`. |
| Backup/restore | `docs/runbooks/backup-restore.md`. |

## Branch protection minima

Antes de M3, configurar no GitHub:

- PR obrigatorio para `main`.
- Pelo menos 1 aprovacao para mudancas em backend, billing, Stays, migrations ou auth.
- Checks obrigatorios: backend build/test, frontend typecheck/build e smoke quando disponivel.
- Bloquear force push em `main`.
- Exigir branch atualizada antes do merge quando houver CI.
- CODEOWNERS ou revisores fixos para `urban-ai-backend-main/src/payments`, `stays`, `migrations`, `auth` e `docs/runbooks/release-gate.md`.

## Criterios de aprovacao

Release pode seguir para producao quando:

- smokes obrigatorios passaram;
- dados do admin fazem sentido;
- nao ha falso sucesso conhecido;
- rollback minimo esta definido;
- qualquer pendencia tem dono e severidade aceita.

Bloqueie quando:

- build falha;
- migration tem risco destrutivo sem backup;
- staging usa segredo de prod por engano;
- Stripe test/live mistura;
- recomendacao/dataset/billing/Stays falham em gate critico;
- operador nao consegue explicar alerta vermelho do admin.

## Promocao para producao

1. Registrar commit, data/hora e responsaveis.
2. Promover o mesmo commit validado em staging.
3. Aguardar deploy verde.
4. Rodar smoke minimo em producao com dados controlados.
5. Monitorar por 30 minutos:
   - logs backend;
   - Sentry;
   - `/admin/dashboard`;
   - jobs ou webhooks tocados pelo release.
6. Registrar decisao final: aprovado, rollback ou hotfix.

## Restore drill

Antes de M3, executar pelo menos um drill:

1. Escolher backup recente.
2. Restaurar em banco staging ou banco temporario.
3. Subir backend apontando para o banco restaurado.
4. Rodar health, login admin e `/admin/dashboard`.
5. Registrar tempo total de restauracao e problemas encontrados.
6. Descartar banco temporario ou voltar staging para base normal.

## Registro de release

```text
Staging release drill
Data/hora:
Commit/branch:
Responsavel release:
Responsavel rollback:
Frentes alteradas:
Checks locais/CI:
Staging URL:
Smokes rodados:
Resultados:
Alertas admin:
Sentry/logs:
Rollback definido:
Decisao: aprovado/bloqueado/rollback
Pendencias:
```

## Saida esperada

Depois de cada janela:

- release fica rastreavel;
- regressao fica mais facil de isolar;
- smokes viram candidatos a automacao;
- M3 so avancara quando staging e branch protection forem rotina, nao excecao.
