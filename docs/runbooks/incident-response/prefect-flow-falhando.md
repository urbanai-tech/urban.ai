# Incidente — Flow Prefect falhando 2+ dias seguidos

**Severidade:** SEV2 → SEV1 se passar de 7 dias (KNN começa a recomendar com dados velhos).
**RTO alvo:** 24h.

## Detecção

- Painel Prefect Cloud → Flows → `raw_data_extraction_and_dump` ou `trigger_all_spiders` mostra red runs nos últimos 2+ dias.
- E-mail de alerta do Prefect (a configurar — F9.3).
- Tabela `event` ou parquets em S3 com data de última atualização > 48h.

## Triagem

1. **Anotar hora.**
2. Abrir o run mais recente que falhou no Prefect Cloud → ver stack trace.
3. Causas comuns:
   - **`AccessDenied` na S3** → IAM key rotacionada ou permissão alterada.
   - **`OperationalError: Lost connection to MySQL`** → MySQL teve hiccup (ver `db-down.md`).
   - **`ProgrammingError: Unknown column`** → schema MySQL mudou e o pipeline não foi atualizado.
   - **`HTTPError 403/429`** do Scrapyd → `auth_proxy` ou rate limit (ver `scrapyd-travado.md`).
   - **`MemoryError`** → parquet muito grande para carregar inteiro; precisa streaming.

## Mitigação

### Caso 1 — Credentials S3 inválidas

Se o IAM key foi rotacionada:

**Ação:** atualizar o Block do Prefect (`AwsCredentials` ou `AssumeRole`) com a chave nova. Re-disparar o flow.

### Caso 2 — Schema MySQL incompatível

Pipeline assume colunas que mudaram.

**Ação curta:** reverter o deploy backend que mudou o schema (`docs/runbooks/migrations-cutover.md` § Rollback rápido).
**Ação longa:** alinhar o pipeline com o novo schema; deploy do pipeline.

### Caso 3 — Plano Prefect free atingido

Sintoma: erro genérico de quota; Prefect Cloud avisa por e-mail.

**Ação:** conferir billing no painel; subir para tier Starter ou esperar reset.

### Caso 4 — Bug em código novo do pipeline

Alguém fez deploy quebrado. Ver `git log` do `urban-pipeline-main/` nos últimos 7 dias.

**Ação:** reverter commit, redeploy.

## Resolução

- Disparar `raw_data_extraction_and_dump` manualmente no Prefect.
- Esperar success.
- Confirmar que tabela `event` ou parquets em S3 receberam dados novos.

## Re-execução em massa

Se o pipeline ficou off por N dias e perdemos dados de eventos desses dias:

- Prefect Cloud → Flow → "Run from custom params" — passar `start_date` cobrindo a janela perdida.
- Cuidado: spiders de eventos velhos podem retornar 404 ou listas vazias dependendo do site.
- Aceitar que dados de janela perdida pode estar incompleto. KNN tolera buracos pequenos.

## Após estabilizar

- Se foi bug nosso: postmortem + adicionar teste no `urban-pipeline-main/tests/`.
- Se foi externo (S3, Prefect, sites alvos): registrar em log interno; avaliar redundância.

## O que NÃO fazer

- ❌ Disparar o flow em paralelo com outros — pode duplicar dados na tabela `event`.
- ❌ Trocar credentials sem revogar as antigas (deixar duas IAM keys ativas é confusão).

---

*Última atualização: 24/04/2026*
