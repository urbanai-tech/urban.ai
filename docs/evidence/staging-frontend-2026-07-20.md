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

## Pendência do domínio canônico

O serviço Railway está provisionado; a pendência é somente associar `staging.myurbanai.com` como domínio customizado do serviço e então criar/validar o DNS correspondente. Essa associação exige sessão autenticada no Railway. Não se deve apontar o CNAME customizado antes de o Railway fornecer/aceitar o destino, para evitar falha de Host/TLS.

## Segurança

Nenhuma variável secreta foi copiada para esta evidência. Valores de NextAuth, OAuth, Sentry e Stripe devem permanecer no secret store do Railway/GitHub e nunca no repositório.
