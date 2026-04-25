# Urban AI — Base de Conversa com os Sócios
**Versão 1.0 · 24/04/2026 · Para:** Fabrício, Rogério (sócios) · **De:** Gustavo Macedo (fundador-operador)

> Este documento é a **base centralizada de status** para nossas reuniões. Resume tudo o que foi feito, onde estamos, para onde vamos e quais decisões dependem de vocês. Linguagem direta, sem jargão técnico desnecessário.

---

## Em uma página: onde estamos

A Urban AI saiu da Lumina Lab em março/2026 e em ~7 semanas teve **transição de infra** (sprint inicial de 14 dias, 53 entregas) + **modernização técnica completa** (~50 commits em sessões intensas de 22–24/04). Hoje:

- **Sistema rodando 100%** em infraestrutura própria (Railway, MySQL, Redis, S3) — custo ~R$ 1.000/mês
- **Produto funcional**: anfitrião cadastra imóvel, recebe sugestão diária de preço quando há evento próximo, pode aplicar manualmente ou via integração Stays (modo automático)
- **Hardening de segurança completo**: senhas migradas para bcrypt, JWT seguro com refresh, rate limiting, CSP, CORS endurecido — pronto para tráfego pago sem incidente
- **Captura de dataset proprietário ativa**: todo dia o sistema grava preços de imóveis cadastrados + comparáveis da vizinhança, construindo a base que vai virar nosso moat
- **Painel admin** existindo pela primeira vez (`/admin`) com KPIs de produto, IA, dataset e Stays

**O que ainda trava o lançamento (decisões de vocês):**
1. KYC Stripe submetido (sem isso, cobrança real bloqueada)
2. Orçamento de marketing aprovado (R$ 4.340–8.170/mês)
3. Stays validada como parceiro e contato comercial iniciado
4. Decisão de contratação de dev contractor

**Go-live realista:** semanas 15–17 (mid-late julho/2026).

---

## Parte 1 — O que entregamos até hoje

### 1.1 Migração da Lumina (concluída em D14, 20/03)

53 entregas no sprint, de Diagnóstico (F1) a Bugs/Segurança (F4). Sistema todo migrado:
- Backend NestJS, Frontend Next.js, Pipeline Prefect, 8 Scrapyd spiders, motor KNN
- Banco MySQL Railway com backup automático
- Redis Upstash, S3 bucket próprio
- Domínio `app.myurbanai.com` ativo, SSL OK
- Sentry, UptimeRobot, Mailersend, Stripe (test mode) configurados

### 1.2 Hardening operacional F5C (concluído em 24/04 — 50+ commits)

Tudo o que estava marcado como CRIT ou Prioridade 1 na auditoria de 16/04 foi resolvido:

| O quê | Por que | Estado |
|---|---|---|
| Chave RapidAPI exposta no código | Risco de leak grave | Movida para env var, repo virou privado |
| Senhas em SHA-256 sem salt | Vulnerável a rainbow table | Migradas para bcrypt(12) com lazy rehash transparente — usuários atuais não percebem mudança |
| `JWT_SECRET = "mysecretkey"` hardcoded | Qualquer um podia assinar JWT válido | Lido de env var; backend não sobe sem |
| Logs gravavam senhas em texto puro | Risco de leak via logs | 4 leaks removidos |
| Sem rate limit em `/auth/*` | Vulnerável a brute force | 5 req/min por IP |
| Sem `helmet` / CSP | Risco XSS, clickjacking | Configurado com whitelist Stripe/Sentry/GMaps |
| `synchronize: true` do TypeORM | Schema podia ser destruído em deploy ruim | Cutover para migrations versionadas |
| 31 arquivos de lixo + dumps SQL no repo | Inflação + leak histórico | Removidos; .gitignore reforçado |
| 84 testes unitários verdes | Antes 0 | Auth, Payments, KNN, Stays cobertos |
| Suite Playwright (smoke + a11y) | Antes 0 | Configurada |
| CI rodando em main+staging | Antes só mirror | GitHub Actions ativo |

### 1.3 Captura de dataset proprietário (24/04)

Antes: o sistema **gerava** sugestões mas **não armazenava** os comparáveis nem o preço base no tempo. Era ouro indo embora.

Agora — **3 frentes de captura ativas**:
- **Cron diário 03:30 BRT** snapshot do preço de cada imóvel cadastrado
- **Persistência automática dos comparáveis** que aparecem em cada análise (5–30 pontos novos por análise)
- **Endpoint de ground truth**: anfitrião confirma preço **realmente aplicado** → vira insumo direto para validar a promessa "+30% receita"

Resultado: dataset cresce passivamente sem fricção comercial. Quando o produto tiver 100 anfitriões ativos por 90 dias, teremos ~9.000 pontos próprios para treinar.

### 1.4 Cobrança por imóvel — F6.5 (24/04)

Mudança comercial pedida por vocês: cobrança **por imóvel × ciclo de billing**, não por conta. Implementado:

- 4 ciclos: mensal, trimestral, semestral, anual
- Desconto progressivo: -15%, -25%, -40% (anual = melhor valor)
- Mensal mais caro (ancora premium)
- Quando anfitrião cadastra mais imóveis do que contratou, paywall oferece upsell de quantidade

Exemplo Profissional: R$ 197/imóvel/mês mensal, R$ 118/imóvel/mês anual. 5 imóveis no anual = R$ 590/mês × 12 = R$ 7.080 trava de receita.

**Pendente de vocês:** revisar a tabela final em [docs/roadmap-pos-sprint.md F6.5](roadmap-pos-sprint.md#f65) e me autorizar a criar os 8 Stripe Price IDs.

### 1.5 Integração com a Stays (24/04)

Fundação técnica completa para o modo automático:
- Quando anfitrião conectar conta Stays, podemos pushar preço direto no Airbnb
- Guardrails: ±25% por padrão (proteção contra erro do modelo)
- Idempotência: o mesmo preço/data não é pushado 2x mesmo em retry
- Rollback: anfitrião pode reverter qualquer push
- Modo automático aplica via cron hora-em-hora sem intervenção humana
- 13 testes unitários cobrindo guardrails, idempotência, falhas

**Pendente de vocês:** validar que **Stays** (stays.net, sediada em Copacabana/RJ) é mesmo o representante Airbnb que vocês mencionaram. Já tenho one-pager pronto e roteiro de WhatsApp/LinkedIn para iniciar contato.

### 1.6 Painel admin (24/04)

**Antes:** não existia. Quem é admin via SQL direto no banco quando precisava ver alguma coisa.

**Agora:** `/admin` autenticado por role com 6 páginas:
- **Visão geral** — usuários, imóveis, eventos, análises, taxa de aceite, assinaturas, estado da IA
- **Usuários** — gestão de roles e ativação
- **Eventos** — cobertura, categorias, top próximos
- **Stays** — saúde da integração, push history
- **Funil** — signup → análise → aceito → aplicado
- **Qualidade** — MAPE da IA, ocupação por imóvel

Honestidade: cobre ~60% do que admin completo ideal teria. Falta receita/MRR/churn, alertas Sentry inline, GA4, suporte. Plano detalhado em [docs/runbooks/admin-evolution.md](runbooks/admin-evolution.md).

---

## Parte 2 — Estado da IA e o moat

### 2.1 Como a IA funciona hoje (Tier 0)

É honesto descrever como **engine de regras sofisticada**, não "IA aprendendo":

```
multiplicador = 1.0
+ 10-20% se categoria do imóvel = Standard/Premium
+ 20-50% se atratividade ao evento é alta
+ 30% se travel time ≤ 15min do evento
+ até 50% baseado em relevância do evento (Gemini AI dá score 0-100)

preço_sugerido = preço_base × multiplicador
```

Funciona. Faz sentido. Mas é regra estática. Para virar **IA que aprende e cresce a receita +30% comprovado**, precisamos do modelo treinado com histórico real.

### 2.2 O caminho do moat — Tiers de IA

| Tier | Algoritmo | Exige | Status |
|---|---|---|---|
| **Tier 0** (hoje) | Regras + multiplicadores | nada | ✅ em produção |
| **Tier 1** | Regras + KNN treinado em dados reais | dataset 100 imóveis × 7 dias | 🔄 scaffold pronto, falta plug do dataset |
| **Tier 2** | XGBoost (Python microservice) | 500 × 30 dias | ⏳ 2–3 sprints após Tier 1 |
| **Tier 3** | XGBoost validado por MAPE ≤ 15% | 5.000 × 90 dias | ⏳ 6 meses |
| **Tier 4 (moat)** | Rede neural híbrida (CNN+LSTM+MLP) | 10.000 × 12 meses | ⏳ 18–24 meses |

**A peça crucial:** implementamos `AdaptivePricingStrategy` que **escolhe automaticamente** qual modelo usar baseado no tamanho do dataset. Não precisa de deploy entre tiers — quando o dataset crescer, o produto migra sozinho.

Por que **modelo neural híbrido** vira moat real:
- **CNN** sobre o mapa de SP captura padrões geográficos não-lineares
- **LSTM** sobre 30 dias de eventos + calendário aprende sazonalidade complexa
- **Embedding de bairro** transfere conhecimento para imóveis novos (sem cold start)
- **Dataset proprietário** crescendo → modelo melhor → mais usuários → mais dataset (loop virtuoso)
- **Concorrente que entrar precisa reconstruir tudo** — código é replicável, dataset não

Antes do Tier 4 estar pronto (18–24 meses), **Tier 2/3 já é diferencial competitivo na América Latina**. PriceLabs/Beyond/Wheelhouse usam variações de XGBoost.

### 2.3 Onde vamos pegar dataset (sem precisar 1.000 anfitriões antes)

Pesquisa real confirmou 3 fontes viáveis hoje:

1. **AirROI** — free tier com 28.184 listings de SP, ADR, ocupação. Fonte mais robusta para começar imediatamente
2. **Base dos Dados (BigQuery)** — espelho do InsideAirbnb com licença CC BY 4.0. Histórico parcial mas grátis
3. **InsideAirbnb data request** — formulário oficial, lead time variável

Acelerador opcional: **Airbtics** US$ 29/mês.

Achado importante: **InsideAirbnb não cobre SP no portal direto** (só Rio). Tinha sido premissa anterior nossa que não bateu — corrigido.

A combinação dessas fontes + dataset que estamos coletando passivamente nos coloca em **Tier 2 em 6–8 semanas** após começarmos a importar.

---

## Parte 3 — Eventos: gap mais importante para qualidade da IA

### 3.1 O problema

Hoje pegamos eventos de Eventim, Sympla, Ingresse, Ticketmaster (8 spiders no total). Cobre **shows e ingressos venda no varejo**. Não cobre:

- **Conferências** (RD Summit, Web Summit Rio, Bett, PMI)
- **Cursos profissionais** (Sebrae executivo, FGV, Insper)
- **Jogos em estádios** (Allianz, Morumbi, Itaquera, Pacaembu)
- **Centros de eventos** (Anhembi, Expo Center Norte, São Paulo Expo)
- **Eventos pequenos** com impacto local (buffets, salões, casas noturnas)

Resultado: o anfitrião próximo ao Allianz Parque **não recebe pico em dia de jogo**. A promessa "+30% receita" cai.

### 3.2 Solução em 3 camadas (autorizada por vocês em 24/04)

**Camada 1 — APIs oficiais** (~2 semanas)
- Trocar scraping de Sympla por API legítima
- Eventbrite API (conferências, cursos)
- Prefeitura SP Open Data
- api-football.com (Allianz, Morumbi, Itaquera)

**Camada 2 — Firecrawl + IA extraction** (~3 semanas, US$ 16/mês)
- Sites alvo: anhembi.com.br, allianzparque.com.br/eventos, rdsummit.com.br, sebrae.com.br/sites/sp/eventos, fgv.br/cursos-executivos, expocenternorte.com.br, etc.
- LLM extrai dados estruturados de qualquer página de evento
- Resistente a mudança de layout (vs scraping que quebra)

**Camada 3 — Curadoria humana** (~1 semana)
- Form admin para inserir evento manualmente
- Import semestral PMI / ABRH
- Parceria SPTuris (feed oficial)

**Custo total adicional:** ~US$ 40/mês. **Cobertura alvo S10:** ≥80% dos eventos relevantes em SP detectados em <24h.

KPIs já visíveis no painel admin (`/admin/events`):
- Cobertura geográfica (% com lat/lng)
- Enriquecimento Gemini (% com relevância)
- Volume futuro 7/30/90 dias
- Mega-eventos próximos (relevância ≥ 80)
- Distribuição por categoria, cidade, faixa de relevância
- Top 10 próximos por relevância

---

## Parte 4 — Cronograma e marcos críticos

### Próximas 2-3 semanas (S5–7) — destrava lançamento

| Quando | Marco | Quem |
|---|---|---|
| S5 | KYC Stripe submetido | Gustavo + sócios |
| S5 | Aprovar orçamento marketing R$ 4.340-8.170/mês | Sócios |
| S5 | Validar Stays + iniciar contato comercial | Gustavo + sócios |
| S5-6 | Decisão sobre contractor dev | Sócios |
| S6 | Conta AirROI + projeto GCP/BigQuery | Gustavo |
| S6 | Provisionar staging Railway (3-4h) | Gustavo |
| S6 | Setar 8 Stripe Price IDs F6.5 + env vars | Gustavo |
| S6-7 | Tier 1 da IA — completar 3 stubs de feature engineering | Gustavo / dev |
| S7 | Camada 1 do motor de eventos (Sympla + Eventbrite + Prefeitura) | Gustavo / dev |

### Sprint S8-12

| Quando | Marco |
|---|---|
| S8-9 | Camada 2 do motor de eventos (Firecrawl em 5 sites PoC) |
| S9-10 | Camada 2 ampliada para 30 sites |
| S9-10 | XGBoost shadow mode em prod |
| S10-11 | Beta fechado com 5–10 anfitriões reais |
| S11-12 | 3 cases auditados de ROI |

### Go-live oficial: **S15–17** (mid-late julho/2026)

Razão de não ser antes: KYC + parceria Stays + dataset começando + 3 cases de ROI são pré-requisitos para landing converter de verdade. Lançar antes vira gasto de mídia em produto sem prova.

### Moat (Tier 4) — 18–24 meses pós-go-live

```
Hoje (S5)        ─▶ Captura passiva ativa, AdaptiveStrategy default
S5-6             ─▶ Datasets externos plugados
S7-8             ─▶ XGBoost shadow mode
S9               ─▶ XGBoost vira Tier 2 automaticamente
S15-17           ─▶ Go-live oficial
~12 meses        ─▶ Tier 3 — XGBoost validado MAPE ≤15%
~18-24 meses     ─▶ Tier 4 (moat) — modelo neural híbrido
```

---

## Parte 5 — Decisões pendentes de vocês

### Urgentes (esta semana)

1. **KYC Stripe** — reunir documentos dos sócios majoritários + contrato social Urban AI + dados conta PJ. Sem isso, cobrança real fica bloqueada.

2. **Aprovar orçamento de marketing** — R$ 4.340–8.170/mês:
   - Gestão de tráfego pago (Google + Meta Ads): R$ 1.500–2.500
   - Verba de mídia direta: R$ 1.500–3.000
   - Design de posts (8–12/mês): R$ 800–1.500
   - Produção vídeo IA (CapCut/HeyGen): R$ 540–1.170

3. **Validar Stays como parceiro Airbnb** — confirmar se a empresa que vocês mencionaram como "representante Airbnb" é mesmo a Stays S.A. (stays.net, Copacabana/RJ, único Preferred+ Software Partner LATAM). Se sim, autorizar Gustavo a iniciar contato comercial pelo WhatsApp +55 21 96706-9723 com one-pager pronto.

4. **Decisão de time** — 3 caminhos não-exclusivos:
   - Contratar dev contractor pleno TS/Node (~R$ 12-20k/mês)
   - Sócio em vendas dedicado (Fabrício ou Rogério)
   - Agência de marketing parceira (dentro do orçamento de marketing)

   Sem essa decisão, velocidade cai linearmente a partir de S7.

### Médio prazo (próximas 2 semanas)

5. **Tabela final de F6.5 (cobrança por imóvel)** — revisar:
   - Starter: R$ 97/imóvel/mês mensal → R$ 58 anual
   - Profissional: R$ 197/imóvel/mês mensal → R$ 118 anual
   - Escala: sob consulta
   
   Se aprovado, autorizar criação de 8 Stripe Price IDs.

6. **Modelo de parceria Stays** — após primeiro contato:
   - Modelo 1: trade gratuidade × dataset agregado anonimizado (recomendado começar por aqui)
   - Modelo 2: revenue share 20-30% (após piloto)
   - Modelo 3: white-label "Stays Smart Pricing" (longo prazo)

### Quando atingirem volume

7. **DPO formal** — quando passar de 1.000 usuários, pode fazer sentido transferir DPO de Gustavo para um sócio jurídico ou contratar externamente.

8. **Expansão geográfica** — começamos em SP. Quando? RJ é segundo maior mercado LATAM Airbnb. Stays já cobre RJ inteiro.

---

## Parte 6 — Custos e investimento

### Custos operacionais já confirmados (mensal)

| Item | Valor |
|---|---|
| Railway Pro (5 serviços + MySQL + backups) | ~R$ 1.000 |
| Upstash Redis (free tier) | R$ 0 |
| AWS S3 (data lake) | < R$ 5 (crédito grátis) |
| Google Cloud Maps API | R$ 0 (R$ 1.759 crédito até 15/06/2026) |
| Mailersend (transacional) | ~R$ 100 |
| Sentry (free tier) | R$ 0 |
| Prefect Cloud (free tier) | R$ 0 |
| Domínios + Hostinger | ~R$ 50 |
| **Total infra** | **~R$ 1.155/mês** |

### Custos novos a aprovar

| Item | Valor |
|---|---|
| **Marketing (a aprovar)** | R$ 4.340-8.170/mês |
| Firecrawl (motor de eventos Camada 2) | US$ 16 (~R$ 80) |
| api-football.com Basic (jogos) | US$ 19 (~R$ 100) |
| Airbtics dataset (opcional, acelerador) | US$ 29 (~R$ 150) |
| Contractor dev pleno (se decidirem) | R$ 12-20k |
| Advogado LGPD pontual | R$ 3-8k |
| **Total novo (sem contractor/advogado)** | **R$ 4.670-8.500/mês** |

### Custos pós-go-live (estimados)

- Mídia paga ativa: R$ 5.000-15.000/mês
- Eventual upgrade de plano Railway por crescimento
- Stripe taxa: 4,99% + R$ 0,39 por transação (já contabilizado em receita líquida)

---

## Parte 7 — Como acompanhar o status

### Reuniões propostas

- **Semanal (15 min)** — status rápido: WhatsApp ou Notion
- **Quinzenal (30 min)** — relatório de progresso (.docx) cobrindo KPIs da fase, tarefas concluídas, próximas 2 semanas
- **Por fase concluída** — relatório de entrega cobrindo resumo executivo, entregas, pontos abertos

### Painel admin

Após primeiro admin ser criado (`/admin`), vocês podem ver em tempo real:
- Quantos usuários ativos
- Quantos imóveis cadastrados
- Quantas análises geradas / aceitas / aplicadas
- Estado atual da IA (qual tier, qual modelo, dataset crescendo?)
- Saúde da Stays (push history)
- Funil de produto

Acesso via `/admin` autenticado com role admin.

### Documentos principais

| O quê | Onde |
|---|---|
| **Roadmap completo** (técnico) | [docs/roadmap-pos-sprint.md](roadmap-pos-sprint.md) |
| **Estado da IA + dataset + moat** | [docs/estado-da-IA-e-evolucao.md](estado-da-IA-e-evolucao.md) |
| **Fase Eventos autorizada** | [docs/fase-eventos-cobertura-total.md](fase-eventos-cobertura-total.md) |
| **Próximas ações operacionais** | [docs/next-actions.md](next-actions.md) |
| **Decisões arquiteturais** | [docs/adr/](adr/) |
| **Auditoria técnica original** | [docs/avaliacao-projeto-2026-04-16.md](avaliacao-projeto-2026-04-16.md) |
| **Outreach Stays** | [docs/outreach/](outreach/) |
| **Política LGPD interna** | [docs/lgpd/politica-privacidade-interna.md](lgpd/politica-privacidade-interna.md) |
| **SLO e SLA** | [docs/slo.md](slo.md) |

---

## Resumo em 5 frases

1. Sistema 100% migrado da Lumina, em infra própria, com hardening de segurança completo e 84 testes automatizados.
2. Captura passiva de dataset proprietário ativa — começamos a construir o ativo que vira moat de longo prazo.
3. Arquitetura de IA preparada com auto-switch de modelo (regras hoje → XGBoost em 2 meses → modelo neural híbrido em 18-24 meses).
4. Painel admin existe pela primeira vez, cobre ~60% do que ideal teria, plano de evolução documentado.
5. Lançamento realista S15-17 (mid-late julho/2026) condicionado a 4 decisões de vocês: KYC Stripe, orçamento marketing, validar Stays, contratar dev.

---

*Documento mantido por Gustavo Macedo. Última atualização: 24/04/2026. Para discutir qualquer ponto: WhatsApp ou agendar reunião.*
