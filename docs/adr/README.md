# Architecture Decision Records (ADRs)

Este diretório contém as decisões arquiteturais da Urban AI. Cada ADR documenta uma escolha significativa: o contexto, as alternativas consideradas, a decisão tomada e as consequências — positivas e negativas.

Escrevemos ADRs por duas razões:
1. **Orientação para quem chega depois** — "por que não usamos X?" tem uma resposta escrita, não precisa reargumentar do zero.
2. **Honestidade com a dívida** — o ADR registra o trade-off assumido. Quando for hora de reverter, a razão original está aqui.

## Formato

Nome: `NNNN-titulo-kebab-case.md`. Numeração sequencial.

Estrutura sugerida:
- **Status**: Proposto / Aceito / Substituído por ADR NNNN
- **Contexto**: qual decisão precisava ser tomada e por quê
- **Opções consideradas**: lista curta
- **Decisão**: qual opção ganhou e o motivo principal
- **Consequências**: o que vem junto — bom e ruim

## Índice

| # | Título | Status | Data |
|---|---|---|---|
| 0001 | [Backend NestJS monolito](./0001-backend-nestjs-monolito.md) | Aceito | 24/04/2026 (retroativo) |
| 0002 | [KNN em Node.js no backend vs microserviço Python](./0002-knn-node-no-backend.md) | Aceito | 24/04/2026 (retroativo) |
| 0003 | [Prefect Cloud como orquestrador vs Airflow](./0003-prefect-cloud.md) | Aceito | 24/04/2026 (retroativo) |
| 0004 | [MySQL gerenciado no Railway vs PostgreSQL](./0004-mysql-railway.md) | Aceito | 24/04/2026 (retroativo) |
| 0005 | [Hospedagem em Railway vs AWS/GCP direto](./0005-hospedagem-railway.md) | Aceito | 24/04/2026 (retroativo) |
| 0006 | [Estratégia de cofre de secrets (Railway Secrets)](./0006-secrets-vault-strategy.md) | Aceito | 24/04/2026 |
| 0007 | [Aposentar repo urban-ai-knn-main](./0007-aposentar-knn-microservice.md) | Aceito | 24/04/2026 |
| 0008 | [Algoritmo de pricing — KNN baseline → XGBoost moat](./0008-pricing-algoritmo-evolucao.md) | Aceito | 24/04/2026 |
| 0009 | [Modelo neural híbrido como moat de longo prazo](./0009-modelo-neural-hibrido-moat.md) | Aceito | 24/04/2026 |

> Os 5 primeiros ADRs foram escritos **retroativamente** em 24/04/2026, em resposta à F5C.4 item #3 da auditoria. Refletem o raciocínio que motivou as decisões originais tomadas por Gustavo + Lumina Lab entre fev–mar/2026.
