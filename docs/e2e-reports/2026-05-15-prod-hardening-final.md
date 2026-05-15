# Fechamento de hardening produto - 2026-05-15

Ambiente de referencia: producao alfa em `https://app.myurbanai.com` + API `https://urbanai-production-85fd.up.railway.app`.

## Status objetivo

O produto esta em condicao de alfa assistido para usuarios existentes, com billing/quotas, recomendacao de preco, painel admin e fluxos principais cobertos por smoke tests. Ainda nao esta em condicao de abertura ampla sem acompanhamento, porque Stays depende da URL oficial da API e o ciclo de aprendizado precisa de resultados reais de reserva para validar uplift.

## Acoes executadas

- Sanitizacao das respostas mutantes de recomendacao de preco: aceitar, rejeitar, aplicar preco e registrar resultado agora retornam DTO publico, sem entidade `User`, hash de senha ou objetos relacionais completos.
- Sanitizacao dos endpoints de propriedades do anfitriao: `/propriedades/user/` e `/propriedades/:id` agora retornam DTO publico e nao vazam `address.user` ou `list.user`.
- Stripe Price IDs: matriz F6.5 validada em producao com `total=8`, `ok=8`, `missing=0`, `problems=0`.
- Stays: `STAYS_TOKEN_ENCRYPTION_KEY` configurada em producao; readiness ficou `tokenEncryptionConfigured=true`, `betaPrivate=true`, `apiBaseConfigured=false`.
- Localidades do usuario alfa Gustavo: 9 imoveis corrigidos de `A definir` para bairros/cidades/UFs conservadores a partir dos dados internos ja armazenados.
- Release gate CI: workflow ganhou job `product-audit`, condicionado a `E2E_BASE_URL`, `E2E_API_URL`, `E2E_EMAIL` e `E2E_PASSWORD`.
- Tela Meu Plano: passou a mostrar ciclo, quota contratada/ativa/disponivel e estado de cortesia alpha.
- Admin jobs: smoke Playwright adicionado para readiness e acionamento mockado de geocoder.

## Validacoes locais

- Backend: `jest src/sugestao/sugestion.service.spec.ts src/propriedades/propriedade.service.spec.ts src/stays/stays.service.spec.ts --runInBand` passou com 21 testes.
- Backend: `nest build` passou.
- Frontend: `next build` passou.
- Playwright recorte publico/admin jobs contra producao atual: 15/15 passou.

## Validacoes de producao ja feitas

- `/admin/stripe/sync-check`: 200, 8/8 Price IDs OK.
- `/admin/stays/health`: 200, beta privado ativo, faltando apenas `STAYS_API_BASE_URL`.
- `/propriedades/dropdown/list`: 9 imoveis do Gustavo com diaria base manual R$150 e receita media mensal R$4.500.
- `/propriedades/user/`: antes do patch retornava hash de senha aninhado; corrigido no codigo e coberto por teste unitario. Revalidar em producao apos deploy.

## Gaps restantes

- Configurar `STAYS_API_BASE_URL` com a URL oficial/sandbox correta da Stays antes de qualquer connect real.
- Configurar no GitHub Actions as variaveis/secrets do gate: `E2E_BASE_URL`, `E2E_API_URL`, `E2E_EMAIL`, `E2E_PASSWORD`.
- Rodar 3 a 5 ciclos reais com Gustavo registrando: sugestao gerada, preco aplicado, diaria praticada, reserva/sem reserva, receita real e observacao.
- Revalidar apos deploy que `/propriedades/user/` e endpoints de sugestao nao retornam `password`, `usuarioProprietario` ou entidades `user`.

