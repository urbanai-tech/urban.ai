# ADR 0007 — Aposentar o repositório `urban-ai-knn-main/`

**Status:** Aceito (24/04/2026)
**Substitui:** parcialmente o ADR 0002 (que documenta a coexistência temporária; este formaliza o desligamento).

## Contexto

O repositório `urban-ai-knn-main/` é um microserviço Express standalone com 2 endpoints (`POST /api/pricing/suggest`, `GET /api/status`), autenticado por `x-api-key`. Em algum momento (pré-Lumina-handoff) era a forma como o backend NestJS pedia recomendação de preço, via HTTP.

Na transição da Lumina para Urban AI (mar/2026), a lógica foi **embedada no backend** (`urban-ai-backend-main/src/knn-engine/`) — ver ADR 0002. O microserviço continua no monorepo mas **não é invocado em produção desde D14**.

A auditoria de 16/04 explicitou: ou aposenta, ou volta a usar. Estamos aceitando como aposentado.

## Opções

1. **Manter o repo no monorepo, apenas marcar como `deprecated`** (caminho escolhido).
2. **Remover o diretório** completamente.
3. **Reativar como microserviço** quando o KNN escalar (seria reabrir ADR 0002).

## Decisão

**Opção 1**: marcar como `deprecated` via `urban-ai-knn-main/DEPRECATED.md` + nota no README do diretório, **sem remover o código**, **arquivar como tag git `archive/knn-microservice-v1`** quando o backup formal acontecer.

Razões:

1. **Remover agora destrói a referência histórica** que a equipe pode precisar quando avaliar reativar (ADR 0002 prevê isso para 2026+).
2. **Tag arquivística** é a prática padrão do git para "código morto mas guardado": `git tag archive/knn-microservice-v1 <commit>` + push da tag.
3. **Custo de manter o diretório no working tree:** zero — não roda em CI, não é importado por nada (já validamos via grep).
4. **Custo de remover já:** real — perde-se contexto, e se voltar a fazer sentido em 6 meses, refaz do zero.

## Consequências

**Positivas:**
- A intenção fica clara para qualquer dev que abra o diretório (`DEPRECATED.md` como primeiro arquivo lido).
- Histórico preservado.

**Negativas:**
- O diretório continua aparecendo em buscas (`grep`, IDE) — mitigado adicionando ao `.gitignore` da IDE quando preciso.
- Tamanho do clone do monorepo: irrelevante (~150KB).

## Implementação

1. ✅ `urban-ai-knn-main/DEPRECATED.md` criado.
2. ✅ README.md original do diretório anota o status.
3. ⬜ **Você executa**: `git tag archive/knn-microservice-v1 HEAD && git push origin archive/knn-microservice-v1` quando estiver confortável.
4. ⬜ Em 6 meses: revisão. Se ninguém abriu o diretório por necessidade real, considerar `git rm -r urban-ai-knn-main/` + manter só a tag.

## Referências

- ADR 0002 — KNN no backend
- `docs/avaliacao-projeto-2026-04-16.md` §3.3
- `docs/ADENDO_TECNICO_KNN.md` (Lumina, mar/2026)
