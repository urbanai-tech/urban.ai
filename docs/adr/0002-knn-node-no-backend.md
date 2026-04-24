# ADR 0002 — Motor KNN em Node.js dentro do backend NestJS

**Status:** Aceito (retroativo, escrito em 24/04/2026)

## Contexto

O core do produto Urban AI é **recomendar preço** por imóvel-dia em função de:
- Perfil do imóvel (categoria via KNN sobre features geoespaciais e amenities)
- Proximidade a eventos (travel time via isochrone)
- Relevância do evento (score 0–100 atribuído por IA)

Em março/2026 havia duas implementações coexistindo:
- `urban-ai-knn-main/` — microserviço Express standalone com `ml-knn`, consumido pelo backend via HTTP com `x-api-key`.
- `urban-ai-backend-main/src/knn-engine/` — mesmo código TypeScript embedado no NestJS, rodando em-processo.

A Lumina Lab já tinha começado a migração para o segundo caminho no relatório de QA pré-entrega.

## Opções consideradas

1. **Manter microserviço Node.js separado** (`urban-ai-knn-main/`).
2. **Motor embedado no backend NestJS** (caminho escolhido).
3. **Reescrever em Python** — para aproveitar scikit-learn, integração direta com o pipeline Prefect e bibliotecas maduras de feature engineering.

## Decisão

**Motor embedado no backend NestJS** (`src/knn-engine/`). O microserviço standalone (`urban-ai-knn-main/`) fica como referência arquivada; decisão formal de aposentar em F5C.3.

Razões:

1. **Custo operacional zero vs. HTTP call por recomendação** — cada `/analise-preco` invocava o microserviço KNN via rede interna. Embedando, vira chamada de método, −50ms p50, −zero chance de timeout/retry.
2. **`ml-knn` é suficiente para o volume atual (3 imóveis mock, alvo ≥200)** — não há nada que scikit-learn ofereça hoje que o time consiga usar melhor que `ml-knn`. A lógica de multiplicadores (categoria + atratividade + travel time + relevância) é matemática simples, não ML pesado.
3. **Evita 1 deploy a mais** — o microserviço tinha Dockerfile próprio, env vars próprias, seu próprio endpoint, sua própria observabilidade. Tirar isso acelera iteração.
4. **Testabilidade** — no monólito, `UrbanAIPricingEngine` é injetado via DI (F5C.2 item #15). Em testes, mockar o classifier e o costMatrix fica trivial (ver `pricing-engine.spec.ts`). Em microserviço, precisaríamos de HTTP mocking ou de test-doubles ao nível de API.

Python foi descartado pela mesma razão do ADR 0001: afinidade de stack + ausência de ganho real no momento. O pipeline Prefect (também em Python) lê dados de S3 e grava no MySQL — o engine KNN não precisa estar no mesmo runtime.

## Consequências

**Positivas:**
- Latência do endpoint `/propriedades/analise-preco` caiu significativamente (medição exata pendente — runbook de load test em F5C.4 #7).
- Um deploy a menos.
- Debugging end-to-end via Sentry/logs do mesmo processo.

**Negativas:**
- **Tree-shake e startup** — o backend NestJS agora carrega `ml-knn` + `@turf/turf` + `kdbush` no boot. ts-jest não transforma `kdbush` (ESM) por default, então suites de teste que importam o engine precisam de `jest.mock('@turf/turf', ...)` (ver `pricing-engine.spec.ts`).
- **Escalabilidade acoplada** — se o engine precisar de mais CPU para retreinar semanalmente (F6.1), escalar o backend inteiro é o caminho, mesmo que só o cron de treino esteja sob pressão.
- **Lock-in de stack** — migrar para Python mais tarde exige reescrita, não port. Aceitável enquanto a fatia ML é pequena.

## Quando revisitar

- Quando o dataset ultrapassar 5k imóveis com histórico de 12 meses → avaliar migrar o treino para um batch job Python dentro do pipeline Prefect (persistir modelo, backend carrega o modelo serializado e só faz inferência).
- Quando o tempo de retraining semanal começar a impactar o SLO de disponibilidade do backend.

## Referências

- `docs/avaliacao-projeto-2026-04-16.md` §3.3 — avaliação do motor KNN
- `docs/ADENDO_TECNICO_KNN.md` — nota técnica detalhada da Lumina sobre a consolidação
- Código: `urban-ai-backend-main/src/knn-engine/`
- Suite de testes: `pricing-engine.spec.ts`, `knn-classifier.spec.ts`
