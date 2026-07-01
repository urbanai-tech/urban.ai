# Resumo dos Chats Recentes

Data base: 2026-07-01.

Este documento substitui a necessidade de o novo dev ler todos os chats do Codex.

## Ajustar Filtros em Todas as Rotas

Resultado:

- Correcoes de produto/copy foram commitadas, pushadas e levadas para `main`.
- Foi evitado merge amplo com docs/evidencias/squads.
- Ficaram alteracoes locais fora do escopo, principalmente docs/evidence, squads, skills e scripts de readiness.

Referencia de commits:

- Branch: `codex/staging-railway-gates-20260526`
- `main`: `1cca3411 fix: repair copy audit regressions`

## Corrigir Calendarios do Brasil

Resultado:

- Bug de calendario BR corrigido.
- Commit e merge em `main` foram feitos nos dois remotes.
- Outras mudancas locais foram preservadas fora do commit.

## Auditar Prontidao do Sistema

Resultado:

- Staging Railway existe e responde.
- Cloudflare custom domains ainda pendentes.
- OAuth Cloudflare antigo no Codex estava expirado/revogado.
- `.env.staging` local foi criado e mantido ignorado pelo Git.

Pendencias:

- DNS `staging.myurbanai.com` e `staging-api.myurbanai.com`.
- JWT admin/host para gate autenticado.
- Restore drill.
- Stays sandbox.

## Verificar Usuarios Cadastrados

Resultado operacional de 2026-05-26:

- Usuario do Rogerio ja existia e estava ativo.
- Entrada da waitlist foi marcada como `converted`.
- Token antigo de convite estava expirado.
- Reset de senha foi disparado.

Observacao: nao expor email/token em docs.

## Auditar Docs e Planejar V2

Resultado:

- Criados documentos de produto e estrategia em `docs/product/`.
- Criado material de spinoff multi-vertical.
- Parte desses arquivos ainda estava untracked em 2026-07-01.

## Auditar Configuracoes Pendentes

Principais achados:

- Geocoding/Google Maps era gargalo historico por `REQUEST_DENIED`.
- Stays depende de API/sandbox/conta assistida.
- Stripe precisa smoke ponta a ponta.
- Owners de suporte/LGPD e CORS precisam configuracao.
- Railway production tinha deploy `SUCCESS` na epoca, mas a validacao atual focou staging.

## SEO/SGO

Resultado:

- Painel chegou a 97% tecnico.
- Faltam credenciais e dados reais para 100% factual:
  - Google Search Console.
  - GA4.
  - Logs de bots.
  - AI monitor.
  - Cases com fonte, periodo, amostra, consentimento e revisao.

## Stays

Decisao recomendada:

- Modelo preferido: cada cliente Urban AI conecta sua propria conta Stays.
- Conta unica Urban gerenciando tudo aumenta responsabilidade e suporte.

Pendencias:

- Obter conta trial/sandbox ou conta assistida.
- Confirmar endpoint de update de preco por data.
- Rodar beta dry-run com allowlists e rollback.

## Regra Sobre Chaves em Chats

Se algum segredo foi colado em chat antigo, ele nao deve ser copiado para docs nem entregue por print. Deve ser rotacionado no provedor e entregue ao dev por acesso direto ou cofre de senhas.
