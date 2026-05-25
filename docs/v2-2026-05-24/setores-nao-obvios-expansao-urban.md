# Setores Nao Obvios e Teses de Expansao da Urban AI

Data: 2026-05-24  
Tipo: exercicio estrategico complementar.  
Relacao com documentos anteriores: este documento nao substitui `frentes-expansao-beachheads.md`; ele amplia a analise para setores fora do eixo obvio de hosts, imoveis e hospedagem.

## 1. Tese principal

A Urban AI nao e apenas uma ferramenta para hosts. O que foi construido tambem pode ser visto como uma camada de inteligencia operacional da cidade:

> eventos + geografia + previsao de demanda + recomendacao de acao + auditoria de decisao.

Essa combinacao serve para hospedagem, mas tambem serve para qualquer setor que precisa reagir a picos locais de demanda.

O comprador nao precisa ser alguem que altera diaria de imovel. Pode ser alguem que altera:

- escala de equipe;
- estoque;
- horario de funcionamento;
- preco;
- midia;
- seguranca;
- capacidade operacional;
- planejamento de rota;
- investimento em uma regiao;
- patrocinio ou ativacao de marca.

Esse e o salto mental importante: a Urban pode vender "decisoes acionaveis sobre demanda urbana", nao apenas "pricing de Airbnb".

## 2. Ativos entregues que podem virar novos produtos

| Ativo ja construido | Produto possivel fora de hospedagem |
|---|---|
| Coleta de eventos por spiders, importacao e fontes externas | Calendario economico local para empresas |
| Deduplicacao, normalizacao e qualidade de eventos | Base confiavel para planejamento comercial |
| Geocoding, mapas, cobertura e proximidade | Inteligencia por raio, bairro, venue e microzona |
| Event Radar | Radar de demanda para negocios locais, midia e operacao |
| Motor de pricing/recomendacao | Motor generico de recomendacao de acao: preco, equipe, estoque, campanha |
| Admin de eventos, jobs, qualidade e coverage | Produto B2B operavel, nao so interface para usuario final |
| ROI, funil, financeiro e qualidade | Prova de valor e gestao para compradores empresariais |
| Audit logs, release gates e runbooks | Confianza para setores mais corporativos |
| Stripe, paywall e planos | Capacidade de empacotar SaaS/report/API |
| Design system e narrativa executiva | Capacidade de transformar dados em material vendavel |

## 3. Sinais externos de mercado

Alguns dados externos reforcam que o "efeito evento" e maior que hospedagem:

- A ABRAPE projetou R$ 141,1 bilhoes de consumo no setor de eventos em 2025 e cita um hub setorial com 52 atividades impactadas, incluindo bares, restaurantes, seguranca privada, hospedagem e operadores turisticos.
- O IAB Brasil, em parceria com IBOPE, consolidou o Digital Adspend 2026 com ano-base 2025 e destacou retail media e DOOH como segmentos relevantes de investimento.
- O mercado de OOH se posiciona como um dos principais meios de investimento publicitario no Brasil, com forte relacao com mobilidade, ruas, aeroportos, edificios e mobiliario urbano.
- A cidade de Sao Paulo reportou recordes recentes de turismo e eventos, o que reforca a tese de usar SP como laboratorio de demanda urbana.

Fontes:

- ABRAPE: https://www.abrape.com.br/abrape-preve-r-141-bilhoes-em-consumo-e-forte-expansao-de-empregos-no-setor-de-eventos-em-2025/
- IAB Brasil Digital Adspend 2026: https://iabbrasil.com.br/pesquisa-digital-adspend-2026/
- Portal da Propaganda sobre IAB/IBOPE: https://www.portaldapropaganda.com.br/noticias/39182/publicidade-digital-no-brasil-cresce-127-e-atinge-r-427-bilhoes-em-2025-mostra-estudo-do-iab-brasil/
- OOH Brasil: https://www.oohbrasil.com.br/sobre-o-meio
- SPTuris / Prefeitura de Sao Paulo: https://prefeitura.sp.gov.br/w/cidade-de-s%C3%A3o-paulo-fecha-2025-com-recorde-hist%C3%B3rico-de-47-2-milh%C3%B5es-de-turistas

## 4. Mapa de setores nao obvios

### 4.1 Midia OOH, DOOH, retail media e geofencing

Tese:

Marcas, agencias e redes de midia querem saber onde e quando ha concentracao de atencao urbana. Eventos geram deslocamento, permanencia, consumo e intencao contextual. A Urban pode transformar o radar de eventos em um planejador de midia por data, bairro, publico provavel e nivel de intensidade.

Produto:

- `Urban Event Media Planner`
- relatorio semanal de oportunidades de campanha;
- API de eventos relevantes por geografia;
- ranking de venues, bairros e datas;
- sugestao de janelas de ativacao;
- score de oportunidade por evento.

Compradores:

- agencias de midia;
- redes OOH/DOOH;
- shopping centers;
- marcas que fazem ativacao local;
- retail media networks;
- plataformas de geofencing.

Por que e interessante:

- Usa o core atual sem precisar aplicar preco em PMS.
- Tem orcamento corporativo, nao apenas SMB.
- O valor e estrategico: melhora alocacao de verba, nao apenas economiza tempo.
- Pode comecar como relatorio premium antes de virar API.

Risco:

- Exige linguagem de midia, audiencia e campanha.
- Idealmente precisara, no futuro, de dados complementares de fluxo/mobilidade ou parceiros.
- Nao deve prometer audiencia real sem fonte de footfall.

Veredito:

Uma das frentes nao obvias mais fortes. E provavelmente melhor como data product ou relatorio premium do que como SaaS self-service no inicio.

### 4.2 Agencias de ativacao, patrocinio e live marketing

Tese:

Agencias que vendem ativacoes precisam identificar eventos, regioes, perfis e datas em que uma marca deve aparecer. Hoje isso costuma depender de repertorio, relacionamento e planilhas. A Urban pode vender inteligencia de oportunidade.

Produto:

- mapa de oportunidades por categoria de evento;
- calendario de ativacao por marca/setor;
- relatorio "onde uma marca deveria estar nos proximos 60 dias";
- ranking de eventos por potencial comercial;
- score de sinergia marca-evento.

Compradores:

- agencias de live marketing;
- agencias de brand experience;
- produtoras de eventos;
- areas de marketing regional;
- patrocinadores.

Por que e interessante:

- Ticket pode ser alto por projeto.
- Nao exige integracao tecnica no MVP.
- Usa muito bem a camada de eventos, ranking e narrativa executiva.

Risco:

- Receita pode comecar consultiva, menos recorrente.
- Precisa de boa apresentacao e storytelling comercial.

Veredito:

Excelente frente para gerar caixa e reputacao sem virar outro produto complexo agora.

### 4.3 Staffing, seguranca, limpeza e mao de obra temporaria

Tese:

Eventos aumentam demanda por promotores, recepcionistas, segurancas, limpeza, montagem, suporte e atendimento. Empresas de terceirizacao precisam prever picos, montar escala, abordar clientes e alocar equipe com antecedencia.

Produto:

- radar de demanda operacional por evento;
- previsao de necessidade de equipe por bairro/data;
- alertas de picos para times comerciais;
- lista de eventos que merecem abordagem de venda;
- painel para planejamento semanal de escala.

Compradores:

- empresas de seguranca privada;
- limpeza e facilities;
- agencias de promotores;
- empresas de staff para eventos;
- fornecedores de montagem e apoio.

Por que e interessante:

- Dor clara: escala errada custa dinheiro.
- Nao depende de dados de reserva de hospedagem.
- O setor de eventos ja puxa varias atividades associadas.
- Pode vender como ferramenta comercial: "quais eventos devo abordar?".

Risco:

- Muitas empresas sao tradicionais e vendem por relacionamento.
- Pode exigir educacao de mercado.

Veredito:

Muito bom beachhead nao obvio. Simples de testar com relatorio semanal para 5 a 10 empresas de servicos.

### 4.4 Estacionamentos, valets e mobilidade local

Tese:

Eventos causam compressao de vaga, aumento de procura, mudanca de rotas e necessidade de equipe. Estacionamentos perto de venues podem ajustar preco, reservar vagas, reforcar equipe e fazer campanha antes dos eventos.

Produto:

- radar de eventos por estacionamento;
- recomendacao de preco/faixa por evento;
- previsao de ocupacao por data;
- alerta de reforco de equipe;
- API para plataformas de reserva de vaga.

Compradores:

- redes de estacionamentos;
- estacionamentos independentes perto de arenas/teatros;
- valets;
- shoppings com eventos proximos;
- plataformas de reserva de estacionamento.

Por que e interessante:

- Fit conceitual forte com dynamic pricing.
- Dor monetizavel: evento com vaga subprecificada perde receita.
- Produto inicial pode ser um calendario por unidade.

Risco:

- Mercado fragmentado.
- Integracoes com sistemas de estacionamento podem ser trabalhosas.
- Alguns operadores tem baixa maturidade digital.

Veredito:

Boa tese, mas eu colocaria depois de midia/ativacao e staffing, a menos que apareca um parceiro grande de distribuicao.

### 4.5 Restaurantes, bares, casas noturnas, food halls e franquias

Tese:

Eventos mudam demanda de mesa, delivery, estoque, escala e promocao. A Urban poderia ajudar negocios de alimentacao a antecipar picos por bairro e venue.

Produto:

- calendario de demanda por unidade;
- alerta de reforco de equipe e estoque;
- sugestao de campanha por evento;
- relatorio de oportunidades por raio;
- integracao futura com POS/reservas.

Compradores:

- grupos de restaurantes;
- bares perto de arenas;
- franquias com lojas em regioes de eventos;
- food halls;
- operadores de delivery/local commerce.

Por que e interessante:

- Mercado enorme.
- Eventos geram comportamento de consumo local.
- Produto e intuitivo para o dono: "vai lotar ou nao vai?".

Risco:

- SMB muito fragmentado e sensivel a preco.
- Restaurante pequeno pode achar legal, mas nao pagar muito.
- Integracao com estoque/POS aumenta complexidade.

Veredito:

Interessante, mas nao como primeiro produto vendido restaurante por restaurante. Melhor testar com grupos, franquias ou food halls.

### 4.6 Distribuidores, bebidas, foodservice B2B e reposicao local

Tese:

Se um bairro tera grande evento, bares e restaurantes ao redor podem aumentar compra de bebidas, gelo, descartaveis e insumos. Distribuidores podem usar o radar para vender antes do pico e organizar rota.

Produto:

- mapa de eventos que impactam pedidos por regiao;
- alerta para times comerciais;
- recomendacao de rota/pre-venda;
- score de oportunidade por cliente/regiao;
- relatorio semanal para representantes.

Compradores:

- distribuidores de bebidas;
- atacarejos regionais;
- foodservice B2B;
- fornecedores de gelo, descartaveis e equipamentos;
- representantes comerciais.

Por que e interessante:

- Eventos viram oportunidade de venda proativa.
- Nao exige convencer o bar final; vende para o fornecedor.
- O comprador ja tem equipe comercial e carteira.

Risco:

- Para ficar muito bom, precisa cruzar com base de clientes do distribuidor.
- Pode virar projeto customizado.

Veredito:

Subestimado. Pode ser uma tese boa de B2B data + sales intelligence.

### 4.7 Real estate comercial e site selection

Tese:

A Urban pode sair de "onde precificar melhor um imovel" para "onde abrir loja, dark kitchen, ponto de retirada, estacionamento, painel de midia ou hospedagem". Eventos sao um sinal de fluxo e valor de localizacao.

Produto:

- `Urban Location Score`;
- score de microzona por densidade de eventos;
- ranking de ruas/bairros por demanda recorrente;
- relatorio para expansao de lojas;
- analise de ponto para varejo, alimentacao, hotelaria e midia.

Compradores:

- redes em expansao;
- consultorias imobiliarias;
- fundos e incorporadoras;
- franqueadoras;
- operadores de dark kitchen;
- empresas de midia exterior.

Por que e interessante:

- Ticket alto: decisao de ponto vale muito.
- Menos obvio e mais estrategico.
- Pode virar produto premium para relatorios e consultoria.

Risco:

- Eventos sozinhos nao bastam; precisa complementar com renda, fluxo, concorrencia, transporte e aluguel.
- Ciclo de venda consultivo.

Veredito:

Boa frente de medio prazo. Nao e beachhead inicial, mas pode virar produto de alto valor quando a base de dados amadurecer.

### 4.8 Turismo corporativo, viagens de negocio e procurement

Tese:

Empresas que mandam funcionarios para eventos, feiras, congressos e reunioes querem prever datas caras, risco de falta de hospedagem e melhor momento de compra. A Urban poderia vender alerta de compressao de cidade.

Produto:

- calendario de datas caras por cidade;
- alerta de antecedencia para compra de hospedagem;
- score de compressao hoteleira/STR;
- relatorio para travel managers;
- API para TMCs.

Compradores:

- travel managers;
- TMCs;
- agencias corporativas;
- empresas com muitos deslocamentos;
- organizadores de congressos.

Por que e interessante:

- Nao depende de vender para host.
- Valor e evitar custo e indisponibilidade.
- Pode se apoiar em eventos e dados de hospedagem.

Risco:

- Precisa de credibilidade em forecast de preco/ocupacao.
- Compra corporativa pode ser lenta.

Veredito:

Boa tese secundaria, especialmente depois de provar a capacidade de prever compressao de demanda.

### 4.9 Seguradoras, risco urbano e compliance operacional

Tese:

Eventos aumentam exposicao a risco: aglomeracao, transito, incidentes, danos, sinistros, cancelamentos e necessidade de plano operacional. A Urban poderia vender scores de risco por local/data.

Produto:

- score de risco por evento/microzona;
- alerta de alta concentracao;
- relatorio para underwriting;
- monitoramento de carteira por geografia;
- trilha auditavel de sinais usados.

Compradores:

- seguradoras;
- brokers;
- empresas de gerenciamento de risco;
- operadores de venues;
- grandes redes com exposicao local.

Por que e interessante:

- Alto ticket potencial.
- Auditabilidade e documentacao da Urban ajudam.
- Pode virar dado alternativo para underwriting.

Risco:

- Ciclo enterprise e regulatorio.
- Exige cuidado legal e estatistico.
- Nao deve ser prioridade sem dados historicos de incidentes/sinistros.

Veredito:

Long shot de alto valor. Guardar como tese de futuro, nao como foco de 90 dias.

### 4.10 Telecom, conectividade temporaria e operacao de rede

Tese:

Eventos mudam carga de rede movel e Wi-Fi em regioes especificas. Operadoras e fornecedores de conectividade precisam planejar capacidade temporaria, suporte e infraestrutura.

Produto:

- calendario de concentracao de publico por antena/regiao;
- alertas de eventos relevantes;
- score de carga esperada;
- API de eventos por coordenada e horario;
- relatorio de hotspots futuros.

Compradores:

- operadoras;
- integradores de rede;
- provedores de Wi-Fi para eventos;
- venues.

Por que e interessante:

- Ticket muito alto.
- Problema real e recorrente.
- Produto de dados, nao necessariamente SaaS visual.

Risco:

- Ciclo de venda muito longo.
- Exige qualidade de dado e SLA altos.
- Pode demandar relacionamento enterprise.

Veredito:

Interesse estrategico, mas nao beachhead. Bom para tese de investidor como opcao futura de expansao.

### 4.11 Organizadores de eventos, venues e centros de convencao

Tese:

Organizadores e venues querem provar impacto economico, entender concorrencia de calendario, atrair patrocinadores e mostrar valor para cidade/marcas. A Urban pode vender relatorio de impacto e calendario competitivo.

Produto:

- relatorio de impacto urbano de evento;
- comparativo de eventos similares;
- mapa de demanda em hospedagem, midia e comercio local;
- argumento para patrocinadores;
- dashboard para venues.

Compradores:

- venues;
- centros de convencao;
- produtoras;
- organizadores de feiras;
- ligas/eventos esportivos;
- secretarias/entidades de turismo em casos pontuais.

Por que e interessante:

- Conecta com a base de eventos atual.
- Material executivo gera valor percebido alto.
- Pode vender por projeto.

Risco:

- O organizador ja conhece o proprio evento; o valor esta no impacto externo.
- Venda pode ser consultiva e irregular.

Veredito:

Boa frente de relatorios premium e parcerias, mas nao deve distrair do produto recorrente principal.

### 4.12 Turismo, entidades setoriais e desenvolvimento economico

Tese:

Municipios, entidades de turismo e associacoes querem entender como eventos movimentam a economia local. A Urban poderia vender "radar economico urbano" com foco em eventos, hospedagem, comercio e oportunidades.

Produto:

- painel de eventos e impacto economico;
- mapa de bairros/venues com maior potencial;
- relatorios mensais para entidades;
- indice de oportunidade turistica;
- material para captacao de eventos.

Compradores:

- entidades de turismo;
- conventions bureaus;
- secretarias;
- associacoes empresariais;
- Sebrae/local.

Por que e interessante:

- Da reputacao institucional.
- Ajuda em PR e autoridade.
- Pode abrir portas para varios setores.

Risco:

- Venda publica/institucional e lenta.
- Pode virar projeto politico/consultivo demais.
- Margem e previsibilidade podem ser piores que B2B privado.

Veredito:

Bom para autoridade e parcerias, ruim como primeiro motor comercial.

### 4.13 Fintech, credito e underwriting de receita local

Tese:

Se a Urban aprende a prever demanda e receita futura por geografia, isso pode ajudar credito para operadores de hospedagem, restaurantes, eventos, bares, fornecedores e pequenos negocios locais.

Produto:

- score de oportunidade/risco de receita;
- relatorio para antecipacao de recebiveis;
- sinal alternativo para underwriting;
- monitoramento de carteira por cidade/bairro.

Compradores:

- fintechs;
- credores;
- plataformas de antecipacao;
- bancos com carteira SMB;
- seguradoras de credito.

Por que e interessante:

- Alto valor quando houver base historica.
- A Urban vira sinal alternativo de receita futura.
- Pode ser vendido como API.

Risco:

- Precisa de historico forte e validacao estatistica.
- Alto risco reputacional se score for mal usado.
- Nao e tese para agora.

Veredito:

Futuro de alto potencial, dependente de outcomes reais e governanca.

### 4.14 Auditoria de IA, governanca e decisao automatizada

Tese:

A Urban ja esta criando uma cultura de decision snapshots, runbooks, auditoria, logs, qualidade e release gates. Essa competencia pode virar produto ou servico para empresas que precisam demonstrar por que uma IA recomendou uma acao.

Produto:

- camada de auditabilidade para decisoes de pricing;
- relatorio de qualidade de modelo;
- trilha de decisao para operacoes com IA;
- playbook de governanca de IA aplicada a receita.

Compradores:

- empresas usando pricing dinamico;
- plataformas B2B com IA;
- setores regulados que precisam explicar recomendacoes;
- startups em due diligence.

Por que e interessante:

- Pouco obvio e bastante valioso.
- Aproveita um diferencial real da Urban: documentacao e operacao.
- Pode ser consultivo no inicio.

Risco:

- Pode tirar foco do produto central.
- Requer posicionamento muito claro para nao virar consultoria generica.

Veredito:

Nao e beachhead, mas e um "ativo de credibilidade" para investidores e clientes enterprise.

## 5. Matriz de atratividade

Escala: 1 = baixo, 5 = alto.  
Esforco: 1 = facil, 5 = dificil.  
Prioridade: A = testar cedo; B = manter em pipeline; C = tese futura.

| Setor | Fit com ativos Urban | Valor ao cliente | Lucratividade | Facilidade de entrada | Esforco | Prioridade | MVP sugerido |
|---|---:|---:|---:|---:|---:|---|---|
| Midia OOH/DOOH/retail media | 4 | 5 | 5 | 3 | 3 | A | Relatorio semanal de oportunidades de midia por evento |
| Ativacao, patrocinio e live marketing | 4 | 4 | 5 | 3 | 2 | A | Ranking de eventos para marcas e agencias |
| Staffing, seguranca e limpeza | 4 | 4 | 4 | 3 | 2 | A | Radar de demanda operacional por semana |
| Estacionamentos e valets | 4 | 4 | 4 | 2 | 3 | A/B | Calendario por unidade + faixa de preco |
| Restaurantes, bares e franquias | 3 | 4 | 3 | 3 | 3 | B | Alertas de demanda para grupos/food halls |
| Distribuidores e foodservice B2B | 3 | 4 | 4 | 3 | 3 | B | Lista de eventos para pre-venda e rota |
| Real estate comercial/site selection | 3 | 5 | 5 | 2 | 4 | B | Urban Location Score por microzona |
| Turismo corporativo/procurement | 3 | 4 | 3 | 3 | 2 | B | Calendario de compressao de cidade |
| Organizadores, venues e centros de convencao | 4 | 4 | 4 | 2 | 3 | B | Relatorio de impacto urbano do evento |
| Turismo/DMOs/desenvolvimento economico | 4 | 4 | 3 | 1 | 4 | B/C | Radar economico mensal por cidade |
| Seguros e risco urbano | 3 | 4 | 5 | 1 | 5 | C | Score de risco por evento/microzona |
| Telecom/conectividade | 3 | 5 | 5 | 1 | 5 | C | API de eventos de alta concentracao |
| Fintech/credito/underwriting | 3 | 5 | 5 | 1 | 5 | C | Sinal alternativo de demanda futura |
| Auditoria de IA/governanca | 4 | 4 | 4 | 2 | 4 | C | Playbook e trilha de decisao auditavel |

## 6. Ranking por tipo de pergunta

### Onde a Urban pode gerar maior valor agregado fora de hosts?

1. Midia OOH/DOOH/retail media: verba grande, necessidade de planejamento por lugar e momento.
2. Staffing/seguranca/limpeza: evento vira escala, custo e receita quase imediatamente.
3. Ativacao/patrocinio/live marketing: dados viram estrategia de marca e podem ser vendidos caro.
4. Estacionamentos/valets: fit natural com dynamic pricing e eventos.
5. Real estate comercial/site selection: decisao de alto valor, mas precisa mais dados.

### Onde pode ser mais lucrativo?

1. Midia, retail media e brand activation.
2. Real estate/site selection.
3. Telecom/conectividade, no longo prazo.
4. Seguros/risco e fintech/credito, no longo prazo.
5. Estacionamentos em rede ou plataformas de vaga.

### Onde seria mais simples de penetrar?

1. Relatorios premium para agencias de ativacao e midia.
2. Relatorios de demanda para staffing/seguranca/limpeza.
3. Alertas para grupos de restaurantes/food halls, nao restaurantes soltos.
4. Estacionamentos independentes proximos a arenas, se houver contato direto.
5. Relatorios para organizadores/venues.

### Onde e mais perigoso perder foco?

1. Restaurantes pequenos, um a um.
2. Prefeitura e setor publico como primeira receita.
3. Telecom enterprise sem parceiro.
4. Seguros/credito antes de dataset historico robusto.
5. Criar app B2C de eventos.

## 7. Beachheads nao obvios recomendados

### Beachhead nao obvio 1 - Urban Event Media Brief

Cliente inicial:

- agencias de midia;
- agencias de ativacao;
- redes OOH/DOOH;
- marcas com ativacao local em Sao Paulo.

Oferta:

- relatorio semanal/mensal com os eventos que mais importam para midia;
- ranking por bairro, venue, categoria e intensidade;
- sugestao de janelas de campanha;
- oportunidades por perfil de marca.

Por que comecar aqui:

- Nao exige integracao tecnica pesada.
- Pode ser vendido com material executivo forte.
- Conecta com um mercado que ja compra dados e planejamento.
- Ajuda a Urban a provar que seu radar vale dinheiro fora de hospedagem.

MVP de 14 dias:

- gerar um PDF/demo para Sao Paulo;
- incluir top eventos dos proximos 30/60 dias;
- criar 5 perfis de marca: bebidas, mobilidade, moda, turismo, tecnologia;
- enviar para 15 contatos de agencias/redes;
- medir resposta, pedidos de customizacao e disposicao a pagar.

Preco-teste:

- R$ 1.500 a R$ 5.000 por relatorio customizado;
- ou R$ 799 a R$ 2.500/mes para brief recorrente inicial.

### Beachhead nao obvio 2 - Radar Operacional para Staffing e Facilities

Cliente inicial:

- seguranca privada;
- limpeza/facilities;
- agencias de promotores;
- empresas de staff e recepcao;
- fornecedores de montagem e apoio.

Oferta:

- radar semanal de eventos por regiao;
- lista de eventos que merecem abordagem comercial;
- alerta de demanda por categoria;
- painel/planilha exportavel para vendedores e gestores de escala.

Por que comecar aqui:

- Evento gera demanda direta de equipe.
- O produto pode ser simples: dados + ranking + acao sugerida.
- O cliente entende rapido: "onde devo vender e escalar gente?".

MVP de 14 dias:

- escolher 50 a 100 eventos relevantes em SP;
- classificar por porte, regiao e tipo de demanda;
- entregar relatorio para 5 empresas;
- perguntar se usariam para prospeccao, escala ou precificacao de proposta.

Preco-teste:

- R$ 499 a R$ 1.500/mes por cidade;
- pacote maior para rede multi-cidade.

### Beachhead nao obvio 3 - Parking & Venue Demand Radar

Cliente inicial:

- estacionamentos perto de Allianz Parque, Anhembi, Expo Center Norte, Interlagos, Ibirapuera e grandes casas de show;
- redes de estacionamento;
- shoppings com eventos proximos.

Oferta:

- calendario de eventos por unidade;
- score de lotacao esperada;
- sugestao de preco/faixa;
- alerta de equipe e campanha.

Por que comecar aqui:

- E o setor mais parecido com pricing de hospedagem.
- O valor e simples de explicar: em evento grande, vaga vale mais.
- Pode virar parceria/API no futuro.

Risco:

- Se for vender estacionamento por estacionamento, vira venda pulverizada.
- Melhor achar rede, sindicato, shopping ou plataforma parceira.

## 8. Pacotes de produto possiveis

### Pacote 1 - Urban Event Intelligence API

Para quem:

- PMS;
- midia;
- plataformas de vaga;
- travel tech;
- agencias;
- portais de turismo.

Entrega:

- eventos normalizados;
- geolocalizacao;
- score de relevancia;
- categoria;
- impacto por microzona;
- webhooks de novos eventos relevantes.

Modelo de receita:

- assinatura API por cidade;
- volume de chamadas;
- pacote enterprise.

### Pacote 2 - Urban Demand Brief

Para quem:

- agencias;
- marcas;
- operadores;
- entidades;
- investidores.

Entrega:

- relatorio semanal/mensal;
- ranking de eventos;
- oportunidades por setor;
- mapas e recomendacoes;
- narrativa executiva.

Modelo de receita:

- assinatura mensal;
- relatorio avulso premium;
- customizacao por cidade/setor.

### Pacote 3 - Urban Operations Radar

Para quem:

- staffing;
- seguranca;
- limpeza;
- restaurantes/grupos;
- estacionamentos;
- distribuidores.

Entrega:

- alertas de demanda por unidade/regiao;
- recomendacao de acao;
- exportacao para comercial/operacao;
- painel simples.

Modelo de receita:

- SaaS por cidade/unidade;
- planos por numero de regioes monitoradas;
- conta B2B com usuarios internos.

### Pacote 4 - Urban Location Score

Para quem:

- investidores;
- franqueadoras;
- consultorias imobiliarias;
- varejo;
- midia OOH.

Entrega:

- score de localizacao;
- densidade e recorrencia de eventos;
- calendario de demanda;
- comparativo entre microzonas;
- relatorio de decisao.

Modelo de receita:

- relatorio premium por regiao;
- assinatura para pipeline de expansao;
- API de score.

## 9. Sequencia recomendada

### Proximos 30 dias

Criar tres demos nao-obvios, sem alterar produto principal:

1. `Urban Event Media Brief - Sao Paulo`
2. `Urban Staffing & Facilities Radar - Sao Paulo`
3. `Urban Parking Demand Radar - Sao Paulo`

Cada demo deve ter:

- eventos dos proximos 30/60 dias;
- mapa por bairro/venue;
- top oportunidades;
- recomendacoes de acao;
- score simples;
- pagina executiva de "por que isso vale dinheiro".

Meta:

- 15 conversas com agencias/midia;
- 10 conversas com staffing/facilities;
- 10 conversas com estacionamento/venues;
- registrar frases exatas dos compradores;
- medir qual mercado entende o valor mais rapido.

### 30 a 60 dias

Escolher uma frente nao obvia para piloto pago ou semi-pago.

Criterios:

- quem pediu recorrencia;
- quem pediu customizacao;
- quem tem verba;
- quem aceitou compartilhar dados;
- quem encurta ciclo de venda;
- quem reforca a tese principal da Urban para investidores.

### 60 a 90 dias

Decidir se a frente nao-obvia vira:

- produto separado;
- modulo do produto principal;
- relatorio premium;
- API;
- parceria;
- apenas tese de investidor.

## 10. Conclusao estrategica

A Urban tem uma oportunidade maior que hospedagem, mas nao deve tentar virar uma plataforma generica de "smart city" agora. Esse caminho e bonito em apresentacao, mas perigoso na execucao.

O caminho mais inteligente e:

1. manter hospedagem/STR como core e fonte de prova economica;
2. empacotar a mesma inteligencia de eventos em relatorios premium para setores adjacentes;
3. testar compradores nao-obvios sem construir software novo demais;
4. transformar o que tiver tracao em API ou modulo recorrente.

Meu ranking pessoal para explorar fora de hosts:

| Rank | Frente | Motivo |
|---:|---|---|
| 1 | Midia OOH/DOOH, retail media e ativacao | Alto ticket, usa dados atuais, nao exige integracao no MVP |
| 2 | Staffing, seguranca, limpeza e facilities | Dor direta, evento vira escala e venda |
| 3 | Estacionamentos/valets perto de venues | Melhor fit com dynamic pricing fora de hospedagem |
| 4 | Distribuidores e foodservice B2B | Tese subestimada: evento vira pre-venda e rota |
| 5 | Real estate comercial/site selection | Muito valor, mas precisa dados complementares |

Frase de posicionamento para essa expansao:

> A Urban AI transforma eventos da cidade em inteligencia acionavel para receita, operacao e investimento.

