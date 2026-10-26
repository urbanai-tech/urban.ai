# ADR 0015 — Motor de preço v2 em modo sombra (`PRICING_ENGINE_V2`)

**Status:** Aceito (26/10/2026) — registra o que já vigora. A decisão de **ligar** o v2 está em aberto: [ADR 0019](./0019-quando-ligar-o-motor-v2.md).

## Contexto

O motor v1 só sobe preço (nunca fica abaixo da base) e exige um evento. O v2 (`urban-ai-backend-main/src/knn-engine/pricing-engine-v2.ts`) calcula também noites sem evento, pode reduzir preço e expõe `drivers` e guardrails. Ele muda números de forma material (no backtest sintético cerca de metade das noites ficam abaixo da base) e a única evidência até agora é sintética ([`runbooks/motor-de-preco.md`](../runbooks/motor-de-preco.md)).

## Opções consideradas

1. **Trocar v1 por v2 de uma vez.** Rápido, mas o anfitrião passa a ver quedas de preço sem evidência real.
2. **Ficar no v1.** Seguro, mas sem como validar o v2 com dados reais.
3. **Rodar o v2 em sombra: v1 responde, v2 é calculado ao lado** (escolhida, padrão).

## Decisão

- `PRICING_ENGINE_V2` tem três modos (`resolvePricingEngineMode` em `pricing-engine-v2.ts`): `true|on|1|v2` → v2 responde; `false|off|0|v1` → só v1; **qualquer outro valor ou ausente → `shadow`** (padrão).
- Em `shadow` (`pricing-engine.ts`, `suggestPrice`), a resposta é o v1, **inalterada**; o resultado do v2 é anexado em `details.shadowV2` (versão do motor, preço, multiplicador, drivers, guardrail) e registrado em log nível debug (`[shadow-v2] ... diff=%`). Falha do v2 em sombra só gera `warn` e nunca afeta a resposta.
- Ligar ou desligar é trocar uma variável e reiniciar; não há migration nem dado a desfazer. Com v2 ligado, `propriedade.service` usa a **média** entre o cálculo ancorado no mercado e o v2 (no v1 usa o maior dos dois), sempre limitada pelo guardrail do usuário.

## Consequências

- (+) Reversível e sem impacto no anfitrião; permite comparar v1 × v2 com tráfego real.
- (−) **O que o runbook chama de comparação "lado a lado" hoje não é persistido.** `details.shadowV2` vive só na resposta em memória do motor; em `propriedade.service.ts` a `AnalisePreco` é salva sem esse campo, e o único rastro é o log debug (que costuma estar desligado em produção). Sem persistir o v2 por recomendação (coluna ou tabela nova, com migration), não há como cruzar v2 com os outcomes reais. É pré-requisito do [ADR 0019](./0019-quando-ligar-o-motor-v2.md).
- (−) Dois motores a manter enquanto o v1 não é aposentado (`knn-classifier.ts` guarda compatibilidade com o v1).
- (−) `PRICING_STRATEGY` (adaptive/rules/xgboost/shadow) é um mecanismo de "sombra" diferente e ortogonal; hoje o fluxo de sugestão não passa pela `PricingStrategyFactory`. Não confundir os dois.
