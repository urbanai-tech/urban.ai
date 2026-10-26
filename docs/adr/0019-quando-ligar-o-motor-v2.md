# ADR 0019 — Quando ligar o motor de preço v2 (`PRICING_ENGINE_V2=true`)

**Status:** Proposto (26/10/2026) — **decisão em aberto**. Decide: Engenharia/Produto (Gustavo). Depende do [ADR 0015](./0015-motor-de-preco-v2-em-sombra.md).

## Contexto

O v2 corrige o viés do v1 (que só sobe), mas ao ligar, preços **caem** para anfitriões existentes: dias úteis, noites sem evento, última hora e lacunas, até −20% (ou o guardrail do perfil), e eventos sobem menos que no v1 (riscos 1–2 em [`runbooks/motor-de-preco.md`](../runbooks/motor-de-preco.md)). A única evidência de que o v2 acerta mais é um backtest **sintético**, cujo gerador compartilha hipóteses com o motor. Hoje o modo é `shadow`, mas o resultado do v2 **não é persistido** (só log debug), então não há dado real para decidir.

## Opções consideradas

1. **Nunca ligar / manter em sombra.** Zero risco, mas o v2 vira código morto e o v1 continua sem reduzir preço.
2. **Ligar já para todos.** Ganho potencial imediato, mas sem evidência real e com queda de preço visível.
3. **Persistir a sombra, definir critérios e ligar por coorte** (recomendada).

## Critérios propostos (a ratificar)

Todos medidos sobre recomendações com v1 e v2 persistidos e com outcome conhecido (`AnalisePreco.reservaStatus`, `precoAplicado`, `OccupancyHistory`; ver [`integracoes-outcomes-calibracao.md`](../runbooks/integracoes-outcomes-calibracao.md)):

- **Volume**: ordem de centenas de recomendações com outcome (sugestão inicial: ≥ 300) distribuídas por vários imóveis (≥ 30) e por pelo menos 8 semanas, incluindo noites com e sem evento. Os números são ponto de partida, não verdade: o motor de preço tem poucos usuários reais hoje e o time deve ajustá-los ao volume disponível.
- **Erro versus preço aplicado**: o erro absoluto percentual do v2 contra o preço que o anfitrião realmente praticou (e/ou a diária que fechou reserva) deve ser **menor ou igual** ao do v1, sem piora nas noites com evento (onde o backtest já mostra empate).
- **Guardrails**: nenhuma sugestão do v2 fora do guardrail do perfil; fração de sugestões abaixo da base dentro do que o produto aceita comunicar; nenhuma recomendação abaixo do piso `minDailyPrice` do anfitrião ([ADR 0010](./0010-plano-b-do-scraping.md)).
- **Reservas**: sem queda de taxa de reserva nas noites em que o v2 reduziu preço, comparando com o grupo que ficou no v1.

## Recomendação

1. **Pré-requisito**: persistir `shadowV2` por recomendação (campo/tabela nova e migration) e a versão do motor.
2. Acumular dados em `shadow` até os critérios acima; revisar semanalmente.
3. Ligar primeiro para uma **coorte pequena** (allowlist de usuários) e só depois geral; manter o piso de auto-aplicação em 1,0× ([ADR 0023](./0023-stays-automatico-abaixo-de-1x.md)) durante essa fase, para que reduções sejam sempre decisão humana.
4. Comunicar a mudança aos anfitriões antes de ligar (sugestões vão baixar em dias fracos).

## Consequências

- (+) A decisão passa a ser baseada em dado real e reversível (mesma variável, sem migration de dados).
- (−) Atrasa o ganho do v2 em semanas; exige trabalho de engenharia (persistência) antes de qualquer decisão.
- (−) Com poucos usuários, os critérios podem demorar a ser atingidos; aceitar um intervalo de confiança maior ou estender a janela é uma escolha do decisor.
