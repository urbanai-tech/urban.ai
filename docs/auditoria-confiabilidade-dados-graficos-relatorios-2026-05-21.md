# Auditoria de confiabilidade de dados, graficos e relatorios

Data: 2026-05-21

Status: corrigido no codigo de runtime.

## Resultado

Os paineis que antes dependiam de dados sinteticos locais agora chamam contratos reais no backend ou falham fechado quando a API nao responde. Isso cobre:

- Pace.
- Portfolio calendar e acoes em lote.
- Pricing rules e preview.
- Market Intel.
- AskUrban.
- Admin alpha.

## Validacao

- Varredura de runtime sem chaves publicas de demo, geradores locais ou fallback de sucesso.
- Typecheck do frontend aprovado.
- Build TypeScript do backend aprovado.

## Observacoes

- Testes automatizados continuam usando mocks de teste, isolados em arquivos de spec/E2E.
- Dados historicos de relatorios E2E foram sanitizados para nao manter e-mails pessoais.
