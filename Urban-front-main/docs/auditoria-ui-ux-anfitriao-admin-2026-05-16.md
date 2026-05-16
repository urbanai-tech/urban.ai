# Auditoria UI/UX - Telas do Anfitriao e Admin

Data: 2026-05-16  
Escopo auditado: app autenticado do anfitriao e telas administrativas do Urban AI.  
Metodo: renderizacao local com respostas mockadas, inspecao visual desktop/mobile e leitura dos componentes React/Chakra/Tailwind.

## Veredito executivo

O produto tem base funcional boa, mas ainda nao esta em nivel premium. O maior problema nao e uma tela isolada: e a falta de uma linguagem visual unica. As telas do anfitriao usam layout claro com Chakra, sidebar iconica e cards amplos; o admin usa um dark dashboard denso em Tailwind; a pagina de integracoes mistura dark components dentro de fundo claro e fica com contraste ruim. Isso da sensacao de produto montado por partes, nao de uma experiencia intencional como paginas publicas premium.

Nota atual estimada:

- Anfitriao desktop: 6.4/10
- Anfitriao mobile: 2.5/10
- Admin desktop: 6.1/10
- Consistencia visual entre areas: 3.5/10
- Potencial apos redesign focado: 8.5/10

Evidencias visuais capturadas:

- `docs/auditoria-ui-ux-screenshots/host-painel.png`
- `docs/auditoria-ui-ux-screenshots/host-calendario.png`
- `docs/auditoria-ui-ux-screenshots/host-propriedades.png`
- `docs/auditoria-ui-ux-screenshots/host-roi.png`
- `docs/auditoria-ui-ux-screenshots/host-integracoes.png`
- `docs/auditoria-ui-ux-screenshots/host-calendario-mobile.png`
- `docs/auditoria-ui-ux-screenshots/admin-home.png`
- `docs/auditoria-ui-ux-screenshots/admin-dashboard.png`
- `docs/auditoria-ui-ux-screenshots/admin-events.png`
- `docs/auditoria-ui-ux-screenshots/admin-waitlist.png`
- `docs/auditoria-ui-ux-screenshots/admin-finance.png`

## Prioridades criticas

### P0 - Mobile do anfitriao esta quebrado

Na captura `host-calendario-mobile.png`, a tela mobile mostra a sidebar desktop colapsada, header duplicado e praticamente nenhum conteudo principal. O usuario fica com uma coluna de icones e footer, sem calendario utilizavel.

Impacto: bloqueia uso real no celular. Para anfitrioes, mobile e provavelmente um canal principal.

Recomendacao:

- Trocar o app shell interno por um unico layout responsivo.
- Desktop: sidebar fixa com labels ou tooltips.
- Mobile: top bar limpa + bottom navigation ou drawer real, nunca sidebar desktop.
- Validar `SideBar.tsx` e os breakpoints Chakra/SSR. A area problematica esta em `src/app/componentes/SideBar.tsx`, especialmente no uso de `Hide below="md"`, `Show below="md"` e no `aside` com `height="100vh"`.

### P0 - Integracoes tem contraste e acabamento incompatíveis com produto premium

`host-integracoes.png` e a tela mais desalinhada visualmente. Ela usa textos `text-slate-*` pensados para fundo escuro sobre fundo claro, o que deixa conteudo apagado, com aspecto desabilitado. O botao "Sincronizar listings" parece texto comum, nao acao. O bloco principal parece um formulario interno sem polimento.

Impacto: essa tela representa confianca, permissao e automacao Stays. Visual fraco aqui reduz seguranca percebida.

Recomendacao:

- Recriar como tela de configuracao premium em fundo claro, com cards brancos, bordas suaves e estados claros.
- Separar "Status da conexao", "Permissoes concedidas", "Listings sincronizados" e "Acoes perigosas".
- Usar CTA primario claro para sincronizar, botao destrutivo discreto para desconectar e labels legiveis.
- Corrigir classes em `src/app/settings/integrations/page.tsx`, hoje com `bg-slate-900`, `text-slate-400`, `text-slate-500` e `max-w-3xl` em contexto claro.

### P1 - Falta uma linguagem visual unica entre anfitriao, admin e public pages

O app autenticado parece um produto operacional claro; o admin parece um terminal executivo dark; as public pages tendem a ter outro tom. Nenhuma das tres areas compartilha claramente a mesma direcao de marca.

Impacto: reduz percepcao de maturidade. Produtos "nivel Apple" parecem inevitaveis: cada tela parece parte da mesma familia.

Recomendacao:

- Definir um design system minimo: tokens de cor, superficie, radius, sombra, tipografia, botao, input, card, tabela, badge e nav.
- Usar o azul-marinho e laranja da marca com parcimonia, com neutros mais sofisticados.
- Escolher uma direcao: admin pode continuar mais denso, mas nao precisa ser outro produto.
- Evitar misturar Chakra e Tailwind sem tokens compartilhados.

## Auditoria do anfitriao

### Navegacao e app shell

Pontos observados:

- Existe sidebar icon-only e header superior ao mesmo tempo.
- O header tem apenas "Iniciar" e "Pagamentos", enquanto a sidebar tem Painel, Notificacao, Calendario, Mapa, Propriedades, ROI, Configuracao e Plano.
- Icones da sidebar nao possuem labels visiveis quando colapsada, o que exige memoria do usuario.
- A tela ativa e indicada apenas por fundo escuro no icone; funciona, mas e sutil.
- O item "Configuracao" aponta para `event-log`, o que gera confusao semantica.

Recomendacao Apple-level:

- Usar uma sidebar expandida por default no desktop, com icone + label.
- Colapsar so por acao do usuario, com tooltip nos icones.
- No mobile, usar bottom nav com 4 itens principais: Painel, Calendario, Mapa, Propriedades. O restante entra em "Mais".
- Remover o header superior redundante ou transformar em barra contextual com busca, propriedade ativa e conta.

### Painel de controle

O painel tem uma boa base: KPIs no topo, filtro de propriedade, cards de eventos com sugestao de preco. A tela comunica valor rapido.

Problemas:

- H1 muito pesado e grande para um dashboard operacional.
- Os cards de KPI parecem genericos; nao ha assinatura visual da Urban AI.
- Event cards sao muito horizontais e vazios em desktop.
- Os badges `SUG.`, `ATUAL` e `%` competem visualmente, todos com cor forte.
- O CTA "Aceitar Sugestao" e menor do que a decisao merece.
- A paginacao fica baixa e visualmente desconectada.

Recomendacao:

- Criar um "Revenue command center": faixa superior com propriedade ativa, periodo e impacto financeiro.
- Dar mais contexto aos KPIs: tendencia, periodo, confianca.
- Transformar sugestoes em cards mais ricos: evento, distancia, impacto esperado, preco atual, preco sugerido, acao primaria.
- Usar uma hierarquia de cor: azul/laranja da marca para estrutura, verde somente para sucesso/ganho, vermelho somente para risco/perda.

### Calendario

O calendario e util e ja tem boa estrutura de duas colunas: mes + painel de eventos.

Problemas:

- O seletor de propriedade renderizou imagem quebrada/alt text dentro do select.
- A grade do calendario ocupa muito espaco com baixa densidade informacional.
- O painel lateral tem conteudo cortado no viewport; os campos de resultado aparecem parcialmente.
- A data selecionada compete com o "hoje"; estado visual poderia ser mais refinado.
- "Como funciona?" e muito discreto para explicar a logica da IA.

Recomendacao:

- Trocar grade quadrada por calendario mais editorial, com microeventos e marcadores mais elegantes.
- Criar painel lateral sticky com scroll interno claro.
- Fazer o card de recomendacao ter camadas: evento, motivo, preco, confianca, acao.
- Evitar campos longos dentro do card quando a sugestao ainda esta em leitura; abrir "Registrar resultado" em modal/drawer.

### Propriedades

A tela cumpre a funcao de listar e editar precos base, mas parece tabela tecnica.

Problemas:

- Imagens quebradas deixam a tela com aspecto inacabado.
- Inputs nao possuem labels visiveis; o usuario precisa inferir que `320` e diaria e `9200` e receita media.
- Coordenadas brutas ocupam espaco nobre e nao ajudam na decisao.
- Acoes "Salvar", "Historico" e deletar ficam alinhadas, mas sem hierarquia e sem agrupamento.
- Layout parece uma linha de banco de dados, nao uma gestao de imoveis.

Recomendacao:

- Transformar cada propriedade em card/list item premium: foto, nome, bairro, status de processamento, diaria base, receita media, ultima analise.
- Inputs com labels persistentes: "Diaria base" e "Receita media mensal".
- Mover coordenadas para detalhes tecnicos/accordion.
- Deletar deve ir para menu contextual ou area separada, longe do CTA primario.

### Meu ROI

E a tela mais forte do anfitriao. A proposta de valor aparece de imediato: dinheiro gerado, retorno sobre assinatura e ganhos recentes.

Problemas:

- O bloco verde escuro e forte, mas ainda parece dashboard interno, nao experiencia premium.
- Selects e botao "Atualizar" ficam funcionais, mas pouco refinados.
- A tela poderia contar melhor a historia do ganho: "o que aconteceu", "por que aconteceu", "o que fazer agora".

Recomendacao:

- Manter esta tela como referencia para o redesign.
- Adicionar narrativa visual: headline de impacto, trend line, comparativo antes/depois.
- Usar cards de "wins" mais emocionais e menos tabelados.

### Integracoes Stays

Problemas:

- Contraste baixo e blocos escuros em fundo claro.
- Permissoes e status nao transmitem seguranca suficiente.
- O estado "ativo" e pequeno demais para uma integracao critica.
- "Sincronizar listings" parece link/texto, nao botao.

Recomendacao:

- Criar uma tela de confianca: "Stays conectada", status, ultima sincronizacao, permissao, listings, log de push.
- Usar checkmarks, timestamps, nivel de automacao por listing e alertas claros.
- Incluir um bloco "O que a Urban AI pode fazer" com linguagem humana.

## Auditoria do admin

### Visao geral admin

O admin e funcional, rico em dados e cobre bem operacao, eventos, waitlist, receita e IA. Para uso interno, a densidade e aceitavel. Para nivel premium, ainda parece muito "painel tecnico".

Problemas recorrentes:

- Dark theme muito uniforme, com pouco relevo entre superficies.
- Texto pequeno demais em muitos cards (`text-xs`, `text-[10px]`).
- Links de navegacao aparecem como texto pequeno ou setas.
- Muitos emojis/icones inconsistentes.
- Falta uma navegacao admin persistente.
- Muitas acoes usam `alert`, `confirm` e `prompt` nativos, o que quebra polimento.

Recomendacao:

- Criar `AdminShell`: sidebar/topbar, breadcrumbs, busca global, usuario, ambiente.
- Definir componentes admin: `MetricCard`, `HealthBanner`, `DataTable`, `FilterBar`, `ActionMenu`, `ConfirmDialog`.
- Substituir alert/confirm/prompt por modais do design system.
- Manter densidade, mas melhorar hierarquia e legibilidade.

### Dashboard executivo

Pontos fortes:

- Bom agrupamento por areas: eventos, waitlist, processamento, receita, dataset, billing, Stays.
- O banner de saude geral e uma boa ancora de decisao.
- Cards mostram dados importantes sem depender de graficos complexos.

Problemas:

- Cards parecem blocos iguais demais; o usuario precisa ler tudo.
- Links pequenos no topo dos cards nao parecem affordances fortes.
- O banner inferior de fallback aparece cortado no viewport.
- A cor dark azul/preto domina demais.

Recomendacao:

- Criar "Executive command center": saude geral + 3 prioridades + KPIs-chave.
- Diferenciar card de alerta, card financeiro, card operacional e card de qualidade.
- Adicionar "next best action" em cada area critica.

### Eventos

Pontos fortes:

- Tela poderosa operacionalmente.
- Tem filtros, KPIs, ranking, timeline e listagem detalhada.

Problemas:

- Densidade alta demais para primeira leitura.
- Muitos dados em `text-xs`.
- Tabelas ficam tecnicas e pouco escaneaveis.
- Filtros nao parecem uma barra de controle premium.

Recomendacao:

- Separar overview e triagem operacional.
- Fazer filtros como toolbar sticky.
- Usar status chips consistentes para geo, scope e enrichment.
- Expandir linhas para detalhes em vez de mostrar tudo na tabela.

### Waitlist

Pontos fortes:

- Boa separacao entre KPIs, origem, top referrers, filtros e tabela.
- Acoes de convite estao claras.

Problemas:

- A tabela e funcional, mas pouco elegante.
- Acoes ficam muito grudadas: "Convidar Notas Remover".
- Busca e select usam estilo nativo simples.

Recomendacao:

- Agrupar acoes em menu ou botoes com espaçamento.
- Criar cards de lead para telas menores.
- Dar mais contexto comercial: origem, score, indicacoes, proximo passo.

### Financeiro

Pontos fortes:

- Bons KPIs: MRR, custos, margem, imoveis ativos.
- A secao "por imovel ativo" e muito util.

Problemas:

- A tela parece planilha dark.
- CRUD de custos e metricas convivem na mesma pagina sem separacao clara de modo leitura/edicao.
- "Popular default" e "+ Novo custo" deveriam ter hierarquia e confirmacao visual.

Recomendacao:

- Dividir em "Resumo financeiro" e "Custos operacionais".
- Transformar edicao de custo em drawer/modal.
- Adicionar graficos leves de margem e custo por categoria.

## Recomendacoes de redesign nivel premium

### 1. Unificar shell e tokens

Criar tokens compartilhados:

- `surface/page`, `surface/card`, `surface/elevated`
- `brand/navy`, `brand/orange`, `success`, `warning`, `danger`
- `radius/card = 12px`, `radius/control = 10px`
- sombras discretas e consistentes
- escalas de fonte: page title, section title, card title, body, caption

### 2. Reorganizar arquitetura visual do anfitriao

Proposta:

- Home autenticada: "Hoje na sua operacao"
- Painel: KPIs + recomendacoes prioritarias
- Calendario: planejamento por data
- Mapa: exploracao espacial
- Propriedades: configuracao de imoveis
- ROI: prova de valor

Cada tela deve responder:

- O que mudou?
- O que importa?
- O que devo fazer agora?

### 3. Transformar recomendacao de preco em componente hero do produto

Hoje a recomendacao aparece como card operacional. Ela deveria ser o objeto central da Urban AI.

Componente sugerido:

- Evento + data + distancia
- Preco atual vs preco sugerido
- Ganho estimado
- Nivel de confianca
- Motivo resumido
- CTA primaria: "Aplicar sugestao" / "Aceitar"
- CTA secundaria: "Ver detalhes"

### 4. Elevar admin sem perder densidade

O admin nao precisa parecer pagina publica, mas precisa parecer ferramenta premium. Referencias: Linear, Stripe Dashboard, Vercel, Apple Business Manager.

Direcao:

- Dark mode mais refinado, menos preto chapado.
- Tabelas com altura de linha, zebra leve, sticky header e chips.
- Acoes perigosas sempre em modal.
- Filtros como toolbar, nao inputs soltos.
- Menos emojis, mais icones consistentes.

### 5. Corrigir responsividade antes de qualquer polimento

Checklist obrigatorio:

- 390x844: app shell, dashboard, calendario, propriedades, ROI.
- 768x1024: tablet.
- 1280x900: laptop.
- 1440x1000: desktop.

Gate: nenhuma tela pode mostrar conteudo principal vazio, header duplicado, sidebar desktop em mobile ou formulario cortado.

## Roadmap recomendado

### Sprint 1 - Correcoes de base

- Corrigir app shell mobile.
- Remover header redundante ou alinhar com sidebar.
- Corrigir contraste da tela de integracoes.
- Corrigir imagens quebradas em propriedades/selects.
- Adicionar labels aos inputs de propriedades.

### Sprint 2 - Design system

- Criar tokens e componentes base.
- Unificar Button, Input, Select, Card, Badge, Table e Modal.
- Substituir `alert`, `confirm`, `prompt` por componentes do app.

### Sprint 3 - Redesign anfitriao

- Recriar Painel e Calendario em cima do componente de recomendacao.
- Melhorar Propriedades como cards editaveis.
- Refinar ROI como tela de prova de valor.

### Sprint 4 - Redesign admin

- Criar AdminShell.
- Redesenhar Dashboard executivo.
- Melhorar Eventos, Waitlist e Financeiro com toolbar/tables/chips.

## Conclusao

O Urban AI ja tem informacao valiosa e fluxos essenciais, mas a experiencia ainda nao comunica a sofisticacao do produto. Para chegar no padrao desejado, o foco deve ser menos "adicionar UI bonita" e mais criar uma linguagem operacional elegante: uma navegacao clara, recomendacoes com hierarquia forte, responsividade impecavel, contraste consistente e acoes que parecam confiaveis.

O maior ganho rapido esta em tres frentes: corrigir mobile, redesenhar integracoes e unificar o shell. Depois disso, o painel do anfitriao e o admin podem evoluir para um nivel bem mais premium sem reescrever toda a aplicacao.
