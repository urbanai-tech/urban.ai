# Frontend de staging no Railway — 2026-07-20

## Resultado

O frontend de staging está provisionado e operacional no Railway pelo domínio nativo:

`https://urban-ai-frontend-staging-staging.up.railway.app`

Validações observadas em 2026-07-20:

- DNS público resolve para o Railway;
- requisição HTTPS retorna HTTP 200;
- título renderizado: `Urban AI | Precificacao dinamica para Airbnb e aluguel por temporada`;
- banner visual `STAGING` presente no DOM, comprovando a configuração de ambiente esperada;
- backend nativo de staging retorna HTTP 200 em `/health/live`;
- Playwright público e autenticado passaram no release gate usando as URLs de staging configuradas no GitHub.

## Arquitetura de deploy

O serviço usa o `Dockerfile` de `Urban-front-main`, com build Next.js standalone em Node 20 Alpine. Variáveis `NEXT_PUBLIC_*` são fornecidas no build e o runtime executa `node server.js`, usando `PORT` injetada pelo Railway e `HOSTNAME=0.0.0.0`.

## Domínio canônico

Em 2026-07-20, a sessão autenticada do Railway confirmou:

- projeto `Front`, ambiente `staging`;
- serviço `urban-ai-frontend-staging`, online, uma réplica em US West;
- `staging.myurbanai.com` já associado ao serviço na porta 8080;
- CNAME e TXT de verificação fornecidos pelo Railway e criados de forma idempotente no Cloudflare;
- CNAME publicado em DNS-only e observado no nameserver autoritativo e em `1.1.1.1`;
- TXT observado no nameserver autoritativo, ainda sujeito ao cache negativo dos resolvedores públicos consultados logo após a criação.

O Railway ainda mostrava `Waiting for DNS update`; portanto, certificado e HTTPS estrito permanecem pendentes. O heartbeat continuará as checagens sem recriar registros nem habilitar proxy antes da validação.

## Segurança

Nenhuma variável secreta foi copiada para esta evidência. Valores de NextAuth, OAuth, Sentry e Stripe devem permanecer no secret store do Railway/GitHub e nunca no repositório.

O valor do TXT de verificação não é reproduzido nesta evidência.

## Revalidação read-only — 2026-07-20 17h (BRT)

O Railway continua exibindo `Waiting for DNS update` para `staging.myurbanai.com`. O CNAME permanece público; HTTPS estrito ainda falha e a chamada com verificação TLS desativada retorna 404 no hostname customizado. O serviço nativo continua sendo a referência aprovada enquanto o certificado não for emitido. Nenhum registro foi recriado e o domínio permaneceu DNS-only.

## Revalidação read-only — 2026-07-21 09h18 (BRT)

O origin nativo continua respondendo HTTP 200, com o título esperado e banner `STAGING`, e o CNAME público permanece apontando para o destino anteriormente fornecido pelo Railway. Entretanto, o serviço `urban-ai-frontend-staging` no projeto/ambiente canônicos agora aparece sem domínio público associado e com a região `us-west2` marcada como inválida, bloqueando deployments. O TLS estrito de `staging.myurbanai.com` continua falhando. Essa divergência invalida a afirmação anterior de associação ativa até nova confirmação; nenhum domínio ou DNS foi recriado.

## Revalidação read-only — 2026-07-21 10h19 (BRT)

O serviço voltou a aparecer `Online`, associado a `staging.myurbanai.com` na porta 8080 e com uma réplica em US West. O Railway ainda mostra `Waiting for DNS update` e o TLS estrito permanece inválido; portanto, a associação recuperada ainda não fecha o gate. O origin segue em HTTP 200 com banner `STAGING`. Nenhum domínio ou DNS foi recriado.
