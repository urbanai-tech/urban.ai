# Urban AI — Estratégia de Integração com Stays e Aquisição de Dados
**Data:** 22/04/2026 · **Autores:** Gustavo + Claude (pesquisa) · **Status:** Proposta técnica e comercial para alinhamento com os sócios e com a Stays

---

## Contexto

A auditoria de 22/04/2026 identificou **Stays S.A.** (stays.net, Copacabana/RJ) como o único Preferred+ Software Partner do Airbnb na América Latina — e Fabrício e Rogério confirmaram que é ela o "representante" que eles têm como referência. Este documento detalha **como integrar a Stays para manipular preços nos listings dos nossos clientes**, **como estruturar uma parceria de dados** e **que alternativas temos** caso a parceria não saia ou precise ser complementada.

O achado-chave da pesquisa técnica é que a Stays tem uma **Open API pública documentada**, paga US$ 19/mês por cliente ativado, cobrindo listings, calendários, preços e reservas. Também ficou claro que a Stays **não tem programa formal de parcerias** ("developers hire a developer on their own and send Stays' complete documentation"). Isso é bom e ruim: bom porque não há burocracia de "vendor approval" como no programa Partner API do Airbnb (que hoje é fechado); ruim porque qualquer relação comercial especial (revenue share, white-label, trade de dados) depende de negociação 1:1 com a liderança da Stays.

---

## Parte 1 — Como Integrar a Stays para Manipular Preços dos Nossos Clientes

### Modelo Técnico Recomendado (Arquitetura A) — Urban AI consome a Open API da Stays **por cliente**

```
┌──────────────────┐
│  Anfitrião (já   │
│  é cliente Stays)│
└────────┬─────────┘
         │ 1) Ativa "Open API" no App Center da Stays (US$ 19/mês)
         │ 2) Gera credenciais e cola no onboarding do Urban AI
         ▼
┌──────────────────────────────────────────────┐
│  Urban AI — novo módulo AirbnbChannelService  │
│                                               │
│   ┌─────────────────────┐  ┌───────────────┐ │
│   │ PropriedadeService  │→ │ StaysConnector│ │
│   │ + KNN sugere preço  │  │ (REST client) │ │
│   └─────────────────────┘  └───────┬───────┘ │
└───────────────────────────────────┼──────────┘
                                    │ PUT /prices/{listing}
                                    ▼
                        ┌────────────────────┐
                        │  Stays Open API    │
                        │  (já é Preferred+  │
                        │   do Airbnb)       │
                        └───────┬────────────┘
                                │
                ┌───────────────┼───────────────┬──────────┐
                ▼               ▼               ▼          ▼
            ┌───────┐     ┌─────────┐     ┌───────┐   ┌───────┐
            │Airbnb │     │Booking  │     │ Vrbo  │   │Decolar│
            └───────┘     └─────────┘     └───────┘   └───────┘
```

**Fluxo do lado do anfitrião:**
1. No onboarding do Urban AI, após conectar o imóvel, exibimos a tela "Você usa Stays? Conecte aqui e a gente aplica os preços sugeridos sozinho em todos os canais (Airbnb + Booking + Vrbo)". Se sim, anfitriões digita as credenciais da Open API.
2. No primeiro contato, Urban AI lê todos os listings daquela conta, mapeia cada um para uma `propriedade` interna, e importa histórico de reservas (para o KNN se alimentar de ocupação real).
3. A cada sugestão de preço aceita (manual ou via modo autônomo), Urban AI faz um `PUT` na Open API da Stays, e a Stays se encarrega de propagar para Airbnb + Booking + Vrbo — mantendo paridade de preço entre canais, que é padrão de mercado.

**Vantagens do Modelo A:**
- **Funciona hoje, sem parceria formal** — só precisa da credencial de Open API que o anfitrião mesmo ativa
- **Cobre todos os canais** que a Stays sincroniza, não só Airbnb — multicanal é um *upgrade* sobre o que o PriceLabs oferece
- **Elimina risco jurídico** do scraping atual (GraphQL do Airbnb)
- **Importa histórico real de reservas** — resolve parcialmente o gap #2 (dados para o KNN) só com o agregado dos próprios clientes
- **Baixo custo de dev** — REST client documentado, sem handshake OAuth complexo

**Limitações do Modelo A:**
- **Exige que o anfitrião seja cliente Stays** — Stays é forte em property managers profissionais, menos em hosts casuais. Perde-se o anfitrião iniciante com 1–2 imóveis que não paga US$ 19/mês
- **US$ 19/mês adicional por cliente** — precisa estar claro na tabela de preços do Urban AI (provavelmente quem não é cliente Stays recebe o valor do Urban AI um pouco maior, ou se oferece pacote "Urban AI + habilitação Stays Open API" como bundle)
- **Não tem acesso privilegiado** — estamos consumindo a mesma API pública que qualquer integrador

### Fallback (Arquitetura B) — Urban AI como PMS alternativo para quem NÃO é cliente Stays

Para o segmento de anfitriões casuais (1–3 imóveis, não pagam PMS) criamos uma integração alternativa:
- **Hostaway** (Preferred+ Partner também, tem API documentada, custa ~US$ 99/mês/listing) — nicho profissional
- **Hostfully** (Preferred Partner) — similar
- **Airbnb API direta via Official Partner Program** — precisa de aprovação do Airbnb. Como a Stays é Preferred+, uma das coisas que pedimos na reunião com eles é *se eles podem nos apresentar ao partner manager do Airbnb* para eventualmente termos nosso próprio acesso direto no longo prazo
- **Modo manual (deep-link)** — para quem não quer integrar nada: Urban AI gera um link que leva o anfitrião direto para a tela de edição de preço do Airbnb com o valor pré-preenchido; basta clicar "Salvar". Pior UX, mas funciona para 100% dos anfitriões desde o dia 1

Recomendação: lançar com A+B como backup manual; migrar anfitriões casuais para Hostaway ou API direta conforme a base cresce.

### Esforço técnico de engenharia (estimativa)

Para a Arquitetura A, minha estimativa é **120–160 horas de dev** distribuídas assim: modelo de domínio novo (`AirbnbAccount`, `AirbnbListing`, `PriceUpdate` — 16h), `StaysConnector` com retry/idempotência (32h), OAuth/credencial flow no onboarding (16h), UI de conectar + status + listagem sincronizada (24h), endpoint de push de preço + logs auditáveis (16h), testes unitários e de integração contra sandbox Stays (24h), documentação + runbook (8h). Para o modo autônomo real com teto de variação e rollback automático, adicionar 40–60h. Total realista: **160–220h** — 4 a 5 semanas com 1 dev em dedicação integral, ou 8–10 semanas com Gustavo sozinho em meio-expediente.

### O que precisa ser resolvido antes de começar a codar

A primeira reunião com a Stays precisa cobrir estes pontos objetivos — documentar por escrito a resposta deles de cada um vira pré-requisito do ADR:

1. Existe **sandbox** da Open API que não cobra US$ 19/mês? (Crítico para desenvolver sem queimar cliente real)
2. **Rate limits** por cliente e global? Se for muito apertado, precisamos de backoff agressivo
3. Atualização de preço é **síncrona** ou vai para uma fila? Se é fila, quanto tempo leva pra propagar pro Airbnb/Booking?
4. Tem **webhook** de quando uma reserva é criada/cancelada/modificada? (Para o Urban AI reagir sem polling)
5. Eles têm interesse em **programa de co-sell** informal? Ou é só "aqui está a API, boa sorte"?
6. Podem apresentar a Urban AI ao **partner manager do Airbnb** para explorar integração direta como caminho futuro?

---

## Parte 2 — Como Estruturar a Parceria de Dados com a Stays

A Stays não tem programa formal de parceria. Isso significa que **qualquer acordo é 1:1, negociado direto com a liderança deles** (provavelmente Sven dos Santos como CEO, ou o time comercial). Aqui estão quatro modelos do mais leve ao mais ambicioso, com a recomendação de sequenciar do topo para o fim:

### Modelo 1 — Trade "Gratuidade ↔ Dataset Agregado" (entrada leve, recomendado)

**Proposta:** Urban AI gratuito durante 3 meses para até N clientes Stays indicados (beta fechado conjunto). Em troca, Stays nos dá acesso a um **dataset agregado anonimizado**: preço médio, ocupação e ADR por bairro × mês × tipo de imóvel × quantidade de quartos — sem identificar anfitriões ou imóveis individualmente. Nada que possa ser re-identificado; nada de PII.

**Por que a Stays diria sim:**
- Nenhum compromisso comercial formal, sem contrato complexo
- Eles adicionam valor aos clientes deles ("olha, agora tem IA de preço grátis por 3 meses")
- Dataset agregado de bairro/mês não é concorrência — é estatística de mercado
- Se o piloto funcionar, abre caminho para monetizar juntos

**Por que a Stays pode dizer não:** LGPD. Mesmo anonimizado, dataset de cliente deles pode precisar de consentimento. Resolver oferecendo dois caminhos: (a) a Stays mesma filtra/consolida e nos entrega CSV periódico, sem exportar raw; (b) só entra no dataset o cliente que der opt-in na hora de aceitar Urban AI.

**Entregável:** Memorando de 1 página, sem obrigação mútua além da confidencialidade, assinado por Gustavo + Sven dos Santos (ou equivalente).

### Modelo 2 — Revenue Share (meio termo, depois de piloto)

**Proposta:** Stays indica Urban AI aos clientes deles como "app de receita recomendado". Urban AI paga 20–30% do MRR dos clientes que vieram dessa indicação (attribution via código de desconto ou URL com parâmetro). Stays libera dataset agregado contínuo como parte do acordo.

**Como funciona na prática:**
- Urban AI cria landing "urbanai.com.br/stays" com código promocional (ex.: `STAYS10` = 10% off nos 6 primeiros meses)
- Stays divulga internamente, newsletter, eventos, integration center
- Todo cliente que vem por essa origem paga-se normal, Urban AI remete 20–30% da receita líquida daquele cliente para a Stays mensalmente
- Accounting simples: stays_referred = true no User; job mensal calcula e emite NF

**Por que a Stays diria sim:** receita recorrente sem esforço operacional. Se 100 clientes vierem ao longo de 12 meses, a R$ 100/mês cada (2 imóveis × plano base ajustado), são R$ 10.000/mês × 25% = R$ 2.500/mês passivos.

**Entregável:** Contrato comercial de afiliação + addendum de dados anonimizados.

### Modelo 3 — White-Label "Stays Smart Pricing" (longo prazo, mais ambicioso)

**Proposta:** Stays incorpora Urban AI como add-on dentro do produto Stays, renomeado "Stays Smart Pricing" ou "Stays Revenue IA". Urban AI cobra da Stays um valor fixo por listing ativo usando o add-on (ex.: US$ 3/listing/mês). Stays repassa ao cliente final pelo preço que quiser.

**Vantagens:** acesso imediato a toda base da Stays (milhares de listings, primeiros cases com volume, dataset de treinamento enorme). Urban AI vira a "Intel Inside" do maior PMS da LatAm.

**Desvantagens:** perde-se a marca própria para o usuário final. Exige integração mais profunda (SSO, UI embarcada, suporte). Riscos de lock-in: Stays pode copiar depois de 2 anos.

**Quando considerar:** só depois do Modelo 1 validado com sucesso E da marca Urban AI já ter reconhecimento próprio (≥ 500 usuários pagantes direto). Prematuro hoje.

### Modelo 4 — Co-Data Commons (aspiracional)

Stays + Urban AI + eventualmente outras PMCs contribuem com dataset anonimizado para um "pool" comum, de onde todos consomem. Governança via comitê. É o modelo "industry standard" que o mercado internacional já tem (STR, AirDNA). No Brasil não existe. Urban AI poderia ser o catalisador. Mas é um projeto de 2–3 anos, não prioridade agora.

### Recomendação de Sequenciamento

Começar pelo **Modelo 1** em S5–6 (próximas 4 semanas), iniciar conversa do Modelo 2 em S8 depois do piloto rodar, considerar Modelo 3 apenas após F7 (go-live) com tração comprovada, e Modelo 4 só quando o Urban AI tiver base própria sólida para contribuir com dados relevantes.

### Como abordar comercialmente — Script inicial

O primeiro contato via WhatsApp (+55 21 96706-9723) ou LinkedIn deve ser curto e prático. Sugestão de roteiro:

> *"Olá, sou Gustavo Macedo, fundador da Urban AI — plataforma de IA para otimização de receita de anfitriões Airbnb, focada em São Paulo. Acompanho a Stays há um tempo e a posição de único Preferred+ Partner Airbnb na LatAm chama atenção. Temos interesse em conversar sobre uma possível colaboração onde nossa IA de precificação seria oferecida a clientes de vocês como piloto — ganho para o cliente final, pouca fricção operacional para a Stays. Consegue me indicar com quem eu posso conversar sobre isso? Posso mandar um one-pager antes se preferir."*

Quando a Stays responder, mandar o one-pager (que eu posso redigir em seguida se você quiser) com: (1) o que é Urban AI em 2 linhas, (2) fit específico com clientes Stays, (3) proposta do Modelo 1 em bullets, (4) próximos passos sugeridos (reunião de 30min). Máximo 1 página, paleta laranja + azul Urban AI, tom autoridade técnica.

---

## Parte 3 — Alternativas de Dados (Além ou Complementares à Stays)

Mesmo se a parceria com a Stays sair perfeita, a estratégia inteligente é ter **múltiplas fontes de dados** — reduz dependência, aumenta cobertura, e dá resiliência se qualquer parceiro mudar postura. Organizo em três tiers por custo × esforço × qualidade.

### Tier 1 — Dados comerciais de terceiros (rápido, qualidade alta, custo variável)

**AirROI** — é o primeiro nome a tentar. Rastreiam **20M+ listings globais, 100% grátis** para uso básico, tem API REST documentada. Cobertura Brasil precisa ser confirmada (pesquisa não detalhou), mas como SP é o 2º maior mercado LatAm de Airbnb depois do Rio, quase certamente têm cobertura decente. **Ação:** testar ainda esta semana, criar conta, consumir endpoint de sample de 100 imóveis em SP, avaliar qualidade (campos retornados, frequência de atualização, lag). Custo: zero. Risco: zero.

**AirDNA** — market leader histórico, cobertura global, **~US$ 100–500/mês** no tier pro. Oferece API mas também front com dashboards. Vale para casos pontuais (relatórios de mercado para pitch comercial, validação de cases de beta), não como fonte operacional contínua pelo custo. **Ação:** considerar só se AirROI não cobrir bem SP.

**Airbtics** — alternativa barata ao AirDNA (~US$ 30/mês). Cobertura Brasil historicamente boa. API de integração. **Ação:** backup do AirROI.

**PriceLabs** — é nosso concorrente direto de dynamic pricing, mas também expõe dados de mercado via API paga. Usar dados deles seria irônico; além disso, TOS pode proibir uso para treinar modelo concorrente. **Ação:** não usar como fonte, mas usar como benchmark de pricing (comprar 1 mês de subscription para ver como posicionam, que filtros oferecem).

### Tier 2 — Parcerias locais (médio esforço, barato ou grátis)

**Seazone** — maior gestora Airbnb do Brasil (>2.000 imóveis em 55 cidades, incluindo SP, certificada Superhost). Não é Preferred Partner de software, é operadora — isso significa que têm o dataset bruto do mercado Brasil inteiro. Proposta similar ao Modelo 1 da Stays: trade de gratuidade por dataset agregado. **Ação:** abordar após validar Stays (não abordar ambos simultaneamente — queima vantagem negocial).

**Nomah, Housi, Tabas, Charlie, Yuca** — operadores grandes de moradia temporária em SP com centenas de unidades cada. Alguns têm Airbnb próprio. Abordagem caso-a-caso: muitos desses são startups que provavelmente trocariam dados por integração de IA de preço (se souberem usar).

**PMCs independentes em SP** — existem ~50 property managers profissionais em SP com 20–100 imóveis cada. Contato direto via Airbnb Community, grupos de Superhost, eventos (Superhost Summit BR, Decolar Connect). Dataset por PMC é modesto mas combinado vira massa crítica. Modelo: 3 meses grátis por PMC em troca do histórico.

**Comunidade Superhost SP — grupos Facebook/Telegram** — comunidade ativa, anfitriões curiosos por IA. Recrutar 20–30 voluntários beta que nos dão histórico em troca de acesso antecipado. Eles viram os primeiros cases de F7.1 (prova de ROI).

**Sympla API + Prefeitura SP (já no roadmap F6.2)** — fontes oficiais de eventos, substituindo parte do scraping jurídico. Não ajuda no preço, mas alimenta o motor de "proximidade a eventos" que é o diferencial do Urban AI.

### Tier 3 — Dados próprios (barato, lento, de longo prazo)

**Dataset orgânico do próprio Urban AI** — a cada usuário ativo pagante, ganhamos dados proprietários: sugestões dadas, sugestões aceitas × ignoradas, preço final praticado, resultados. A partir de ~100 usuários ativos por 6 meses (≈600 imóveis × 180 dias), o dataset orgânico vira competitivo. É o "cold start problem" clássico: os primeiros 6–9 meses dependem de Tier 1 + Tier 2; depois vira ativo próprio.

**Spiders atuais** — continuam rodando, mas **reposicionar como fonte secundária e não primária**. Escopo fica restrito a: (a) Airbnbs públicos sem consentimento para validação cruzada do KNN, (b) eventos de Eventim/Sympla/etc. com cuidado jurídico. Risco: TOS, cease-and-desist. Mitigação: migrar para APIs oficiais sempre que possível.

**Dados públicos open data** — Prefeitura de SP publica indicadores turísticos, IBGE tem dados de domicílios por bairro, dados de hotelaria da Abih. Não substituem dados reais de Airbnb, mas enriquecem o modelo com features demográficas por região.

**Parcerias acadêmicas** — USP, FGV, Insper têm grupos estudando turismo e hotelaria. Alguns publicam datasets acadêmicos. Parceria de pesquisa pode render dataset + validação metodológica + paper co-autorado (boa para branding B2B enterprise depois). Esforço alto, retorno indireto. Considerar só na F6 avançada.

### Tabela Consolidada — Tiers × Custo × Qualidade × Prazo

| Fonte | Tier | Custo estimado | Qualidade | Prazo para usar | Quando priorizar |
|-------|------|----------------|-----------|-----------------|------------------|
| **Stays (Modelo 1)** | 1/2 | R$ 0 (trade) | ⭐⭐⭐⭐⭐ (Preferred+ Airbnb) | 2–4 semanas negociação | **Agora (prioridade máxima)** |
| **AirROI API free** | 1 | R$ 0 | ⭐⭐⭐ (confirmar SP) | 1 semana integração | **Agora (paralelo Stays)** |
| **Airbtics** | 1 | ~US$ 30/mês | ⭐⭐⭐⭐ | 1 semana | Se AirROI insuficiente |
| **AirDNA** | 1 | US$ 100–500/mês | ⭐⭐⭐⭐⭐ | 1 semana | Só para pitch comercial/relatórios |
| **Seazone (trade)** | 2 | R$ 0 (trade) | ⭐⭐⭐⭐ (operadora) | 4–8 semanas | Após validar Stays |
| **PMCs indep SP** | 2 | R$ 0 (trade) | ⭐⭐⭐ (volume acumulado) | 6–12 semanas | Fase beta fechado |
| **Comunidade Superhost** | 2 | R$ 0 | ⭐⭐ (volume modesto) | 2–4 semanas | Para cases de ROI rápidos |
| **Dataset orgânico próprio** | 3 | R$ 0 | ⭐⭐⭐⭐⭐ (seu próprio) | 6–9 meses | Pós-go-live |
| **Spiders atuais** | 3 | R$ 0 | ⭐⭐ (risco jurídico) | Já temos | Secundário / validação |
| **Open data (Prefeitura+IBGE)** | 3 | R$ 0 | ⭐⭐ (features, não preço) | 2–4 semanas | Enrichment, não principal |
| **Parceria acadêmica** | 3 | R$ 0 | ⭐⭐⭐ | 3–6 meses | Quando houver time para tocar |
| **PriceLabs (benchmark)** | — | US$ 20/mês (1 conta) | — | 1 dia | Comprar 1 mês para observar |

### Recomendação Consolidada de Fontes

Para atingir o critério mínimo do KNN (≥200 imóveis × 12 meses de histórico) em 8 semanas, combinar:

1. **AirROI API grátis** — captura base larga, cobertura de SP inteira, sem custo (**semana 5–6**)
2. **Stays Modelo 1** — profundidade de dados reais de clientes profissionais, qualidade alta (**semana 6–8**)
3. **Comunidade Superhost SP** — recrutar 20–30 voluntários beta para dataset + cases de ROI (**semana 6–8**, já amarrado com F7.1)
4. **Spiders + scraping próprio** — mantido como fonte secundária de validação cruzada (**contínuo**)
5. **Sympla API + Prefeitura SP** — alimenta o lado de eventos (**semana 7–8**)

Com esse mix, no início da semana 9 temos dataset suficiente para retirar o mock, treinar o KNN com dados reais, validar MAPE ≤15% e entrar no beta fechado (F7) com fundação sólida.

---

## Resumo Executivo em 5 Bullets

- **Integração técnica com Stays**: viável HOJE via Open API (US$ 19/mês pago pelo cliente anfitrião), sem precisar de parceria formal, cobrindo Airbnb + Booking + Vrbo + Decolar. Esforço: 160–220h de dev.
- **Parceria de dados**: começar pelo Modelo 1 (trade gratuidade × dataset agregado, sem compromisso comercial), sequenciar para revenue share (Modelo 2) após piloto; white-label (Modelo 3) só após tração própria.
- **Abordagem comercial**: WhatsApp direto do comercial Stays (+55 21 96706-9723), one-pager de 1 página com proposta do Modelo 1, buscar reunião de 30min com Sven dos Santos ou equivalente.
- **Alternativas de dados**: AirROI grátis é o primeiro teste, Airbtics como backup pago barato; parcerias locais (Seazone, PMCs, Superhost community) como fontes secundárias; spiders próprios como validação cruzada secundária; dataset orgânico do Urban AI vira ativo principal a partir do 6º mês pós-go-live.
- **Próximos 5 passos concretos**: (1) validar com sócios que Stays é a referência ✓ feito; (2) testar AirROI API esta semana; (3) redigir one-pager para Stays; (4) contato inicial via WhatsApp/LinkedIn com Stays; (5) iniciar F6.4 em paralelo com Hostaway/deep-link como fallback para anfitriões não-Stays.

---

*Urban AI © 2026 · Uso interno · Estratégia de integração Stays e dados · 22/04/2026*
