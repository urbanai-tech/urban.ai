# Auditoria SEO + SGO/GEO por tela - Urban AI

Data: 2026-05-19  
Escopo: frontend Next.js em `Urban-front-main`, rotas publicas em `myurbanai.com` e app em `app.myurbanai.com`.

## Criterios usados

- SEO: rastreabilidade, indexacao, canonical, titles/descriptions, sitemap, robots, semantica HTML, imagens, links internos e dados estruturados.
- SGO/GEO: capacidade de mecanismos generativos entenderem, citarem e compararem a Urban AI. Na pratica, isso exige conteudo indexavel, textual, direto, confiavel, com perguntas/respostas, entidade clara, metodologia e dados estruturados consistentes com o conteudo visivel.
- Referencias atuais: Google Search Central informa que recursos de IA da Busca usam as mesmas boas praticas de SEO; paginas precisam ser indexaveis e qualificadas para snippet. Tambem recomenda conteudo importante em texto, links internos, boa experiencia e dados estruturados que correspondam ao texto visivel.

## Diagnostico executivo

O produto esta bem encaminhado na separacao entre site publico e app autenticado: `robots.ts`, `sitemap.ts` e `middleware.ts` ja tentam dividir `myurbanai.com` e `app.myurbanai.com`. O problema e que a camada de SEO das telas ainda esta incompleta.

Prioridades:

1. Adicionar metadata unica, canonical e OG por pagina publica.
2. Adicionar `X-Robots-Tag: noindex, nofollow` nas respostas do app, admin, preview e rotas sensiveis. O `robots.txt` sozinho nao basta para garantir noindex, porque se o rastreamento for bloqueado o crawler pode nao ver a diretiva de indexacao.
3. Corrigir duplicidade `/` vs `/landing`: raiz publica serve a landing, mas `/landing` continua acessivel. Definir canonical para `/` ou redirecionar `/landing` para `/`.
4. Implementar JSON-LD: `Organization`, `WebSite`, `SoftwareApplication`, `Offer`, `FAQPage`, `BreadcrumbList`, `ContactPage`.
5. Reescrever parte do copy manifesto em blocos mais diretos para consultas de busca e IA: "como precificar Airbnb em dias de evento", "precificacao dinamica para aluguel por temporada", "ferramenta para anfitrioes Airbnb", "eventos em Sao Paulo e diaria".
6. Corrigir semantica: layout publico gera `main` aninhado em varias paginas; termos tem 112 `h2` porque paragrafos numerados viram heading.
7. Substituir `lastModified = new Date()` no sitemap por datas reais/estaveis.
8. Incluir imagens reais do produto/fluxo e OG image por pagina. Hoje as paginas publicas auditadas renderizam zero imagens.

## Achados globais

| Area | Estado atual | O que fazer |
|---|---|---|
| Host split | `myurbanai.com` permite publico; `app.myurbanai.com` retorna `Disallow: /`; app routes no apex redirecionam 301 para app. | Manter direcao, mas adicionar header `X-Robots-Tag` para app/admin/preview. |
| Sitemap | Lista `/`, `/precos`, `/lancamento`, `/sobre`, `/contato`, `/termos`, `/privacidade`. | Usar `lastModified` estavel; evitar duplicidade com `/landing`; considerar `hreflang` se EN/ES forem reais. |
| Canonical | Nenhuma pagina publica auditada tem canonical. | Definir canonical absoluto por rota publica. |
| Metadata | Apenas `/landing` e `/precos` tem metadata propria; demais herdam title/OG "Urban AI". | Criar metadata por rota publica e metadata noindex por rotas de app. |
| JSON-LD | `jsonLdCount = 0` em todas as paginas publicas. | Criar componente `StructuredData` e aplicar por pagina. |
| Imagens | Zero imagens em `/landing`, `/lancamento`, `/precos`, `/sobre`, `/contato`, `/termos`, `/privacidade`. | Adicionar screenshot, diagrama, produto ou visual editorial com `alt` descritivo. |
| Semantica | PublicLayout envolve filhos em `<main>` e paginas tambem usam `<main>`. | Deixar apenas um `<main>` por pagina. |
| App privado | Muitas rotas autenticadas renderizam client-side e dependem de API/redirect; SEO deve ser defensivo. | Noindex por header/layout e, idealmente, controle de acesso mais cedo em rotas sensiveis. |

## Telas publicas

| Tela | Status SEO/SGO | Fazer |
|---|---|---|
| `/` em `myurbanai.com` | Rewrite para `/landing`; deve ser a home canonica. | Canonical `https://myurbanai.com/`; garantir que title/OG da landing sejam emitidos na raiz; decidir se `/landing` vira 301 para `/`. |
| `/landing` | Melhor pagina atual: title/description proprios, 1 `h1`, bastante texto. Sem canonical, sem schema, sem imagens. | Tratar como home ou redirecionar. Inserir `Organization`, `WebSite`, `SoftwareApplication`, FAQ schema, imagem/OG e copy mais direto com termos de busca. |
| `/lancamento` | Title/description/OG genericos herdados; conteudo bom para waitlist; 2 `main`; sem schema. | Metadata propria: "Lista de espera Urban AI | Precificacao dinamica para Airbnb"; canonical; `FAQPage`; decidir se indexa agora e noindex depois do go-live. |
| `/precos` | Title/description proprios, mas OG generico; sem canonical/schema; link `wa.me/seunumerodevendas` e placeholder. | Corrigir WhatsApp; adicionar `Offer`/`Product` ou `SoftwareApplication` com planos visiveis; FAQ schema; copy de comparacao contra comissao/planilha. |
| `/sobre` | Title/description/OG genericos; texto curto; sem entidade forte. | Metadata propria; `AboutPage` + `Organization`; adicionar CNPJ, responsavel, setor, publico-alvo, Sao Paulo/Brasil, integracoes e prova de confianca. |
| `/contato` | Title/description/OG genericos; client component; formulario OK; sem schema. | Metadata propria; `ContactPage`; dados de contato, privacidade, prazo de resposta, possivel endereco/cidade; evitar depender de JS para informacao principal. |
| `/termos` | Title generico; 112 `h2` por classificacao errada dos blocos; pagina legal extensa. | Metadata legal propria; corrigir parser para apenas secoes reais virarem `h2`; avaliar manter indexada com baixa prioridade ou aplicar `noindex` se nao quiser aparecer em buscas. |
| `/privacidade` | Title generico; headings aceitaveis; conteudo forte para confianca/LGPD; 2 `main`. | Metadata propria; canonical; `WebPage`/`PrivacyPolicy` quando aplicavel; destacar DPO/canal de privacidade em bloco rastreavel. |

## Telas de app/anfitriao

Essas telas nao devem competir por SEO organico. A meta e impedir indexacao e melhorar titulos apenas para UX, compartilhamento interno, PWA e acessibilidade.

| Grupo/telas | Fazer |
|---|---|
| Login e conta: `/` no app, `/create`, `/request-reset-password`, `/reset-password/[id]`, `/confirm-email/[id]`, `/post-login`, `/forbidden`, `/waitlist/aceitar` | `noindex,nofollow`; metadata UX por tela; evitar que tokens/e-mails sejam indexaveis; confirmar que `create` no app nao aparece no sitemap. |
| Onboarding e billing: `/onboarding`, `/onboarding/payment/price`, `/plans`, `/plans/v2`, `/price`, `/my-plan` | `noindex,nofollow`; canonicals desnecessarios; titles internos; rotas antigas `/price` e `/plans/v2` devem ser redirect limpo ou removidas se forem aliases. |
| Produto host: `/painel`, `/dashboard`, `/portfolio`, `/properties`, `/properties/[id]/market`, `/properties/[id]/pricing-rules`, `/maps`, `/near-events`, `/near-events/[id]`, `/event-log`, `/notificacao`, `/settings/integrations`, `/my-roi` | `noindex,nofollow`; remover duplicatas `/painel` vs `/dashboard` e `/maps-bkp`; garantir que dados de imovel/eventos nao aparecem para crawler anonimo. |
| Admin: `/admin` e todos `/admin/*` | `noindex,nofollow` por header; idealmente bloquear renderizacao anonima antes do client; titles internos ajudam, mas SEO aqui e risco, nao aquisicao. |
| Backups/orfas: `/maps-bkp` | Remover da navegacao e do deploy publico, ou redirecionar 301 para `/maps`. |

## Conteudo necessario para SGO/GEO

Criar ou adaptar paginas para responder consultas de alta intencao:

- `/precificacao-dinamica-airbnb`: explicar o problema, exemplos por evento, como a Urban calcula, limites e seguranca.
- `/guias/como-precificar-airbnb-em-dias-de-eventos`: artigo evergreen com passos, exemplos e FAQ.
- `/eventos-sao-paulo-aluguel-temporada`: pagina hub de Sao Paulo/Grande SP, sem expor dados sensiveis.
- `/integracoes/stays`: explicar integracao, consentimento, limites, rollback e diferenca entre recomendacao/manual/automatico.
- `/comparativos/urban-ai-vs-planilha`: comparacao honesta para capturar consultas "planilha precificacao Airbnb".
- `/seguranca-lgpd`: pagina curta baseada na politica, com linguagem comercial e links para documentos legais.

Cada uma deve ter:

- Uma resposta direta nos primeiros 150-250 palavras.
- FAQ visivel e marcado com JSON-LD quando aplicavel.
- Links internos para precos, contato, lancamento/home e sobre.
- Provas: metodologia, limites, cobertura, integracoes, LGPD, exemplos numericos.
- Imagem ou diagrama com `alt` descritivo.

## Backlog sugerido

### P0 - Fundacao tecnica

1. Implementar `X-Robots-Tag: noindex, nofollow` no middleware para `app.myurbanai.com`, preview e rotas sensiveis.
2. Criar helper de metadata para paginas publicas com canonical, title template, OG e Twitter.
3. Resolver duplicidade `/` e `/landing`.
4. Corrigir sitemap com `lastModified` estavel.
5. Corrigir nested `<main>` no layout publico.
6. Corrigir headings dos termos.

### P1 - Entidade e snippets

1. Criar componente JSON-LD reutilizavel.
2. Aplicar `Organization` e `WebSite` na home.
3. Aplicar `SoftwareApplication`/`Product` + `Offer` em `/precos`.
4. Aplicar `FAQPage` em `/landing`, `/lancamento`, `/precos`.
5. Aplicar `ContactPage` em `/contato` e `AboutPage` em `/sobre`.
6. Criar OG image padrao e imagens por pagina.

### P2 - Conteudo de captura

1. Criar hubs/guias de intencao comercial e informacional.
2. Inserir links internos contextuais entre home, precos, sobre, guias e contato.
3. Revisar copy manifesto para manter marca, mas adicionar blocos objetivos com palavras que anfitrioes realmente pesquisam.
4. Configurar e validar Search Console, Rich Results Test e PageSpeed Insights.
5. Monitorar consultas, CTR, index coverage e conversao por pagina.

## Addendum - estrategia para buscas de IA

A base SEO acima e necessaria, mas nao suficiente para maximizar aparicoes em ChatGPT Search, Perplexity, Copilot/Bing e respostas generativas do Google. Falta uma camada de "distribuicao para respostas", focada em crawlers, entidade, citabilidade e monitoramento.

### Politica de crawlers

| Crawler/superficie | Recomendacao para `myurbanai.com` | Recomendacao para `app.myurbanai.com` |
|---|---|---|
| Googlebot / Google Search AI features | Permitir acesso ao site publico. Nao bloquear paginas que queremos em AI Overviews/AI Mode. | `X-Robots-Tag: noindex, nofollow` e bloqueio de rotas privadas. |
| Google-Extended | Decisao legal/estrategica separada: controla uso em alguns sistemas Google fora da Busca. Nao e necessario para aparecer no Google Search. | Bloquear. |
| Bingbot / Copilot | Permitir site publico e cadastrar Bing Webmaster Tools. Bing tem relatorios de AI Performance em preview. | Noindex e bloqueio. |
| OAI-SearchBot | Permitir site publico para elegibilidade em ChatGPT Search. | Bloquear/noindex. |
| GPTBot | Decisao separada: permitir ajuda treinamento; bloquear nao deve impedir ChatGPT Search se OAI-SearchBot estiver permitido. | Bloquear. |
| PerplexityBot | Permitir site publico se quisermos citacoes em Perplexity. | Bloquear/noindex. |

Ponto critico: conferir Cloudflare/WAF/Railway para garantir que esses bots verificados nao recebem 403 no site publico. `robots.txt` permitir nao adianta se a borda bloqueia o crawler.

### Paginas que faltam para virar fonte citavel

Criar paginas com respostas diretas, exemplos e tabelas:

1. `precificacao-dinamica-airbnb`
2. `como-precificar-airbnb-em-dias-de-eventos`
3. `precificacao-por-eventos-sao-paulo`
4. `integracao-stays-precificacao-automatica`
5. `urban-ai-vs-planilha-de-precificacao`
6. `urban-ai-vs-ferramentas-globais-de-pricing`
7. `seguranca-lgpd-ia-precificacao`

Formato ideal para IA:

- Resposta curta logo no inicio: "A Urban AI e..."
- Definicoes claras: "O que e precificacao por eventos?"
- Tabelas comparativas.
- FAQ com perguntas naturais.
- Exemplos numericos.
- Limites e disclaimers, para aumentar confianca.
- Data de atualizacao e autor/editor quando houver conteudo educativo.

### Entidade e reputacao

Para IA, a marca precisa aparecer como entidade consistente fora do proprio site. Faltam sinais externos:

- LinkedIn da empresa e fundadores.
- Perfil Google Business/Bing Places, mesmo sendo SaaS, se houver operacao em Sao Paulo.
- Perfis em diretórios SaaS/startup quando fizer sentido.
- Paginas institucionais com CNPJ, empresa responsavel, cidade, contato e politicas.
- `sameAs` no JSON-LD apontando para perfis oficiais.

### Monitoramento AI Search

Montar uma matriz mensal com 30-50 perguntas e verificar manualmente ou com automacao controlada:

- Google AI Overviews / AI Mode
- ChatGPT Search
- Perplexity
- Bing/Copilot

Metricas:

- A Urban AI apareceu?
- Foi citada com link?
- Qual URL apareceu?
- A resposta entendeu corretamente o produto?
- Concorrentes citados.
- Lacunas de conteudo que fizeram outra fonte ganhar a resposta.

Tambem monitorar:

- Logs de servidor por `OAI-SearchBot`, `PerplexityBot`, `Bingbot`, `Googlebot`.
- Referrals de `chatgpt.com`, `perplexity.ai`, `copilot.microsoft.com`, `bing.com`.
- Bing Webmaster Tools AI Performance.
- Search Console para queries comerciais e informacionais.

### Sobre `llms.txt`

Pode ser criado como conveniencia, mas nao deve ser tratado como estrategia principal. O que realmente importa para Google, OpenAI Search e Bing/Copilot ainda e: paginas publicas rastreaveis, conteudo claro, schema correto, autoridade, links, canonical limpo e controles de crawler bem configurados.
