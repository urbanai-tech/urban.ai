# Evidência — cobertura crítica de health e locks/cron >= 90%

Data: 2026-07-15

## Resultado

Os três domínios críticos ficaram acima de 90% nas quatro métricas com instrumentação V8, que atribui os ramos ao TypeScript original e evita contabilizar como regra de negócio os helpers gerados pelos decorators do Nest/TypeScript.

| Domínio | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Health (`health.service` + `health.controller`) | 97,75% | 92,66% | 95,45% | 97,75% |
| Admin job runs / lock de janela | 97,47% | 92,64% | 100% | 97,47% |
| Adaptadores de cron | 98,43% | 93,54% | 100% | 98,43% |
| Total do recorte | 97,78% | 92,78% | 97,82% | 97,78% |

Comando de cobertura executado a partir de `urban-ai-backend-main/src`:

```powershell
npx jest --runInBand health/health.service.spec.ts health/health.controller.spec.ts admin-job-runs/admin-job-run-tracker.spec.ts admin-job-runs/scheduled-job-runner.service.spec.ts cron/cron.controller.spec.ts --coverage --coverageProvider=v8 --coverageReporters=text --coverageReporters=json --collectCoverageFrom=health/health.service.ts --collectCoverageFrom=health/health.controller.ts --collectCoverageFrom=admin-job-runs/scheduled-job-runner.service.ts --collectCoverageFrom=admin-job-runs/admin-job-run-tracker.ts --collectCoverageFrom=cron/cron.controller.ts
```

Resultado: **5 suites, 76 testes, 0 falhas**.

## Cenários adicionados

- Health/readiness: versão explícita e fallback de pacote, ambiente padrão, liveness, DB saudável/lento/indisponível, configuração parcial de DB, readiness de e-mail, token público/protegido, token enterprise, header array, formato inválido e comparação com comprimentos diferentes.
- Redis: não configurado, saudável, lento, indisponível, TLS, porta/senha, encerramento normal e fallback para `disconnect` quando `quit` falha.
- Cron health: linhas válidas, timestamp inválido, tabela ausente e ausência de DataSource.
- Job tracker: sucesso primitivo/estruturado, `ok=false`, falha total de lote, status `failed`/`error`/`blocked`, exceção e valor não-Error, payload seguro e serialização de execução ainda aberta.
- Lock de janela: claim local, sobreposição local, janela já concluída, MySQL/MariaDB, lock negado, resposta malformada, query de lock com erro, liberação após sucesso/falha e adaptadores com/sem runner.
- Cron controller: endpoints manuais, execução diária/mensal com sucesso, erro `Error` e não-Error, falha de notificação tolerada e contrato público preservado.

## Locks de recompute

O spec de `EventIntelligenceService` ganhou cobertura comportamental específica para:

- aquisição/liberação de advisory lock MySQL;
- MariaDB e fallback da coluna retornada por `GET_LOCK`;
- falha de `RELEASE_LOCK` sem vazamento da conexão;
- lock ocupado com três tentativas limitadas;
- sobreposição no lock em processo e reutilização segura após a liberação.

Comando:

```powershell
npx jest --runInBand event-intelligence/event-intelligence.service.spec.ts
```

Resultado: **1 suite, 12 testes, 0 falhas**.

## Correção mínima identificada pelos testes

`toAdminJobRunResponse` chamava `toISOString()` antes de tratar `finishedAt = null`, quebrando a serialização de jobs ainda em execução. Foi corrigido para `run.finishedAt?.toISOString() ?? null` e coberto por teste.

## Validações adicionais

- ESLint restrito aos sete arquivos tocados: **passou sem warnings**.
- `npm run build`: **passou**.
- `git diff --check` no recorte: **passou**.
- `npx tsc --noEmit -p tsconfig.spec.json`: não ficou verde por erros preexistentes e fora deste recorte em três specs de `auth` (`auth.controller.spec.ts`, `auth.service.spec.ts` e `auth.support.spec.ts`); nenhum erro apontou para os arquivos desta entrega.
