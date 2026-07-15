# Auditoria de mocks e hardcodeds nos paineis admin e usuario

> SUPERSEDED: snapshot historico. Consulte `../../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md`.

Data: 2026-05-21

Status: corrigido no codigo de runtime.

Atualizacao 2026-05-22: a auditoria consolidada atual esta em
`docs/archive/audits/auditoria-consolidada-dados-graficos-relatorios-2026-05-22.md`. Esta auditoria
continua valida para runtime; mocks de testes e artefatos legados/deprecated devem ser
tratados separadamente para nao gerar falsos positivos.

## Escopo

- Frontend Next.js em `Urban-front-main/src/app/admin`.
- Paineis de usuario em `painel`, `dashboard`, `portfolio`, `properties`, `near-events`, `my-roi`, `my-plan`, `settings`, `notificacao`, `event-log` e rotas legadas de price.
- Servicos compartilhados em `Urban-front-main/src/app/service`.
- Backend NestJS em `urban-ai-backend-main/src`.

## Correcoes aplicadas

- Removidos geradores e chaves publicas de dados demonstrativos em `Urban-front-main/src/app/service/api.ts`.
- Removidos fallbacks locais que mascaravam erro de API em pace, portfolio, pricing rules, market intel e AskUrban.
- Adicionados endpoints reais no backend para portfolio, pace, pricing rules, market intel e AskUrban.
- Removido e-mail pessoal hardcoded do fluxo admin alpha; a tela agora exige input/configuracao explicita.
- Removidos defaults de Stripe Price IDs e URLs de scrapers no codigo; essas integracoes agora dependem de env.
- Removido arquivo legado de dataset sintetico em propriedades.
- Removido exemplo executavel legado de `knn-engine/pricing-engine.js`.
- DB e Redis deixam de cair silenciosamente para host local fora de dev/test/local.
- Exemplos e comentarios de docs/rotas legadas foram limpos para reduzir falso positivo em futuras varreduras.

## Validacao executada

- Varredura por flags/geradores/fallbacks locais no frontend e backend de runtime.
- Varredura por hardcoded pessoal, exemplos externos e artefatos legados.
- Typecheck do frontend com `tsc --noEmit --incremental false`.
- Build TypeScript do backend com `tsc -p tsconfig.build.json`.

## Observacoes

- Testes (`*.spec.ts`) e E2E ainda contem mocks de teste, como esperado.
- O middleware do frontend ainda reconhece `localhost` e `127.0.0.1` para comportamento de dev local; isso nao afeta producao.
- `tsconfig.tsbuildinfo` foi atualizado pelo typecheck do front.
