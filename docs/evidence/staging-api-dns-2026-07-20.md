# Evidência — DNS de `staging-api`

**Data:** 2026-07-20
**Owner:** Engenharia + Operação
**Status:** parcial — DNS propagado; associação e certificado Railway pendentes
**Escopo:** `staging-api.myurbanai.com`; nenhum registro de produção, `staging` ou `status` foi alterado.

## Alterações aplicadas

| Registro | Configuração | Resultado |
|---|---|---|
| CNAME `staging-api` | destino exigido pelo Railway; proxy temporariamente desativado durante a verificação | criado e propagado |
| TXT `_railway-verify.staging-api` | valor obtido diretamente do status do domínio Railway | criado, público e idêntico ao requisito; valor omitido desta evidência |

## Validação

| Controle | Resultado observado |
|---|---|
| Token Cloudflare | ativo, com leitura/escrita DNS confirmadas |
| Zona | `myurbanai.com` ativa |
| Cloudflare API | um CNAME e um TXT exatos, sem duplicatas ou conflitos |
| DNS público | CNAME e TXT visíveis em resolvedor público |
| Railway DNS | `DNS_RECORD_STATUS_PROPAGATED` |
| Railway verification | pendente |
| Railway certificate | `CERTIFICATE_STATUS_TYPE_ISSUING` |
| Backend pelo domínio Railway | `GET /health/live` → HTTP 200 |
| Backend pelo hostname customizado | ainda indisponível/sem associação completa; não aprovado |

## Segurança e rollback

- Nenhum token, segredo R2 ou valor TXT foi registrado no repositório.
- Os registros foram criados de forma idempotente e restritos ao hostname `staging-api`.
- Para rollback, remover apenas o CNAME `staging-api` e o TXT `_railway-verify.staging-api`; não alterar os registros de produção.
- As credenciais Cloudflare/R2 compartilhadas fora do secret store devem ser rotacionadas após a conclusão.

## Gate restante

1. aguardar o Railway marcar o domínio como verificado e emitir o certificado;
2. validar TLS público e `GET /health/live` = 200 no hostname customizado;
3. reativar o proxy Cloudflare somente depois da associação e repetir o smoke;
4. manter `staging.myurbanai.com` bloqueado até existir um frontend de staging como destino;
5. manter `status.myurbanai.com` bloqueado até a escolha/provisão da status page.
