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
3. publicar o reforço do `AdminAuditService`, que redige segredos, tenta persistir três vezes e retorna erro explícito em vez de engolir a falha;
4. após uma operação administrativa real autorizada em produção, confirmar inclusão no próximo backup;
5. repetir o restore drill e exigir 5/5 checks verdes.

## Riscos residuais

- o RPO observado de pouco mais de sete horas atende ao objetivo documentado de 24 horas; o workflow agora usa 24 horas como limite padrão;
- o workflow passou a exigir criptografia server-side suportada e registrar, sem segredos, o estado de versionamento e a quantidade de regras de lifecycle; esses controles ainda precisam ser observados em uma nova execução;
- rollback de deploy/migration continua sendo um exercício separado;
- até existir trilha administrativa real no backup, o scorecard de DR/auditabilidade não pode receber 10/10.

## Correção preventiva preparada

O serviço de auditoria administrativa foi endurecido no PR operacional de 2026-07-20:

- remove chaves sensíveis de `before`, `after` e `metadata` de forma recursiva;
- normaliza campos e suporta `BigInt`/referências circulares sem perder a gravação;
- repete falhas transitórias por até três tentativas com espera limitada;
- depois das tentativas, registra erro sanitizado e devolve 503 com orientação para confirmar o estado antes de repetir a mutação.

Risco residual: as chamadas atuais ocorrem depois de algumas mutações administrativas e não compartilham a mesma transação. O erro deixa de ser silencioso, mas a garantia atômica completa exige outbox transacional ou gravação na mesma unidade de trabalho. Esse débito permanece aberto e não autoriza criar auditoria artificial.

## Segunda execução — workflow reforçado

O run final `29774937156`, no SHA `83b280b0`, repetiu o restore em MySQL 8.4 efêmero e isolado:

- 18/18 tabelas e 4/5 checks aprovados;
- RPO observado: 49.680 s (13 h 48 min), dentro do limite de 24h;
- RTO observado: 42 s;
- criptografia server-side do backup: `AES256`, aprovada pelo novo gate;
- versionamento do bucket: `not-enabled`;
- regras de lifecycle detectadas: zero;
- falha final: somente `admin_audit_logs` vazio, sem criação de registro artificial.

Conclusão adicional: existência, integridade, criptografia e restauração do backup estão comprovadas. Proteção contra sobrescrita/exclusão e retenção automatizada continuam incompletas até habilitar versionamento e uma política de lifecycle aprovada.

## Política de retenção aplicada — 2026-07-21

Com autorização explícita do owner, o run `29828580872` aplicou e verificou a política canônica no bucket off-site. Uma falha de ordenação no workflow interrompeu esse primeiro run depois da configuração, sem reverter a política externa; o YAML foi corrigido no commit `caf48bb3`.

O run final `29828809180` executou sem reaplicar a política e comprovou o estado persistente do bucket durante um novo restore isolado:

- criptografia server-side: `AES256`;
- versionamento: `Enabled`;
- regra de lifecycle canônica detectada: 1;
- backups atuais: 90 dias;
- versões não atuais: 30 dias;
- uploads multipart incompletos: abortados após 7 dias;
- RPO observado: 22.391 s (6 h 13 min 11 s), dentro do limite de 24h;
- RTO observado: 33 s;
- restore técnico: 18/18 tabelas e 4/5 checks aprovados;
- bloqueio restante: somente `admin_audit_logs` vazio.

Classificação atualizada: **proteção off-site e restore técnico aprovados; auditabilidade ainda reprovada**. Nenhum registro artificial foi criado.
