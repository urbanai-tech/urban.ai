# Status page operacional — 2026-07-20

## Resultado

A Urban AI passou a ter uma status page pública, independente do monorepo e sem custo mensal de licença, baseada em Upptime e GitHub Pages:

- repositório: `Gustavogm9/urbanai-status`;
- domínio: `status.myurbanai.com`;
- publicação: branch `gh-pages` do GitHub Pages;
- monitoramento público: site institucional, aplicação web e liveness da API;
- incidentes: issues do repositório, atualmente sem incidentes abertos.

O DNS público já resolve `status.myurbanai.com` por CNAME para `gustavogm9.github.io`. A página foi construída e responde pelo origin do GitHub Pages. Em 2026-07-20, o certificado do domínio customizado ainda estava em emissão; portanto, HTTPS estrito e `https_enforced` permaneciam pendentes. O heartbeat operacional acompanha esse estado e habilitará HTTPS obrigatório assim que o certificado existir.

## Evidência reproduzível

| Controle | Evidência observada |
|---|---|
| Configuração sem credencial pessoal | commit `e210317`; atualização automática do template foi removida para não exigir `GH_PAT` pessoal |
| Setup | run `29744221234`, concluído com sucesso |
| Geração de gráficos | run `29744247455`, concluído com sucesso |
| Primeira rodada de probes | run `29744740197`, concluído com sucesso |
| Publicação | GitHub Pages em estado `built`, branch `gh-pages`, CNAME customizado configurado |
| DNS | CNAME público observado em `1.1.1.1`, `8.8.8.8` e DNS-over-HTTPS |
| Incidentes | nenhuma issue aberta no momento da coleta |

Primeira rodada observada:

| Componente | URL | Resultado | Latência observada |
|---|---|---:|---:|
| Site institucional | `https://myurbanai.com` | HTTP 200 | 257 ms |
| Aplicação web | `https://app.myurbanai.com` | HTTP 200 | 238 ms |
| API | `https://urbanai-production-85fd.up.railway.app/health/live` | HTTP 200 | 181 ms |

## Arquitetura e limites

O Upptime executa probes por GitHub Actions, persiste histórico versionado e publica a interface pelo GitHub Pages. Essa escolha reduz custo e evita acoplar a página de status à mesma infraestrutura Railway que ela observa.

O monitor público usa apenas liveness não autenticado. Readiness autenticado, MySQL e Redis continuam validados por gate separado, pois a credencial de readiness não deve ser exposta em uma página pública nem em repositório aberto.

Risco residual em 2026-07-20: emissão do certificado do domínio customizado pelo GitHub Pages. O DNS não deve ser recriado nem receber proxy enquanto essa emissão estiver pendente.

## Segurança e manutenção

- nenhum token Cloudflare, Railway, GitHub pessoal ou segredo de aplicação foi salvo no repositório;
- upgrades do template são deliberadamente manuais e pinados;
- o domínio de status permanece DNS-only durante a emissão do certificado;
- após o TLS estrito responder 200, o monitor deve registrar a conclusão e manter `https_enforced=true`.

## Revalidação read-only — 2026-07-20 17h (BRT)

O GitHub Pages permanece em `built`, com `https_enforced=false`. O CNAME continua público; HTTPS estrito ainda falha, enquanto a resposta com verificação TLS desativada permanece HTTP 200. O certificado ainda não está disponível, portanto o enforcement não foi antecipado e o DNS não foi alterado.

## Revalidação read-only — 2026-07-21 09h18 (BRT)

O GitHub Pages continua `built`, o CNAME público resolve e HTTP sem TLS responde 200. A API ainda informa `https_enforced=false`, sem certificado customizado disponível, e HTTPS estrito falha por incompatibilidade do certificado. O enforcement não foi habilitado e o DNS permaneceu inalterado.

## Revalidação read-only — 2026-07-21 10h19 (BRT)

Estado inalterado: Pages `built`, CNAME público, HTTP 200, `https_enforced=false` e nenhum certificado customizado disponível. HTTPS estrito continua falhando; nenhuma configuração foi alterada.
