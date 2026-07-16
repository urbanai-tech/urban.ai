# Auditoria Documental e Estado Atual

Data: 2026-05-24  
Escopo auditado: documentos Markdown, DOCX, PDFs, READMEs, ADRs, runbooks, evidencias, roadmaps e codigo dos principais servicos.

## Resumo executivo

A documentacao da Urban AI e abundante e valiosa, mas esta fragmentada em ciclos diferentes. Existem tres camadas convivendo:

1. **Documentacao de transicao, marco/abril de 2026:** boa para historico, mas parte dela descreve on-premise, FastAPI, SendGrid, KNN separado e processo operacional antigo.
2. **Documentacao operacional moderna, maio de 2026:** ADRs, runbooks, evidencias, status de roadmap, release gates e auditorias recentes. Esta e a camada mais confiavel para operacao atual.
3. **Documentacao de produto/estrategia em evolucao:** planos de Event Radar, pricing intelligence, outcomes, auto-apply e materiais executivos. Esta camada precisa virar uma fonte de verdade V2.

Veredito: a Urban AI tem maturidade documental acima do normal para o estagio, mas precisa consolidar as fontes em uma V2 oficial para reduzir ruido, evitar promessas antigas e acelerar onboarding de time, socios e investidores.

## Inventario resumido

| Area | Evidencias encontradas | Estado |
|---|---|---|
| Roadmaps | `roadmap.md`, roadmaps por sprint, roadmaps 4 tracks, status 2026-05-22/23 | Ricos, mas redundantes e com datas/percentuais conflitantes |
| Arquitetura | README raiz, READMEs por servico, ADRs 0001-0009, docx 07/11 | Boa base, precisa uma arquitetura V2 unica |
| PRD e produto | DOCX 12, auditorias de lancamento, planos Event Radar | Forte, mas precisa PRD atualizado para V2 |
| Design system e marca | `docs/product/DESIGN-SYSTEM.md`, guardrails do front, DOCX 19/20 arquivados | Forte no código atual; DOCX e Markdown anteriores são históricos |
| Operacao e runbooks | `docs/runbooks/`, incident-response, SLO, backups, release gate | Muito forte, precisa indice operacional unico |
| Legal e LGPD | docs LGPD, termos, privacidade, DPA checklist, briefing v3 | Boa base, revisar donos, DPAs e canal de privacidade |
| Evidencias e QA | `docs/evidence/`, e2e reports, Playwright, Jest, pytest | Forte localmente, precisa staging/DB real como trilha padrao |
| Materiais executivos | relatorios de status, PDFs para socios, apresentacao operacional | Bons, mas datados e tecnicos demais para investidor nao tecnico |

## Documentos DOCX numerados

O pacote histórico `docs/archive/docx/urban-ai-documentacao/` possui 32 documentos Word cobrindo runbook, servicos externos, variaveis, infraestrutura, acessos, Stripe, arquitetura, ERD, APIs, divida tecnica, fluxo de dados, PRD, jornada, setup, deploy, padroes de codigo, spiders, KNN, design, marca, telas, pricing, KPIs, seguranca, LGPD, backup, incidentes, monitoramento, changelog, termos, privacidade e transferencia de contas. Ele foi substituído pelas fontes canônicas em `docs/product/`, `docs/runbooks/` e pelo plano mestre.

### Pontos fortes

- Cobertura ampla dos temas que uma due diligence costuma pedir.
- Existencia de PRD, ERD, APIs, KPIs, seguranca, LGPD, runbook e marca.
- Boa evidencia de que houve entendimento sistematico do legado recebido.

### Pontos desatualizados

- Parte dos documentos ainda fala em **on-premise**, **FastAPI principal**, **SendGrid**, **spiders semanais** e **KNN desintegrado**.
- O design system antigo cita azul escuro como cor secundaria e nao reflete totalmente a versao atual com `urban-manifesto`, `urban-admin`, `urban-app` e tokens CSS vivos.
- Os documentos de deploy e infraestrutura nao refletem com clareza o estado Railway, MySQL, Sentry, Stripe, Stays, service account de ingestao e release gates recentes.
- O mapa de APIs numerado e curto demais para a superficie atual, que possui 34 controllers e 215 endpoints HTTP no backend.

### Acao recomendada

Manter os DOCX numerados como "biblioteca historica de transicao" e criar uma nova documentacao V2 em Markdown primeiro. Quando a V2 estiver aprovada, gerar versoes DOCX/PDF executivas a partir dela.

## PDFs e materiais historicos

Foram identificados relatórios de status, roadmap e apresentacoes executivas, incluindo:

- `Roadmap Urban Ai.pdf`
- `Relatorio Status - Urban.pdf`
- `Relatorio Status 2.pdf` a `Relatorio Status 5.pdf`
- `Relatorio Socios Abril 2026.pdf`
- `Apresentacao Operacionalizacao Urban Ai.pdf`
- `Projeto Urban AI KNN.pdf`
- `docs/lgpd/BRIEFING COMPLETO - Urban AI.pdf`

### Leitura

Os PDFs contam uma boa historia de execucao: transicao de infraestrutura, sprint de migracao, assumimento operacional, estabilizacao e crescimento. Para investidores, porem, a narrativa precisa ficar menos tecnica e mais orientada a:

- problema de mercado;
- solucao;
- tracao operacional;
- qualidade de execucao;
- defensabilidade;
- proximos marcos;
- uso de capital.

## Roadmaps

### O que esta bom

- Ha varias leituras de progresso por frente.
- A evolucao de maio mostra maturidade: Event Radar, pricing intelligence, auto-apply, outcomes, release gates e auditabilidade.
- Os status recentes ja sao honestos ao separar "tecnico local" de "validado em staging/producao".

### Problema

Existem muitos documentos com percentuais diferentes. Alguns dizem 97%, 98%, 99% ou 68-74% dependendo do recorte. Isso e correto tecnicamente, mas confunde socios e investidores.

### Padrao V2 recomendado

Separar sempre quatro percentuais:

| Percentual | Significado |
|---|---|
| Produto/codigo local | O que compila, testa e funciona localmente |
| Release controlado | O que esta pronto para subir com smoke e rollback |
| Operacao real | O que foi validado com ambiente, dados e credenciais reais |
| Valor comprovado | O que ja gerou outcome mensuravel em cliente real |

Assim a Urban pode dizer algo honesto e forte: "A fundacao tecnica esta muito avancada; a V2 agora foca em dados reais, evidencia de valor e escala operacional."

## Arquitetura e codigo

### Estado real observado

- Monorepo com cinco blocos principais: backend NestJS, frontend Next.js, pipeline Prefect, webscraping Scrapy e KNN legado aposentado.
- Backend com 32 modules, 34 controllers, 215 endpoints e 41 entities.
- Frontend com 75 page routes no `src/app`, 22 componentes UI compartilhados e 16 componentes admin.
- Webscraping com spiders para Blue Ticket, Even3, Eventim, Ingresse, Sympla, Ticket 360 e Ticketmaster.
- Pipeline Prefect para disparo de spiders e processamento S3/MySQL.
- KNN standalone aposentado, mantido como referencia historica.

### Pontos fortes

- ADRs documentam escolhas criticas: monolito NestJS, MySQL, Railway, secrets e aposentadoria do KNN.
- A arquitetura ja tem separacao razoavel entre host, admin, eventos, pricing, billing, Stays, comunicacoes e operacao.
- O Event Radar recente mostra direcao correta: transformar evento em demanda, impacto por imovel e decisao de preco.

### Lacunas

- Falta um mapa tecnico oficial sempre atualizado.
- Alguns endpoints legados ainda convivem com endpoints novos.
- Rotas duplicadas como `/maps` e `/maps-bkp`, `/painel` e `/dashboard`, `/price` e `/plans` precisam decisao de produto.
- O service client do frontend (`api.ts`) concentra muitos contratos e deve ser quebrado por dominio na V2.

## Produto e valor

### O que a Urban faz hoje

A Urban AI ajuda anfitrioes e gestores de hospedagem a enxergar eventos relevantes perto dos imoveis, entender quando a demanda local pode subir e receber recomendacoes de preco. O sistema tambem oferece painel administrativo para monitorar usuarios, propriedades, eventos, fontes, jobs, pricing, ROI, financeiro, Stays, comunicacoes e qualidade.

### Maturidade atual

| Frente | Leitura |
|---|---|
| Produto web | Forte para beta controlado |
| Admin/operacao | Acima da media para estagio inicial |
| Eventos e radar | P0/P1 tecnico muito avancado, falta staging/DB real |
| Pricing | Motor funcional, precisa mais outcomes reais |
| ROI | Existe, mas deve separar confirmado, projetado e potencial |
| Stays | Fundacao boa, ainda beta assistido |
| Billing | Base boa, precisa smoke/KYC/flows reais |
| Design | Atual forte, docs antigas precisam convergir |
| Investidor | Falta narrativa nao tecnica consolidada |

## Principais lacunas para V2

1. **Fonte de verdade documental:** substituir multiplos roadmaps por um roadmap V2.
2. **Staging isolado:** criar ambiente nao-producao com DB staging e release gate obrigatorio.
3. **Dados reais de outcome:** capturar aceite, aplicacao, reserva, receita e feedback.
4. **Decision snapshot:** transformar cada recomendacao em objeto auditavel com drivers, confianca, cenarios e versao.
5. **Geocoding e dados externos:** corrigir Google Geocoding 403 e formalizar fontes.
6. **Rotas legadas:** decidir o que fica, redireciona ou sai.
7. **API client modular:** separar contratos do frontend por dominio.
8. **Marca e design V2:** alinhar DOCX antigos ao design system vivo.
9. **Material executivo:** traduzir execucao tecnica em historia de negocio.
10. **Provas de valor:** criar 3 a 5 cases auditados antes de promessa quantitativa forte.

## Classificacao de prontidao

| Categoria | Status recomendado |
|---|---|
| Pre-lancamento | Pronto com ajustes de analytics e narrativa |
| Beta fechado manual | Recomendado apos eventos/recomendacoes/staging estarem validados |
| Beta pago limitado | Recomendado apos Stripe smoke, KYC, suporte e evidencias de valor |
| Go-live publico amplo | Aguardar outcomes, cases e operacao estavel |
| Material para investidores | Pode ser feito agora, desde que honesto sobre fase e proximos marcos |

## Decisoes recomendadas agora

1. Aprovar este pacote como base V2.
2. Declarar `docs/archive/roadmaps/roadmap.md` e DOCX numerados como historicos, nao como fonte atual.
3. Usar `prd-roadmap-v2.md` como plano vivo.
4. Priorizar staging, outcomes, pricing decision snapshot e narrativa executiva.
5. Gerar depois uma versao PDF/deck para investidores a partir do arquivo executivo.
