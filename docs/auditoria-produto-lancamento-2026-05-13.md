# Auditoria de Produto para Lancamento - Urban AI

Data: 2026-05-13
Escopo: produto, roadmap, prontidao de lancamento, fluxo de recomendacao de preco, dados de producao, configuracao Railway e lacunas comerciais/operacionais.
Conclusao curta: a Urban AI tem uma base tecnica ampla e muita coisa de produto ja implementada, mas ainda nao esta pronta para go-live publico pago com a promessa atual de "+30% receita via IA". Esta pronta para pre-lancamento controlado/waitlist e pode entrar em beta fechado apenas depois de corrigir o motor de eventos/recomendacoes e medir resultado em casos reais.

---

## 1. Veredito executivo

### Estado real hoje

O sistema esta mais maduro tecnicamente do que estava nas auditorias anteriores: backend, frontend, admin, waitlist, planos, eventos, Stays, dataset e pricing tem estrutura no codigo. A operacao Railway tambem esta estavel apos os hotfixes de 2026-05-13.

Mas, como produto de lancamento, o core value ainda nao esta comprovado em producao:

- Existem 29 imoveis ativos, todos com coordenadas e status `completed`.
- Existem 87 usuarios no banco, 23 ativos e 1 admin.
- Existem 1.404 eventos no banco, mas apenas 2 eventos futuros no momento da auditoria.
- Nao houve nenhum evento novo nos ultimos 7 dias e o ultimo evento criado foi em 2026-05-06.
- Existem 9.143 recomendacoes historicas, mas nenhuma criada nos ultimos 30 dias.
- Existem apenas 14 recomendacoes para eventos futuros, cobrindo 10 de 29 imoveis ativos.
- Nao ha nenhum `PriceSnapshot`, nenhum historico de ocupacao e nenhum `EventProximityFeature` em producao.
- Nao ha nenhum preco aplicado capturado (`preco_aplicado = 0`).
- Nao ha conta Stays conectada, listing Stays mapeado ou push de preco registrado.
- A waitlist existe no produto, mas a tabela de producao esta vazia.

Isso quer dizer: temos um produto com muita infraestrutura, mas a tese comercial central ainda nao esta operacionalmente demonstrada.

### Prontidao por tipo de lancamento

| Tipo de lancamento | Veredito | Prontidao estimada | Observacao |
|---|---:|---:|---|
| Pre-lancamento / landing / lista de espera | Pode rodar com ajustes | 65-75% | Precisa analytics, teste do fluxo de convite e clareza de copy. |
| Beta fechado gratuito/manual | Possivel depois de P0s de dados | 45-55% | Serve para 5-10 anfitrioes acompanhados manualmente, sem promessa forte de ROI. |
| Beta pago | Nao recomendado hoje | 30-40% | Billing e core de valor ainda precisam prova ponta-a-ponta. |
| Go-live publico pago | Nao pronto | 25-35% | Nao sustenta promessa "+30% receita via IA" sem dataset, recomendacoes recentes e casos auditados. |

Minha avaliacao honesta: lancar marketing de waitlist agora e defensavel; lancar venda paga ampla agora e arriscado.

---

## 2. O que foi cruzado

Fontes usadas nesta auditoria:

- `docs/roadmap.md`
- `docs/roadmap-pos-sprint.md`
- `docs/backlog-produto-pos-assuncao.md`
- `docs/go-live-manual-checklist.md`
- `docs/base-socios.md`
- `docs/estado-da-IA-e-evolucao.md`
- `docs/fase-eventos-cobertura-total.md`
- `docs/next-actions.md`
- `docs/runbooks/prelaunch-mode.md`
- `docs/runbooks/stays-integration-setup.md`
- `docs/runbooks/admin-evolution.md`
- `docs/runbooks/matriz-env-operacional.md`
- `docs/slo.md`
- Codigo do backend, frontend e entities principais.
- Railway/DB de producao com metricas agregadas, sem registrar secrets nem PII.

---

## 3. Roadmap versus realidade

### 3.1 Promessa estrategica

Roadmap/documentos:

- Plataforma de otimizacao de receita para short-term rentals.
- Foco inicial: anfitrioes Airbnb em Sao Paulo.
- Promessa comercial recorrente: aumento de receita via IA, em alguns docs como "+30%".
- Caminho de IA: regras hoje, KNN/dataset, XGBoost, modelo neural hibrido como moat.

Realidade atual:

- O sistema tem engine de regras e calculo de preco por evento.
- O "IA" atual e mais correto como motor heuristico com enriquecimento de eventos por Gemini e KNN local/ad-hoc em alguns calculos.
- Nao existe dataset proprietario populado em producao (`price_snapshots = 0`).
- Nao existe historico de ocupacao (`occupancy_history = 0`).
- Nao existe captura de preco aplicado (`preco_aplicado = 0`).
- Sem esses tres pontos, nao ha MAPE real, nao ha ROI auditado e nao ha base para prometer "+30%" de forma defensavel.

Status: estrutura tecnica existe, prova de produto ainda nao.

Recomendacao de posicionamento:

- Evitar "aumente 30% sua receita" como promessa principal no lancamento.
- Usar algo como: "identifique eventos proximos e receba recomendacoes de preco para capturar dias de maior demanda".
- Guardar "+30%" para quando houver 3 cases auditados e metodologia clara.

### 3.2 F5 - Landing, canais e aquisicao

Roadmap:

- Landing e pre-lancamento.
- Analytics, Meta Pixel, GA4.
- Trafego pago e materiais sociais.
- Waitlist/referral.

Realidade:

- Existem paginas publicas: landing, lancamento, precos, termos, privacidade, contato.
- Existe `PRELAUNCH_MODE` no backend.
- Existe waitlist no backend e frontend.
- `NEXT_PUBLIC_GA4_ID` esta ausente.
- `NEXT_PUBLIC_META_PIXEL_ID` esta ausente.
- Tabela `waitlist` esta vazia em producao.
- Runbook de pre-lancamento ainda marca o aceite definitivo do convite como TODO/proximo PR.

Status: pode captar interesse, mas nao esta instrumentado o suficiente para medir canal/conversao de lancamento.

### 3.3 F6.1 - IA, dataset e recomendacao

Roadmap:

- Captura passiva de dataset.
- AdaptivePricingStrategy.
- MAPE e qualidade de recomendacao.
- Evolucao Tier 0 -> Tier 1 -> Tier 2.

Realidade:

- Entities e services de dataset existem.
- Strategy/adaptive existe no codigo.
- `PRICING_STRATEGY` nao esta configurado no backend Railway.
- `AIRROI_API_KEY` ausente.
- `GCP_SERVICE_ACCOUNT_KEY` ausente.
- `price_snapshots = 0`.
- `occupancy_history = 0`.
- `event_proximity_features = 0`.
- Recomendacoes existentes sao historicas; nenhuma nova nos ultimos 30 dias.

Status: arquitetura preparada, mas dataset/ML nao esta ativo de verdade em producao.

### 3.4 F6.2 - Eventos e cobertura

Roadmap:

- Camada 1: APIs oficiais/publicas.
- Camada 2: Firecrawl/SerpAPI/Tavily/LLM extraction.
- Camada 3: curadoria humana.
- Cobertura total de eventos relevantes em SP.

Realidade:

- Schema de eventos tem `source`, `dedupHash`, `venueType`, `pendingGeocode`, `outOfScope`.
- Admin de eventos e import CSV existem.
- Gemini esta configurado.
- Firecrawl, SerpAPI, Tavily e API Football nao estao configurados no backend.
- Producao tem 1.404 eventos, mas 1.400 sao legacy/null source.
- Apenas 4 eventos vieram de fontes novas identificadas (`serpapi_events`, `scraper-ticket_master`, `tavily`).
- Apenas 2 eventos futuros.
- Nenhum evento criado nos ultimos 7 dias.

Status: modelo de dados e UI existem; ingestao/cobertura atual de producao nao sustenta lancamento.

### 3.5 F6.4 - Stays e modo automatico

Roadmap:

- Conectar conta Stays.
- Sincronizar listings.
- Push manual/auto.
- Guardrails e rollback.

Realidade:

- Backend e frontend de integracao existem.
- `STAYS_API_BASE_URL` ausente.
- `STAYS_TOKEN_ENCRYPTION_KEY` ausente.
- Nao ha `stays_accounts`.
- Nao ha `stays_listings`.
- `price_updates` nem existe no banco atual, enquanto a entity existe no codigo.
- Sem key de criptografia em ambiente production/staging, persistir token Stays deve falhar pelo transformer.

Status: fundacao tecnica, nao feature pronta para usuario real.

Recomendacao:

- Mostrar Stays como "modo automatico em beta privado" ou esconder ate credenciais/smoke.
- Nao prometer aplicacao automatica no Airbnb no lancamento publico.

### 3.6 F6.5 - Planos, cobranca por imovel e Stripe

Roadmap:

- 2 planos principais x 4 ciclos = 8 Price IDs.
- Checkout Stripe com quantity por imovel.
- Quota/paywall.

Realidade:

- Tabela `plans` tem Starter e Profissional ativos com os 4 campos de Stripe preenchidos no banco.
- Env vars esperadas `STARTER_PRICE_*` e `PROFISSIONAL_PRICE_*` estao 0/8 configuradas no backend.
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` existem.
- Frontend tem `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `payment` tem status inconsistentes, inclusive `peding` com erro de grafia.
- Existem 4 pagamentos `active`, 5 `trialing`, 47 `peding`, 4 `pending`.
- KYC Stripe nao foi verificado nesta auditoria.

Status: fluxo de pagamento tem base, mas precisa smoke end-to-end e saneamento antes de cobrar clientes novos.

### 3.7 F7 - Beta/go-live

Roadmap:

- Beta fechado.
- 3 cases auditados de ROI.
- Go-live oficial mid-late julho/2026.
- Staging, smoke, KYC, MAPE.

Realidade:

- Nao ha MAPE.
- Nao ha preco aplicado.
- Nao ha dataset.
- Nao ha eventos futuros suficientes.
- Nao ha Stays real.
- Nao ha evidencia de staging operacional completo nesta coleta.
- Producao precisou de hotfixes diretos apos deploy em 2026-05-13, o que mostra risco de release process.

Status: F7 ainda nao esta cumprida.

---

## 4. Auditoria por area de produto

### 4.1 Onboarding e cadastro de imoveis

O que esta bom:

- Fluxo de onboarding existe.
- Modal de adicionar imovel existe.
- Quota de imoveis foi corrigida para evitar criacao parcial.
- Propriedades novas enfileiram processamento.
- 29 imoveis ativos estao com coordenadas e status `completed`.

Lacunas:

- 16/29 imoveis ativos aparecem com cidade "A definir" e estado "A ", o que reduz confianca em segmentacao geografica, cobertura e explicacoes para o usuario.
- O usuario pode ficar com "processamento completed" sem recomendacao nova util se nao houver evento futuro suficiente.
- Empty states e mensagens acionaveis ainda sao apontados como backlog.

Risco de lancamento:

- Medio. O cadastro pode funcionar, mas o usuario pode concluir onboarding e nao ver valor imediato.

### 4.2 Recomendacoes de preco

O que esta bom:

- Existe entity `AnalisePreco`.
- Existe endpoint para aceitar sugestao.
- Existe endpoint para registrar preco aplicado.
- Guardrails foram adicionados e a limpeza operacional deixou futuras recomendacoes dentro de -25%/+45%.
- Ha notificacao "Sugestoes de preco disponiveis" criada para 6 usuarios apos revisao operacional.

Lacunas graves:

- Nenhuma recomendacao criada nos ultimos 30 dias.
- Apenas 14 recomendacoes futuras existem agora.
- Apenas 10 de 29 imoveis ativos tem recomendacao futura.
- O `lastCreated` de recomendacao e 2025-09-20.
- `preco_aplicado` nunca foi usado.
- O pipeline de geracao atual depende de eventos futuros, preco Airbnb disponivel e compatibilidade geografica. Com apenas 2 eventos futuros, a cobertura fica muito baixa.

Risco de lancamento:

- Critico. Este e o coracao do produto. Se lancar hoje, muitos anfitrioes podem entrar e nao receber recomendacoes novas.

Decisao recomendada:

- P0 antes de beta: reativar a geracao de recomendacoes recentes e criar uma metrica diaria: `imoveis ativos com recomendacao futura / imoveis ativos`.
- Gate minimo para beta: >= 70% dos imoveis ativos com pelo menos 1 recomendacao futura em regioes cobertas, ou explicacao clara de "sem evento relevante nos proximos dias".
- Gate minimo para publico: >= 85% em SP coberto + recomendacoes geradas nas ultimas 24h/48h.

### 4.3 Eventos

O que esta bom:

- Schema novo esta preparado.
- Admin tem listagem, analytics, import manual e health de coletores.
- Gemini configurado.
- Events enrichment existe.

Lacunas graves:

- Apenas 2 eventos futuros.
- Ultima ingestao foi 2026-05-06.
- Sem atividade nos ultimos 7 dias.
- Sources novas praticamente nao populadas.
- Firecrawl/SerpAPI/Tavily/API Football nao configurados.

Risco de lancamento:

- Critico. Sem eventos futuros, o pricing por evento nao gera valor.

Gate recomendado:

- No minimo 200 eventos futuros em 30 dias para SP antes de campanha publica.
- No minimo 5 fontes ativas, com `lastSeen` em ate 24h/48h.
- Alertas quando `created24h = 0` ou `future < alvo`.

### 4.4 Dataset, IA e prova de ROI

O que esta bom:

- Roadmap de IA esta bem pensado.
- Entities de dataset existem.
- Admin de qualidade existe.
- Strategy pattern existe.

Lacunas graves:

- Dataset em producao vazio.
- Sem historico de ocupacao.
- Sem preco aplicado.
- Sem MAPE.
- Sem cases de ROI.

Risco de lancamento:

- Critico se a comunicacao usar "IA que aumenta receita" como promessa forte.

Gate recomendado:

- Ativar snapshot diario e confirmar crescimento por 7 dias.
- Criar UI/fluxo obrigatorio ou facil para o anfitriao informar preco aplicado.
- Criar pelo menos 3 estudos de caso antes de promessa quantitativa.
- Enquanto isso, posicionar como "assistente de oportunidade de preco", nao "IA comprovada de revenue uplift".

### 4.5 Billing e planos

O que esta bom:

- Planos existem.
- Checkout existe.
- Stripe secret e webhook secret estao configurados.
- Planos Starter/Profissional no banco possuem os 4 Price IDs.
- Quota/paywall por imovel existe.

Lacunas:

- Env vars dos 8 Price IDs nao estao configuradas.
- Status `peding` sugere legado/bug de dados.
- KYC live nao foi confirmado.
- Precisa smoke real: checkout -> webhook -> assinatura -> quota -> cancelamento.

Risco de lancamento:

- Alto para beta pago/publico. Medio para waitlist/beta gratuito.

### 4.6 Stays e modo automatico

O que esta bom:

- O desenho do produto e bom: conectar, sync, aplicar, rollback, guardrail.
- Ha tela de integracoes.
- Ha services e entities para conta/listing.

Lacunas:

- Nenhuma conta conectada.
- Sem `STAYS_API_BASE_URL`.
- Sem `STAYS_TOKEN_ENCRYPTION_KEY`.
- Sem tabela/log de push em producao.
- Sem smoke real.

Risco de lancamento:

- Alto se anunciado como pronto. Baixo se escondido/rotulado como beta privado.

### 4.7 Admin e gestao

O que esta bom:

- Painel admin e bem mais completo que o normal para esta fase.
- Tem users, finance, pricing-config, waitlist, events, coverage, collectors health, funnel, quality e Stays.
- Backend tem endpoints admin protegidos.

Lacunas:

- Alguns paines mostram estrutura, mas os dados estao vazios: dataset, occupancy, Stays, quality.
- Faltam jobs operacionais self-service para reprocessar, backfill, retreino e health de pipeline.
- Falta audit log administrativo.

Risco de lancamento:

- Medio. Para operacao por fundador/dev, suficiente. Para time de suporte/gestores, parcial.

### 4.8 Marketing, analytics e pre-lancamento

O que esta bom:

- Landing e paginas publicas existem.
- Termos, privacidade e consent banner existem.
- Waitlist/referral existe.

Lacunas:

- GA4 ausente.
- Meta Pixel ausente.
- Waitlist sem registros em producao.
- Convite da waitlist ainda tem pendencia de conversao definitiva segundo runbook.

Risco de lancamento:

- Medio. Pode gerar interesse, mas sem analytics fica dificil aprender com campanha.

### 4.9 Infra, confiabilidade e release process

O que esta bom:

- Railway atual esta com deployments `SUCCESS`.
- Front e backend respondem.
- Backend `/health` e `/health/live` respondem.
- Sentry configurado.
- Backups foram feitos antes de manutencao.

Lacunas:

- Servico `urban-pipeline` tinha dominio publico retornando 502, provavelmente por ser worker sem HTTP.
- KNN/webscraping retornam 401 no root, o que pode gerar ruido em monitoramento.
- Producao precisou de hotfixes diretos em `main` apos merge.
- Staging/release gate nao foi comprovado como obrigatorio.

Risco de lancamento:

- Medio/alto para publico pago, porque incidentes de deploy ainda podem escapar.

---

## 5. Principais riscos antes do lancamento

### P0-Produto-001 - O core de recomendacao nao esta gerando recomendacoes recentes

Evidencia:

- `analise_preco.created30d = 0`.
- `analise_preco.lastCreated = 2025-09-20`.
- Apenas 14 recomendacoes futuras.

Impacto:

- Usuario entra, cadastra imovel e pode nao receber valor real.

Acao:

- Corrigir e monitorar job de geracao de recomendacoes.
- Criar painel/admin metric: recomendacoes novas por dia, cobertura por imovel, falhas por motivo.

### P0-Produto-002 - Motor de eventos esta sem cobertura futura suficiente

Evidencia:

- Apenas 2 eventos futuros.
- Nenhum evento criado nos ultimos 7 dias.
- Sources novas quase vazias.

Impacto:

- Sem evento, nao ha gatilho para recomendacao de preco.

Acao:

- Reativar coletores e ingestion.
- Configurar fontes pagas/publicas ou operar curadoria manual inicialmente.
- Definir alvos de cobertura por cidade/janela.

### P0-Produto-003 - Promessa de ROI nao e comprovavel hoje

Evidencia:

- `preco_aplicado = 0`.
- `occupancy_history = 0`.
- `price_snapshots = 0`.
- `event_proximity_features = 0`.

Impacto:

- Risco comercial, juridico e reputacional se a promessa for quantitativa.

Acao:

- Implementar captura de ground truth e casos auditados.

### P0-Produto-004 - Stays nao esta pronto para uso real

Evidencia:

- Sem envs criticas.
- Sem contas/listings/pushes.
- Sem tabela `price_updates` no banco atual.

Impacto:

- Modo automatico nao pode ser vendido como pronto.

Acao:

- Esconder modo automatico ou limitar a beta privado.
- Rodar smoke completo com sandbox/conta real.

### P0-Produto-005 - Billing precisa validacao ponta-a-ponta antes de cobrar

Evidencia:

- 0/8 env vars de Price IDs configuradas, apesar de IDs no banco.
- Status legado inconsistente em pagamentos.
- KYC nao confirmado.

Impacto:

- Checkout ou quota pode falhar no primeiro cliente pago.

Acao:

- Smoke completo Stripe live/test com webhook.
- Saneamento de status e relatorio de sync Stripe.

---

## 6. Plano recomendado de lancamento

### Fase A - 48 a 72 horas: tornar pre-lancamento seguro

Objetivo: poder ligar marketing de waitlist sem prometer demais.

Checklist:

- Ativar GA4 e Meta Pixel.
- Testar `/lancamento -> /create -> waitlist -> admin invite -> aceite`.
- Corrigir/fechar TODO do aceite de convite criando User real, se ainda aberto.
- Garantir `PRELAUNCH_MODE=true` no backend e coerencia visual no frontend.
- Revisar copy publica para nao prometer ROI quantitativo ainda.
- Adicionar dashboard simples de waitlist por source/referral.

Saida esperada:

- Site publico pronto para captar leads e aprender canal.

### Fase B - 1 semana: reanimar eventos e recomendacoes

Objetivo: fazer o produto gerar valor novamente para imoveis reais.

Checklist:

- Corrigir/ativar coletores de eventos.
- Configurar ou substituir fontes faltantes.
- Criar curadoria manual de eventos SP como fallback inicial.
- Rodar reprocessamento e provar que recomendacoes novas aparecem com `criado_em` atual.
- Criar alerta quando `events.future < 200`, `events.created24h = 0` ou `pricing.created24h = 0`.
- Criar motivo de "sem recomendacoes" para o usuario quando nao houver evento relevante.

Saida esperada:

- Pelo menos 70% dos imoveis ativos em SP com recomendacao futura ou empty state explicativo.

### Fase C - 1 a 2 semanas: beta fechado

Objetivo: validar com poucos anfitrioes, alta assistencia manual.

Checklist:

- 5-10 anfitrioes beta.
- Cada imovel com setup revisado.
- Recomendacoes explicaveis no dashboard.
- Captura de aceite e preco aplicado.
- Snapshot diario ativo por 7 dias.
- Relatorio semanal de: recomendacoes geradas, aceitas, aplicadas, diferenca de preco, feedback.

Saida esperada:

- Primeiros cases qualitativos e base para ROI.

### Fase D - antes de cobrar publicamente

Objetivo: transformar estrutura em produto comercial defensavel.

Checklist:

- Stripe KYC confirmado.
- Checkout/webhook/quota/cancelamento testados.
- 8 Price IDs resolvidos no mecanismo oficial usado pelo app.
- MAPE ou metrica substituta com amostra minima.
- 3 cases auditados de ROI ou uplift/preco aplicado.
- Staging obrigatorio e branch protection.
- Runbook de incidente e rollback.

Saida esperada:

- Beta pago limitado.

---

## 7. Recomendacao de narrativa para socios e mercado

### O que podemos dizer com seguranca

- "A Urban AI ja tem uma plataforma funcional em producao para cadastrar imoveis, mapear eventos proximos e gerar recomendacoes de preco."
- "Estamos em fase de pre-lancamento e beta controlado para validar recomendacoes com anfitrioes reais."
- "A arquitetura de IA e dataset proprietario ja esta preparada para evoluir conforme dados reais entram."
- "O modo automatico via Stays esta planejado/estruturado para beta privado."

### O que eu nao recomendaria dizer ainda

- "Aumente 30% sua receita" como promessa garantida.
- "IA treinada com dataset proprietario" como fato atual de producao.
- "Modo automatico Stays pronto" para publico geral.
- "Cobertura total de eventos em SP" como situacao atual.

### Copy mais segura para lancamento

> Receba alertas de eventos proximos ao seu imovel e recomendacoes de preco para capturar dias de maior demanda.

> Comece por recomendacoes manuais; o modo automatico fica disponivel em beta para anfitrioes selecionados.

---

## 8. Proximos passos objetivos

1. Corrigir cobertura de eventos futuros.
2. Fazer recomendacoes novas aparecerem com data atual.
3. Ligar dataset: `PriceSnapshot`, ocupacao e preco aplicado.
4. Instrumentar pre-lancamento com GA4/Pixel e waitlist de verdade.
5. Fazer smoke Stripe completo e confirmar KYC.
6. Esconder/rotular Stays como beta ate ter credenciais e smoke real.
7. Criar staging/release gate antes de proximo merge grande.
8. Revisar narrativa comercial e remover promessas quantitativas ate cases.

---

## 9. Nota final

O sistema nao esta "ruim"; pelo contrario, ele tem muita fundacao boa e varias pecas que startups normalmente nem tem nessa fase. O problema e outro: o roadmap avancou em largura, mas o lancamento exige profundidade no core.

Para lancar de verdade, a pergunta nao e "tem tela?", "tem entity?", "tem endpoint?". A pergunta e:

- Um anfitriao real cadastra um imovel hoje e recebe recomendacao nova?
- Essa recomendacao faz sentido?
- Ele aplica?
- Conseguimos medir o que aconteceu depois?
- Conseguimos cobrar sem quebrar?
- Conseguimos operar sem terminal e sem susto?

Hoje, a resposta ainda e parcial. O caminho mais seguro e: pre-lancamento agora, beta fechado apos corrigir eventos/recomendacoes, beta pago apos ROI/cobranca/ground truth.
