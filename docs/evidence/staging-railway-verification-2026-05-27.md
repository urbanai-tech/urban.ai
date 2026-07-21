# Evidência histórica — verificação Railway de staging

**Data original:** 2026-05-27

**Estado:** substituído pelas evidências operacionais de 2026-07-20/21

**Escopo:** inventário histórico dos domínios de staging, sem valores sensíveis de DNS.

## Resultado histórico

Na coleta original, os serviços Railway de backend e frontend de staging existiam e os hostnames customizados ainda dependiam de configuração/verificação DNS no Cloudflare. Os destinos CNAME e os TXT foram obtidos diretamente do Railway, mas seus valores não são reproduzidos nesta versão saneada.

A credencial Cloudflare disponível naquela sessão estava expirada, então nenhuma alteração DNS foi executada durante a coleta de maio.

## Estado superveniente

As evidências atuais substituem este registro para decisões operacionais:

- [`staging-api-dns-2026-07-20.md`](staging-api-dns-2026-07-20.md)
- [`staging-frontend-2026-07-20.md`](staging-frontend-2026-07-20.md)
- [`status-page-2026-07-20.md`](status-page-2026-07-20.md)

Em 2026-07-21, os origins Railway respondiam 200, mas os hostnames customizados ainda falhavam em TLS estrito. O serviço canônico do frontend também aparecia sem domínio público e com região inválida, impedindo tratar a associação histórica como evidência atual.

## Segurança

Valores TXT, tokens e credenciais não devem ser registrados em documentação ou logs. A versão anterior deste arquivo foi substituída para remover um valor de verificação legado.
