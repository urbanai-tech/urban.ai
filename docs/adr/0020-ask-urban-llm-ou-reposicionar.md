# ADR 0020 — Ask Urban: implementar com LLM e cota, ou reposicionar a promessa

**Status:** Proposto (26/10/2026) — **decisão em aberto**. Decide: Produto/Engenharia (Gustavo).

## Contexto — o que o código faz hoje

- O Ask Urban (`urban-ai-backend-main/src/host-panels/`: `ask.controller.ts`, `host-panels.service.ts`) **não usa LLM**. `buildAskAnswer` lê as análises do usuário (até 500) e responde por **palavras-chave** (`receita`, `projec`, `ganho`...) com textos montados a partir de dados reais da conta (imóveis, recomendações, receita registrada, lift potencial) e citações para telas internas. Não há chamada a Gemini ou outro modelo nesse caminho.
- A cota diária (`ASK_URBAN_DAILY_QUOTA`, padrão 100; teto `ASK_URBAN_DAILY_HARD_CAP`, padrão 200) e o entitlement por plano (`ASK_URBAN_ALLOWED_PLANS`: profissional/escala/alpha) existem, mas protegem um custo que hoje é praticamente zero. A cota conta mensagens desde a meia-noite do **fuso do servidor** (`startOfToday()`), não de São Paulo ([ADR 0013](./0013-calendario-sao-paulo-para-todo-dia.md)).
- O front (`AskUrbanDrawer.tsx`) convida a "perguntar sobre receita, ocupação, eventos" em linguagem livre ("Ex: minha diária está boa este mês?"), o que sugere um assistente conversacional. O PRD (§4.10) descreve respostas por dados reais; `USER-JOURNEYS.md` lista "AskUrban com LLM" como **não coberto** pelos testes.
- O Gemini já é usado no backend para enriquecimento de eventos ([`ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md) §5), então a dependência e a chave existem.

## Opções consideradas

1. **Implementar com LLM** (Gemini): perguntas livres, respostas fundamentadas nos dados da conta. Custo por pergunta, latência (timeout `heavy` de 45 s, [ADR 0017](./0017-locks-distribuidos-para-jobs-agendados.md)), risco de alucinação de preço e de enviar dados pessoais a um subprocessador (exige DPA e atualização da política de privacidade; ver [`lgpd/dpa-checklist.md`](../lgpd/dpa-checklist.md)).
2. **Reposicionar a cópia**: assumir que é um "painel de perguntas rápidas" com respostas determinísticas; trocar o placeholder por perguntas sugeridas (botões), remover a promessa de conversa livre.
3. **Híbrido**: manter o determinístico e usar o LLM só para reescrever/explicar um resultado já calculado (sem número novo vindo do modelo).

## Recomendação

Curto prazo: **opção 2 imediatamente** (barata, honesta, faz o produto cumprir o que diz), com perguntas sugeridas cobrindo as intenções que o roteador de palavras-chave já entende. Médio prazo: avaliar a opção 3 quando houver demanda real, mantendo a regra "números vêm do banco, o modelo só redige", cota em dia de São Paulo, cache de respostas e DPA do fornecedor assinado antes do primeiro dado de cliente sair. Só ir à opção 1 completa se perguntas livres se mostrarem diferencial de venda.

## Consequências

- (+) Opção 2 elimina o risco de prometer mais do que o produto faz e custa poucas horas.
- (−) Opção 1/3 adicionam custo variável, dependência de fornecedor e superfície de LGPD.
- (−) Enquanto não decidido, a cota e o entitlement continuam como estão, e o fuso da cota segue inconsistente com o ADR 0013.
