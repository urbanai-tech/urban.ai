# Evidência — correção de contraste e scorecard mobile do mapa HTML

**Arquivo alterado:** `docs/urban-ai-system-map-2026-07-15.html`  
**Data:** 2026-07-15

## Correções aplicadas

- preservadas as 13 seções e os 13 links do índice;
- mantida a identidade visual dark editorial/light premium;
- introduzidos contrastes semânticos específicos para texto sobre accent e para a pirâmide;
- tokens de status do tema claro receberam variantes escuras legíveis;
- IDs de issues e barras de dispositivo usam texto secundário com contraste AA;
- swatches claros usam texto escuro sem alterar suas cores demonstrativas;
- o alvo `10` deixou de ser ocultado abaixo de 900 px;
- a grade do scorecard foi recalculada para quatro colunas em 390–900 px.

## Validação Axe + layout

Execução programática com Chromium e `@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a` e `wcag21aa`:

| Viewport | Tema | Serious/critical | Erros JS | Overflow horizontal | Seções | Links de navegação | Target visível |
|---:|---|---:|---:|---|---:|---:|---|
| 1440×900 | dark | 0 | 0 | não (`1440/1440`) | 13 | 13 | sim, `10` |
| 1440×900 | light | 0 | 0 | não (`1440/1440`) | 13 | 13 | sim, `10` |
| 390×900 | dark | 0 | 0 | não (`390/390`) | 13 | 13 | sim, `10` |
| 390×900 | light | 0 | 0 | não (`390/390`) | 13 | 13 | sim, `10` |

Todos os quatro cenários retornaram `ok: true` e exit code 0.

## Comparativo

- antes: 36 nós `serious` no dark e 60 no light;
- depois: zero violações `serious` ou `critical` em dark/light, desktop/mobile;
- nenhuma seção, rota, fluxo, jornada ou item do mapa foi removido.
