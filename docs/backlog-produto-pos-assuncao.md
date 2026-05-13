# Backlog de Produto Pos-Assuncao

Data: 2026-05-13

Este backlog deve ser executado depois da estabilizacao operacional e dos P0/P1 de seguranca. A ideia e separar evolucao de produto de correcoes necessarias para operar.

## Prioridade A - Confianca do Usuario

- Melhorar estados vazios do dashboard e onboarding.
- Mostrar claramente plano, quota e status de assinatura.
- Criar tela de erro/403 amigavel para acesso negado.
- Revisar textos de reset, confirmacao de e-mail e login.
- Reduzir duplicidade de fluxos de auth: login direto vs NextAuth.

## Prioridade B - Pricing

- Expor explicacao da recomendacao de preco com linguagem simples.
- Criar historico de sugestoes aceitas/aplicadas.
- Medir resultado real por propriedade: preco sugerido, preco aplicado, ocupacao e receita.
- Separar modos `notifications`, `user_accepted` e `auto` com guardrails visiveis.

## Prioridade C - Stays

- Melhorar tela de integracoes com status da conta, ultima sync e ultimo erro.
- Mostrar preview antes de push de preco.
- Permitir rollback com confirmacao forte.
- Criar rotina operacional para regravar/recriptografar tokens Stays legados em plaintext apos configurar `STAYS_TOKEN_ENCRYPTION_KEY`.

## Prioridade D - Operacao Admin

- Criar painel admin para jobs e batchs, evitando endpoints manuais via Swagger.
- Mostrar fila, duracao, erro e custo estimado por job.
- Adicionar trilha de auditoria para acoes admin.

## Prioridade E - Dados e Pipeline

- Padronizar pipeline de eventos com staging/production.
- Criar fixtures E2E com MySQL service container.
- Mapear fontes de eventos, termos de uso, frequencia e fallback.

## Prioridade G - Operacao e Secrets

- Montar inventario externo de secrets por ambiente usando `docs/runbooks/matriz-env-operacional.md`.
- Definir owner, data de rotacao e plano de emergencia para cada secret critico.
- Separar DSNs/chaves Sentry por staging e producao.

## Prioridade F - Qualidade Frontend

- Consolidar `api.ts` por dominios menores.
- Remover contratos legados sem controller correspondente.
- Padronizar guards client-side baseados em `/auth/me`.
- Adicionar smoke tests Playwright para login, cadastro, reset, checkout e dashboard.
