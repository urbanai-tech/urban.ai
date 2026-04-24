# DEPRECATED — Microserviço KNN standalone (Express)

**Status:** aposentado em 24/04/2026 (ADR 0007).
**Substituído por:** `urban-ai-backend-main/src/knn-engine/` (mesma lógica, embedada no monolito NestJS — ADR 0002).

## Por que está aqui

Mantemos o código por valor histórico e referência:

- Quando o KNN voltar a precisar de mais isolamento (e.g., escalar treino independente do backend), este diretório é o ponto de partida — não vamos refazer do zero.
- A documentação do `pricing-engine.js` mostra a lógica de multiplicadores antes da migração para TypeScript.

## Como usar este código

**Não use em produção.** Se precisar rodar localmente para entender:

```bash
cd urban-ai-knn-main
npm install
npm start  # roda em :3000
```

A versão **viva** da lógica está em:
- `urban-ai-backend-main/src/knn-engine/pricing-engine.ts`
- `urban-ai-backend-main/src/knn-engine/knn-classifier.ts`
- `urban-ai-backend-main/src/knn-engine/cost-matrix.ts`
- `urban-ai-backend-main/src/knn-engine/isochrone.ts`

Cobertura de testes: `pricing-engine.spec.ts`, `knn-classifier.spec.ts`.

## Quando remover do monorepo

A tag git `archive/knn-microservice-v1` será criada para preservar o estado em 24/04/2026. Após 6 meses sem uso, considerar `git rm -r urban-ai-knn-main/` para reduzir ruído no clone — a tag manterá o histórico recuperável.

---

*Decisão formalizada em `docs/adr/0007-aposentar-knn-microservice.md`*
