# PRD e Roadmap V2

Data: 2026-05-24  
Produto: Urban AI V2  
Publico primario: anfitrioes Airbnb, gestores de temporada, investidores imobiliarios e administradoras de short-term rentals.

## 1. Visao do produto

A Urban AI V2 deve ser o radar de demanda e pricing para hospedagens de curta temporada. O produto deve mostrar o que esta acontecendo na cidade, quais eventos afetam cada imovel, qual diaria o mercado provavelmente absorve e qual acao o anfitriao deve tomar.

Em uma frase:

> A Urban AI mapeia a cidade, identifica oportunidades de demanda e transforma isso em decisoes de preco explicaveis para cada imovel.

## 2. Problema

Anfitrioes e gestores de hospedagem perdem receita porque:

- nao acompanham todos os eventos que alteram a demanda local;
- precificam com atraso ou com base em intuicao;
- nao sabem ate onde podem aumentar diaria sem reduzir demais a chance de reserva;
- nao medem se as recomendacoes aplicadas realmente geraram resultado;
- nao possuem um processo simples para aprender com os acertos e erros.

## 3. Objetivos V2

1. Unificar eventos, geografia, pricing e ROI em uma experiencia de decisao.
2. Transformar cada recomendacao em objeto auditavel, com drivers, confianca, cenarios e outcome.
3. Reduzir tempo ate o primeiro valor para o anfitriao.
4. Criar trilha operacional para beta pago e investidores sem depender de promessas nao comprovadas.
5. Preparar o produto para aprendizado com dados reais e auto-apply seguro.

## 4. Nao objetivos

- Nao prometer aumento percentual fixo de receita antes de cases auditados.
- Nao liberar auto-apply amplo sem Stays validado, consentimento, allowlist, rollback e evidencia.
- Nao transformar a V2 em apenas mais dashboards. O foco e decisao acionavel.
- Nao depender de mock runtime em fluxos criticos.

## 5. Personas

| Persona | Necessidade | Valor esperado |
|---|---|---|
| Anfitriao casual | Nao perder oportunidades obvias perto do imovel | Recomendacao simples e confiavel |
| Anfitriao profissional | Gerir varios imoveis e datas de alta demanda | Portfolio, lotes, regras e ROI |
| Administradora | Operar muitos clientes com consistencia | Cockpit, alertas, integracoes e auditoria |
| Fundador/operacao | Saber onde o motor falha e onde ha dinheiro na mesa | Admin, jobs, qualidade, coverage e support |
| Investidor | Entender defensabilidade, execucao e caminho de escala | Narrativa clara, marcos e evidencia |

## 6. Proposta de valor V2

### Para o anfitriao

- Ver eventos relevantes na cidade.
- Entender quais eventos afetam seus imoveis.
- Receber uma faixa de preco recomendada por cenario.
- Saber por que a Urban recomenda aquele preco.
- Aplicar manualmente ou, no beta, via Stays.
- Ver o resultado depois.

### Para a operacao Urban

- Monitorar cobertura de eventos.
- Ver gargalos de geocoding, fontes, jobs e pricing.
- Priorizar clientes e imoveis com maior potencial.
- Medir ROI por driver e por evento.
- Rodar beta assistido com controle.

### Para investidores

- Produto com fundacao tecnica propria.
- Mercado com dor clara e recorrente.
- Dados proprietarios acumulaveis.
- Caminho para defensabilidade por inteligencia de demanda e outcomes.
- Disciplina de governanca, seguranca e operacao.

## 7. Funcionalidades V2

### 7.1 Eventos na Cidade

Objetivo: mostrar ao host o calendario de eventos mapeados pela Urban AI.

Requisitos:

- Lista, mapa e calendario de eventos.
- Filtros por cidade, periodo, categoria, bairro, fonte e confianca.
- Detalhe do evento com link oficial, fonte, local, data, imagem quando existir e interpretacao Urban AI.
- CTA para ver impacto nos imoveis.

Criterio de pronto:

- Rota publica/autenticada clara.
- Dados reais ou fixture contratual em staging.
- Estado sem dados, erro e carregamento separados.

### 7.2 Radar de Eventos do Host

Objetivo: transformar eventos em oportunidades por imovel.

Requisitos:

- Heatmap de demanda futura.
- Lista priorizada de eventos que impactam os imoveis.
- Impacto por imovel: distancia, captura, diaria atual, faixa absorvivel, preco recomendado, chance e confianca.
- Simulacao de preco por evento.
- CTA para aplicar, salvar, ignorar ou pedir revisao.

Criterio de pronto:

- `GET /host/events/radar` e relacionados respondem com dados versionados.
- Cards mostram `generatedAt`, confianca e fonte.
- E2E desktop/mobile cobrindo lista, detalhe e simulacao.

### 7.3 Pricing Decision Snapshot

Objetivo: criar o objeto central da Urban AI V2.

Campos essenciais:

- `decisionId`
- `propertyId`
- `eventId`
- `targetDate`
- `generatedAt`
- `jobRunId`
- `metricVersion`
- `modelVersion`
- `strategyTier`
- `sourceFreshness`
- `sampleSize`
- `confidence`
- `currentPrice`
- `suggestedPrice`
- `guardrailMin`
- `guardrailMax`
- `guardrailApplied`
- `expectedOccupancyDelta`
- `expectedRevenueDelta`
- `riskLevel`
- `drivers.event`
- `drivers.pace`
- `drivers.compSet`
- `drivers.seasonality`
- `drivers.rules`
- `drivers.guardrail`
- `scenarios.conservative`
- `scenarios.recommended`
- `scenarios.aggressive`
- `historicalComparison`
- `outcome`

Criterio de pronto:

- Snapshot persistido por recompute.
- Idempotencia por evento/propriedade/data/modelVersion.
- Payload usado pelo `RecommendationCard`, ROI, Quality e Stays.

### 7.4 Curva de Absorcao de Preco

Objetivo: mostrar ate onde o preco pode subir com probabilidade explicita.

Requisitos:

- Cenarios conservador, recomendado, agressivo e extremo.
- Para cada cenario: diaria, multiplicador, chance de reserva, receita esperada, risco e leitura humana.
- Guardrails do host e da Urban aplicados.

Criterio de pronto:

- Cenários aparecem no host e admin.
- Probabilidades rotuladas como estimativas.
- Outcomes alimentam calibracao futura.

### 7.5 ROI por Driver

Objetivo: separar valor confirmado, projetado e potencial.

Drivers:

- Eventos.
- Regras de pricing.
- Market intel.
- Guardrails.
- Stays/manual.
- Portfolio actions.

Criterio de pronto:

- UI mostra confirmado, projetado e potencial em areas distintas.
- Cada numero tem periodo, fonte, amostra e confianca.
- Nao misturar receita real com estimativa.

### 7.6 Admin Cockpit V2

Objetivo: transformar admin em cockpit de decisao.

Modos:

- Exec: crescimento, receita, ROI, margem, risco e progresso.
- Ops: eventos, coletores, jobs, dados, geocoding, Stays.
- Support: usuarios, imoveis bloqueados, tickets, LGPD e proximas acoes.

Criterio de pronto:

- Cada alerta mostra impacto, dono e proxima acao.
- Jobs criticos registram `AdminJobRun`.
- Relatorios conectados a `jobRunId`.

### 7.7 Stays Beta Assistido

Objetivo: permitir aplicacao controlada de preco via Stays.

Requisitos:

- Conectar conta Stays.
- Sync listing.
- Preview antes de push.
- Push manual.
- Auto-apply apenas com kill switch, dry-run, allowlist e consentimento.
- Rollback exercitado.

Criterio de pronto:

- Smoke em staging/conta controlada.
- Evidencia em `docs/evidence/`.
- Nenhum push automatico fora da allowlist.

### 7.8 Material Executivo e Prova de Valor

Objetivo: preparar Urban para investidores e parceiros.

Requisitos:

- One-pager atualizado.
- Carta aos investidores.
- Resumo de entregas e melhorias.
- Roadmap de marcos.
- 3 a 5 cases auditados quando houver outcomes reais.

Criterio de pronto:

- Material nao tecnico aprovado pelos socios.
- Numeros com fonte, data e ressalva.
- Sem promessa quantitativa nao comprovada.

## 8. Roadmap V2

### Fase 0 - Consolidacao documental e governanca (0 a 7 dias)

Objetivo: criar a fonte de verdade.

Entregas:

- Aprovar pacote V2.
- Marcar docs antigos como historicos.
- Atualizar README principal apontando para V2.
- Criar indice de runbooks.
- Definir donos de produto, engenharia, operacao, LGPD e investidor.

Gates:

- Todos os socios sabem qual documento usar.
- Roadmap antigo nao e mais usado como plano atual.

### Fase 1 - Ambiente real e release seguro (1 a 2 semanas)

Objetivo: diferenciar "funciona localmente" de "esta validado em ambiente real".

Entregas:

- Staging Railway isolado com DB nao-producao.
- Migrations aplicadas em staging.
- Release gate contra staging.
- Geocoding Google corrigido.
- Smoke Event Radar contra staging.
- Smoke Stripe test.
- Smoke Stays dry-run.

Gates:

- `GET /health` e `/health/live` ok em staging.
- Front staging responde rotas criticas.
- Recompute Event Radar roda em staging e gera snapshots.
- Evidencia salva em `docs/evidence/`.

### Fase 2 - Decision Snapshot e explicabilidade (2 a 4 semanas)

Objetivo: centralizar a decisao de preco.

Entregas:

- `pricing_decision_snapshot` completo.
- `RecommendationCard` consumindo drivers, cenarios e confianca.
- `event_property_impact` ligado aos snapshots.
- ROI separando confirmado/projetado/potencial.
- Market Intel com sample size, periodo e freshness.

Gates:

- Cada recomendacao tem rastreabilidade.
- Host entende "por que esse preco".
- Admin consegue depurar o caminho evento -> impacto -> preco -> outcome.

### Fase 3 - Beta fechado assistido (4 a 8 semanas)

Objetivo: provar valor com poucos clientes.

Entregas:

- 5 a 10 hosts beta.
- Setup revisado por imovel.
- Relatorio semanal de recomendacoes geradas, aceitas, aplicadas e resultados.
- Captura de preco aplicado.
- Captura de feedback do host.
- Suporte e LGPD com SLA.

Gates:

- Pelo menos 70% dos imoveis beta com recomendacao futura ou motivo claro de ausencia.
- Pelo menos 3 casos qualitativos documentados.
- Erros operacionais com runbook e dono.

### Fase 4 - Beta pago limitado (8 a 12 semanas)

Objetivo: validar monetizacao com controle.

Entregas:

- Stripe KYC confirmado.
- Checkout, webhook, portal, cancelamento e quota testados.
- Stays manual/preview validado para cohort pequeno.
- Admin cockpit com alertas por impacto.
- Primeiro pacote de cases auditados.

Gates:

- Cobrar sem quebrar fluxo.
- Suporte consegue operar sem terminal para rotinas comuns.
- Relatorio executivo mensal aprovado.

### Fase 5 - V2 publico controlado (12+ semanas)

Objetivo: ampliar com base em dados reais.

Entregas:

- Calibracao de curva de absorcao com outcomes.
- Auto-apply beta com rollback comprovado.
- ROI por driver.
- Expansao de fontes de eventos.
- Customer success cockpit.
- Deck de investidores atualizado com resultados reais.

Gates:

- Prova de valor repetivel.
- Operacao e suporte previsiveis.
- Narrativa comercial pode incluir numeros com metodologia.

## 9. Criterios de pronto gerais

Uma feature V2 so deve ser considerada pronta quando:

- possui contrato documentado;
- tem estado de loading, vazio e erro;
- possui auth/ownership revisados;
- gera logs/auditoria quando muta dados;
- tem teste unitario ou e2e proporcional ao risco;
- possui evidencia quando depende de ambiente real;
- nao depende de mock runtime em producao;
- tem texto claro para usuario nao tecnico;
- possui runbook se impactar operacao.

## 10. Metricas de sucesso

### Produto

- Time to first value.
- Imoveis com recomendacao futura.
- Recomendacoes aceitas.
- Recomendacoes aplicadas.
- Feedback positivo/negativo por recomendacao.

### Dados e pricing

- Eventos futuros cobertos.
- Fontes ativas e freshness.
- Eventos com geocode.
- Eventos com pricing gerado.
- Decision snapshots gerados.
- Outcome capture rate.
- MAPE ou metrica substituta quando houver amostra.

### Negocio

- Leads na waitlist.
- Conversao para beta.
- Clientes pagos.
- MRR.
- Margem por listing.
- CAC quando canais estiverem medidos.

### Operacao

- Incidentes por severidade.
- Jobs falhando.
- Tempo de restore.
- Release gate pass rate.
- Tempo de resposta suporte/LGPD.

## 11. Riscos

| Risco | Mitigacao |
|---|---|
| Prometer ROI antes de prova | Usar narrativa de oportunidade e beta controlado |
| Eventos insuficientes | Fonte manual + spiders + coverage economica |
| Geocoding falhar | Corrigir Google, fallback manual e health alert |
| Auto-apply indevido | Default off, dry-run, allowlist, consentimento e rollback |
| Billing quebrar | Stripe smoke test e KYC antes de beta pago |
| Admin virar excesso de tela | Organizar por perguntas e impacto financeiro |
| Docs voltarem a divergir | Um indice V2 e dono de documentacao |

## 12. Decisao recomendada

Comecar a V2 pela cadeia:

`staging real -> recompute real -> pricing_decision_snapshot -> explicabilidade host -> outcome capture -> beta assistido`.

Essa ordem cria valor, reduz risco e produz a historia que investidores entendem: a Urban AI nao esta apenas construindo software, esta construindo um sistema que aprende com a demanda real da cidade.
