# ADR 0023 — Stays automático abaixo de 1,0×: piso para reduções automáticas

**Status:** Proposto (26/10/2026) — **decisão em aberto**. Decide: Produto/Engenharia (Gustavo), com validação do primeiro grupo de anfitriões do beta. Depende de [ADR 0016](./0016-conector-stays-slug-escrita-desligada-rollback.md) e [ADR 0019](./0019-quando-ligar-o-motor-v2.md).

## Contexto

A auto-aplicação (`urban-ai-backend-main/src/stays/stays-auto-apply.service.ts`) só envia preço se o multiplicador recomendado ficar dentro de `[STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER, STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER]`. Os padrões são **1,00** e **1,25** (faixa permitida de configuração 0,5–3). Na prática, **reduções nunca são aplicadas automaticamente**: só aumentos moderados. Reduções continuam possíveis por ação humana (preview + push).

Com o motor v2 ligado, sugestões abaixo de 1,0× passam a existir em volume (até −20% ou o guardrail do perfil). Um piso de 1,0× então deixaria o modo automático sem efeito nas noites fracas, justamente onde preço alto demais custa reserva. Por outro lado, baixar preço sem supervisão é o erro mais caro e menos visível do produto.

## Opções consideradas

1. **Manter 1,00 (só sobe automaticamente).** Seguro; reduções exigem confirmação do anfitrião.
2. **Piso curto (ex.: 0,95 a 0,90).** Permite pequenas reduções automáticas; limita o dano de um erro.
3. **Piso largo (0,80, igual ao limite do v2).** Automação máxima; exige evidência real forte.
4. **Reduções automáticas com confirmação assíncrona** (notificar e aplicar após prazo, se o anfitrião não vetar).

## Recomendação

**Manter 1,00 enquanto o v2 estiver em sombra e durante a coorte inicial do ADR 0019.** Depois, migrar para **opção 4 → 2**: reduções pequenas (até −5% a −10%) automáticas só para quem optou explicitamente por "reduzir automaticamente", com o piso de preço do anfitrião (`minDailyPrice`) respeitado, limite diário de variação, notificação de cada redução e rollback de um clique (já existe, ADR 0016). Baixar o piso global (opção 3) só com erro medido do v2 em dados reais. Os valores acima são ponto de partida para o decisor, não resultado de medição.

## Consequências

- (+) Mantém a regra segura hoje; abre caminho gradual e auditável.
- (−) Enquanto o piso for 1,00, o modo automático não captura o valor das reduções do v2; o anfitrião vê a recomendação mas precisa aplicar.
- (−) Opção 4 exige notificação confiável e prazo claro de veto; é trabalho de produto, não só de configuração.
