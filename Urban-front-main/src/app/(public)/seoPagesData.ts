import type { SeoCaseStudy, SeoContent } from "./seoContent";

type ValidationCaseStudyInput = {
  title: string;
  summary: string;
  source: string;
  sample: string;
  validationNote: string;
  period?: string;
};

function validationCaseStudy({
  title,
  summary,
  source,
  sample,
  validationNote,
  period = "Em definicao apos coleta assistida e revisao do responsavel.",
}: ValidationCaseStudyInput): SeoCaseStudy {
  return {
    title,
    summary,
    source,
    period,
    sample,
    status: "em_validacao",
    validationNote,
  };
}

export const dynamicPricingAirbnb: SeoContent = {
  path: "/precificacao-dinamica-airbnb",
  title: "Precificacao dinamica para Airbnb - Urban AI",
  description:
    "Entenda como precificacao dinamica para Airbnb usa eventos, demanda local e dados do imovel para orientar diarias.",
  eyebrow: "Guia - Airbnb pricing",
  h1: "Precificacao dinamica para Airbnb",
  lead:
    "Precificacao dinamica para Airbnb e o processo de ajustar diarias conforme demanda, antecedencia, eventos, sazonalidade e desempenho do imovel.",
  answer:
    "A Urban AI ajuda anfitrioes a precificar com mais contexto: ela cruza eventos urbanos, localizacao, janela de antecedencia e sinais de mercado para sugerir quando uma diaria pode subir, cair ou permanecer estavel.",
  directAnswers: [
    {
      question: "O que e precificacao dinamica para Airbnb?",
      answer:
        "Precificacao dinamica para Airbnb e a revisao recorrente da diaria com base em demanda, calendario, antecedencia, caracteristicas do imovel e sinais locais observaveis.",
    },
    {
      question: "Quando a IA deve recomendar subir ou reduzir a diaria?",
      answer:
        "A IA deve recomendar ajuste quando encontra mudanca relevante no contexto, como evento proximo, feriado, baixa procura, alta antecedencia ou risco de ficar fora da faixa de comparaveis.",
    },
  ],
  sections: [
    {
      title: "O problema",
      body:
        "Muitos anfitrioes definem uma diaria media e so revisam quando o calendario ja ficou vazio ou lotou cedo demais. Isso pode fazer datas de alta demanda serem tratadas como datas comuns.",
    },
    {
      title: "Como a IA entra",
      body:
        "A IA combina dados do imovel, comportamento do bairro e calendario de eventos. A recomendacao nao substitui a decisao do anfitriao; ela reduz incerteza.",
    },
    {
      title: "Quando vale mais",
      body:
        "A necessidade de revisao tende a ser maior em cidades com muitos eventos, feriados regionais, shows, congressos e variacao forte de procura por bairro.",
    },
  ],
  evidence: [
    {
      title: "Sinais usados na recomendacao",
      body:
        "A leitura parte de informacoes rastreaveis: dados do imovel, calendario de disponibilidade, janela de antecedencia, eventos publicos e sinais de mercado quando disponiveis.",
    },
    {
      title: "Separacao entre sugestao e execucao",
      body:
        "A pagina declara que recomendacao e automacao sao fluxos diferentes. O anfitriao pode revisar a justificativa antes de aplicar o preco.",
    },
    {
      title: "Sem promessa de resultado garantido",
      body:
        "As respostas evitam promessa de aumento automatico de receita. A proposta e reduzir incerteza e tornar a decisao mais explicavel.",
    },
  ],
  methodology: [
    {
      title: "1. Normalizar o contexto",
      body:
        "O primeiro passo e organizar bairro, tipo de imovel, capacidade, calendario, regras do anuncio e historico operacional informado pelo anfitriao.",
    },
    {
      title: "2. Ler a demanda local",
      body:
        "Depois, o motor procura sinais externos que alteram a procura, como eventos, feriados, sazonalidade e mudancas de comportamento por antecedencia.",
    },
    {
      title: "3. Explicar a recomendacao",
      body:
        "A sugestao deve apontar o motivo do ajuste, o tipo de sinal observado e os limites que protegem a decisao comercial do anfitriao.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Recomendacao assistida por evento urbano",
      summary:
        "Slot para documentar uma recomendacao gerada a partir de evento, revisao humana e decisao de preco do anfitriao.",
      source:
        "Beta fechado assistido, AnalisePreco e PriceSnapshot, somente quando houver consentimento e vinculo entre recomendacao e imovel.",
      sample:
        "Amostra em formacao: imoveis com recomendacao, preco aplicado e snapshot associado.",
      validationNote:
        "Sem metrica publica enquanto a fonte, o periodo e a amostra nao forem revisados. Status atual: em validacao.",
    }),
    validationCaseStudy({
      title: "Comparacao entre preco recomendado e preco aplicado",
      summary:
        "Slot para comparar decisao sugerida, decisao aplicada e contexto operacional sem atribuir resultado automaticamente a IA.",
      source:
        "Historico operacional autorizado, aceite/rejeicao de recomendacao e registro de preco aplicado.",
      sample:
        "Amostra pendente de revisao: recomendacoes com decisao do usuario e dado de aplicacao rastreavel.",
      validationNote:
        "Qualquer numero futuro precisa separar correlacao, decisao humana e fatores externos antes de aparecer no site.",
    }),
  ],
  internalCtas: [
    {
      href: "/como-precificar-airbnb-em-dias-de-eventos",
      label: "Guia de eventos",
      description:
        "Veja como transformar shows, congressos, jogos e feriados em criterios praticos de preco.",
    },
    {
      href: "/integracao-stays-precificacao-automatica",
      label: "Automacao com Stays",
      description:
        "Entenda quando a recomendacao vira aplicacao automatica com consentimento, limites e historico.",
    },
    {
      href: "/urban-ai-vs-planilha-de-precificacao",
      label: "Comparativo",
      description:
        "Compare a leitura de IA com regras fixas de planilha para precificacao de curta temporada.",
    },
  ],
  faq: [
    {
      question: "Precificacao dinamica aumenta receita automaticamente?",
      answer:
        "Nao ha garantia automatica. Ela apoia a tomada de decisao ao mostrar datas com maior chance de demanda e riscos de subprecificacao.",
    },
    {
      question: "A Urban AI altera meu Airbnb sozinha?",
      answer:
        "No modo recomendacao, nao. O anfitriao recebe a sugestao e decide. A automacao via Stays exige consentimento e limites configurados.",
    },
    {
      question: "Qual o diferencial da Urban AI?",
      answer:
        "O foco e precificacao por eventos urbanos no Brasil, com prioridade inicial em Sao Paulo e Grande SP.",
    },
    {
      question: "A recomendacao substitui a estrategia do anfitriao?",
      answer:
        "Nao. A recomendacao organiza sinais e sugere uma faixa de acao, mas metas, custos, risco e posicionamento continuam sendo decisoes do anfitriao.",
    },
    {
      question: "Quais dados nao devem ser inventados pela IA?",
      answer:
        "A IA nao deve inventar ocupacao, receita, comparaveis ou impacto de eventos. Quando um dado nao esta disponivel, a resposta deve indicar a limitacao.",
    },
  ],
};

export const eventPricingGuide: SeoContent = {
  path: "/como-precificar-airbnb-em-dias-de-eventos",
  title: "Como precificar Airbnb em dias de eventos - Urban AI",
  description:
    "Guia pratico para ajustar diarias de Airbnb em shows, congressos, jogos, feriados e eventos perto do imovel.",
  eyebrow: "Guia pratico",
  h1: "Como precificar em dias de eventos",
  lead:
    "Dias de evento mudam a procura por bairro. A diaria ideal depende de distancia real, antecedencia, tipo de evento e comparaveis.",
  answer:
    "Para precificar Airbnb em dias de eventos, identifique o evento, estime a demanda local, compare imoveis similares, defina um teto de aumento e revise a ocupacao ate a data. A Urban AI automatiza essa leitura e transforma o contexto em recomendacao.",
  directAnswers: [
    {
      question: "Como precificar Airbnb em dia de evento?",
      answer:
        "Comece pelo evento, confirme distancia e acesso ate o imovel, compare anuncios semelhantes, defina limites de variacao e revise o preco conforme a data se aproxima.",
    },
    {
      question: "Qual criterio evita aumento de preco sem base?",
      answer:
        "O criterio principal e exigir uma justificativa observavel: evento real, proximidade util, publico compatível, calendario de disponibilidade e comparaveis coerentes.",
    },
  ],
  sections: [
    {
      title: "1. Confirme o raio de impacto",
      body:
        "Nem todo evento impacta toda a cidade. Eventos perto do imovel ou com facil acesso por transporte tendem a afetar mais a diaria.",
    },
    {
      title: "2. Ajuste por antecedencia",
      body:
        "Eventos anunciados cedo permitem subir preco com calma. Em datas proximas, a prioridade pode virar ocupacao e velocidade de reserva.",
    },
    {
      title: "3. Use limites",
      body:
        "Aumento sem teto pode reduzir conversao. A recomendacao deve respeitar historico do imovel, nota, cancelamento e qualidade do anuncio.",
    },
  ],
  evidence: [
    {
      title: "Evento identificavel",
      body:
        "A recomendacao deve partir de um evento com data, local e fonte publica ou operacional, evitando tratar boatos e datas genericas como demanda confirmada.",
    },
    {
      title: "Impacto por acesso, nao so por mapa",
      body:
        "A distancia em linha reta pode enganar. Transporte, tempo de deslocamento e barreiras urbanas ajudam a qualificar se o evento afeta o imovel.",
    },
    {
      title: "Limites comerciais",
      body:
        "O ajuste precisa respeitar teto, piso, posicionamento do anuncio, politica de cancelamento e objetivo de ocupacao definido pelo anfitriao.",
    },
  ],
  methodology: [
    {
      title: "1. Classificar o evento",
      body:
        "Separe shows, feiras, congressos, jogos, festivais e feriados, porque cada tipo muda a antecedencia e o perfil de hospede.",
    },
    {
      title: "2. Medir relevancia local",
      body:
        "Cruze local do evento, acesso, bairro do imovel, datas de entrada e saida provaveis e oferta alternativa na regiao.",
    },
    {
      title: "3. Revisar ate a data",
      body:
        "A primeira recomendacao nao precisa ser definitiva. O preco deve ser revisto conforme calendario, procura e risco de vacancia mudam.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Evento com impacto local confirmado",
      summary:
        "Slot para documentar quando um evento real gerou uma recomendacao revisada, com contexto de acesso e decisao do anfitriao.",
      source:
        "Fonte publica do evento, registro interno da recomendacao e decisao operacional autorizada pelo anfitriao.",
      sample:
        "Amostra em formacao: eventos com data, local, imovel elegivel e decisao registrada.",
      validationNote:
        "Nenhum percentual de ajuste e publicado enquanto a relacao entre evento, acesso e decisao nao estiver validada.",
    }),
    validationCaseStudy({
      title: "Evento monitorado sem ajuste publicado",
      summary:
        "Slot para mostrar que nem todo evento vira recomendacao, preservando o criterio de cautela quando o sinal e fraco.",
      source:
        "Agenda de eventos, criterio de distancia/acesso e registro de motivo para nao recomendar ajuste.",
      sample:
        "Amostra pendente: eventos avaliados e descartados com motivo rastreavel.",
      validationNote:
        "O status permanece em validacao ate haver revisao do criterio e registro suficiente para publicar o aprendizado.",
    }),
  ],
  internalCtas: [
    {
      href: "/precificacao-por-eventos-sao-paulo",
      label: "Sao Paulo",
      description:
        "Entenda por que eventos em Sao Paulo e Grande SP exigem leitura por bairro e acesso.",
    },
    {
      href: "/precificacao-dinamica-airbnb",
      label: "Precificacao dinamica",
      description:
        "Veja como eventos entram em uma estrategia mais ampla de ajuste recorrente de diaria.",
    },
    {
      href: "/precos",
      label: "Planos",
      description:
        "Conheca os planos publicos da Urban AI para anfitrioes e gestoras.",
    },
  ],
  faq: [
    {
      question: "Todo evento justifica aumentar diaria?",
      answer:
        "Nao. O impacto depende de tamanho, publico, distancia, acesso e conflito com outras datas de demanda.",
    },
    {
      question: "Quanto devo aumentar em dias de show?",
      answer:
        "Nao existe percentual unico. Um bom ponto de partida e comparar o imovel com similares e aplicar tetos por perfil de demanda.",
    },
    {
      question: "A Urban AI mostra o motivo da sugestao?",
      answer:
        "Sim. A recomendacao deve ser explicavel: evento, proximidade, janela e potenciais impactos no preco.",
    },
    {
      question: "Evento longe do imovel pode afetar preco?",
      answer:
        "Pode, mas apenas quando o acesso e facil ou quando a cidade tem baixa oferta alternativa para o publico daquele evento.",
    },
    {
      question: "Quando devo reduzir o preco mesmo em semana de evento?",
      answer:
        "A reducao pode fazer sentido se a data estiver proxima, o calendario seguir vazio, os comparaveis estiverem mais competitivos ou o evento nao impactar o bairro.",
    },
  ],
};

export const saoPauloEventsPricing: SeoContent = {
  path: "/precificacao-por-eventos-sao-paulo",
  title: "Precificacao por eventos em Sao Paulo - Urban AI",
  description:
    "Como eventos em Sao Paulo e Grande SP podem influenciar diarias de aluguel por temporada e Airbnb.",
  eyebrow: "Sao Paulo - Eventos",
  h1: "Eventos em Sao Paulo mudam a diaria",
  lead:
    "Sao Paulo concentra shows, feiras, congressos, jogos e festivais que deslocam demanda entre bairros e datas.",
  answer:
    "A Urban AI prioriza Sao Paulo e Grande SP porque a densidade de eventos torna a precificacao manual dificil. O sistema observa o calendario urbano e sinaliza datas em que a procura pode fugir do padrao.",
  directAnswers: [
    {
      question: "Por que eventos em Sao Paulo afetam o Airbnb?",
      answer:
        "Eventos em Sao Paulo afetam o Airbnb porque deslocam demanda por bairro, transporte e datas especificas, especialmente quando o hospede quer ficar perto do local ou de uma rota simples.",
    },
    {
      question: "Como a Urban AI avalia eventos em Sao Paulo?",
      answer:
        "A Urban AI cruza agenda urbana, localizacao do imovel, acesso, antecedencia e sinais de mercado para indicar se uma data merece atencao de preco.",
    },
  ],
  sections: [
    {
      title: "Eventos corporativos",
      body:
        "Feiras e congressos podem elevar procura em regioes com facil acesso a centros de convencoes e polos comerciais.",
    },
    {
      title: "Shows e estadios",
      body:
        "Grandes shows e jogos criam picos localizados. A distancia real e o transporte importam mais que a distancia em linha reta.",
    },
    {
      title: "Feriados e sazonalidade",
      body:
        "Feriados prolongados mudam o perfil de busca. Em alguns bairros a demanda sobe; em outros, pode cair.",
    },
  ],
  evidence: [
    {
      title: "Agenda urbana como ponto de partida",
      body:
        "A leitura considera eventos publicos e datas conhecidas, como shows, feiras, congressos, jogos e feriados, sem pressupor impacto igual para toda a cidade.",
    },
    {
      title: "Bairro e acesso como filtros",
      body:
        "Sao Paulo exige leitura por acesso real. Proximidade de metro, vias e polos de evento pode ser mais importante que a distancia em linha reta.",
    },
    {
      title: "Cobertura declarada",
      body:
        "A pagina deixa claro que a profundidade inicial esta em Sao Paulo e Grande SP, evitando afirmar cobertura nacional completa antes da expansao.",
    },
  ],
  methodology: [
    {
      title: "1. Mapear datas relevantes",
      body:
        "O calendario organiza eventos por data, tipo e local para separar demanda recorrente de picos especificos.",
    },
    {
      title: "2. Associar evento a micro-regiao",
      body:
        "Cada evento e avaliado contra bairros, rotas e perfil de hospedagem, em vez de gerar uma regra unica para Sao Paulo inteira.",
    },
    {
      title: "3. Sinalizar acao possivel",
      body:
        "A recomendacao indica se vale observar, ajustar preco, manter estrategia ou priorizar ocupacao conforme a janela de reserva.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Cobertura de eventos em Sao Paulo e Grande SP",
      summary:
        "Slot para registrar quais fontes de eventos foram usadas, quais datas foram cobertas e quais lacunas ficaram abertas.",
      source:
        "Coletores de eventos, fallback manual e evidencia de fonte publica quando disponivel.",
      sample:
        "Amostra em formacao: eventos classificados por data, tipo, local e fonte.",
      validationNote:
        "A cobertura publica deve continuar descrita como em validacao ate a amostra e a cadencia serem auditadas.",
    }),
    validationCaseStudy({
      title: "Leitura por bairro, acesso e micro-regiao",
      summary:
        "Slot para validar se a recomendacao diferencia bairros e rotas em vez de aplicar uma regra unica para a cidade.",
      source:
        "Dados do imovel, local do evento, criterio de acesso e revisao operacional registrada.",
      sample:
        "Amostra pendente: recomendacoes com bairro, rota relevante e justificativa da decisao.",
      validationNote:
        "Sem dado validado, a pagina deve apenas declarar o metodo e manter qualquer resultado como em validacao.",
    }),
  ],
  internalCtas: [
    {
      href: "/como-precificar-airbnb-em-dias-de-eventos",
      label: "Guia pratico",
      description:
        "Aprenda o passo a passo para transformar um evento em decisao de preco.",
    },
    {
      href: "/precificacao-dinamica-airbnb",
      label: "Airbnb pricing",
      description:
        "Entenda como eventos se combinam com antecedencia, sazonalidade e dados do imovel.",
    },
    {
      href: "/contato",
      label: "Contato",
      description:
        "Fale com a Urban AI sobre cobertura, integracoes e leitura de eventos para sua operacao.",
    },
  ],
  faq: [
    {
      question: "A cobertura da Urban AI ja e nacional?",
      answer:
        "A cobertura mais profunda comeca por Sao Paulo e Grande SP. Outras capitais entram conforme o pipeline de eventos amadurece.",
    },
    {
      question: "Eventos pequenos importam?",
      answer:
        "Alguns importam, especialmente se estao perto do imovel e atingem um publico com baixa oferta de hospedagem proxima.",
    },
    {
      question: "A Urban AI usa dados publicos de eventos?",
      answer:
        "Sim. O motor combina fontes publicas de eventos com dados do imovel e sinais de mercado.",
    },
    {
      question: "A mesma regra vale para todos os bairros de Sao Paulo?",
      answer:
        "Nao. A demanda pode variar por bairro, acesso, tipo de evento e perfil de hospede, por isso a recomendacao precisa ser localizada.",
    },
    {
      question: "Shows e congressos devem ter estrategias iguais?",
      answer:
        "Nao necessariamente. Shows podem concentrar demanda em uma noite; congressos podem gerar estadias mais longas e busca por acesso corporativo.",
    },
  ],
};

export const staysIntegrationPricing: SeoContent = {
  path: "/integracao-stays-precificacao-automatica",
  title: "Integracao Stays para precificacao automatica - Urban AI",
  description:
    "Entenda como a Urban AI usa integracao Stays para aplicar precos sugeridos com consentimento, limites e historico.",
  eyebrow: "Integracao Stays",
  h1: "Precificacao automatica com Stays",
  lead:
    "A integracao com Stays permite que recomendacoes aprovadas sejam aplicadas no canal de distribuicao respeitando limites definidos pelo anfitriao.",
  answer:
    "A Urban AI separa recomendacao de automacao. Primeiro, o sistema explica o preco sugerido. Depois, quando o anfitriao ativa a integracao, os ajustes podem ser enviados via Stays com tetos, consentimento e rastreabilidade.",
  directAnswers: [
    {
      question: "O que a integracao Stays permite na Urban AI?",
      answer:
        "A integracao Stays permite enviar precos aprovados ou automatizados para a operacao, respeitando consentimento, limites configurados e historico de aplicacao.",
    },
    {
      question: "A automacao deve aplicar qualquer sugestao de IA?",
      answer:
        "Nao. A automacao deve obedecer regras do usuario, como teto, piso, pausa manual e criterios de seguranca antes de alterar um preco.",
    },
  ],
  sections: [
    {
      title: "Modo recomendacao",
      body:
        "O anfitriao ve a sugestao no painel e decide se aplica manualmente. E o fluxo ideal para comecar com controle total.",
    },
    {
      title: "Modo automatico",
      body:
        "Quando ativado, o envio respeita regras de seguranca, como tetos de variacao e possibilidade de pausar a automacao.",
    },
    {
      title: "Historico e auditoria",
      body:
        "Cada sugestao e aplicacao deve ser rastreavel, com motivo, data e parametros usados na decisao.",
    },
  ],
  evidence: [
    {
      title: "Consentimento explicito",
      body:
        "A automacao depende de ativacao do usuario. Sem consentimento, a Urban AI deve permanecer no modo recomendacao.",
    },
    {
      title: "Limites configuraveis",
      body:
        "Tetos, pisos e pausas reduzem risco de aplicacao fora da estrategia comercial do anfitriao.",
    },
    {
      title: "Historico de decisoes",
      body:
        "Cada aplicacao precisa manter contexto minimo: data, motivo, origem da recomendacao e regra usada no envio.",
    },
  ],
  methodology: [
    {
      title: "1. Gerar recomendacao explicada",
      body:
        "Antes de qualquer envio, o sistema produz a sugestao com motivo, data afetada e criterio observado.",
    },
    {
      title: "2. Validar regra de automacao",
      body:
        "A integracao verifica se o ajuste esta dentro dos limites definidos pelo usuario e se a automacao esta ativa.",
    },
    {
      title: "3. Registrar aplicacao",
      body:
        "Quando o preco e enviado, o historico deve permitir auditoria e reversao operacional quando necessario.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Aplicacao via Stays com consentimento",
      summary:
        "Slot para documentar uma sugestao aprovada e enviada via integracao, com limites configurados e historico de aplicacao.",
      source:
        "Consentimento de integracao, PriceUpdate, regra de automacao e log operacional sem expor token ou dado sensivel.",
      sample:
        "Amostra em formacao: aplicacoes com consentimento, preco/data e status rastreavel.",
      validationNote:
        "Sem evidencia completa, a copy publica permanece em validacao e nao afirma melhoria automatica de receita.",
    }),
    validationCaseStudy({
      title: "Pausa ou reversao de automacao",
      summary:
        "Slot para validar que o usuario consegue interromper ou revisar a automacao quando a regra comercial muda.",
      source:
        "Historico de pausa, rollback ou rejeicao de envio, associado ao usuario e ao motivo operacional.",
      sample:
        "Amostra pendente: casos com acao de controle humano e status final registrado.",
      validationNote:
        "O case so pode sair de em validacao quando o fluxo for reproduzivel e revisado sem expor dado privado.",
    }),
  ],
  internalCtas: [
    {
      href: "/seguranca-lgpd-ia-precificacao",
      label: "Seguranca e LGPD",
      description:
        "Veja os principios de privacidade, controle do usuario e rastreabilidade da Urban AI.",
    },
    {
      href: "/precificacao-dinamica-airbnb",
      label: "Recomendacao",
      description:
        "Entenda a diferenca entre sugestao de preco e aplicacao automatica.",
    },
    {
      href: "/contato",
      label: "Falar com a Urban",
      description:
        "Converse sobre requisitos de integracao, operacao e limites de automacao.",
    },
  ],
  faq: [
    {
      question: "Preciso usar Stays para usar a Urban AI?",
      answer:
        "Nao. Stays e necessario apenas para fluxos de automacao. O modo recomendacao funciona sem integracao automatica.",
    },
    {
      question: "Posso pausar a automacao?",
      answer:
        "Sim. A automacao deve ser ativada, pausada ou desconectada pelo proprio usuario.",
    },
    {
      question: "A Urban AI faz scraping para aplicar preco?",
      answer:
        "A estrategia correta e integracao nativa quando disponivel, evitando hacks e fluxos frageis.",
    },
    {
      question: "O que acontece se eu pausar a integracao?",
      answer:
        "Ao pausar, a automacao deve deixar de enviar ajustes. As recomendacoes podem continuar visiveis para revisao manual.",
    },
    {
      question: "A integracao registra quem autorizou a automacao?",
      answer:
        "O fluxo deve manter rastreabilidade de ativacao, limites e aplicacoes para que o usuario entenda o que foi alterado e por que.",
    },
  ],
};

export const spreadsheetComparison: SeoContent = {
  path: "/urban-ai-vs-planilha-de-precificacao",
  title: "Urban AI vs planilha de precificacao - Urban AI",
  description:
    "Comparativo entre usar planilha para precificar Airbnb e usar IA com eventos, dados locais e recomendacoes explicaveis.",
  eyebrow: "Comparativo",
  h1: "Urban AI vs planilha de precificacao",
  lead:
    "Planilhas ajudam a organizar regras, mas ficam defasadas quando eventos, ocupacao e concorrencia mudam com velocidade.",
  answer:
    "A Urban AI nao substitui o raciocinio financeiro do anfitriao; ela substitui a parte repetitiva de observar calendario urbano, comparar sinais e transformar mudancas de demanda em recomendacoes acionaveis.",
  directAnswers: [
    {
      question: "Quando uma planilha de precificacao deixa de bastar?",
      answer:
        "A planilha deixa de bastar quando o anfitriao precisa atualizar muitas datas, muitos imoveis ou muitos sinais externos que mudam fora da rotina manual.",
    },
    {
      question: "O que a IA faz melhor que uma planilha fixa?",
      answer:
        "A IA consegue observar eventos, antecedencia, calendario e contexto local de forma recorrente, enquanto a planilha costuma depender de atualizacao manual.",
    },
  ],
  sections: [
    {
      title: "Planilha e boa para controle",
      body:
        "Ela funciona para custos, metas e regras fixas. O problema aparece quando a demanda muda diariamente.",
    },
    {
      title: "IA e boa para contexto",
      body:
        "O motor observa sinais externos que uma planilha raramente captura automaticamente, como eventos e mudancas no bairro.",
    },
    {
      title: "Melhor uso combinado",
      body:
        "A planilha continua util para metas. A Urban AI entra para alertar oportunidades e riscos que exigem atualizacao constante.",
    },
  ],
  evidence: [
    {
      title: "Regras fixas continuam uteis",
      body:
        "Custos, meta minima, margem desejada e restricoes operacionais podem continuar em planilha ou ERP da gestora.",
    },
    {
      title: "Sinais externos mudam com frequencia",
      body:
        "Eventos, procura por bairro, antecedencia e disponibilidade nao seguem uma regra estatica, por isso exigem revisao recorrente.",
    },
    {
      title: "Comparacao sem promessa absoluta",
      body:
        "A pagina nao afirma que IA sempre supera planilha. Ela delimita onde cada ferramenta tende a ajudar melhor.",
    },
  ],
  methodology: [
    {
      title: "1. Separar controle de contexto",
      body:
        "Use planilha para custos e metas internas; use o motor de IA para observar contexto externo e datas sensiveis.",
    },
    {
      title: "2. Priorizar excecoes",
      body:
        "Em vez de recalcular tudo manualmente, a recomendacao deve destacar datas com risco ou oportunidade fora do padrao.",
    },
    {
      title: "3. Manter decisao explicavel",
      body:
        "Cada sugestao precisa dizer qual sinal motivou o alerta, para que o anfitriao compare com sua propria regra financeira.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Rotina manual comparada com recomendacao explicavel",
      summary:
        "Slot para documentar como uma decisao antes feita em planilha foi revisada com apoio de contexto urbano e evento.",
      source:
        "Planilha ou regra operacional informada pelo anfitriao, recomendacao Urban AI e decisao aplicada.",
      sample:
        "Amostra em formacao: datas revisadas com regra original, sinal observado e decisao final.",
      validationNote:
        "A pagina nao deve afirmar substituicao superior da planilha sem case aprovado e consentimento de publicacao.",
    }),
    validationCaseStudy({
      title: "Data sensivel fora da rotina fixa",
      summary:
        "Slot para registrar datas em que o contexto externo exigiu revisao especifica, sem transformar isso em promessa de resultado.",
      source:
        "Calendario de eventos, disponibilidade do imovel e motivo da recomendacao.",
      sample:
        "Amostra pendente: datas com justificativa, decisao humana e resultado observado separado por fatores externos.",
      validationNote:
        "Qualquer numero futuro precisa mostrar fonte, periodo e amostra; ate la, o status publico e em validacao.",
    }),
  ],
  internalCtas: [
    {
      href: "/precificacao-dinamica-airbnb",
      label: "IA de preco",
      description:
        "Veja como a Urban AI transforma contexto urbano em recomendacoes de diaria.",
    },
    {
      href: "/como-precificar-airbnb-em-dias-de-eventos",
      label: "Eventos",
      description:
        "Aprenda quais eventos merecem ajuste e quais devem ser tratados com cautela.",
    },
    {
      href: "/precos",
      label: "Precos",
      description:
        "Compare os planos publicos da Urban AI com o custo operacional de manter regras manuais.",
    },
  ],
  faq: [
    {
      question: "Posso continuar usando minha planilha?",
      answer:
        "Sim. A Urban AI pode complementar a planilha, oferecendo alertas e recomendacoes para datas especificas.",
    },
    {
      question: "A Urban AI calcula custo operacional?",
      answer:
        "O foco principal e recomendacao de diaria com base em demanda e eventos. Custos internos continuam sendo referencia do anfitriao.",
    },
    {
      question: "Quando a planilha deixa de ser suficiente?",
      answer:
        "Quando ha muitos imoveis, muitas datas especiais ou mercado local mudando rapido demais para atualizar manualmente.",
    },
    {
      question: "A Urban AI substitui meu controle financeiro?",
      answer:
        "Nao. O controle financeiro interno continua sendo referencia do anfitriao. A Urban AI adiciona leitura de demanda e eventos.",
    },
    {
      question: "Planilha e IA podem discordar?",
      answer:
        "Sim. Quando isso acontece, a melhor pratica e revisar o motivo da recomendacao, o limite financeiro e o objetivo de ocupacao daquela data.",
    },
  ],
};

export const lgpdSecurityPricing: SeoContent = {
  path: "/seguranca-lgpd-ia-precificacao",
  title: "Seguranca, LGPD e IA na precificacao - Urban AI",
  description:
    "Como a Urban AI trata privacidade, seguranca, dados de imoveis e limites de IA para precificacao de aluguel por temporada.",
  eyebrow: "Seguranca e LGPD",
  h1: "IA de precificacao precisa de confianca",
  lead:
    "Ferramentas de precificacao lidam com dados de conta, imoveis, integracoes e decisoes comerciais. A protecao desses dados precisa ser clara.",
  answer:
    "A Urban AI trata IA como apoio a decisao. O usuario mantem controle sobre aplicacao de preco, consentimento de integracoes e solicitacoes de privacidade.",
  directAnswers: [
    {
      question: "Como a Urban AI posiciona IA na precificacao?",
      answer:
        "A Urban AI posiciona IA como apoio a decisao, com recomendacoes explicaveis, controle humano e limites configuraveis para automacao.",
    },
    {
      question: "Qual canal de privacidade da Urban AI?",
      answer:
        "O canal informado para solicitacoes de privacidade e privacidade@myurbanai.com, conforme a politica publicada no site.",
    },
  ],
  sections: [
    {
      title: "Dados usados",
      body:
        "A plataforma usa dados do imovel, sinais publicos de mercado, eventos e historico operacional necessario para gerar recomendacoes.",
    },
    {
      title: "Controle do usuario",
      body:
        "Mesmo quando ha automacao, o usuario deve poder configurar limites, pausar integracoes e revisar historico.",
    },
    {
      title: "Canal de privacidade",
      body:
        "Solicitacoes sobre dados pessoais podem ser enviadas para privacidade@myurbanai.com, conforme a politica publicada.",
    },
  ],
  evidence: [
    {
      title: "Politica publica como referencia",
      body:
        "A pagina aponta para principios alinhados a politicas publicadas: finalidade, controle do usuario, canal de privacidade e direitos do titular.",
    },
    {
      title: "Controle humano declarado",
      body:
        "A Urban AI descreve a IA como apoio a decisao, nao como decisor irreversivel de preco ou integracao.",
    },
    {
      title: "Dados relacionados a operacao",
      body:
        "Os dados citados estao ligados ao funcionamento da plataforma: imoveis, eventos, mercado, historico operacional e integracoes autorizadas.",
    },
  ],
  methodology: [
    {
      title: "1. Minimizar dados necessarios",
      body:
        "A recomendacao deve usar apenas dados relevantes para calcular, explicar e auditar precos e integracoes.",
    },
    {
      title: "2. Manter rastreabilidade",
      body:
        "Sugestoes, aplicacoes e limites precisam registrar motivo e contexto para que o usuario possa revisar decisoes.",
    },
    {
      title: "3. Preservar canais de escolha",
      body:
        "O usuario deve conseguir revisar recomendacoes, pausar automacao, desconectar integracoes e acionar o canal de privacidade.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Pedido LGPD tratado ponta a ponta",
      summary:
        "Slot para documentar solicitacao de privacidade recebida, classificada, respondida e registrada com evidencia.",
      source:
        "Ticket de privacidade, registro de resposta e checklist interno de suporte/LGPD.",
      sample:
        "Amostra em formacao: pedidos reais ou testes controlados identificados como teste.",
      validationNote:
        "Nenhum dado pessoal ou detalhe de titular deve aparecer no case publico; status atual: em validacao.",
    }),
    validationCaseStudy({
      title: "Auditoria de recomendacao com controle humano",
      summary:
        "Slot para validar se uma recomendacao pode ser explicada, revisada e associada aos limites definidos pelo usuario.",
      source:
        "Historico de recomendacao, motivo exibido, limite configurado e decisao do usuario.",
      sample:
        "Amostra pendente: recomendacoes auditaveis com motivo, data afetada e controle humano registrado.",
      validationNote:
        "A publicacao deve focar governanca e rastreabilidade; qualquer metrica fica bloqueada ate revisao.",
    }),
  ],
  internalCtas: [
    {
      href: "/privacidade",
      label: "Privacidade",
      description:
        "Leia a politica de privacidade publicada e os canais para solicitacoes de dados.",
    },
    {
      href: "/integracao-stays-precificacao-automatica",
      label: "Integracao Stays",
      description:
        "Entenda como consentimento, limites e historico entram na automacao de preco.",
    },
    {
      href: "/contato",
      label: "Contato",
      description:
        "Fale com a Urban AI sobre seguranca, privacidade e governanca de integracoes.",
    },
  ],
  faq: [
    {
      question: "A Urban AI vende meus dados?",
      answer:
        "A politica publicada informa que dados pessoais nao sao vendidos. O uso e voltado a operacao da plataforma e melhoria das recomendacoes.",
    },
    {
      question: "Posso pedir exclusao de dados?",
      answer:
        "Sim. A politica de privacidade descreve direitos do titular e o canal oficial para solicitacoes.",
    },
    {
      question: "A IA toma decisoes irreversiveis?",
      answer:
        "Nao deve. A Urban AI posiciona a IA como apoio a decisao, com controle humano e limites configuraveis.",
    },
    {
      question: "Que dados sao relevantes para precificacao?",
      answer:
        "Dados relevantes incluem informacoes do imovel, disponibilidade, eventos, sinais de mercado e historico operacional necessario para explicar recomendacoes.",
    },
    {
      question: "Como evitar recomendacoes opacas de IA?",
      answer:
        "A recomendacao deve mostrar motivo, sinal observado, data afetada e limite aplicado, permitindo revisao humana antes ou depois da aplicacao.",
    },
  ],
};
