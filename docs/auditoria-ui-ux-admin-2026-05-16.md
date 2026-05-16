# Auditoria UI/UX — Painel Admin

**Data:** 2026-05-16
**Escopo:** 19 telas `/admin/*`
**Padrão de referência:** páginas públicas manifesto editorial + inspiração Linear / Stripe Dashboard / Vercel Analytics
**Framework:** high-ticket-page skill, MODO 1 (auditoria)

---

## Resumo Executivo

O painel admin (19 telas) está num estado funcional-mas-monocultural: todas usam `bg-slate-950` + `border-slate-800 rounded-xl bg-slate-900/40` + acentos `emerald-500/400/300` aplicados como se fossem semântica universal (sucesso, link, KPI positivo, header secundário, botão primário — **tudo verde**).

Não há sistema de design — há um padrão copy-pasted de cards arredondados com bordas slate e um arco-íris de cores (red/amber/emerald/blue/orange/sky/rose) usado sem regra. A divergência com o manifesto editorial das LPs públicas (`#080A0F`, branco frio, accent único `#E8500A`, Bebas Neue) é total: **zero pontes visuais entre vitrine e ferramenta.**

Loading states são strings cruas ("Carregando…"), empty states genéricos, motion inexistente, tabelas sem hover state na maioria das telas. Headers `h1 text-2xl/3xl font-bold` genéricos sem hierarquia editorial. Em síntese: dashboard "Bootstrap-admin 2019" — usável, mas comunica amador.

---

## Doenças Sistêmicas

1. **CRÍTICO — Paleta fragmentada sem accent único.** Em 19 telas: `emerald-300/400/500`, `red-300/400`, `amber-200/300`, `blue-300`, `sky-200/300`, `rose-300`, `orange-200/300` aplicadas como semântica. Em `dashboard/page.tsx` linha 250-267, três `<a>` consecutivos usam `text-blue-300 hover:underline` enquanto o botão da página usa `bg-emerald-500`. Não existe regra. Manifesto exige UM accent (`#E8500A`) + neutros + max 2 semânticas (sucesso/erro) em tom subdued.

2. **CRÍTICO — `bg-slate-950` em vez de `#080A0F`.** Todas as 19 telas começam com `<main className="min-h-screen bg-slate-950 text-slate-50 p-8">`. Slate-950 é `#020617` (mais frio/azulado). Quebra continuidade com LPs. Branco `text-slate-50` (`#F8FAFC`) também não bate com branco puro `#FFFFFF` do manifesto.

3. **CRÍTICO — `border-slate-800` em vez de `rgba(255,255,255,0.08)`.** Padrão repetido literalmente em `admin/page.tsx:175`, `dashboard/page.tsx:410`, `events/page.tsx:174`, e em todos KPIs/cards/tabelas. Resultado: bordas opacas em vez de divisórias translúcidas que respiram.

4. **ALTO — `rounded-xl` / `rounded-2xl` ubíquo em TUDO.** Cards, botões, badges, inputs, alerts — tudo arredondado. Manifesto editorial proíbe rounded em cards. Admin pode aceitar rounded sutil em botões (max `rounded` 4px). Hoje `rounded-xl` aparece 100+ vezes no admin.

5. **ALTO — Headers `h1 text-2xl/3xl font-bold` genéricos.** Toda página tem `<h1 className="text-2xl font-bold">Nome</h1>` (ex.: `dashboard:82`, `events:112`, `finance:77`, `funnel:45`, `roi:62`, `stays:36`, `users:89`, `waitlist:126`, `quality:137`). Zero verticalidade, zero diferenciação editorial. Manifesto pede display Bebas Neue clamp(48px, 6vw, 96px) para títulos pesados (overview/dashboard), com eyebrow Inter 600 12px uppercase #E8500A acima.

6. **ALTO — Botão primário `bg-emerald-500 text-slate-900 font-bold rounded` aparece em 40+ lugares.** Identificado em `admin:86`, `alpha:151`, `audit-logs:116`, `coverage:177`, `events/new:367`, `events/import:187`, `events:259`, `finance:215`, `jobs:275`, `pricing-config:239`, `quality:336`, `waitlist:253`. Deveria ser orange `#E8500A` sólido com texto branco, sem rounded ou rounded `2px` máximo.

7. **ALTO — Loading state cru em 11 telas.** Strings literais "Carregando painel admin..." (`admin:58`), "Carregando dashboard…" (`dashboard:65`), "Carregando…" (`events:89`, `finance:57`, `funnel:21`, `pricing-config:57`, `quality:119`, `stays:22`, `users:106`). Nenhum skeleton, nenhuma transição. Em dashboard com auto-refresh 60s o estado flicka.

8. **MÉDIO — Setas como texto Unicode `→` `←`.** Em `admin:88` "Dashboard executivo →", `dashboard:106` "← Voltar", `events:120`, e em ~30 outros lugares. Inconsistência. Deveria ser componente `<Icon name="arrow-right" />` SVG inline 14px.

9. **MÉDIO — Emojis como ícones de produção.** `dashboard/page.tsx` linhas 115-120 e 143-147: "🟢🟡🔴🚨⚠️ℹ️". Linhas 160, 186, 209, 244: ícones de Block são strings `📅🎟️⚙️💰RDBS`. Emojis renderizam diferente por OS, têm cor própria, parecem amadores em ferramenta B2B premium.

10. **MÉDIO — Inputs com 5 variantes diferentes de bg.** `bg-slate-800 border border-slate-700` (`contacts:147`, `coverage:164`, `events/new:191`, `waitlist:235`), `bg-slate-900 border border-slate-700` (`alpha:131`), `bg-slate-950 border border-slate-700` (`audit-logs:206`, `quality:255`). Caos.

11. **MÉDIO — `alert()` e `confirm()` nativos em 15+ ações.** `contacts:82`, `coverage:71,86`, `events/new:111`, `users:52,70`, `waitlist:68,73,87`, `finance:200,205`, `pricing-config`, `jobs`. Modal nativa quebra dark theme, parece debug.

12. **BAIXO — Mobile breakpoint inconsistente.** Maioria das tabelas usa `overflow-x-auto` mas sem indicador de scroll lateral. Em `collectors-health` (13 colunas), `events/page.tsx` (Top10 + 8 colunas) usuário não percebe que pode rolar.

13. **BAIXO — Footers explicativos repetidos.** `<section className="text-xs text-slate-500 border-t border-slate-800 pt-4">` em `admin:234`, `dashboard:469`, `collectors-health:179`, `events:425`, `jobs:240`. Padronizar como componente `AdminPageFooterNote`.

---

## Tabela Consolidada — Nota por Tela

| Tela | 1ºImp | Estét | Estrut | Copy | Motion | Mobile | **TOTAL/60** |
|---|---|---|---|---|---|---|---|
| /admin (overview) | 4 | 3 | 5 | 6 | 2 | 5 | **25** |
| /admin/dashboard | 5 | 3 | 6 | 6 | 3 | 5 | **28** |
| /admin/alpha | 5 | 4 | 6 | 5 | 3 | 5 | **28** |
| /admin/audit-logs | 5 | 4 | 6 | 5 | 3 | 5 | **28** |
| /admin/collectors-health | 4 | 3 | 6 | 7 | 3 | 3 | **26** |
| /admin/contacts | 5 | 4 | 6 | 5 | 3 | 5 | **28** |
| /admin/coverage | 5 | 4 | 5 | 6 | 3 | 5 | **28** |
| /admin/events | 4 | 3 | 5 | 6 | 4 | 4 | **26** |
| /admin/events/new | 5 | 4 | 6 | 6 | 2 | 5 | **28** |
| /admin/events/import | 5 | 4 | 6 | 7 | 2 | 5 | **29** |
| /admin/finance | 4 | 3 | 5 | 6 | 2 | 5 | **25** |
| /admin/funnel | 4 | 3 | 5 | 4 | 2 | 5 | **23** |
| /admin/jobs | 5 | 4 | 6 | 6 | 3 | 5 | **29** |
| /admin/pricing-config | 5 | 4 | 6 | 7 | 3 | 5 | **30** |
| /admin/quality | 5 | 4 | 6 | 6 | 3 | 5 | **29** |
| /admin/roi | 6 | 4 | 6 | 7 | 3 | 5 | **31** |
| /admin/stays | 4 | 3 | 5 | 4 | 2 | 5 | **23** |
| /admin/users | 4 | 4 | 6 | 5 | 3 | 5 | **27** |
| /admin/waitlist | 5 | 3 | 6 | 6 | 3 | 5 | **28** |

**Média: ~27/60.** Nenhuma tela passa de 35/60. Piores: `/admin/funnel` e `/admin/stays` (23). Melhores: `/admin/roi` (31) e `/admin/pricing-config` (30) — por terem copy explicativa decente.

---

## Auditoria por Tela (12 mais críticas)

### /admin (overview) — 25/60

**O que está errado:**
- **[CRÍTICO]** Header `<h1 className="text-3xl font-bold mb-2">Painel Urban AI</h1>` (linha 79) seguido de `<a className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-bold">` (linha 84). Botão promocional de SaaS 2018.
- **[ALTO]** `NavCard` (linha 245-255) usa `hover:border-emerald-500/50 hover:bg-emerald-950/20`. 17 cards iguais empilhados num grid — falta de hierarquia. Deveria ser navbar lateral fixa, não card grid.
- **[ALTO]** Seção "Motor de IA" (linha 118) com `border-emerald-800/40 bg-emerald-950/20` — verde como cor de destaque, quando deveria ser destaque com border-left `2px #E8500A`.
- **[ALTO]** `KpiCard` (linha 267) `text-2xl font-bold` — fraco. KPI número precisa Bebas Neue ~48px com label eyebrow.
- **[MÉDIO]** Loading: `<p className="text-slate-400">Carregando painel admin...</p>` (linha 58).

**Como deveria ficar:** Substituir grid de NavCards por sidebar fixa esquerda (12rem). Header vira eyebrow `ADMIN · OVERVIEW` + display "Painel" + sublinha branca curta. KPIs num grid de 4 colunas com números Bebas Neue 56px brancos, label uppercase tracking-4px cinza-60. Seção IA vira faixa horizontal full-bleed com border-left orange.

---

### /admin/dashboard — 28/60

**O que está errado:**
- **[CRÍTICO]** Saúde geral com emoji literal `<span className="text-3xl">🟢🟡🔴</span>` (linha 115). Ridículo numa ferramenta B2B. Sub bullets também usam `🚨⚠️ℹ️` (143-147). Substituir por dot SVG colorido 8px + texto.
- **[CRÍTICO]** `Block` (linha 481) e `Stat` (linha 509) têm `text-sm font-bold` e `text-lg font-bold` — KPI principal tem font-size 18px. Em dashboard executivo, número precisa dominar (32-48px Bebas).
- **[ALTO]** Ícones de cada Block são strings `"📅", "🎟️", "⚙️", "💰", "R", "D", "B", "S"` (155-345). Mistura emoji com letras. Caos.
- **[ALTO]** 11 cores diferentes na mesma tela: `emerald-300` (168), `red-300` (177), `amber-300` (192), `blue-300` (197), `text-rose-300` indireto via `severity`. Reduzir a 3 tokens: neutro/sucesso/atenção.
- **[MÉDIO]** MiniTimeline (531) usa `bg-emerald-400` + `bg-red-400` — barras precisam ser branco/orange + cinza-30.
- **[MÉDIO]** Auto-refresh checkbox (91) cru, sem switch estilizado.

**Como deveria ficar:** Health card vira faixa full-width horizontal com border-left 4px (verde/amber/red sólido — 1 cor por estado, não emoji). 4 blocks principais viram grid de 4 KPIs gigantes com número Bebas + delta abaixo. Mini-timeline com barras brancas + out-of-scope em laranja `#E8500A` 30% alpha. Toggle auto-refresh vira switch custom 32×18.

---

### /admin/finance — 25/60

**O que está errado:**
- **[CRÍTICO]** Seção "Por imóvel" (linha 104) tem `border-emerald-800/40 bg-emerald-950/20` — toda em verde porque "é métrica boa". Margem por imóvel é o número mais importante do negócio, merece formato de pull-quote editorial (border-left 2px orange + display).
- **[ALTO]** "Margem" KPI usa `marginColor` (67-70): >30% emerald, >0 amber, <0 red. Cores semânticas ok, mas o NÚMERO ainda é `text-2xl` — perdido entre outros KPIs.
- **[ALTO]** `NewCostForm` (269) é form inline com `bg-emerald-950/20` — soa fora de lugar. Deve virar drawer/sheet lateral.
- **[MÉDIO]** Custos por categoria (160) usa `bg-emerald-500` nas barras (175). Barras de custo deveriam ser laranja, não verde (custo ≠ receita).
- **[MÉDIO]** Botão "Popular default" (211) `border-emerald-700 text-emerald-300` e "+ Novo custo" `bg-emerald-500 text-slate-900`. Dois botões verdes, hierarquia confusa.

**Como deveria ficar:** Hero KPI "Margem por imóvel" gigante (Bebas 96px) com signal de tendência ao lado. Receita/Custo/Imóveis ativos como linha menor abaixo. Tabela de custos com tr hover border-bottom orange. Categorias com barras brancas finas (2px height).

---

### /admin/events — 26/60

**O que está errado:**
- **[CRÍTICO]** 8 KPIs no topo (123-137) todos `text-xl font-bold` — sem hierarquia, olho não sabe onde pousar. "Total no DB" e "Mega-eventos 30d" não têm mesmo peso decisório.
- **[ALTO]** Toggle de scope `in/out/all` (248-268) usa `bg-emerald-500 text-slate-900` no ativo. Deveria ser segmented control com underline orange.
- **[ALTO]** Coluna "Relevância" em 2 tabelas (198-208, 343-358) usa `bg-rose-500/20 text-rose-300` (≥80), `bg-amber-500/20 text-amber-300` (≥60), `bg-slate-700` (<60). 3 cores em badge. Substituir por número monocromático + barra horizontal abaixo.
- **[MÉDIO]** TimelineChart (495) usa cores `bg-emerald-400`/`bg-red-400` para in/out scope.
- **[MÉDIO]** Símbolos `✓` `✗` `⌛` como texto (388-391, 364-373) — usar ícones SVG.

**Como deveria ficar:** Reorganizar em 1 hero KPI ("Total" + "%cobertura"), 3 KPIs médios (próximos 7/30/90d), 4 KPIs pequenos. Tabela com row hover laranja, sticky header. Charts em laranja sólido + branco-30.

---

### /admin/funnel — 23/60 (pior tela)

**O que está errado:**
- **[CRÍTICO]** Funil renderizado como 7 cards empilhados verticais com barra `bg-emerald-500` (52-62). Não é um funil visual — é uma lista. Funil DEVE ter forma de funil (largura decrescente).
- **[CRÍTICO]** Tela tem 80 linhas e 0 contexto. "Funil de Produto" não explica de onde vem o dado, qual janela, o que cada etapa significa pra negócio.
- **[ALTO]** Os 2 cards de taxa (66, 71) usam mesma cor `border-emerald-800/40 bg-emerald-950/20` — não há diferenciação entre "Taxa de aceite" e "Taxa de aplicação" (que são conceitualmente diferentes).
- **[MÉDIO]** Janela `data.windowDays` (47) hardcoded — não há controle pra trocar 30/60/90d.

**Como deveria ficar:** Funil real em SVG com trapézios decrescentes, números grandes Bebas dentro de cada estágio, % drop-off entre eles ao lado. Eyebrow `FUNIL DE PRODUTO · ÚLTIMOS X DIAS` + seletor de janela. Cada etapa com tooltip explicativo.

---

### /admin/stays — 23/60 (pior tela)

**O que está errado:**
- **[CRÍTICO]** Header sem subtítulo (36) — só "Saúde da Stays" + link voltar. Nada explica o que é "Stays" pra quem chegou frio.
- **[ALTO]** Status do beta-private (41) vira card amarelo/verde gigante no topo. KPIs reais (73-125) ficam ABAIXO. Inverter: KPIs primeiro, alerta de readiness secundário.
- **[ALTO]** "Push price últimos 30d" (98) lista 4 status em 4 cores diferentes (`emerald-300`, `amber-300`, `red-300`, `slate-300`). Mostrar gráfico de pizza ou barra empilhada compacta.
- **[MÉDIO]** Tabela "Pushes recentes" (128) sem hover, sem paginação visível, sem filtro de status.

**Como deveria ficar:** Hero card "Push success rate" como % grande Bebas. Sub-KPIs: contas conectadas, listings, pushes. Alerta beta-private vira faixa horizontal slim (border-left amber 2px). Tabela com filtro.

---

### /admin/collectors-health — 26/60

**O que está errado:**
- **[CRÍTICO]** Tabela com 13 colunas (153-167) — densidade muito alta. Em mobile/tablet fica ilegível. Considerar split: "Saúde básica" (5 cols) + "Detalhes" (drawer).
- **[ALTO]** 4 níveis de badge: HealthBadge, CriticalityBadge, signals badges, missing_env tags. Cada um com paleta própria. Caos cromático.
- **[MÉDIO]** `outOfScopePercent` colorido inline (270): >30 red, >10 amber, else slate. Mesmo padrão para `errorRate` (288). Tornar consistente via componente `<MetricCell threshold={[10,30]} />`.
- **[MÉDIO]** Footer explicativo (179-197) com `list-disc` e `<code>`. Boa intenção, estilo solto. Virar accordion "Como ler" colapsável.

**Como deveria ficar:** Master/detail: tabela compacta 6 colunas + drawer ao clicar na linha com detalhes. Badges monocromáticos com border-left finos. Header com filtros (status, critical, source search).

---

### /admin/audit-logs — 28/60

**O que está errado:**
- **[CRÍTICO]** Coluna "Depois" (228-234) renderiza JSON cru em `<pre>` truncado em 900 chars — vira mancha de texto. Linha tem altura imprevisível.
- **[ALTO]** Form de filtros (87) com 5 inputs grid — em mobile vira coluna gigante. Considerar collapse "Filtros avançados".
- **[MÉDIO]** Botão "Filtrar" `bg-emerald-500 text-slate-950 font-bold text-sm` (116) — botão verde dominante.
- **[MÉDIO]** Header com eyebrow `<p className="text-xs uppercase tracking-wider text-emerald-300 font-bold">Admin</p>` (72) — emerald-300 como cor de eyebrow. Manifesto pede orange `#E8500A`.

**Como deveria ficar:** Eyebrow `AUDITORIA` em orange, display Bebas "Auditoria". Coluna "Depois" vira ícone expand → drawer com JSON formatado. Filtros como pills no topo.

---

### /admin/alpha — 28/60

**O que está errado:**
- **[ALTO]** 4 botões no header (128-157): input email + Atualizar + Export CSV + Reprocessar. Hierarquia perdida — qual é o primário?
- **[ALTO]** 8 KPIs em grid `xl:grid-cols-4` (168-177) sem diferenciação. "Receita real" e "Imóveis alpha" mesmo peso.
- **[MÉDIO]** Tabela "Auditoria de recomendações" (212) com 8 colunas, tr sem hover. `border-t border-slate-800/80` borda quase invisível.
- **[MÉDIO]** "Reprocessar alpha" usa `bg-emerald-500` (151) — ação cara como botão verde sem confirmação.

**Como deveria ficar:** Hero KPI "Receita real" como Bebas gigante + delta. Botões secundários como text-link com border-bottom orange. Tabela com hover laranja + linhas alternadas sutis.

---

### /admin/pricing-config — 30/60

**O que está errado:**
- **[ALTO]** Aviso "STRIPE_SECRET_KEY ausente" (319) e gate F5 (326-336) — 3 estados visuais (vermelho/amber/verde) num card. Substituir por dot indicator + texto neutro.
- **[ALTO]** `StripeSyncCard` Stats (388) renderiza 5 mini-stats em `<div className="rounded border border-slate-700 px-3 py-1.5 bg-slate-900/40">` — pequenos demais. Definir hierarquia: KPI grande / pequeno / inline-stat.
- **[MÉDIO]** Tabela sync check com badge de status colorido `statusColor` map (286-295). 8 status × 8 cores. Reduzir.
- **[MÉDIO]** `details/summary` (216) para Stripe Price IDs — funcional, pouco estilizado.

**Como deveria ficar:** Manter conteúdo (é bom), mas migrar borders coloridas pra `rgba(255,255,255,0.08)` + indicadores de status como dots + texto. Badges sync-check em variantes monocromáticas com letter-spacing.

---

### /admin/coverage — 28/60

**O que está errado:**
- **[ALTO]** "Testar ponto" (152) e "Nova região" (213) — 2 forms inline com `border-emerald-800/40 bg-emerald-950/20`. Competem com tabela. Mover pra drawer lateral.
- **[ALTO]** Botão "Reset retroativo enrichment" (197) com `border-amber-700 text-amber-300 hover:bg-amber-950/30` — ação destrutiva escondida ao lado de "+ Nova região" verde. Hierarquia confusa, falta confirmação visual (modal custom vs `confirm()` nativo).
- **[MÉDIO]** Resultado do "Testar ponto" mostra `✓ DENTRO` / `✗ FORA` (186) inline como texto. Virar pill com cor + ícone SVG.

**Como deveria ficar:** "Nova região" como drawer lateral. "Testar ponto" como widget compacto no topo. Tabela com row hover orange + ações no hover (Eye/Edit/Trash icons).

---

### /admin/jobs — 29/60

**O que está errado:**
- **[ALTO]** 4 JobCards (88-126) + 1 card "Atalhos" (128) no mesmo grid `lg:grid-cols-5`. O 5º é semanticamente diferente (links, não ação) — quebra a leitura.
- **[ALTO]** Status do card vira eyebrow `<p className="text-xs uppercase tracking-wider text-slate-500">{status}</p>` (268). Mas o valor `pendingGeocode === null ? "carregando" : "X pendentes"` (90) é estado dinâmico que merece destaque, não eyebrow.
- **[MÉDIO]** Resultado JSON em `<pre>` (170) `max-h-80 overflow-auto rounded-lg bg-slate-950 border border-slate-800` — falta syntax highlight.
- **[MÉDIO]** "Atalhos" (128) tem 4 `<a>` com `text-blue-300 hover:underline` — outra cor (azul!) introduzida só aqui.

**Como deveria ficar:** Separar JobCards (ações primárias) de Atalhos (links secundários) em duas sections distintas. Status do job em destaque (`text-base font-bold` + dot). JSON viewer com syntax highlight neutro (chaves em white, strings em orange-40, números em white-70).

---

## Plano de correção priorizado (top 15)

| # | Mudança | Impacto | Effort |
|---|---|---|---|
| 1 | Criar `globals.css` `.urban-admin` com tokens: `--admin-bg #080A0F`, `--admin-divider rgba(255,255,255,0.08)`, `--admin-accent #E8500A`, `--admin-text rgba(255,255,255,0.92)`, `--admin-text-muted rgba(255,255,255,0.55)` | ALTO | BAIXO |
| 2 | Componente `<AdminShell>` (sidebar fixa + main) substituindo NavCard grid em `/admin` | ALTO | MÉDIO |
| 3 | Componente `<AdminKpiCard variant="hero \| md \| sm">` com Bebas Neue no `value` para hero | ALTO | BAIXO |
| 4 | Componente `<AdminSectionHeader eyebrow display sub />` (eyebrow Inter 600 12px orange + display Bebas + sub Inter 400 14px white-65) | ALTO | BAIXO |
| 5 | Substituir todos `bg-emerald-500 text-slate-900 font-bold` (40+ ocorrências) por `<AdminButton variant="primary">` (#E8500A) | ALTO | MÉDIO |
| 6 | `<AdminEmptyState />` e `<AdminLoadingSkeleton variant="table\|kpi\|chart" />` para substituir 11 "Carregando…" crus | ALTO | MÉDIO |
| 7 | Remover TODOS emojis (🟢🟡🔴🚨📅⚙️💰 etc) — substituir por `<AdminStatusDot color="success\|warn\|error">` + ícones SVG inline (Lucide ou heroicons) | ALTO | MÉDIO |
| 8 | Componente `<AdminTable>` com row hover #E8500A border-bottom + sticky header + scroll indicator visual | ALTO | MÉDIO |
| 9 | Padronizar inputs num único `<AdminInput>` (bg `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`, focus border #E8500A) | ALTO | BAIXO |
| 10 | Modal/Toast custom substituindo `alert()/confirm()` nativos (15+ chamadas em waitlist, users, coverage, finance, contacts) | MÉDIO | MÉDIO |
| 11 | Refazer `/admin/funnel` como SVG funil real (trapézios) — hoje é lista | MÉDIO | MÉDIO |
| 12 | Refazer charts (MiniTimeline, TimelineChart, BarList) com paleta white/orange/white-30 — remover verde-vermelho saturado | MÉDIO | BAIXO |
| 13 | Padronizar setas: substituir Unicode `→ ←` por componente `<Arrow direction="right" />` SVG 14px | BAIXO | BAIXO |
| 14 | Audit-logs: coluna "Depois" vira ícone expand → drawer com JSON formatado | BAIXO | MÉDIO |
| 15 | Coverage/Finance: forms inline viram drawer lateral | BAIXO | MÉDIO |

---

## Componentes a criar

- **`AdminShell`** — layout shell: sidebar fixa 240px (nav agrupado em "Negócio", "Motor de eventos", "Operações", "Sistema") + main com `bg #080A0F` + grain overlay opcional
- **`AdminSectionHeader`** — eyebrow Inter 600 12px tracking-4 uppercase #E8500A + display Bebas Neue clamp(36px, 5vw, 64px) branco + subtitle Inter 400 14px white-65
- **`AdminKpiCard`** — 3 variantes (hero: Bebas 64-96px, md: Bebas 40-48px, sm: Inter 600 20px). Label sempre eyebrow + sub Inter 400 12px white-55. Sem border, separação por `border-bottom rgba(255,255,255,0.08)` ou padding generoso
- **`AdminTable`** — wrapper com sticky header, tr hover `box-shadow inset 0 -1px 0 #E8500A`, divisor `rgba(255,255,255,0.06)`, scroll indicator
- **`AdminButton`** — variantes: `primary` (bg #E8500A, text white), `secondary` (border 1px white-15, hover bg white-04), `ghost` (text white-65, hover text white + underline orange), `danger` (text amber-300 sutil, border amber-700/30)
- **`AdminInput` / `AdminSelect` / `AdminTextarea`** — bg `rgba(255,255,255,0.03)`, border `rgba(255,255,255,0.08)`, focus border #E8500A + box-shadow 0 0 0 3px rgba(232,80,10,0.15)
- **`AdminBadge`** — variantes status: `success` (text #4ade80 60%, sem fill), `warn` (#fbbf24 60%), `error` (#f87171 60%), `neutral` (white-50). Borda fina, sem fill saturado
- **`AdminStatusDot`** — dot 8×8 + texto, substituindo emojis 🟢🟡🔴
- **`AdminLoadingSkeleton`** — variants: `kpi` (rect 40×120 shimmer), `table` (8 rows × N cols), `chart` (rect com pulse). Shimmer orange-tinted
- **`AdminEmptyState`** — eyebrow + título Bebas pequeno + sub + CTA opcional
- **`AdminDrawer`** — slide-in direita 400-480px, fundo `#0d1117`, backdrop blur, usado pra forms (NewCostForm, NewRegionForm) e detail views
- **`AdminToast` / `AdminConfirmDialog`** — substituem `alert()/confirm()` nativos. Toast top-right 4s; dialog centered com backdrop blur

---

## Migração proposta — primeiro passo

**Caminho mais barato:**

1. **Adicionar bloco `.urban-admin` ao `globals.css`** análogo ao `.urban-manifesto` existente. Definir CSS variables (`--admin-bg`, `--admin-accent`, `--admin-divider`, `--admin-text`, `--admin-text-muted`), classes utilitárias e fonte Bebas Neue já carregada para uso seletivo.

2. **Criar `src/app/admin/_components/`** com 5 componentes mínimos: `AdminShell`, `AdminSectionHeader`, `AdminKpiCard`, `AdminTable`, `AdminButton`. Cada um <80 linhas TSX, usando classes utilitárias do passo 1. Sem dependências de Chakra/HeadlessUI — Tailwind puro.

3. **Migrar `/admin/dashboard/page.tsx` como prova de conceito.** É a tela mais visível, com mais densidade, e tem 11 doenças sistêmicas num só lugar. Tempo: 1 sprint focado (3-4 dias).

4. **Validar com Gustavo + Fabrício antes de espalhar.** A/B comparar `/admin/dashboard` (novo) vs `/admin/finance` (legado) — define se a linguagem visual aguenta densidade de dados ou precisa ajustar.

5. **Após aprovação, migrar tela-a-tela em ordem de criticidade:** `/admin` (overview) → `/admin/finance` → `/admin/events` → `/admin/funnel` → `/admin/roi` → restante. ~0.5-1.5 dia por tela usando os componentes prontos.

**Custo estimado total:** ~3 sprints (15 dias úteis) para sistema + dashboard prova de conceito + 5 telas principais + drawer/toast/skeleton. Restante pode ser feito como dívida técnica em paralelo a features.

**Não fazer agora:** não introduzir Chakra ou MUI no admin. O custo de migração de 19 telas + bundle size + override de tema não compensa frente a Tailwind puro com tokens CSS. Mantém o admin alinhado com as LPs (mesma stack), permite copy-paste de classes utilitárias entre os dois mundos.
