# Material Executivo e Carta aos Investidores

Data: 2026-05-24  
Publico: socios, investidores e parceiros nao tecnicos.

## 1. Resumo executivo

A Urban AI e uma plataforma de inteligencia de mercado e precificacao para hospedagens de curta temporada. Ela ajuda anfitrioes e gestores a entenderem quando a demanda local deve subir, principalmente por causa de eventos na cidade, e transforma essa leitura em recomendacoes de preco para cada imovel.

Em vez de o anfitriao depender de intuicao, planilha ou ajuste tardio, a Urban AI acompanha sinais da cidade, identifica oportunidades, estima impacto por imovel e orienta a melhor acao.

O produto ja possui uma base tecnologica propria: aplicativo web, painel administrativo, motor de eventos, motor de pricing, integracoes, cobranca, seguranca, runbooks e evidencias de teste. A proxima versao foca em transformar essa fundacao em prova de valor mensuravel: recomendacoes explicaveis, outcomes reais, ROI por driver e beta controlado com clientes.

## 2. O que e a Urban AI

A Urban AI e um sistema que conecta tres mundos:

1. **Cidade:** eventos, shows, feiras, congressos, jogos e movimentacoes locais.
2. **Hospedagem:** imoveis, localizacao, preco atual, regras, ocupacao e perfil do anfitriao.
3. **Decisao:** recomendacao de preco, explicacao, simulacao, aplicacao e medicao de resultado.

Nossa tese e simples: a cidade muda a demanda. Quem percebe antes e precifica melhor captura mais valor.

## 3. O que o sistema faz hoje

### Para anfitrioes

- Cadastro e login.
- Onboarding e cadastro de imoveis.
- Visualizacao de eventos proximos.
- Radar de eventos e demanda.
- Recomendacoes de preco.
- Painel de ROI.
- Market intelligence por imovel.
- Regras de pricing.
- Portfolio multi-imovel.
- Notificacoes.
- Integracao Stays em beta controlado.
- Planos e billing.
- Assistente AskUrban.

### Para administradores

- Painel executivo.
- Gestao de usuarios e propriedades.
- Eventos e cobertura geografica.
- Deduplicacao e importacao de eventos.
- Saude dos coletores.
- Jobs operacionais.
- Qualidade de pricing.
- ROI agregado.
- Funil.
- Financeiro.
- Stays.
- Comunicacoes.
- Waitlist.
- Auditoria.

### Para operacao

- Runbooks de release, staging, backup, restore, incidentes, Stripe, Stays, LGPD e webscraping.
- Evidencias de testes.
- ADRs de arquitetura.
- SLO e procedimentos de manutencao.

## 4. O que ja foi construido

### Tecnologia propria

- Backend NestJS com API REST.
- Frontend Next.js.
- Banco MySQL.
- Pipeline Prefect.
- Webscraping com Scrapy/Scrapyd.
- Motor de pricing dentro do backend.
- Painel admin robusto.
- Design system proprio.

### Infraestrutura e governanca

- Deploy em Railway.
- Sentry para observabilidade.
- Health checks.
- Runbooks de operacao.
- Backups e plano de restore.
- Documentacao de seguranca e LGPD.
- Architecture Decision Records.
- Release gates e evidencias.

### Produto

- Landing e paginas publicas.
- Cadastro e onboarding.
- Dashboard host.
- Eventos na cidade.
- Radar de eventos.
- Portfolio.
- ROI.
- Market intel.
- Admin completo.
- Stripe billing.
- Stays beta.
- Push notifications.
- AskUrban.

## 5. Melhorias recentes relevantes

1. **Radar de Eventos:** a Urban passou a enxergar eventos como oportunidades de demanda, nao apenas como lista de acontecimentos.
2. **Inteligencia de demanda:** foram criados conceitos de demanda por evento, impacto por imovel e curva de absorcao de preco.
3. **Auditabilidade:** o sistema avancou para registrar decisoes, drivers, confianca e outcomes.
4. **Admin mais forte:** o painel interno agora cobre eventos, coletores, jobs, qualidade, ROI, financeiro, Stays e funil.
5. **Design system:** a experiencia visual foi padronizada para publico, host e admin.
6. **Seguranca operacional:** Stays auto-apply foi tratado com kill switch, dry-run, allowlist e rollback.
7. **Testes e evidencias:** Event Radar teve gate Playwright, typecheck e testes direcionados verdes em escopo local.

## 6. Por que isso importa

O mercado de hospedagens de curta temporada depende de precificacao dinamica, mas muitos anfitrioes ainda operam com ajustes manuais, planilhas ou ferramentas que nao entendem bem a realidade local.

A Urban AI entra nessa lacuna:

- entende eventos locais;
- traduz impacto em preco;
- explica a recomendacao;
- mede o resultado;
- aprende com o tempo.

Isso cria um ativo defensavel: dados proprietarios sobre como eventos afetam hospedagens em cada regiao.

## 7. Diferenciais

| Diferencial | Por que importa |
|---|---|
| Radar de eventos | Identifica demanda antes do calendario do anfitriao reagir |
| Geografia aplicada | Calcula impacto por proximidade e acesso ao evento |
| Pricing explicavel | Aumenta confianca do anfitriao |
| Admin operacional | Permite operar beta e suporte com disciplina |
| Stays beta | Caminho para aplicacao controlada de preco |
| Outcomes | Base para provar ROI e treinar modelos melhores |
| Documentacao e runbooks | Reduz risco operacional e aumenta valor institucional |

## 8. Estado atual honesto

A Urban AI esta em uma fase de **beta operacional avancado**. A base tecnica esta muito adiantada, mas a empresa ainda precisa completar a etapa de dados reais e prova de valor antes de comunicar promessas quantitativas amplas.

Podemos afirmar com seguranca:

- temos uma plataforma propria funcionando;
- temos um motor de eventos e pricing em evolucao;
- temos painel host e admin;
- temos infraestrutura, seguranca e runbooks;
- temos capacidade de executar beta controlado;
- temos uma tese clara de dados proprietarios.

Devemos evitar, por enquanto:

- prometer aumento fixo de receita sem cases auditados;
- dizer que auto-apply esta liberado para todos;
- apresentar estimativas como receita confirmada;
- tratar testes locais como validacao completa de producao.

Essa transparencia aumenta credibilidade.

## 9. Plano V2 em linguagem executiva

### Primeiro marco: deixar a operacao pronta para beta

- Staging isolado.
- Geocoding corrigido.
- Release gate real.
- Smoke de Stripe e Stays.
- Eventos e recomendacoes com dados reais.

### Segundo marco: transformar recomendacoes em decisoes auditaveis

- Cada recomendacao tera explicacao, confianca, cenarios e fonte.
- O anfitriao vera por que aquele preco faz sentido.
- A operacao vera quando e por que o motor errou.

### Terceiro marco: medir resultado

- Capturar preco aplicado.
- Capturar aceite/rejeicao.
- Capturar reserva/receita quando disponivel.
- Separar ROI confirmado, projetado e potencial.

### Quarto marco: beta pago e cases

- 5 a 10 hosts beta.
- Relatorios semanais.
- 3 a 5 cases auditados.
- Stripe e suporte prontos.

### Quinto marco: escala

- Calibrar modelo com outcomes reais.
- Liberar auto-apply por cohorts seguros.
- Expandir fontes de eventos.
- Preparar rodada comercial/investimento com dados.

## 10. Narrativa para investidores

A Urban AI nao e apenas uma tela de dashboard. Ela esta se tornando uma camada de inteligencia para capturar demanda urbana em hospedagens.

O valor esta em tres ativos:

1. **Produto:** interface para anfitrioes tomarem decisoes melhores.
2. **Dados:** historico proprietario de eventos, precos, respostas e resultados.
3. **Operacao:** capacidade de monitorar, auditar, corrigir e escalar com governanca.

A empresa ja demonstrou execucao: assumiu tecnologia, organizou infraestrutura, criou documentacao, fortaleceu seguranca, construiu produto e evoluiu para uma tese de inteligencia mais defensavel.

O proximo passo e converter essa capacidade em prova de mercado: beta assistido, outcomes e cases.

## 11. One-pager executivo

### Urban AI

Radar de demanda e pricing para hospedagens de curta temporada.

### Problema

Anfitrioes perdem receita porque nao enxergam a demanda local a tempo e nao sabem como ajustar preco com seguranca.

### Solucao

A Urban AI monitora eventos, calcula impacto por imovel, recomenda faixas de preco e mede o resultado.

### Produto hoje

- Plataforma web.
- Painel do host.
- Radar de eventos.
- Painel admin.
- Motor de pricing.
- Billing.
- Integracao Stays beta.
- Runbooks e governanca.

### Diferencial

Dados proprietarios de eventos, geografia, recomendacoes, aplicacoes e resultados.

### Proximo marco

Beta fechado com outcomes reais e cases auditados.

### Visao

Ser a camada de inteligencia de receita para hospedagem urbana na America Latina.

## 12. Carta aos investidores

Prezados investidores,

A Urban AI nasceu de uma observacao simples: a demanda por hospedagem muda antes de aparecer no calendario do anfitriao. Um show, uma feira, um congresso, um jogo ou uma grande concentracao local pode alterar o valor de uma diaria. O desafio e perceber isso a tempo, entender quais imoveis sao afetados e transformar esse sinal em uma decisao de preco clara.

Estamos construindo a Urban AI para resolver exatamente esse problema.

Nos ultimos meses, a empresa avançou de forma significativa. Assumimos a base tecnologica, estabilizamos a infraestrutura, organizamos o produto, criamos uma plataforma propria e estruturamos uma operacao com documentacao, runbooks, seguranca, painel administrativo e evidencias de teste. Hoje a Urban AI ja possui aplicativo web, cadastro de imoveis, radar de eventos, recomendacoes de preco, painel de ROI, painel administrativo, cobranca, integracao Stays em beta e um caminho claro para aprendizado com dados reais.

O mais importante e que a Urban AI deixou de ser apenas uma ferramenta de tela. A tese evoluiu para uma camada de inteligencia sobre demanda urbana. Mapeamos eventos, estimamos impacto por regiao, conectamos isso a imoveis especificos e caminhamos para registrar cada recomendacao como uma decisao auditavel: por que recomendamos, com qual confianca, em qual cenario, com qual risco e qual foi o resultado depois.

Essa disciplina e essencial. Em vez de prometer ganhos genericos sem base, estamos construindo a infraestrutura que permite provar valor. O proximo ciclo da Urban AI sera dedicado a dados reais, beta assistido, captura de outcomes e primeiros cases auditados. Essa e a base para transformar uma boa tecnologia em uma empresa defensavel.

Vemos tres ativos principais sendo formados.

O primeiro e o produto: uma experiencia para anfitrioes e gestores entenderem onde existe oportunidade e o que fazer com ela.

O segundo e o dado proprietario: eventos, regioes, precos recomendados, decisoes tomadas, respostas do mercado e resultados observados.

O terceiro e a capacidade operacional: a Urban AI foi organizada com governanca tecnica, seguranca, monitoramento, runbooks e uma arquitetura preparada para crescer sem depender de improviso.

Estamos em uma fase de beta operacional avancado. A fundacao tecnica esta forte; agora o foco e provar valor em campo, com poucos clientes bem acompanhados, medindo resultado de forma honesta e repetivel. A partir disso, poderemos escalar com mais seguranca, comunicar numeros com metodologia e ampliar integracoes como Stays e outros canais.

A oportunidade e grande porque o mercado de hospedagem de curta temporada ainda opera, em grande parte, com decisao manual, atraso de informacao e ferramentas pouco sensiveis ao contexto local. A Urban AI quer ocupar esse espaco: ser o sistema que entende a cidade, traduz demanda em preco e ajuda o anfitriao a capturar valor.

Nosso compromisso e construir com qualidade, clareza e consistencia. A Urban AI ja demonstrou capacidade de execucao. O proximo passo e demonstrar, com dados reais, que essa execucao se converte em receita, eficiencia e defensabilidade.

Atenciosamente,

Urban AI

## 13. Mensagens para apresentacao oral

- "A Urban AI monitora a cidade para ajudar o anfitriao a precificar melhor."
- "O produto ja tem fundacao propria: app, admin, eventos, pricing, billing, integracoes e operacao."
- "Nossa V2 transforma recomendacoes em decisoes auditaveis."
- "Estamos sendo disciplinados: antes de prometer percentual de ganho, vamos medir outcomes e criar cases."
- "O ativo de longo prazo e o dataset proprietario de demanda urbana aplicada a hospedagem."

## 14. Proximos materiais recomendados

1. Deck de 10 slides para investidores.
2. One-pager comercial para parceiros.
3. Relatorio mensal de progresso para socios.
4. Case template para beta.
5. FAQ nao tecnico sobre IA, dados e seguranca.
