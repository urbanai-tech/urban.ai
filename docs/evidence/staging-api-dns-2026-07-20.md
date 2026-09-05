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

## Revalidação read-only — 2026-07-20 17h (BRT)

O Railway continua exibindo `Waiting for DNS update` para `staging-api.myurbanai.com`, embora o serviço e o CNAME estejam online/públicos. HTTPS estrito ainda falha e a chamada com verificação TLS desativada retorna 404 no hostname customizado. Nenhum CNAME/TXT foi recriado e o proxy permaneceu inalterado.

## Revalidação read-only — 2026-07-21 09h18 (BRT)

O CNAME público continua apontando para o destino Railway já provisionado e o serviço aparece `Online`. O origin Railway responde `GET /health/live` com HTTP 200, porém o painel ainda mostra `Waiting for DNS update` para o hostname customizado e o TLS estrito falha por incompatibilidade do certificado. Nenhum registro foi recriado, o proxy não foi habilitado e o gate permanece aberto.

## Revalidação read-only — 2026-07-21 10h19 (BRT)

O origin Railway permanece saudável com `GET /health/live` em HTTP 200 e o CNAME continua público. Entretanto, o serviço canônico do backend agora aparece sem domínio público associado e com a região `us-west2` marcada como inválida, bloqueando deployments. O TLS estrito do hostname customizado continua falhando. Nenhum domínio ou DNS foi recriado e o proxy permaneceu inalterado.

## Revalidação read-only — 2026-07-22 20h10 (BRT)

`https://staging-api.myurbanai.com/health/live` continua sem handshake TLS válido; a consulta diagnóstica sem validação do certificado retorna HTTP 404. O CNAME e um único TXT de verificação continuam publicados, mas o próprio destino público atualmente referenciado pelo CNAME também retorna 404 em `/health/live`, indicando associação Railway ausente ou obsoleta — diagnóstico que precisa ser confirmado no provedor antes de qualquer troca. A sessão do Railway expirou tanto na CLI quanto no conector, impedindo confirmar o estado interno do domínio e do certificado nesta rodada. Nenhum CNAME/TXT foi recriado, o proxy não foi alterado e produção permaneceu fora do escopo.
