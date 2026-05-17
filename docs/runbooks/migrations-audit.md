# Runbook - Auditor dry-run de migrations TypeORM

**Objetivo:** apoiar o cutover para `DB_SYNCHRONIZE=false` sem exigir conexao real
com MySQL. O auditor compara arquivos de entities e migrations e aponta entities
que nao aparecem em migrations por nome de tabela ou nome de entity.

## Quando rodar

- Antes de desligar `DB_SYNCHRONIZE` em staging/producao.
- Depois de criar ou alterar uma entity.
- Antes de revisar PRs que mexem em `src/entities` ou `src/migrations`.

## Comandos

Dentro de `urban-ai-backend-main`:

```bash
node scripts/audit-migrations.js
node scripts/audit-migrations.js --strict
node scripts/audit-migrations.js --json
```

Da raiz do workspace:

```bash
node urban-ai-backend-main/scripts/audit-migrations.js
```

## Interpretacao

- `COVERED`: alguma migration menciona literalmente o nome da tabela.
- `WEAK`: alguma migration menciona o nome da entity/tabela por heuristica, mas
  nao encontrou literal exato de tabela.
- `SUSPECT`: nenhuma migration menciona a entity ou a tabela pelos nomes
  detectados. Revisar se a tabela esta coberta pela baseline historica ou se
  precisa de migration explicita.

O comando normal e consultivo e retorna exit code `0` mesmo quando encontra
suspeitas. Use `--strict` para retornar exit code `1` quando houver `SUSPECT`,
o que permite ligar o auditor em CI sem quebrar o fluxo local por padrao.

## Limitacoes

Este auditor nao compara schema real nem interpreta AST TypeScript completo. Ele
e um guardrail de arquivos para detectar esquecimentos obvios antes de rodar
`migration:run`. Para cutover de producao, combine este resultado com backup,
staging atualizado e smoke tests do backend.
