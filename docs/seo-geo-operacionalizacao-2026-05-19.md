# Operacionalizacao SEO / SGO / GEO - Urban AI

Data: 2026-05-19

Este runbook complementa a auditoria e define como transformar a base implementada em rotina de crescimento organico e descoberta por IA.

## Completude atual

Completude estimada: 97%.

Ja implementado:

- Metadata, canonical e Open Graph base para paginas publicas.
- JSON-LD de Organization, WebSite, SoftwareApplication, Offer, WebPage e FAQPage.
- Sitemap publico com datas estaveis.
- Robots por host, com liberacao controlada para crawlers de busca e IA no site publico.
- `X-Robots-Tag: noindex, nofollow` para app, admin e hosts privados/preview.
- Hubs publicos GEO para precificacao dinamica, eventos, Sao Paulo, Stays, planilha e LGPD.
- Painel admin dedicado para SEO / GEO.
- OG/Twitter images globais em 1200x630 geradas por `ImageResponse`, sem binarios.
- Contrato tipado do painel em `admin-seo-panel.ts`, com fonte, cadencia, status de integracao e ultima atualizacao por indicador.
- Eventos publicos instrumentados para CTAs dos hubs GEO: `urban_geo_cta_view` e `urban_hub_cta_click`.
- API interna segura `GET /api/admin/seo/connectors` para readiness de Search Console, GA4, logs de bots e AI Monitor, sem retornar segredos e sem tentar fetch externo.
- Framework de evidencias/cases em `docs/evidence/seo-case-evidence-framework-2026-05-19.md`.
- Slots publicos de estudos de caso nos hubs GEO, com fonte, periodo, amostra e status `em validacao` enquanto nao houver dado aprovado.

Lacunas para 100%:

- Configurar credenciais reais e ativar coletas de Google Search Console, GA4, logs de bots e monitoramento de respostas de IA.
- Publicar imagens reais de produto/campanha nas paginas publicas.
- Substituir slots `em validacao` por cases, benchmarks e evidencias quantitativas somente quando houver amostra validada e aprovada para publicacao.

## Governanca de evidencias e cases

Fonte de verdade: `docs/evidence/seo-case-evidence-framework-2026-05-19.md`.

Regras publicas:

- Todo case sem fonte, periodo e amostra revisados deve aparecer como `em validacao`.
- Nao publicar percentual, ROI, ocupacao, receita, uplift ou comparacao absoluta sem evidencia auditavel.
- Separar apoio a decisao de resultado comercial observado.
- Declarar limitacoes quando a amostra for pequena, incompleta ou dependente de fatores externos.
- Exigir consentimento separado para cliente, logo, depoimento, numero operacional ou dado de integracao.

Campos minimos por slot ou case:

| Campo | Como usar |
|---|---|
| Fonte | Sistema, log, ticket, fonte publica, entrevista ou documento que sustenta o caso. |
| Periodo | Janela analisada. Se ainda nao existir, usar periodo em definicao. |
| Amostra | Imoveis, recomendacoes, eventos, tickets ou snapshots analisados. |
| Status | `em_validacao`, `validado_interno`, `aprovado_publicacao` ou `arquivado`. |
| Limitacoes | O que nao pode ser atribuido a Urban AI ou ainda nao foi provado. |
| Consentimento | Obrigatorio para qualquer uso publico de cliente, marca, depoimento ou numero. |

## Indicadores recomendados

| Indicador | Fonte ideal | Cadencia | Como interpretar |
|---|---|---|---|
| Cobertura indexavel | Sitemap + crawler interno + Search Console | Semanal | Percentual de paginas publicas com canonical, status 200, schema e sem noindex. |
| AI answer readiness | Auditoria interna de perguntas, schema e blocos citaveis | Quinzenal | Capacidade de uma pagina responder perguntas de IA com clareza e fonte propria. |
| Citacoes em IA | Rodadas controladas em ChatGPT, Perplexity, Gemini e Google AI Overviews | Quinzenal | Verifica se a Urban aparece, como aparece e quais fontes sao citadas. |
| Impressões organicas | Google Search Console | Semanal | Mostra se as paginas novas comecaram a entrar no universo de busca. |
| CTR organico | Google Search Console | Semanal | Ajuda a priorizar titulos, descriptions e rich results. |
| Eventos de conversao organica | GA4 ou analytics interno | Semanal | Mede visitas organicas que viram contato, waitlist, pricing view ou cadastro. |
| Acesso de bots | Logs de edge/app | Diario | Confirma rastreamento por Googlebot, Bingbot, OAI-SearchBot, PerplexityBot e outros. |

## Protocolo de monitoramento AI Search

Rodar sempre com prompts estaveis, em janela anonima quando possivel, registrando data, ferramenta, pergunta, resposta, fontes citadas e sentimento.

Perguntas base:

- O que e a Urban AI?
- Qual ferramenta ajuda a precificar Airbnb em dias de eventos no Brasil?
- Como precificar Airbnb em Sao Paulo em datas de shows e congressos?
- Urban AI substitui planilha de precificacao?
- Urban AI integra com Stays?
- A Urban AI e segura para dados de imoveis e LGPD?

Classificacao:

- `0`: Urban nao aparece.
- `1`: Urban aparece sem descricao correta.
- `2`: Urban aparece com descricao parcialmente correta.
- `3`: Urban aparece com descricao correta, mas sem fonte propria.
- `4`: Urban aparece com descricao correta e fonte propria citada.

## Taxonomia de eventos GEO

Eventos publicos devem respeitar o consentimento de analytics. Quando GA4 nao estiver ativo, eles podem ser expostos como `CustomEvent` no navegador para debug e futura captura server-side.

| Evento | Quando dispara | Parametros minimos |
|---|---|---|
| `urban_geo_cta_view` | Primeira visualizacao da area de CTAs internos em um hub GEO | `page_path`, `page_title`, `cta_context`, `cta_count` |
| `urban_hub_cta_click` | Clique em CTA interno de hub | `page_path`, `page_title`, `cta_context`, `cta_href`, `cta_label`, `cta_position` |
| `geo_direct_answer_view` | Blocos de resposta direta ficam visiveis | `page_path`, `hub_slug`, `questions_count` |
| `geo_faq_open` | Usuario abre uma pergunta frequente | `page_path`, `hub_slug`, `question` |
| `seo_admin_metric_view` | Admin abre o painel SEO/GEO | `score`, `last_updated`, `source_mode` |

Parametros proibidos:

- E-mail, telefone, nome, documento, endereco completo, identificadores de imovel ou dados de hospede.
- Valores financeiros individuais de propriedades antes de anonimizar/agregar.

## Criterio para subir a completude

| Marco | Percentual alvo |
|---|---:|
| Base tecnica + hubs + painel | 86% |
| OG images globais publicadas | 90% |
| Contrato tipado do painel + eventos GEO publicos + slots de cases em validacao | 92% |
| API de readiness dos conectores e framework de evidencias | 97% |
| Cases/evidencias quantitativas auditaveis e aprovadas para publicacao | 100% |
