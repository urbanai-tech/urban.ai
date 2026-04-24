# ADR 0003 — Prefect Cloud como orquestrador de data pipeline

**Status:** Aceito (retroativo, escrito em 24/04/2026)

## Contexto

O pipeline de dados da Urban AI precisa rodar dois fluxos diários:
1. `trigger_all_spiders` (03:00 UTC) — dispara 8 spiders Scrapy para fontes de eventos (Eventim, Sympla, Ingresse, Ticketmaster, blue_ticket, even_three, ticket_360, variantes).
2. `raw_data_extraction_and_dump` (04:00 UTC) — lê parquets em S3 (`urbanai-data-lake`) e faz append em tabelas MySQL (uma por spider).

Precisa de:
- Scheduling com janela horária respeitada (evitar bloquear sites de venda em horário de pico).
- Retry policy por flow e por task.
- Secrets (AWS, DB credentials) injetados de forma gerenciada.
- Observabilidade — quando um flow falha por 3 dias seguidos, alguém tem que saber.

Stack disponível em 2026-03: Python 3.11 já escolhido por causa do Scrapy.

## Opções consideradas

1. **Prefect Cloud** (free tier) com `serve.py` em Railway.
2. **Airflow self-hosted** (MWAA na AWS ou ECS próprio).
3. **Cron simples no Railway** rodando scripts Python.
4. **Dagster Cloud** — alternativa moderna a Airflow, mas pouco conhecida no mercado BR.

## Decisão

**Prefect Cloud Free + serve.py em Railway**.

Razões:

1. **Custo ≈ zero** — o tier free cobre os 2 flows diários do Urban AI por uma ordem de grandeza.
2. **Menor superfície operacional** que Airflow — não precisa de scheduler, worker, webserver, metadata DB separados. O `serve.py` dispara via cron UTC e o Prefect Cloud orquestra a execução distribuída pela API.
3. **UI decente pra investigar flows que falharam** — vital quando o debugging é remoto e time pequeno.
4. **Secrets via Prefect Blocks** — AWS assume-role, MySQL DATABASE_URL, tudo fica no Cloud, não no código.
5. **Cron simples** foi descartado porque falha não é observável — um script cron falhando 3 dias em Railway só aparece se alguém for olhar logs.
6. **Airflow** foi descartado por complexidade operacional; teria consumido uma semana só para colocar o cluster em pé.
7. **Dagster** foi descartado por imaturidade da comunidade BR e pela curva de aprendizado em cima do Prefect.

## Consequências

**Positivas:**
- Pipeline em produção em 2 dias.
- Logs e retries visíveis no Cloud.
- Secrets fora do código.

**Negativas:**
- **Dependência de SaaS de terceiro** — se o Prefect Cloud free mudar regras (já aconteceu uma vez, conforme relatório QA da Lumina que precisou migrar de `worker` para `serve.py`), pode tomar horas de resposta para recalibrar.
- **Falta de alertas nativos** — Prefect Cloud manda webhook/e-mail, mas o squad ainda não tem um handler que grita no WhatsApp do Gustavo quando um flow falha. Tarefa em F9.3 (Observabilidade).
- **Flows em Python isolado do backend NestJS** — trocar metadados entre os dois precisa passar pelo MySQL como intermediário (não há API direto Prefect ↔ NestJS hoje).

## Quando revisitar

- Se o custo do plano free for atingido (novos flows F6.1 para treino KNN + scraping de Airbnb de backup).
- Se a latência de execução virar problema (hoje aceitamos que o scraping começa 03:00 UTC e pode levar até 1h para completar).

## Referências

- `docs/avaliacao-projeto-2026-04-16.md` §3.4 — avaliação do pipeline
- Código: `urban-pipeline-main/serve.py`, `urban-pipeline-main/flows/`
- Workspace Prefect: (nome em posse do Gustavo)
