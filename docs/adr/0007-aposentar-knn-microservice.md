# ADR 0007 — Aposentar o repositório `urban-ai-knn-main/`

**Status:** Aceito (24/04/2026)
**Substitui:** parcialmente o ADR 0002 (que documenta a coexistência temporária; este formaliza o desligamento).

## Contexto

O repositório `urban-ai-knn-main/` é um microserviço Express standalone com 2 endpoints (`POST /api/pricing/suggest`, `GET /api/status`), autenticado por `x-api-key`. Em algum momento (pré-Lumina-handoff) era a forma como o backend NestJS pedia recomendação de preço, via HTTP.

Na transição da Lumina para Urban AI (mar/2026), a lógica foi **embedada no backend** (`urban-ai-backend-main/src/knn-engine/`) — ver ADR 0002. O microserviço continua no monorepo. A ausência de consumidor no código não prova, sozinha, ausência de tráfego ou de um serviço ainda provisionado no Railway.

### Evidência estática revalidada em 15/07/2026

- `npm run audit:knn-legacy:head` analisou todas as superfícies executáveis/configuráveis versionadas no `HEAD` e encontrou **zero consumidor** do diretório standalone, de `POST /api/pricing/suggest`, de URL de serviço KNN ou de variáveis `KNN_*_URL`.
- O backend usa apenas a implementação interna `urban-ai-backend-main/src/knn-engine/`; referências a `knn-engine` não são dependências do microserviço legado.
- O standalone ainda contém `Dockerfile`, `server.js`, `npm start` e os endpoints antigos. Portanto ele permanece tecnicamente implantável.
- A CI executa testes, audit e syntax smoke dentro de `urban-ai-knn-main`; isso é manutenção defensiva do artefato legado, não consumo em runtime.
- Não existe manifesto Railway versionado que permita provar se há serviço, domínio, cron ou variáveis associados ao standalone. Essa parte continua externa ao Git.

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
3. **Custo de manter o diretório no working tree:** baixo — não é importado por consumidores estáticos e roda na CI somente para audit/test/syntax smoke.
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
3. ✅ Gate `scripts/knn-legacy-dependency-gate.js` bloqueia novos consumidores em código/configuração; self-test 9/9 e CI integrados.
4. ⬜ **Owner executa após a prova de tráfego**: criar a tag arquivística e remover/desprovisionar o serviço de forma coordenada.
5. ⬜ Em 6 meses: revisão. Se telemetria e Railway confirmarem ausência de uso, considerar `git rm -r urban-ai-knn-main/` + manter só a tag.

## Evidência externa obrigatória antes de remover

No Railway, com acesso de owner, ainda é necessário:

1. listar projetos, ambientes e serviços e localizar qualquer deploy cuja raiz, start command, imagem ou repositório aponte para `urban-ai-knn-main`, `server.js` ou o endpoint `/api/pricing/suggest`;
2. exportar configuração sem valores secretos: service ID, ambiente, domínio, root directory, start command, healthcheck, réplicas, cron e status do último deploy;
3. consultar métricas e logs por uma janela acordada — mínimo recomendado de 30 dias, incluindo pico de negócio — e medir requests totais, último request, códigos HTTP, origem/upstream e acessos aos dois endpoints;
4. verificar métricas do gateway/domínio e logs do backend para chamadas ao host legado, pois zero log no container não basta se o serviço estiver suspenso ou sem retenção;
5. confirmar que nenhuma variável de backend/frontend/job contém URL/host do serviço e que nenhum domínio/DNS ainda resolve para ele;
6. registrar owner e aprovação do desligamento, criar snapshot/tag, então desabilitar tráfego antes de excluir; observar erros e rollback durante a janela definida.

Critério de remoção: **zero consumidor estático + zero configuração dependente + zero tráfego observável na janela + aprovação do owner + rollback arquivístico testado**. Sem esses cinco itens, o diretório e o serviço não devem ser removidos por inferência.

## Referências

- ADR 0002 — KNN no backend
- `docs/archive/audits/avaliacao-projeto-2026-04-16.md` §3.3
- `docs/product/data/ADENDO_TECNICO_KNN.md` (Lumina, mar/2026)
