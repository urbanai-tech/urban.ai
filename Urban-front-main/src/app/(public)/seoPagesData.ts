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
  period = "Em definição após coleta assistida e revisão do responsável.",
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
  title: "Precificação dinâmica para Airbnb - Urban AI",
  description:
    "Entenda como precificação dinâmica para Airbnb usa eventos, demanda local e dados do imóvel para orientar diárias.",
  eyebrow: "Guia - Airbnb pricing",
  h1: "Precificação dinâmica para Airbnb",
  lead:
    "Precificação dinâmica para Airbnb é o processo de ajustar diárias conforme demanda, antecedência, eventos, sazonalidade e desempenho do imóvel.",
  answer:
    "A Urban AI ajuda anfitriões a precificar com mais contexto: ela cruza eventos urbanos, localização, janela de antecedência e sinais de mercado para sugerir quando uma diária pode subir, cair ou permanecer estável.",
  directAnswers: [
    {
      question: "O que é precificação dinâmica para Airbnb?",
      answer:
        "Precificação dinâmica para Airbnb é a revisão recorrente da diária com base em demanda, calendário, antecedência, características do imóvel e sinais locais observáveis.",
    },
    {
      question: "Quando a IA deve recomendar subir ou reduzir a diária?",
      answer:
        "A IA deve recomendar ajuste quando encontra mudança relevante no contexto, como evento próximo, feriado, baixa procura, alta antecedência ou risco de ficar fora da faixa de comparáveis.",
    },
  ],
  sections: [
    {
      title: "O problema",
      body:
        "Muitos anfitriões definem uma diária média e só revisam quando o calendário já ficou vazio ou lotou cedo demais. Isso pode fazer datas de alta demanda serem tratadas como datas comuns.",
    },
    {
      title: "Como a IA entra",
      body:
        "A IA combina dados do imóvel, comportamento do bairro e calendário de eventos. A recomendação não substitui a decisão do anfitrião; ela reduz incerteza.",
    },
    {
      title: "Quando vale mais",
      body:
        "A necessidade de revisão tende a ser maior em cidades com muitos eventos, feriados regionais, shows, congressos e variação forte de procura por bairro.",
    },
  ],
  evidence: [
    {
      title: "Sinais usados na recomendação",
      body:
        "A leitura parte de informações rastreáveis: dados do imóvel, calendário de disponibilidade, janela de antecedência, eventos públicos e sinais de mercado quando disponíveis.",
    },
    {
      title: "Separação entre sugestão e execução",
      body:
        "A página declara que recomendação e automação são fluxos diferentes. O anfitrião pode revisar a justificativa antes de aplicar o preço.",
    },
    {
      title: "Sem promessa de resultado garantido",
      body:
        "As respostas evitam promessa de aumento automático de receita. A proposta é reduzir incerteza e tornar a decisão mais explicável.",
    },
  ],
  methodology: [
    {
      title: "1. Normalizar o contexto",
      body:
        "O primeiro passo é organizar bairro, tipo de imóvel, capacidade, calendário, regras do anúncio e histórico operacional informado pelo anfitrião.",
    },
    {
      title: "2. Ler a demanda local",
      body:
        "Depois, o motor procura sinais externos que alteram a procura, como eventos, feriados, sazonalidade e mudanças de comportamento por antecedência.",
    },
    {
      title: "3. Explicar a recomendação",
      body:
        "A sugestão deve apontar o motivo do ajuste, o tipo de sinal observado e os limites que protegem a decisão comercial do anfitrião.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Recomendação assistida por evento urbano",
      summary:
        "Slot para documentar uma recomendação gerada a partir de evento, revisão humana e decisão de preço do anfitrião.",
      source:
        "Beta fechado assistido, AnalisePreco e PriceSnapshot, somente quando houver consentimento e vínculo entre recomendação e imóvel.",
      sample:
        "Amostra em formação: imóveis com recomendação, preço aplicado e snapshot associado.",
      validationNote:
        "Sem métrica pública enquanto a fonte, o período e a amostra não forem revisados. Status atual: em validação.",
    }),
    validationCaseStudy({
      title: "Comparação entre preço recomendado e preço aplicado",
      summary:
        "Slot para comparar decisão sugerida, decisão aplicada e contexto operacional sem atribuir resultado automaticamente à IA.",
      source:
        "Histórico operacional autorizado, aceite/rejeição de recomendação e registro de preço aplicado.",
      sample:
        "Amostra pendente de revisão: recomendações com decisão do usuário e dado de aplicação rastreável.",
      validationNote:
        "Qualquer número futuro precisa separar correlação, decisão humana e fatores externos antes de aparecer no site.",
    }),
  ],
  internalCtas: [
    {
      href: "/como-precificar-airbnb-em-dias-de-eventos",
      label: "Guia de eventos",
      description:
        "Veja como transformar shows, congressos, jogos e feriados em critérios práticos de preço.",
    },
    {
      href: "/integracao-stays-precificacao-automatica",
      label: "Automação com Stays",
      description:
        "Entenda quando a recomendação vira aplicação automática com consentimento, limites e histórico.",
    },
    {
      href: "/urban-ai-vs-planilha-de-precificacao",
      label: "Comparativo",
      description:
        "Compare a leitura de IA com regras fixas de planilha para precificação de curta temporada.",
    },
  ],
  faq: [
    {
      question: "Precificação dinâmica aumenta receita automaticamente?",
      answer:
        "Não há garantia automática. Ela apoia a tomada de decisão ao mostrar datas com maior chance de demanda e riscos de subprecificação.",
    },
    {
      question: "A Urban AI altera meu Airbnb sozinha?",
      answer:
        "No modo recomendação, não. O anfitrião recebe a sugestão e decide. A automação via Stays exige consentimento e limites configurados.",
    },
    {
      question: "Qual o diferencial da Urban AI?",
      answer:
        "O foco é precificação por eventos urbanos no Brasil, com prioridade inicial em São Paulo e Grande SP.",
    },
    {
      question: "A recomendação substitui a estratégia do anfitrião?",
      answer:
        "Não. A recomendação organiza sinais e sugere uma faixa de ação, mas metas, custos, risco e posicionamento continuam sendo decisões do anfitrião.",
    },
    {
      question: "Quais dados não devem ser inventados pela IA?",
      answer:
        "A IA não deve inventar ocupação, receita, comparáveis ou impacto de eventos. Quando um dado não está disponível, a resposta deve indicar a limitação.",
    },
  ],
};

export const eventPricingGuide: SeoContent = {
  path: "/como-precificar-airbnb-em-dias-de-eventos",
  title: "Como precificar Airbnb em dias de eventos - Urban AI",
  description:
    "Guia prático para ajustar diárias de Airbnb em shows, congressos, jogos, feriados e eventos perto do imóvel.",
  eyebrow: "Guia prático",
  h1: "Como precificar em dias de eventos",
  lead:
    "Dias de evento mudam a procura por bairro. A diária ideal depende de distância real, antecedência, tipo de evento e comparáveis.",
  answer:
    "Para precificar Airbnb em dias de eventos, identifique o evento, estime a demanda local, compare imóveis similares, defina um teto de aumento e revise a ocupação até a data. A Urban AI automatiza essa leitura e transforma o contexto em recomendação.",
  directAnswers: [
    {
      question: "Como precificar Airbnb em dia de evento?",
      answer:
        "Comece pelo evento, confirme distância e acesso até o imóvel, compare anúncios semelhantes, defina limites de variação e revise o preço conforme a data se aproxima.",
    },
    {
      question: "Qual critério evita aumento de preço sem base?",
      answer:
        "O critério principal é exigir uma justificativa observável: evento real, proximidade útil, público compatível, calendário de disponibilidade e comparáveis coerentes.",
    },
  ],
  sections: [
    {
      title: "1. Confirme o raio de impacto",
      body:
        "Nem todo evento impacta toda a cidade. Eventos perto do imóvel ou com fácil acesso por transporte tendem a afetar mais a diária.",
    },
    {
      title: "2. Ajuste por antecedência",
      body:
        "Eventos anunciados cedo permitem subir preço com calma. Em datas próximas, a prioridade pode virar ocupação e velocidade de reserva.",
    },
    {
      title: "3. Use limites",
      body:
        "Aumento sem teto pode reduzir conversão. A recomendação deve respeitar histórico do imóvel, nota, cancelamento e qualidade do anúncio.",
    },
  ],
  evidence: [
    {
      title: "Evento identificável",
      body:
        "A recomendação deve partir de um evento com data, local e fonte pública ou operacional, evitando tratar boatos e datas genéricas como demanda confirmada.",
    },
    {
      title: "Impacto por acesso, não só por mapa",
      body:
        "A distância em linha reta pode enganar. Transporte, tempo de deslocamento e barreiras urbanas ajudam a qualificar se o evento afeta o imóvel.",
    },
    {
      title: "Limites comerciais",
      body:
        "O ajuste precisa respeitar teto, piso, posicionamento do anúncio, política de cancelamento e objetivo de ocupação definido pelo anfitrião.",
    },
  ],
  methodology: [
    {
      title: "1. Classificar o evento",
      body:
        "Separe shows, feiras, congressos, jogos, festivais e feriados, porque cada tipo muda a antecedência e o perfil de hóspede.",
    },
    {
      title: "2. Medir relevância local",
      body:
        "Cruze local do evento, acesso, bairro do imóvel, datas de entrada e saída prováveis e oferta alternativa na região.",
    },
    {
      title: "3. Revisar até a data",
      body:
        "A primeira recomendação não precisa ser definitiva. O preço deve ser revisto conforme calendário, procura e risco de vacância mudam.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Evento com impacto local confirmado",
      summary:
        "Slot para documentar quando um evento real gerou uma recomendação revisada, com contexto de acesso e decisão do anfitrião.",
      source:
        "Fonte pública do evento, registro interno da recomendação e decisão operacional autorizada pelo anfitrião.",
      sample:
        "Amostra em formação: eventos com data, local, imóvel elegível e decisão registrada.",
      validationNote:
        "Nenhum percentual de ajuste é publicado enquanto a relação entre evento, acesso e decisão não estiver validada.",
    }),
    validationCaseStudy({
      title: "Evento monitorado sem ajuste publicado",
      summary:
        "Slot para mostrar que nem todo evento vira recomendação, preservando o critério de cautela quando o sinal é fraco.",
      source:
        "Agenda de eventos, critério de distância/acesso e registro de motivo para não recomendar ajuste.",
      sample:
        "Amostra pendente: eventos avaliados e descartados com motivo rastreável.",
      validationNote:
        "O status permanece em validação até haver revisão do critério e registro suficiente para publicar o aprendizado.",
    }),
  ],
  internalCtas: [
    {
      href: "/precificacao-por-eventos-sao-paulo",
      label: "São Paulo",
      description:
        "Entenda por que eventos em São Paulo e Grande SP exigem leitura por bairro e acesso.",
    },
    {
      href: "/precificacao-dinamica-airbnb",
      label: "Precificação dinâmica",
      description:
        "Veja como eventos entram em uma estratégia mais ampla de ajuste recorrente de diária.",
    },
    {
      href: "/precos",
      label: "Planos",
      description:
        "Conheça os planos públicos da Urban AI para anfitriões e gestoras.",
    },
  ],
  faq: [
    {
      question: "Todo evento justifica aumentar diária?",
      answer:
        "Não. O impacto depende de tamanho, público, distância, acesso e conflito com outras datas de demanda.",
    },
    {
      question: "Quanto devo aumentar em dias de show?",
      answer:
        "Não existe percentual único. Um bom ponto de partida é comparar o imóvel com similares e aplicar tetos por perfil de demanda.",
    },
    {
      question: "A Urban AI mostra o motivo da sugestão?",
      answer:
        "Sim. A recomendação deve ser explicável: evento, proximidade, janela e potenciais impactos no preço.",
    },
    {
      question: "Evento longe do imóvel pode afetar preço?",
      answer:
        "Pode, mas apenas quando o acesso é fácil ou quando a cidade tem baixa oferta alternativa para o público daquele evento.",
    },
    {
      question: "Quando devo reduzir o preço mesmo em semana de evento?",
      answer:
        "A redução pode fazer sentido se a data estiver próxima, o calendário seguir vazio, os comparáveis estiverem mais competitivos ou o evento não impactar o bairro.",
    },
  ],
};

export const saoPauloEventsPricing: SeoContent = {
  path: "/precificacao-por-eventos-sao-paulo",
  title: "Precificação por eventos em São Paulo - Urban AI",
  description:
    "Como eventos em São Paulo e Grande SP podem influenciar diárias de aluguel por temporada e Airbnb.",
  eyebrow: "São Paulo - Eventos",
  h1: "Eventos em São Paulo mudam a diária",
  lead:
    "São Paulo concentra shows, feiras, congressos, jogos e festivais que deslocam demanda entre bairros e datas.",
  answer:
    "A Urban AI prioriza São Paulo e Grande SP porque a densidade de eventos torna a precificação manual difícil. O sistema observa o calendário urbano e sinaliza datas em que a procura pode fugir do padrão.",
  directAnswers: [
    {
      question: "Por que eventos em São Paulo afetam o Airbnb?",
      answer:
        "Eventos em São Paulo afetam o Airbnb porque deslocam demanda por bairro, transporte e datas específicas, especialmente quando o hóspede quer ficar perto do local ou de uma rota simples.",
    },
    {
      question: "Como a Urban AI avalia eventos em São Paulo?",
      answer:
        "A Urban AI cruza agenda urbana, localização do imóvel, acesso, antecedência e sinais de mercado para indicar se uma data merece atenção de preço.",
    },
  ],
  sections: [
    {
      title: "Eventos corporativos",
      body:
        "Feiras e congressos podem elevar procura em regiões com fácil acesso a centros de convenções e polos comerciais.",
    },
    {
      title: "Shows e estádios",
      body:
        "Grandes shows e jogos criam picos localizados. A distância real e o transporte importam mais que a distância em linha reta.",
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
        "A leitura considera eventos públicos e datas conhecidas, como shows, feiras, congressos, jogos e feriados, sem pressupor impacto igual para toda a cidade.",
    },
    {
      title: "Bairro e acesso como filtros",
      body:
        "São Paulo exige leitura por acesso real. Proximidade de metrô, vias e polos de evento pode ser mais importante que a distância em linha reta.",
    },
    {
      title: "Cobertura declarada",
      body:
        "A página deixa claro que a profundidade inicial está em São Paulo e Grande SP, evitando afirmar cobertura nacional completa antes da expansão.",
    },
  ],
  methodology: [
    {
      title: "1. Mapear datas relevantes",
      body:
        "O calendário organiza eventos por data, tipo e local para separar demanda recorrente de picos específicos.",
    },
    {
      title: "2. Associar evento a micro-região",
      body:
        "Cada evento é avaliado contra bairros, rotas e perfil de hospedagem, em vez de gerar uma regra única para São Paulo inteira.",
    },
    {
      title: "3. Sinalizar ação possível",
      body:
        "A recomendação indica se vale observar, ajustar preço, manter estratégia ou priorizar ocupação conforme a janela de reserva.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Cobertura de eventos em São Paulo e Grande SP",
      summary:
        "Slot para registrar quais fontes de eventos foram usadas, quais datas foram cobertas e quais lacunas ficaram abertas.",
      source:
        "Coletores de eventos, fallback manual e evidência de fonte pública quando disponível.",
      sample:
        "Amostra em formação: eventos classificados por data, tipo, local e fonte.",
      validationNote:
        "A cobertura pública deve continuar descrita como em validação até a amostra e a cadência serem auditadas.",
    }),
    validationCaseStudy({
      title: "Leitura por bairro, acesso e micro-região",
      summary:
        "Slot para validar se a recomendação diferencia bairros e rotas em vez de aplicar uma regra única para a cidade.",
      source:
        "Dados do imóvel, local do evento, critério de acesso e revisão operacional registrada.",
      sample:
        "Amostra pendente: recomendações com bairro, rota relevante e justificativa da decisão.",
      validationNote:
        "Sem dado validado, a página deve apenas declarar o método e manter qualquer resultado como em validação.",
    }),
  ],
  internalCtas: [
    {
      href: "/como-precificar-airbnb-em-dias-de-eventos",
      label: "Guia prático",
      description:
        "Aprenda o passo a passo para transformar um evento em decisão de preço.",
    },
    {
      href: "/precificacao-dinamica-airbnb",
      label: "Airbnb pricing",
      description:
        "Entenda como eventos se combinam com antecedência, sazonalidade e dados do imóvel.",
    },
    {
      href: "/contato",
      label: "Contato",
      description:
        "Fale com a Urban AI sobre cobertura, integrações e leitura de eventos para sua operação.",
    },
  ],
  faq: [
    {
      question: "A cobertura da Urban AI já é nacional?",
      answer:
        "A cobertura mais profunda começa por São Paulo e Grande SP. Outras capitais entram conforme o pipeline de eventos amadurece.",
    },
    {
      question: "Eventos pequenos importam?",
      answer:
        "Alguns importam, especialmente se estão perto do imóvel e atingem um público com baixa oferta de hospedagem próxima.",
    },
    {
      question: "A Urban AI usa dados públicos de eventos?",
      answer:
        "Sim. O motor combina fontes públicas de eventos com dados do imóvel e sinais de mercado.",
    },
    {
      question: "A mesma regra vale para todos os bairros de São Paulo?",
      answer:
        "Não. A demanda pode variar por bairro, acesso, tipo de evento e perfil de hóspede, por isso a recomendação precisa ser localizada.",
    },
    {
      question: "Shows e congressos devem ter estratégias iguais?",
      answer:
        "Não necessariamente. Shows podem concentrar demanda em uma noite; congressos podem gerar estadias mais longas e busca por acesso corporativo.",
    },
  ],
};

export const staysIntegrationPricing: SeoContent = {
  path: "/integracao-stays-precificacao-automatica",
  title: "Integração Stays para precificação automática - Urban AI",
  description:
    "Entenda como a Urban AI usa integração Stays para aplicar preços sugeridos com consentimento, limites e histórico.",
  eyebrow: "Integração Stays",
  h1: "Precificação automática com Stays",
  lead:
    "A integração com Stays permite que recomendações aprovadas sejam aplicadas no canal de distribuição respeitando limites definidos pelo anfitrião.",
  answer:
    "A Urban AI separa recomendação de automação. Primeiro, o sistema explica o preço sugerido. Depois, quando o anfitrião ativa a integração, os ajustes podem ser enviados via Stays com tetos, consentimento e rastreabilidade.",
  directAnswers: [
    {
      question: "O que a integração Stays permite na Urban AI?",
      answer:
        "A integração Stays permite enviar preços aprovados ou automatizados para a operação, respeitando consentimento, limites configurados e histórico de aplicação.",
    },
    {
      question: "A automação deve aplicar qualquer sugestão de IA?",
      answer:
        "Não. A automação deve obedecer regras do usuário, como teto, piso, pausa manual e critérios de segurança antes de alterar um preço.",
    },
  ],
  sections: [
    {
      title: "Modo recomendação",
      body:
        "O anfitrião vê a sugestão no painel e decide se aplica manualmente. É o fluxo ideal para começar com controle total.",
    },
    {
      title: "Modo automático",
      body:
        "Quando ativado, o envio respeita regras de segurança, como tetos de variação e possibilidade de pausar a automação.",
    },
    {
      title: "Histórico e auditoria",
      body:
        "Cada sugestão e aplicação deve ser rastreável, com motivo, data e parâmetros usados na decisão.",
    },
  ],
  evidence: [
    {
      title: "Consentimento explícito",
      body:
        "A automação depende de ativação do usuário. Sem consentimento, a Urban AI deve permanecer no modo recomendação.",
    },
    {
      title: "Limites configuráveis",
      body:
        "Tetos, pisos e pausas reduzem risco de aplicação fora da estratégia comercial do anfitrião.",
    },
    {
      title: "Histórico de decisões",
      body:
        "Cada aplicação precisa manter contexto mínimo: data, motivo, origem da recomendação e regra usada no envio.",
    },
  ],
  methodology: [
    {
      title: "1. Gerar recomendação explicada",
      body:
        "Antes de qualquer envio, o sistema produz a sugestão com motivo, data afetada e critério observado.",
    },
    {
      title: "2. Validar regra de automação",
      body:
        "A integração verifica se o ajuste está dentro dos limites definidos pelo usuário e se a automação está ativa.",
    },
    {
      title: "3. Registrar aplicação",
      body:
        "Quando o preço é enviado, o histórico deve permitir auditoria e reversão operacional quando necessário.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Aplicação via Stays com consentimento",
      summary:
        "Slot para documentar uma sugestão aprovada e enviada via integração, com limites configurados e histórico de aplicação.",
      source:
        "Consentimento de integração, PriceUpdate, regra de automação e log operacional sem expor token ou dado sensível.",
      sample:
        "Amostra em formação: aplicações com consentimento, preço/data e status rastreável.",
      validationNote:
        "Sem evidência completa, a copy pública permanece em validação e não afirma melhoria automática de receita.",
    }),
    validationCaseStudy({
      title: "Pausa ou reversão de automação",
      summary:
        "Slot para validar que o usuário consegue interromper ou revisar a automação quando a regra comercial muda.",
      source:
        "Histórico de pausa, rollback ou rejeição de envio, associado ao usuário e ao motivo operacional.",
      sample:
        "Amostra pendente: casos com ação de controle humano e status final registrado.",
      validationNote:
        "O case só pode sair de em validação quando o fluxo for reproduzível e revisado sem expor dado privado.",
    }),
  ],
  internalCtas: [
    {
      href: "/seguranca-lgpd-ia-precificacao",
      label: "Segurança e LGPD",
      description:
        "Veja os princípios de privacidade, controle do usuário e rastreabilidade da Urban AI.",
    },
    {
      href: "/precificacao-dinamica-airbnb",
      label: "Recomendação",
      description:
        "Entenda a diferença entre sugestão de preço e aplicação automática.",
    },
    {
      href: "/contato",
      label: "Falar com a Urban",
      description:
        "Converse sobre requisitos de integração, operação e limites de automação.",
    },
  ],
  faq: [
    {
      question: "Preciso usar Stays para usar a Urban AI?",
      answer:
        "Não. Stays é necessário apenas para fluxos de automação. O modo recomendação funciona sem integração automática.",
    },
    {
      question: "Posso pausar a automação?",
      answer:
        "Sim. A automação deve ser ativada, pausada ou desconectada pelo próprio usuário.",
    },
    {
      question: "A Urban AI faz scraping para aplicar preço?",
      answer:
        "A estratégia correta é integração nativa quando disponível, evitando hacks e fluxos frágeis.",
    },
    {
      question: "O que acontece se eu pausar a integração?",
      answer:
        "Ao pausar, a automação deve deixar de enviar ajustes. As recomendações podem continuar visíveis para revisão manual.",
    },
    {
      question: "A integração registra quem autorizou a automação?",
      answer:
        "O fluxo deve manter rastreabilidade de ativação, limites e aplicações para que o usuário entenda o que foi alterado e por que.",
    },
  ],
};

export const spreadsheetComparison: SeoContent = {
  path: "/urban-ai-vs-planilha-de-precificacao",
  title: "Urban AI vs planilha de precificação - Urban AI",
  description:
    "Comparativo entre usar planilha para precificar Airbnb e usar IA com eventos, dados locais e recomendações explicáveis.",
  eyebrow: "Comparativo",
  h1: "Urban AI vs planilha de precificação",
  lead:
    "Planilhas ajudam a organizar regras, mas ficam defasadas quando eventos, ocupação e concorrência mudam com velocidade.",
  answer:
    "A Urban AI não substitui o raciocínio financeiro do anfitrião; ela substitui a parte repetitiva de observar calendário urbano, comparar sinais e transformar mudanças de demanda em recomendações acionáveis.",
  directAnswers: [
    {
      question: "Quando uma planilha de precificação deixa de bastar?",
      answer:
        "A planilha deixa de bastar quando o anfitrião precisa atualizar muitas datas, muitos imóveis ou muitos sinais externos que mudam fora da rotina manual.",
    },
    {
      question: "O que a IA faz melhor que uma planilha fixa?",
      answer:
        "A IA consegue observar eventos, antecedência, calendário e contexto local de forma recorrente, enquanto a planilha costuma depender de atualização manual.",
    },
  ],
  sections: [
    {
      title: "Planilha é boa para controle",
      body:
        "Ela funciona para custos, metas e regras fixas. O problema aparece quando a demanda muda diariamente.",
    },
    {
      title: "IA é boa para contexto",
      body:
        "O motor observa sinais externos que uma planilha raramente captura automaticamente, como eventos e mudanças no bairro.",
    },
    {
      title: "Melhor uso combinado",
      body:
        "A planilha continua útil para metas. A Urban AI entra para alertar oportunidades e riscos que exigem atualização constante.",
    },
  ],
  evidence: [
    {
      title: "Regras fixas continuam úteis",
      body:
        "Custos, meta mínima, margem desejada e restrições operacionais podem continuar em planilha ou ERP da gestora.",
    },
    {
      title: "Sinais externos mudam com frequência",
      body:
        "Eventos, procura por bairro, antecedência e disponibilidade não seguem uma regra estática, por isso exigem revisão recorrente.",
    },
    {
      title: "Comparação sem promessa absoluta",
      body:
        "A página não afirma que IA sempre supera planilha. Ela delimita onde cada ferramenta tende a ajudar melhor.",
    },
  ],
  methodology: [
    {
      title: "1. Separar controle de contexto",
      body:
        "Use planilha para custos e metas internas; use o motor de IA para observar contexto externo e datas sensíveis.",
    },
    {
      title: "2. Priorizar exceções",
      body:
        "Em vez de recalcular tudo manualmente, a recomendação deve destacar datas com risco ou oportunidade fora do padrão.",
    },
    {
      title: "3. Manter decisão explicável",
      body:
        "Cada sugestão precisa dizer qual sinal motivou o alerta, para que o anfitrião compare com sua própria regra financeira.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Rotina manual comparada com recomendação explicável",
      summary:
        "Slot para documentar como uma decisão antes feita em planilha foi revisada com apoio de contexto urbano e evento.",
      source:
        "Planilha ou regra operacional informada pelo anfitrião, recomendação Urban AI e decisão aplicada.",
      sample:
        "Amostra em formação: datas revisadas com regra original, sinal observado e decisão final.",
      validationNote:
        "A página não deve afirmar substituição superior da planilha sem case aprovado e consentimento de publicação.",
    }),
    validationCaseStudy({
      title: "Data sensível fora da rotina fixa",
      summary:
        "Slot para registrar datas em que o contexto externo exigiu revisão específica, sem transformar isso em promessa de resultado.",
      source:
        "Calendário de eventos, disponibilidade do imóvel e motivo da recomendação.",
      sample:
        "Amostra pendente: datas com justificativa, decisão humana e resultado observado separado por fatores externos.",
      validationNote:
        "Qualquer número futuro precisa mostrar fonte, período e amostra; até lá, o status público está em validação.",
    }),
  ],
  internalCtas: [
    {
      href: "/precificacao-dinamica-airbnb",
      label: "IA de preço",
      description:
        "Veja como a Urban AI transforma contexto urbano em recomendações de diária.",
    },
    {
      href: "/como-precificar-airbnb-em-dias-de-eventos",
      label: "Eventos",
      description:
        "Aprenda quais eventos merecem ajuste e quais devem ser tratados com cautela.",
    },
    {
      href: "/precos",
      label: "Preços",
      description:
        "Compare os planos públicos da Urban AI com o custo operacional de manter regras manuais.",
    },
  ],
  faq: [
    {
      question: "Posso continuar usando minha planilha?",
      answer:
        "Sim. A Urban AI pode complementar a planilha, oferecendo alertas e recomendações para datas específicas.",
    },
    {
      question: "A Urban AI calcula custo operacional?",
      answer:
        "O foco principal é recomendação de diária com base em demanda e eventos. Custos internos continuam sendo referência do anfitrião.",
    },
    {
      question: "Quando a planilha deixa de ser suficiente?",
      answer:
        "Quando há muitos imóveis, muitas datas especiais ou mercado local mudando rápido demais para atualizar manualmente.",
    },
    {
      question: "A Urban AI substitui meu controle financeiro?",
      answer:
        "Não. O controle financeiro interno continua sendo referência do anfitrião. A Urban AI adiciona leitura de demanda e eventos.",
    },
    {
      question: "Planilha e IA podem discordar?",
      answer:
        "Sim. Quando isso acontece, a melhor prática é revisar o motivo da recomendação, o limite financeiro e o objetivo de ocupação daquela data.",
    },
  ],
};

export const lgpdSecurityPricing: SeoContent = {
  path: "/seguranca-lgpd-ia-precificacao",
  title: "Segurança, LGPD e IA na precificação - Urban AI",
  description:
    "Como a Urban AI trata privacidade, segurança, dados de imóveis e limites de IA para precificação de aluguel por temporada.",
  eyebrow: "Segurança e LGPD",
  h1: "IA de precificação precisa de confiança",
  lead:
    "Ferramentas de precificação lidam com dados de conta, imóveis, integrações e decisões comerciais. A proteção desses dados precisa ser clara.",
  answer:
    "A Urban AI trata IA como apoio à decisão. O usuário mantém controle sobre aplicação de preço, consentimento de integrações e solicitações de privacidade.",
  directAnswers: [
    {
      question: "Como a Urban AI posiciona IA na precificação?",
      answer:
        "A Urban AI posiciona IA como apoio à decisão, com recomendações explicáveis, controle humano e limites configuráveis para automação.",
    },
    {
      question: "Qual canal de privacidade da Urban AI?",
      answer:
        "O canal informado para solicitações de privacidade é privacidade@myurbanai.com, conforme a política publicada no site.",
    },
  ],
  sections: [
    {
      title: "Dados usados",
      body:
        "A plataforma usa dados do imóvel, sinais públicos de mercado, eventos e histórico operacional necessário para gerar recomendações.",
    },
    {
      title: "Controle do usuário",
      body:
        "Mesmo quando há automação, o usuário deve poder configurar limites, pausar integrações e revisar histórico.",
    },
    {
      title: "Canal de privacidade",
      body:
        "Solicitações sobre dados pessoais podem ser enviadas para privacidade@myurbanai.com, conforme a política publicada.",
    },
  ],
  evidence: [
    {
      title: "Política pública como referência",
      body:
        "A página aponta para princípios alinhados a políticas publicadas: finalidade, controle do usuário, canal de privacidade e direitos do titular.",
    },
    {
      title: "Controle humano declarado",
      body:
        "A Urban AI descreve a IA como apoio à decisão, não como decisor irreversível de preço ou integração.",
    },
    {
      title: "Dados relacionados à operação",
      body:
        "Os dados citados estão ligados ao funcionamento da plataforma: imóveis, eventos, mercado, histórico operacional e integrações autorizadas.",
    },
  ],
  methodology: [
    {
      title: "1. Minimizar dados necessários",
      body:
        "A recomendação deve usar apenas dados relevantes para calcular, explicar e auditar preços e integrações.",
    },
    {
      title: "2. Manter rastreabilidade",
      body:
        "Sugestões, aplicações e limites precisam registrar motivo e contexto para que o usuário possa revisar decisões.",
    },
    {
      title: "3. Preservar canais de escolha",
      body:
        "O usuário deve conseguir revisar recomendações, pausar automação, desconectar integrações e acionar o canal de privacidade.",
    },
  ],
  caseStudies: [
    validationCaseStudy({
      title: "Pedido LGPD tratado ponta a ponta",
      summary:
        "Slot para documentar solicitação de privacidade recebida, classificada, respondida e registrada com evidência.",
      source:
        "Ticket de privacidade, registro de resposta e checklist interno de suporte/LGPD.",
      sample:
        "Amostra em formação: pedidos reais ou testes controlados identificados como teste.",
      validationNote:
        "Nenhum dado pessoal ou detalhe de titular deve aparecer no case público; status atual: em validação.",
    }),
    validationCaseStudy({
      title: "Auditoria de recomendação com controle humano",
      summary:
        "Slot para validar se uma recomendação pode ser explicada, revisada e associada aos limites definidos pelo usuário.",
      source:
        "Histórico de recomendação, motivo exibido, limite configurado e decisão do usuário.",
      sample:
        "Amostra pendente: recomendações auditáveis com motivo, data afetada e controle humano registrado.",
      validationNote:
        "A publicação deve focar governança e rastreabilidade; qualquer métrica fica bloqueada até revisão.",
    }),
  ],
  internalCtas: [
    {
      href: "/privacidade",
      label: "Privacidade",
      description:
        "Leia a política de privacidade publicada e os canais para solicitações de dados.",
    },
    {
      href: "/integracao-stays-precificacao-automatica",
      label: "Integração Stays",
      description:
        "Entenda como consentimento, limites e histórico entram na automação de preço.",
    },
    {
      href: "/contato",
      label: "Contato",
      description:
        "Fale com a Urban AI sobre segurança, privacidade e governança de integrações.",
    },
  ],
  faq: [
    {
      question: "A Urban AI vende meus dados?",
      answer:
        "A política publicada informa que dados pessoais não são vendidos. O uso é voltado à operação da plataforma e melhoria das recomendações.",
    },
    {
      question: "Posso pedir exclusão de dados?",
      answer:
        "Sim. A política de privacidade descreve direitos do titular e o canal oficial para solicitações.",
    },
    {
      question: "A IA toma decisões irreversíveis?",
      answer:
        "Não deve. A Urban AI posiciona a IA como apoio à decisão, com controle humano e limites configuráveis.",
    },
    {
      question: "Que dados são relevantes para precificação?",
      answer:
        "Dados relevantes incluem informações do imóvel, disponibilidade, eventos, sinais de mercado e histórico operacional necessário para explicar recomendações.",
    },
    {
      question: "Como evitar recomendações opacas de IA?",
      answer:
        "A recomendação deve mostrar motivo, sinal observado, data afetada e limite aplicado, permitindo revisão humana antes ou depois da aplicação.",
    },
  ],
};
