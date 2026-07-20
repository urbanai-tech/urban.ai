# Restore drill real — 2026-07-20

## Resultado executivo

O backup off-site mais recente foi baixado e restaurado com sucesso em um MySQL 8.4 efêmero e isolado no GitHub Actions. O banco temporário foi destruído junto com o runner. O restore técnico e quatro verificações estruturais passaram; o gate global permaneceu vermelho porque a tabela `admin_audit_logs` existe, mas está vazia no backup.

Classificação: **restore técnico aprovado; auditabilidade reprovada**. A lacuna não foi mascarada com registros artificiais.

## Execução

- workflow: `Restore Drill MySQL`;
- run: `29746197104` no SHA canônico `f66ec443`;
- ambiente temporário: MySQL 8.4 em service container descartável;
- fonte: backup off-site S3 mais recente sob o prefixo `mysql/`;
- artefato sanitizado: `restore-drill-evidence-29746197104`;
- credenciais e URL do banco: redigidas pelo verificador.

## Métricas observadas

| Métrica | Resultado |
|---|---:|
| Timestamp do backup | 2026-07-20 06:22:20 UTC |
| Início do drill | 2026-07-20 13:26:18 UTC |
| RPO observado / idade do backup | 25.441 s (7 h 04 min 01 s) |
| RTO de restore + verificação | 27 s |
| Tamanho comprimido | 6.359.492 bytes |
| Tabelas operacionais esperadas | 18/18 presentes |
| Checks pós-restore | 4 passaram; 1 falhou |

## Checks pós-restore

| Check | Resultado | Evidência |
|---|---|---|
| Conectividade | aprovado | `SELECT 1` no banco restaurado |
| Schema esperado | aprovado | 18/18 tabelas presentes |
| Contagem de linhas | aprovado | leitura concluída nas tabelas centrais |
| Timestamps mais recentes | aprovado | leitura concluída nas tabelas aplicáveis |
| Auditabilidade | reprovado | `admin_job_runs` possui dados; `admin_audit_logs` possui zero registros |

## Diagnóstico e ação corretiva

O código contém a entidade, migration, serviço e chamadas de gravação de auditoria administrativa. O resultado do backup não prova, porém, que essas gravações estão operando em produção. As hipóteses ainda abertas são ausência de mutações administrativas desde a implantação, falha silenciosa no `AdminAuditService.record()` ou deployment anterior ao uso efetivo do controle.

Para fechar o gate sem adulterar evidência:

1. executar uma mutação administrativa inofensiva e autorizada em staging;
2. confirmar que um registro real aparece em `admin_audit_logs` com ator, ação, entidade e timestamp;
3. verificar logs de warning do `AdminAuditService` e alertar falhas de persistência;
4. após uma operação administrativa real autorizada em produção, confirmar inclusão no próximo backup;
5. repetir o restore drill e exigir 5/5 checks verdes.

## Riscos residuais

- RPO observado de pouco mais de sete horas precisa ser comparado ao objetivo de recuperação aprovado pelo negócio;
- criptografia e retenção do bucket não foram certificadas por este workflow;
- rollback de deploy/migration continua sendo um exercício separado;
- até existir trilha administrativa real no backup, o scorecard de DR/auditabilidade não pode receber 10/10.
