# Evidência — cobertura Stays >= 90%

Data: 2026-07-15

## Escopo

- `src/stays/stays.service.ts`
- `src/stays/stays-connector.ts`
- `src/stays/stays-auto-apply.service.ts`
- respectivos testes unitários `*.spec.ts`

## Resultado de cobertura focada

Comando executado:

```powershell
npx jest --runInBand stays/stays.service.spec.ts stays/stays-connector.spec.ts stays/stays-auto-apply.service.spec.ts --coverage --coverageProvider=v8 --collectCoverageFrom="stays/stays.service.ts" --collectCoverageFrom="stays/stays-connector.ts" --collectCoverageFrom="stays/stays-auto-apply.service.ts" --coverageReporters=text-summary --coverageReporters=json-summary --silent
```

Resultado agregado do domínio:

| Métrica | Coberto | Total | Percentual | Meta |
|---|---:|---:|---:|---:|
| Statements | 1.427 | 1.461 | **97,67%** | >= 90% |
| Branches | 422 | 464 | **90,94%** | >= 90% |
| Functions | 65 | 70 | **92,85%** | >= 90% |
| Lines | 1.427 | 1.461 | **97,67%** | >= 90% |

Resultado dos testes: **3 suites aprovadas, 91 testes aprovados, 0 falhas**.

O provider V8 foi usado para medir os branches do TypeScript original sem contabilizar como branches de produto os helpers de decorators emitidos pelo `ts-jest`/Istanbul.

## Cobertura adicionada

- conexão, reconexão, consentimento, desconexão e conta ausente;
- sincronização de listings novos e existentes, owner scope e readiness;
- preview/push/rollback: guardrails, input inválido, idempotência e corrida de chave única;
- persistência e tolerância a falhas do outcome de decisão de preço;
- conector: autenticação, mapping de payload, ping, 4xx/5xx/network, limites de retry e `Retry-After` numérico/data;
- auto-apply: effective mode, allowlists, kill switch, dry-run, cron concorrente, análise ausente, preços inválidos, falha do provider, sinais e guardrails de decisão;
- helpers numéricos, datas, confidence, deduplicação de riscos e auditoria.

## Bug comprovado e corrigido

`null`, `undefined` e string vazia eram convertidos em `0` por `Number(...)` em sinais de decisão do auto-apply. Isso classificava um sinal ausente como valor abaixo do limite. A normalização agora retorna `null`, preservando o bloqueio fail-closed correto (`missing_*`) sem liberar pushes.

## Validações adicionais

- `npm run build`: aprovado.
- `npx prettier --check` nos quatro arquivos tocados: aprovado.
- reexecução pós-formatação: **91/91 testes aprovados**.

