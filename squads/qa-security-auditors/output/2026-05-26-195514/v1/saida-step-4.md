# [UX] Confianca, acessibilidade e leitura de dados

## 1. Alta - CTA "Aplicar sugestao" nao aplica preco

Evidencia:

- `Urban-front-main/src/app/dashboard/components/ItemEvento.tsx:154`
- `Urban-front-main/src/app/dashboard/components/ItemEvento.tsx:262`
- `Urban-front-main/src/app/dashboard/components/ItemEvento.tsx:359`

Problema: o botao `Aplicar sugestao` chama `alterarAceitoSugestao` e marca a recomendacao como aceita. A aplicacao efetiva de preco aparece separada como `Registrar preco aplicado`.

Impacto: o anfitriao pode acreditar que o preco foi aplicado no canal/operador quando apenas aceitou a recomendacao.

Recomendacao: trocar label para `Aceitar sugestao` ou `Marcar como aceita`; exibir estado "aceita, ainda nao aplicada"; separar claramente de "Registrar preco aplicado".

## 2. Alta - fallback/mock contratual pode parecer dado real

Evidencia:

- `Urban-front-main/src/app/service/api.ts:1206`
- `Urban-front-main/src/app/service/api.ts:1621`
- `Urban-front-main/src/app/service/hostEventRadarMocks.ts:16`
- `Urban-front-main/src/app/event-radar/page.tsx:194`

Problema: alguns fallbacks sao intencionais para contrato/experiencia, mas a UI ainda pode reduzir isso a uma badge pequena.

Impacto: metricas, eventos e oportunidades simuladas podem ser lidas como inteligencia operacional atual.

Recomendacao: banner global de modo demonstracao/fallback; timestamp dos dados; fonte por metrica; labels distintos para `mock`, `simulado`, `derivado`, `estimado`.

## 3. Alta - heatmap transmite precisao geografica maior que a base suporta

Evidencia:

- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx:172`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx:700`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx:1054`

Problema: bolhas e bounds podem dar sensacao visual de precisao mesmo quando a celula e derivada ou usa fallback.

Impacto: usuario pode confiar demais em localizacao, raio de demanda e potencial visual.

Recomendacao: mostrar precisao da geocodificacao no canvas, tooltip e `aria-label`; destacar "celula derivada/sem centro confiavel"; quando base for fraca, priorizar tabela/lista.

## 4. Media/Alta - ROI mistura confirmado e projetado na leitura dominante

Evidencia:

- `Urban-front-main/src/app/my-roi/page.tsx:160`
- `Urban-front-main/src/app/my-roi/page.tsx:222`
- `Urban-front-main/src/app/service/api.ts:1950`

Problema: o tipo separa confirmado/projetado, mas o hero/tabela podem usar linguagem dominante como "Gerado".

Impacto: receita projetada pode ser interpretada como receita realizada.

Recomendacao: separar "confirmado" e "projetado" no hero e por imovel; evitar "Gerado" quando inclui estimativa; incluir qualidade/fonte da atribuicao perto do valor.

## 5. Media - erro de propriedades pode virar estado vazio no dashboard

Evidencia:

- `Urban-front-main/src/app/dashboard/page.tsx:220`
- `Urban-front-main/src/app/dashboard/page.tsx:315`

Problema: erro de propriedades e capturado, mas nem sempre vira estado visivel especifico ao usuario; a tela pode cair no vazio "Ainda nao ha imovel pronto".

Impacto: falha de backend pode parecer ausencia real de dados.

Recomendacao: separar vazio real de erro tecnico com `role="alert"`, botao de tentar novamente e mensagem especifica para falha no carregamento de imoveis.
