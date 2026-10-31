# Architecture Decision Records (ADRs)

Este diretório contém as decisões arquiteturais da Urban AI. Cada ADR documenta uma escolha significativa: o contexto, as alternativas consideradas, a decisão tomada e as consequências — positivas e negativas.

Escrevemos ADRs por duas razões:
1. **Orientação para quem chega depois** — "por que não usamos X?" tem uma resposta escrita, não precisa reargumentar do zero.
2. **Honestidade com a dívida** — o ADR registra o trade-off assumido. Quando for hora de reverter, a razão original está aqui.

## Formato

Nome: `NNNN-titulo-kebab-case.md`. Numeração sequencial.

Estrutura sugerida:
- **Status**: Proposto (decisão em aberto, com recomendação e quem decide) / Aceito / Substituído por ADR NNNN
- **Contexto**: qual decisão precisava ser tomada e por quê
- **Opções consideradas**: lista curta
- **Decisão**: qual opção ganhou e o motivo principal
- **Consequências**: o que vem junto — bom e ruim

## Índice

| # | Título | Status | Data |
|---|---|---|---|
| 0001 | [Backend NestJS monolito](./0001-backend-nestjs-monolito.md) | Aceito (adendo 2026-10-23) | 24/04/2026 (retroativo) |
| 0002 | [KNN em Node.js no backend vs microserviço Python](./0002-knn-node-no-backend.md) | Aceito | 24/04/2026 (retroativo) |
| 0003 | [Prefect Cloud como orquestrador vs Airflow](./0003-prefect-cloud.md) | Aceito (adendo 2026-10-23: bronze S3 inativo) | 24/04/2026 (retroativo) |
| 0004 | [MySQL gerenciado no Railway vs PostgreSQL](./0004-mysql-railway.md) | Aceito | 24/04/2026 (retroativo) |
| 0005 | [Hospedagem em Railway vs AWS/GCP direto](./0005-hospedagem-railway.md) | Aceito (adendo 2026-10-23: Cloudflare, Vercel) | 24/04/2026 (retroativo) |
| 0006 | [Estratégia de cofre de secrets (Railway Secrets)](./0006-secrets-vault-strategy.md) | Aceito | 24/04/2026 |
| 0007 | [Aposentar repo urban-ai-knn-main](./0007-aposentar-knn-microservice.md) | Aceito | 24/04/2026 |
| 0008 | [Algoritmo de pricing — KNN baseline → XGBoost moat](./0008-pricing-algoritmo-evolucao.md) | Aceito | 24/04/2026 |
| 0009 | [Modelo neural híbrido como moat de longo prazo](./0009-modelo-neural-hibrido-moat.md) | Aceito | 24/04/2026 |
| 0010 | [Plano B do scraping: dados informados pelo anfitrião](./0010-plano-b-do-scraping.md) | Aceito | 26/10/2026 |
| 0011 | [Repositório público canônico com escopo por allowlist](./0011-repositorio-publico-canonico.md) | Aceito | 26/10/2026 |
| 0012 | [Sessão em cookie httpOnly + refresh rotativo com detecção de reuso](./0012-sessao-cookie-httponly-refresh-rotativo.md) | Aceito | 26/10/2026 |
| 0013 | [Calendário de São Paulo para todo "dia"](./0013-calendario-sao-paulo-para-todo-dia.md) | Aceito | 26/10/2026 |
| 0014 | [Guarda de assinatura (402) e registro de políticas](./0014-guarda-de-assinatura-e-registro-de-politicas.md) | Aceito | 26/10/2026 |
| 0015 | [Motor de preço v2 em modo sombra](./0015-motor-de-preco-v2-em-sombra.md) | Aceito | 26/10/2026 |
| 0016 | [Conector Stays: slug, escrita desligada, rollback](./0016-conector-stays-slug-escrita-desligada-rollback.md) | Aceito | 26/10/2026 |
| 0017 | [Locks distribuídos para jobs e timeouts HTTP](./0017-locks-distribuidos-para-jobs-agendados.md) | Aceito | 26/10/2026 |
| 0018 | [Entrega confiável dos coletores: outbox SQLite](./0018-entrega-confiavel-dos-coletores-outbox-sqlite.md) | Aceito | 26/10/2026 |
| 0019 | [Quando ligar o motor de preço v2](./0019-quando-ligar-o-motor-v2.md) | Proposto (em aberto) | 26/10/2026 |
| 0020 | [Ask Urban: LLM ou reposicionar a cópia](./0020-ask-urban-llm-ou-reposicionar.md) | Proposto (em aberto) | 26/10/2026 |
| 0021 | [Login com Google: concluir ou remover](./0021-login-com-google.md) | Proposto (em aberto) | 26/10/2026 |
| 0022 | [Vercel e fluxo bronze S3 do Prefect](./0022-vercel-e-fluxo-bronze-do-prefect.md) | Proposto (em aberto) | 26/10/2026 |
| 0023 | [Stays automático abaixo de 1,0×](./0023-stays-automatico-abaixo-de-1x.md) | Proposto (em aberto) | 26/10/2026 |
| 0024 | [Retenção de dados pessoais](./0024-retencao-de-dados-pessoais.md) | Proposto (em aberto) | 26/10/2026 |
| 0025 | [Senha em claro sob TLS, hash só no servidor](./0025-senha-em-claro-sob-tls-hash-no-servidor.md) | Aceito | 28/10/2026 |
| 0027 | [Relatório mensal para o proprietário: base legal, link seguro, envio e retenção](./0027-relatorio-mensal-proprietario.md) | Aceito (arquitetura); texto jurídico em aberto | 31/10/2026 |

> Os 5 primeiros ADRs foram escritos **retroativamente** em 24/04/2026, em resposta à F5C.4 item #3 da auditoria. Refletem o raciocínio que motivou as decisões originais tomadas por Gustavo + Lumina Lab entre fev–mar/2026.

> Os ADRs 0011–0018 registram, em 26/10/2026, decisões que o código já implementava; 0019–0024 são decisões **em aberto**. Mapa de arquitetura e fluxos: [`../ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md) §10–11.
