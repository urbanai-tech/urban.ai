# Plano de Correção e Reestruturação — Anfitrião + Admin

**Data:** 2026-05-16
**Status:** rascunho para aprovação do Gustavo
**Base:** cruzamento de 3 auditorias independentes + evidência visual (11 screenshots)

Documentos-fonte:
- `docs/auditoria-ui-ux-anfitriao-2026-05-16.md` (auditoria técnica do anfitrião, framework high-ticket-page, 20 telas + shell)
- `docs/auditoria-ui-ux-admin-2026-05-16.md` (auditoria técnica do admin, 19 telas)
- `Urban-front-main/docs/auditoria-ui-ux-anfitriao-admin-2026-05-16.md` (auditoria estratégica com renderização local + screenshots)
- `Urban-front-main/docs/auditoria-ui-ux-screenshots/` (11 PNGs — desktop + 1 mobile)

---

## 1. Cruzamento das 3 auditorias

### Convergências fortes (as 3 fontes apontam para o mesmo problema)

| Tema | Auditoria técnica anfitrião | Auditoria técnica admin | Relatório estratégico + screenshots |
|---|---|---|---|
| **Falta de design system único** | "três sistemas brigando (Chakra light + Tailwind dark slate + manifesto público)" | "padrão copy-pasted bg-slate-950 + emerald sem regra" | "produto montado por partes, não experiência intencional" |
| **Paleta caótica** | "blue/teal/green/emerald/orange + hex bruto `#ff5a5f`, `#3FCF19`, `#1931CF`" | "emerald/red/amber/blue/sky/rose/orange aplicadas como semântica universal" | "azul-marinho e laranja com parcimônia, neutros mais sofisticados" |
| **Botão primário sem cor única** | "`colorScheme="blue"` ou `colorScheme="teal"` ou `bg-emerald-500`" | "`bg-emerald-500 text-slate-900 font-bold rounded` em 40+ lugares" | "Aceitar Sugestão", "Salvar", "Atualizar" cada um com cor diferente |
| **Integrações é pior tela do anfitrião** | "terceiro tom dark + emerald — não bate com `#080A0F`" | n/a | "P0 — texto `text-slate-400` sobre fundo claro, ilegível, parece desabilitado" |
| **Admin sem nav persistente** | n/a | "17 NavCards num grid em vez de sidebar fixa" | "falta navegação admin persistente, breadcrumbs, busca global" |
| **alert/confirm/prompt nativos** | "Alert chakra default amarelo banana" | "15+ chamadas em waitlist, users, coverage, finance, contacts" | "muitas ações usam alert/confirm/prompt nativos, quebra polimento" |
| **Recomendação de preço subdimensionada** | "card branco com CTA pequeno, badge SUG/ATUAL/% competem" | n/a | "deveria ser objeto central da Urban AI, não card operacional" |
| **Emojis decorativos** | "🏠🛏️🛌🚿🛡️⚖️🚀🤖 no onboarding" | "🟢🟡🔴🚨📅⚙️💰 no dashboard executivo" | "muitos emojis/ícones inconsistentes" |
| **Loading states crus** | "`<Spinner size='xl'>` cru em ~12 telas" | "11 telas com texto `Carregando…` cru" | "falta polimento de loading/empty/error" |

### Achados novos do relatório estratégico + screenshots (que minhas auditorias técnicas subestimaram)

1. **CRÍTICO — Mobile do anfitrião está literalmente vazio.** `host-calendario-mobile.png` mostra a tela renderizando: sidebar desktop aberta, dois headers (hamburger da sidebar + logo + hamburger do header) e ZERO conteúdo principal. Footer aparece colado embaixo. Bloqueia uso real no celular. Minhas auditorias deram nota Mobile 4-5/10 — na verdade é **0-1/10**. Causa raiz: `Hide below="md"` + `Show below="md"` mal combinados em `SideBar.tsx` + `aside` com `height="100vh"`.

2. **CRÍTICO — Imagens quebradas em produção.** `host-propriedades.png` mostra `<img alt="Studio Paulista">` e `<img alt="Loft Jardins">` SEM imagem carregando — placeholder broken image visível no DOM. Mesma coisa em `host-calendario.png` no seletor de propriedade (`<img alt="Stu...">` dentro do `<select>` em vez de thumbnail). É bug funcional, não cosmético.

3. **CRÍTICO — Hierarquia visual INVERTIDA na recomendação de preço.** `host-painel.png`: badge "ATUAL R$ 320 +42.10%" está em VERDE chamativo grande; "SUG. R$ 455" está em AZUL escuro discreto. A sugestão (output da IA) DEVERIA dominar visualmente — está soterrada pelo "preço atual". Isso prejudica a percepção de valor do produto inteiro.

4. **ALTO — Header superior "Iniciar / Pagamentos" redundante.** Em todos os screenshots desktop do anfitrião o header só tem "Iniciar" e "Pagamentos" como links. Não complementa a sidebar — duplica e confunde.

5. **ALTO — Campos cortados no painel lateral do calendário.** `host-calendario.png` mostra "Resultado" e "Receita real" começando mas cortados no viewport. Bug de overflow não tratado.

6. **ALTO — Coordenadas latitude/longitude expostas no card de propriedade.** `host-propriedades.png` mostra "Latitude: -23.5617, Longitude: -46.6559" como segunda linha em destaque. Informação técnica em lugar nobre — deveria ser detalhe colapsável.

7. **MÉDIO — Banner "FALLBACK MANUAL DE EVENTOS" no admin/dashboard.** `admin-dashboard.png` mostra esse bloco no fim da tela, separado, sem padronização visual com o resto. CTAs "Cadastrar evento / Importar CSV / Rodar jobs" alinhados como texto link plano sem peso.

### Notas reconciliadas

| Frente | Auditoria técnica (eu) | Auditoria estratégica (você) | **Cruzada** |
|---|---|---|---|
| Anfitrião desktop | 25/60 (≈4.2/10) | 6.4/10 | **≈5/10** — funcional mas longe de premium |
| Anfitrião mobile | 4-5/10 (subestimei) | 2.5/10 | **2/10** — quebrado, bloqueia uso |
| Admin desktop | 27/60 (≈4.5/10) | 6.1/10 | **≈5/10** — usável internamente, comunica amador externamente |
| Consistência inter-áreas | n/a | 3.5/10 | **3/10** — três marcas no mesmo produto |
| Potencial pós-redesign | n/a | 8.5/10 | **8.5/10** — alcançável em 4 sprints |

**Veredicto cruzado:** as 3 auditorias convergem. Não há contradição material. As minhas (técnicas) dão direção de implementação (classNames, hex codes, file paths); a sua (estratégica) dá priorização de produto e captura bugs que só aparecem rodando. **Os planos abaixo unem as duas visões.**

---

## 2. Pilares estratégicos (6 frentes que englobam tudo)

Todo achado das 3 auditorias cai em uma destas 6 frentes. O plano completo é executar as 6 em paralelo controlado.

### Pilar A — Mobile do anfitrião funcional
**Problema:** tela mobile literalmente vazia. P0.
**Resultado esperado:** em 390×844, o anfitrião consegue navegar entre Painel, Calendário, Mapa, Propriedades, ROI sem ver header duplicado, sidebar desktop ou conteúdo cortado.

### Pilar B — Design system Urban AI (fundação compartilhada)
**Problema:** Chakra default light + Tailwind slate dark + manifesto público são três marcas no mesmo produto.
**Resultado esperado:** um arquivo de tokens (cor, tipografia, radius, sombra, spacing, breakpoint) consumido por Chakra theme + classes utilitárias Tailwind. Mesmo botão primário em qualquer tela.

### Pilar C — App shell unificado (anfitrião)
**Problema:** sidebar icon-only sem label, header superior redundante, item "Configuração" aponta pra `/event-log`, 3 headers diferentes coexistindo, dois loaders/wordmarks diferentes.
**Resultado esperado:** um único shell responsivo. Desktop: sidebar expansível com label. Mobile: top bar limpa + bottom nav de 4 itens (Painel, Calendário, Mapa, Propriedades) + "Mais".

### Pilar D — Componente "Recomendação de Preço" como hero do produto
**Problema:** o output principal da IA aparece como card operacional com hierarquia visual invertida (preço atual domina, sugestão some).
**Resultado esperado:** componente único `<RecommendationCard>` usado em Painel, Calendário, Notificação, e-mail. Sugestão é o número grande, preço atual é referência menor, motivo é pull-quote, CTA primário "Aplicar" claro.

### Pilar E — Admin Shell + premium-ferramenta (não premium-vitrine)
**Problema:** admin é dashboard genérico Bootstrap-admin 2019 com NavCard grid em vez de sidebar.
**Resultado esperado:** `<AdminShell>` com sidebar fixa, breadcrumbs, busca global, badge ambiente, usuário. Componentes admin (`MetricCard`, `DataTable`, `FilterBar`, `Drawer`, `ConfirmDialog`) substituem padrões inconsistentes.

### Pilar F — Acabamento (bugs visíveis em produção)
**Problema:** imagens quebradas, mock data hardcoded, ISO strings cruas, coordenadas brutas, alert nativos, string `");"` literal no JSX.
**Resultado esperado:** zero quebra visível em screenshot. Cada bug listado é fechado antes do redesign visual da tela em questão.

---

## 3. Plano do Anfitrião

### Sprint 1 — Estabilização (correção de base, 5-7 dias)

**Objetivo:** zerar bugs gritantes e desbloquear mobile. Sem redesign — só correção.

**Entregas:**

| # | Item | Tela | Severidade | Effort |
|---|---|---|---|---|
| 1 | Refatorar `SideBar.tsx` — eliminar `Hide below="md"` / `Show below="md"` mal combinados. Mobile recebe top bar + drawer (não sidebar desktop). Desktop mantém sidebar expansível. | Shell | CRÍTICO | M |
| 2 | Deletar `header.tsx` (redundante) e `HeaderLogin.tsx` (texto "Ai Urban" errado, `/image.png` placeholder). Manter apenas `HeaderPublic.tsx` (público) e novo `HeaderApp.tsx` (autenticado, mínimo). | Shell | CRÍTICO | S |
| 3 | Corrigir item "Configuração" da sidebar: ou renomear para "Ajustes" mantendo rota `/event-log`, ou mover componente para `/settings/profile` e remover `/event-log`. | Shell | ALTO | S |
| 4 | Corrigir `<Image>` quebradas em Propriedades + select de propriedade do Calendário. Fallback com inicial em circle quando `src` 404. | `/properties`, `/dashboard` (calendário) | ALTO | S |
| 5 | Deletar `/price` e `/onboarding/payment/price` (mock data hardcoded `'Apartamento charmoso perto do centro'` + `onBack={() => alert('Voltar clicado')}` em produção). Adicionar redirect 301 → `/painel`. | `/price`, `/onboarding/payment/price` | CRÍTICO | S |
| 6 | Corrigir bug do `");"` literal vazando como texto no JSX de `/near-events/[id]:155`. Formatar `ev.dataInicio` / `ev.dataFim` (ISO → pt-BR). | `/near-events/[id]` | ALTO | S |
| 7 | Corrigir key i18n errada em `/near-events` (usa `t('my_properties.title')` da outra tela). | `/near-events` | MÉDIO | S |
| 8 | Mover "Latitude: x, Longitude: y" para detalhes técnicos colapsável em Propriedades. | `/properties` | MÉDIO | S |
| 9 | Adicionar labels persistentes aos inputs de Diária base e Receita média em Propriedades. Hoje só placeholder. | `/properties` | ALTO | S |
| 10 | Corrigir overflow do painel lateral do Calendário (campos "Resultado" e "Receita real" cortados no viewport). | `/dashboard` (calendário) | ALTO | S |

**Gate:** Smoke test em 390×844 / 768×1024 / 1280×900 / 1440×1000. Nenhuma tela com header duplicado, sidebar desktop em mobile, conteúdo cortado, imagem quebrada visível.

---

### Sprint 2 — Design system + Shell unificado (8-10 dias)

**Objetivo:** Pilar B + Pilar C entregues. Toda tela seguinte usa esses primitives.

**Entregas:**

| # | Item | Effort |
|---|---|---|
| 1 | Criar `src/styles/tokens.css` ou `tailwind.config.js` `theme.extend` com tokens: `--app-bg`, `--app-surface`, `--app-surface-elevated`, `--app-text`, `--app-text-muted`, `--app-border`, `--brand-navy`, `--brand-orange`, `--success`, `--warning`, `--danger`, `--radius-card 12`, `--radius-control 10`, escalas de fonte (page-title 32/28/24, section-title 20/18, card-title 16, body 14, caption 12). | M |
| 2 | Criar `src/styles/chakra-theme.ts` consumindo tokens. Configurar `extendTheme` com `colors.brand`, `semanticTokens`, `components.Button.variants`, `Input`, `Card`, `Badge`. Trocar default `colorScheme="blue"` por `brand` (laranja `#E8500A`). | M |
| 3 | Componentes base — pasta `src/app/componentes/ui/`: `<Button variant="primary\|secondary\|ghost\|danger">`, `<Input>`, `<Select>`, `<Textarea>`, `<Card>`, `<Badge>`, `<Avatar>`, `<EmptyState>`, `<LoadingState>` (skeleton — não Spinner). Cada um <80 linhas, usando tokens. | L |
| 4 | Refazer `SideBar.tsx` → `<AppSidebar>`: desktop expansível 240px com ícone + label, colapsar via toggle (lembra preference em localStorage), item ativo com border-left 2px `#E8500A`, avatar circle 40px no rodapé com nome + plano. | M |
| 5 | Criar `<MobileNav>`: top bar 56px (logo + hamburger + ações contextuais opcionais) + bottom nav 64px fixa com 4 itens (Painel, Calendário, Mapa, Propriedades) + "Mais" → drawer com Notificações, ROI, Plano, Configurações, Sair. | M |
| 6 | Criar `<AppShell>` que escolhe sidebar (desktop ≥768px) vs mobile-nav. Substitui o uso atual de `SideBar.tsx` em todas as rotas autenticadas. | S |
| 7 | Skin custom de `react-toastify` em `tokens.css` (toast top-right, fundo dark surface, borda esquerda 2px na cor do status, sem ícone gritante). | S |
| 8 | Substituir todos `Alert chakra default` / `useToast()` por `<AppToast>` consistente. | M |

**Gate:** dois telas-amostra migradas e comparadas: `/painel` (mais visível) + `/properties` (mais editorial). Aprovação Gustavo+Fabrício antes de espalhar.

---

### Sprint 3 — Redesign de telas-chave (10-12 dias)

**Objetivo:** redesenhar 6 telas mais importantes usando os componentes do Sprint 2. Telas operacionais (events-log, plans, settings) ficam pro Sprint 4.

**Entregas:**

| # | Tela | O que muda |
|---|---|---|
| 1 | `/painel` (Painel de controle) | Hero band "Hoje na sua operação" — propriedade ativa + período + impacto financeiro do mês. KPIs ganham tendência, período e nível de confiança. Filtros como toolbar sticky. |
| 2 | Componente `<RecommendationCard>` (Pilar D) | Substitui card atual em Painel, Calendário, Notificação, e-mail. Estrutura: eyebrow (evento + categoria), título evento Bebas, data + distância, **preço sugerido grande em branco**, preço atual menor em rgba 0.65, delta % em accent `#E8500A`, motivo curto, nível de confiança chip, CTA primário "Aplicar sugestão", CTA secundário "Ver detalhes". |
| 3 | `/dashboard` (Calendário) | Grade do mês com células de altura uniforme, indicador de evento como dot accent 6×6 (não badge `#3FCF19`). Painel lateral sticky com scroll interno. "Registrar resultado" vira drawer (não inline cortado). Botão "Cancelar" vira ghost text-link (não vermelho gritante). |
| 4 | `/properties` | Lista editorial: foto 80×80 quadrada com fallback, nome + bairro, chips de status (auto/manual, conectado/livre), inputs com label persistente, ações "Histórico" / "Editar" em menu kebab, "Adicionar propriedade" como CTA primário no topo. |
| 5 | `/my-roi` | Manter força atual (é a melhor tela). Trocar `bg="green.900"` por `bg-app-surface-elevated` + accent `#E8500A` no número de dinheiro atribuído. Adicionar narrativa visual: "o que aconteceu / por que / o que fazer agora". Trend line opcional embaixo. |
| 6 | `/settings/integrations` | **Reescrever do zero** (P0 do relatório estratégico). Estrutura: header "Conexão Stays" + status pill (Conectado/Falha/Desconectado), última sincronização, listings sincronizados (lista com modo operacional por listing), permissões concedidas, log de push (últimos 10), zona de ação destrutiva separada ("Desconectar conta"). Usar `<Card>` + `<Badge>` + `<Button variant="primary\|danger">`. Sem `bg-slate-*` em fundo claro. |

**Gate:** A/B subjetivo Gustavo+Fabrício antes/depois cada tela. Lighthouse mobile score ≥85.

---

### Sprint 4 — Redesign do fluxo de aquisição + telas residuais (8-10 dias)

**Objetivo:** fechar onboarding, pagamento, planos. Esse é o caminho do dinheiro — não pode ficar SaaS-genérico.

**Entregas:**

| # | Tela | O que muda |
|---|---|---|
| 1 | `/create` | Layout 60/40 — esquerda manifesto (URBAN AI Bebas + tagline + grain), direita formulário sem caixa (inputs border-bottom only). Cor de CTA `#E8500A` (não `#1C1D3B`). Remover `gray.50` do card de regras de senha. |
| 2 | `/onboarding` steps 1-4 | Remover todos os emojis (🛡️⚖️🚀🤖🛏️🛌🚿👥📍🔗✨★🏠). Strategy cards e Operation mode cards passam a usar `<Card>` do design system, com indicador de seleção via border-left 2px `#E8500A`. Progress bar como linha fina horizontal (não bar chakra azul). |
| 3 | `/onboarding` step 5 (paywall) | **Reusar layout de `/precos`** (página pública já em manifesto editorial). Componente compartilhado `<PlanComparison>` — mesma estética desktop e mobile. CTA "Confirmar plano" `#E8500A` grande. |
| 4 | `/plans` e `/plans/v2` | Mesma decisão de reuso de `/precos`. Eliminar `text-emerald-400` no h1. Decidir se mantém `v2` ou apaga. |
| 5 | `/my-plan` | KPIs (QuotaCards) em monocromático — quota usada/contratada como hero numérico Bebas, sub-stack monocromático. Estado "quota atingida" usa accent `#E8500A`. Badge "Alpha assistido" vira eyebrow uppercase letter-spacing (não `colorScheme="purple"`). |
| 6 | `/notificacao` | Lista vertical sem cards rounded. Não-lida ganha dot accent 6×6 absoluto à esquerda + título branco. Lida mantém rgba 0.65. Substituir `bg="#E8F0FF"` + `bg="#1931CF"` por dark surface + accent. |
| 7 | `/waitlist/aceitar` | Match com `/lancamento`. Fundo `#080A0F` + grain. Eyebrow "POSIÇÃO #X" + heading Bebas + CTA `#E8500A`. Continuidade visual da vitrine. |
| 8 | `/maps` | Eliminar `antd RangePicker`. Date picker custom usando design system. Filtros como chips flutuando sobre o mapa (não inputs soltos). Mapbox style dark se possível. |
| 9 | `/near-events` + `/near-events/[id]` | Lista editorial estilo índice (01/02/03). Detalhe vira página de artigo (hero imagem + nome evento grande + meta data + lista de imóveis próximos abaixo). |
| 10 | `/event-log` | Renomear rota para `/settings/preferences` ou similar. Toggle de estratégia como grid de chips (não select dropdown). Inputs border-bottom. CTA "Salvar" `#E8500A` (não `colorScheme="teal"`). |

**Gate:** Onboarding completo de novo (login → conectar Stays → primeira recomendação aceita) em ≤8 minutos. Heat-map de cliques em recomendação ≥35% (referência atual baseline a definir).

---

## 4. Plano do Admin

### Sprint 1 — AdminShell + tokens admin (5-7 dias)

**Objetivo:** Pilar E entregue. Toda tela admin passa a ter shell e tokens compartilhados.

**Entregas:**

| # | Item | Effort |
|---|---|---|
| 1 | Adicionar bloco `.urban-admin` em `src/app/globals.css` análogo ao `.urban-manifesto`. Tokens CSS variables: `--admin-bg #080A0F` (não `slate-950`), `--admin-surface rgba(255,255,255,0.02)`, `--admin-divider rgba(255,255,255,0.08)`, `--admin-accent #E8500A`, `--admin-text rgba(255,255,255,0.92)`, `--admin-text-muted rgba(255,255,255,0.55)`. | S |
| 2 | Criar `src/app/admin/_components/AdminShell.tsx`: sidebar fixa 240px à esquerda agrupando nav em 4 seções (NEGÓCIO: overview, dashboard, finance, funnel, roi, alpha, contacts, waitlist · MOTOR DE EVENTOS: events, events/new, events/import, coverage, collectors-health · OPERAÇÕES: jobs, stays, users · SISTEMA: audit-logs, pricing-config, quality). Topbar 56px com breadcrumb + busca global + badge ambiente (`staging`/`prod`) + avatar admin. Substitui o grid de 17 NavCards em `/admin`. | M |
| 3 | Componentes admin — `src/app/admin/_components/`: `<AdminSectionHeader eyebrow display sub />`, `<AdminMetricCard variant="hero\|md\|sm">` (Bebas Neue no value se hero), `<AdminButton variant="primary\|secondary\|ghost\|danger">`, `<AdminInput>`, `<AdminBadge variant="success\|warn\|error\|neutral">`, `<AdminStatusDot>` (substitui emojis 🟢🟡🔴). | M |
| 4 | `<AdminDataTable>`: sticky header, tr hover `box-shadow inset 0 -1px 0 #E8500A`, divisor `rgba(255,255,255,0.06)`, scroll indicator (sombra lateral quando overflow horizontal), empty state slot. | M |
| 5 | `<AdminLoadingSkeleton variant="kpi\|table\|chart">` substituindo 11 strings "Carregando…" cruas. | S |
| 6 | `<AdminDrawer>` (slide-in direita 400-480px) + `<AdminConfirmDialog>` (centered com backdrop blur). Substitui forms inline (NewCostForm, NewRegionForm) e todos os `alert()`/`confirm()` nativos. | M |

**Gate:** `/admin` (overview) e `/admin/dashboard` (executivo) migrados como prova de conceito. Aprovação antes de espalhar.

---

### Sprint 2 — Migração das 6 telas mais críticas (10-12 dias)

**Objetivo:** dashboard executivo + 5 telas de maior impacto operacional.

**Entregas:**

| # | Tela | O que muda |
|---|---|---|
| 1 | `/admin` (overview) | Header eyebrow "ADMIN · OVERVIEW" + display Bebas "Painel". KPIs em grid de 4 colunas com `<AdminMetricCard variant="md">` (Bebas Neue 40-48px). Seção "Motor de IA" vira faixa horizontal full-bleed com border-left 2px `#E8500A`. Remover grid de NavCards (já está no AdminShell). |
| 2 | `/admin/dashboard` (executivo) | Health card vira faixa full-width horizontal com border-left 4px (verde/amber/red sólido — 1 cor por estado, **sem emoji**). Os 8 blocks viram grid de 4 KPIs gigantes + 4 KPIs médios. MiniTimeline com barras brancas + out-of-scope laranja 30% alpha (sem verde/vermelho). Toggle auto-refresh vira `<Switch>` custom. Banner "FALLBACK MANUAL DE EVENTOS" vira faixa amber-700 border-left 4px no topo da tela (não embaixo cortado). |
| 3 | `/admin/finance` | Hero KPI "Margem por imóvel" como `<AdminMetricCard variant="hero">` (Bebas 96px) com signal de tendência. Receita/Custo/Imóveis ativos como linha menor abaixo. `NewCostForm` vira `<AdminDrawer>` lateral. Barras de custos por categoria em branco (não emerald — custo ≠ receita). |
| 4 | `/admin/events` | Reorganizar KPIs: 1 hero ("Total" + "%cobertura"), 3 médios (próximos 7/30/90d), 4 pequenos. Toggle scope `in/out/all` vira `<SegmentedControl>` com underline orange. Coluna "Relevância" vira número monocromático + barra horizontal 2px abaixo (não badge `bg-rose-500/20` etc). TimelineChart com paleta branco/orange. |
| 5 | `/admin/waitlist` | Tabela com hover row `#E8500A` border-bottom. Ações ("Convidar Notas Remover") agrupadas em `<AdminButton variant="ghost">` com espaçamento, ou menu kebab. Busca + filtro como toolbar sticky no topo (não inputs soltos). Cards de lead opcional para 768px. |
| 6 | `/admin/funnel` | **Refazer como SVG funil real** (trapézios decrescentes), não lista. Números grandes Bebas dentro de cada estágio. % drop-off entre eles. Eyebrow `FUNIL DE PRODUTO · ÚLTIMOS X DIAS` + seletor de janela (30/60/90d). Tooltip explicando cada etapa. |

**Gate:** densidade preservada (admin não pode ficar inflado). Tempo de leitura primeira impressão Gustavo+Fabrício ≤5s pra "saúde geral".

---

### Sprint 3 — Migração das 13 telas restantes (8-10 dias)

**Objetivo:** consistência total. Cada tela usa componentes do Sprint 1.

**Entregas (telas, sem detalhamento — aplicar mesmo padrão):**

`/admin/alpha`, `/admin/audit-logs`, `/admin/collectors-health`, `/admin/contacts`, `/admin/coverage`, `/admin/events/new`, `/admin/events/import`, `/admin/jobs`, `/admin/pricing-config`, `/admin/quality`, `/admin/roi`, `/admin/stays`, `/admin/users`.

**Para cada uma:**
- Migrar shell (já feito globalmente).
- Substituir `bg-slate-950` por `var(--admin-bg)`, `border-slate-800` por `var(--admin-divider)`, `bg-emerald-500 text-slate-900` por `<AdminButton variant="primary">`.
- Loading cru → `<AdminLoadingSkeleton>`.
- Emoji → `<AdminStatusDot>` + ícone SVG (Lucide ou heroicons).
- `alert()/confirm()` → `<AdminConfirmDialog>`.
- Setas Unicode → `<Arrow direction="right" />` SVG 14px.
- Forms inline (coverage, finance new cost) → `<AdminDrawer>`.

**Caso especial — `/admin/collectors-health`:** tabela de 13 colunas vira master/detail (6 colunas + drawer ao clicar na linha com detalhes técnicos). Reduz overload visual.

**Caso especial — `/admin/audit-logs`:** coluna "Depois" vira ícone expand → drawer com JSON formatado (syntax-highlighted neutro). Form de filtros (5 inputs) colapsa em "Filtros avançados" no mobile.

**Gate:** 19/19 telas admin com mesma assinatura visual. Nenhuma `alert()` / `confirm()` / `prompt()` nativo sobrevive.

---

### Sprint 4 — Detalhes premium + observabilidade (5-7 dias)

**Objetivo:** acabamento "Linear-like".

**Entregas:**

| # | Item | Effort |
|---|---|---|
| 1 | Charts (MiniTimeline, TimelineChart, BarList) com paleta branco/orange/branco-30. Remover verde-vermelho saturado. | M |
| 2 | Busca global no AdminShell (Cmd+K) — abre command palette que navega entre telas e busca eventos/usuários por id/email. | M |
| 3 | Badge ambiente no topbar (`staging` / `prod` / `local`) lido de `NEXT_PUBLIC_ENV`. | S |
| 4 | Página `/admin/_debug` (ou setting do AdminShell): toggle dark/light futuro, atalhos de teclado, versão da build, link release notes. | S |
| 5 | Substituir setas Unicode `→ ←` por SVG component em 30+ lugares. | S |
| 6 | Adicionar `aria-label` em ícones / buttons sem texto. Pass WCAG 2.1 AA contrast em todos os pares texto/fundo. | M |

**Gate:** Lighthouse Accessibility ≥90 em `/admin/dashboard`. Atalho Cmd+K funciona em qualquer tela admin.

---

## 5. Design System base (compartilhado entre Anfitrião e Admin)

Não é um sprint à parte — é o subproduto do Sprint 2 do anfitrião + Sprint 1 do admin. Reproduzido aqui pra ficar claro o escopo único.

### Tokens

```css
/* src/styles/tokens.css */
:root {
  /* Surfaces */
  --bg-canvas: #FFFFFF;          /* Anfitrião desktop */
  --bg-canvas-dark: #080A0F;     /* Admin + público */
  --bg-surface: #F7F8FA;
  --bg-surface-elevated: #FFFFFF;
  --bg-surface-dark: rgba(255,255,255,0.02);

  /* Text */
  --text-primary: #0E1116;
  --text-secondary: rgba(14,17,22,0.62);
  --text-primary-dark: rgba(255,255,255,0.92);
  --text-secondary-dark: rgba(255,255,255,0.55);

  /* Borders */
  --border-subtle: rgba(14,17,22,0.06);
  --border-default: rgba(14,17,22,0.12);
  --border-subtle-dark: rgba(255,255,255,0.06);
  --border-default-dark: rgba(255,255,255,0.12);

  /* Brand */
  --brand-orange: #E8500A;
  --brand-orange-soft: rgba(232,80,10,0.15);
  --brand-navy: #1C1D3B;         /* só headlines secundárias */

  /* Semantic */
  --success: #16A06B;            /* sutil, nunca dominante */
  --warning: #C8810E;
  --danger: #C2342E;

  /* Radius */
  --radius-card: 12px;
  --radius-control: 10px;
  --radius-pill: 999px;

  /* Type */
  --font-display: 'Bebas Neue', 'Inter', sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --fs-page: clamp(28px, 4vw, 40px);
  --fs-section: 20px;
  --fs-card: 16px;
  --fs-body: 14px;
  --fs-caption: 12px;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(14,17,22,0.04);
  --shadow-md: 0 4px 16px rgba(14,17,22,0.08);

  /* Spacing scale 4-base */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;
}
```

### Componentes-fundação (15 itens)

Anfitrião + admin compartilham. Pasta sugerida: `src/app/componentes/ui/` (compartilhada) com sub-componentes `_admin/` ou `_host/` quando precisa especializar.

1. `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">`
2. `<Input>`, `<Select>`, `<Textarea>` (label + helper + erro)
3. `<Card>` (radius 12, shadow-sm, sem cores customizadas) + `<Card.Header>`, `<Card.Body>`, `<Card.Footer>`
4. `<Badge variant="success|warn|danger|neutral|accent">` (sem fill gritante)
5. `<StatusDot color="success|warn|error|neutral">` — substitui emojis 🟢🟡🔴
6. `<Avatar src fallback name size>`
7. `<MetricCard label value sub trend variant="hero|md|sm">`
8. `<DataTable columns rows onRowClick stickyHeader>` + `<DataTable.FilterBar>`
9. `<EmptyState eyebrow title sub cta>`
10. `<LoadingSkeleton variant="kpi|table|chart|text">`
11. `<Drawer side="right|left" size="sm|md|lg">`
12. `<ConfirmDialog title body confirmLabel destructive onConfirm>` — substitui `confirm()` nativos
13. `<Toast>` + `useToast()` — substitui `react-toastify` default
14. `<RecommendationCard>` — Pilar D, o objeto de produto central
15. `<Eyebrow>`, `<DisplayHeading>`, `<PullQuote>` — primitives tipográficos (já existem como CSS utilities no `globals.css`, virar componentes React reutilizáveis)

---

## 6. Critérios de aceite (como saber se cada sprint foi feito)

### Anfitrião
- **Sprint 1:** smoke test 390/768/1280/1440 em 6 telas-âncora sem header duplicado, sem broken image, sem mock data, sem string `");"` literal. Item "Configuração" da sidebar resolve corretamente.
- **Sprint 2:** demo de 2 telas com design system. Tokens documentados em README. Zero `bg="blue.500"` / `colorScheme="teal"` / `bg-emerald-500` no diff.
- **Sprint 3:** Lighthouse Mobile ≥85 em 6 telas. `<RecommendationCard>` mesma instância em ≥3 telas. `/settings/integrations` aprovado por Gustavo+Fabrício como confiável.
- **Sprint 4:** onboarding novo de ponta-a-ponta em ≤8 minutos. Zero emoji decorativo. `/onboarding` step 5 visualmente idêntico a `/precos`.

### Admin
- **Sprint 1:** AdminShell vivo em todas as 19 rotas. `/admin` overview e `/admin/dashboard` migrados como prova.
- **Sprint 2:** 6 telas refeitas com componentes admin. Densidade preservada (não inflou). Tempo de "primeira leitura" health geral ≤5s.
- **Sprint 3:** 19/19 com mesma assinatura. Zero `alert()/confirm()` nativo. Zero emoji.
- **Sprint 4:** Cmd+K funciona em qualquer tela. Lighthouse A11y ≥90.

### Métrica transversal
- **Consistência inter-áreas (medida em revisão):** sair de 3/10 para ≥8/10 após Sprint 3 do anfitrião + Sprint 1 do admin. Mesmo botão primário, mesma estrutura de eyebrow + display, mesma forma de empty/loading/error.

---

## 7. Ordem de execução sugerida (cruzada anfitrião × admin)

Como há fundação compartilhada (Pilar B), faz sentido cruzar as duas tracks:

| Semana | Anfitrião | Admin | Compartilhado |
|---|---|---|---|
| 1-2 | Sprint 1 (estabilização) | — | — |
| 3-4 | Sprint 2 (design system + shell) | — | tokens + componentes ui/ |
| 4-5 | — | Sprint 1 (AdminShell + tokens admin) | reuso componentes ui/ |
| 5-6 | Sprint 3 (redesign telas-chave) | Sprint 2 (6 telas críticas) | `<RecommendationCard>` |
| 7-8 | Sprint 4 (aquisição + residuais) | Sprint 3 (13 telas restantes) | — |
| 9 | Polish + a11y | Sprint 4 (detalhes premium) | — |

**Total estimado:** 9 semanas com um dev focado, ou 6 semanas com você + outro dev em paralelo.

**Bloqueios fora do plano (precisa decisão Gustavo):**
- Decidir se `/plans/v2` é mantida ou apagada (Sprint 4 anfitrião).
- Decidir se admin terá comando palette Cmd+K (Sprint 4 admin) — nice-to-have.
- Mapbox style dark precisa de chave/configuração no Mapbox (Sprint 4 anfitrião `/maps`) — verificar conta.

---

## 8. O que NÃO está no plano (decisões intencionais)

- **Não migrar Chakra para Tailwind no anfitrião agora.** Custo alto, benefício marginal. Em vez disso, configurar Chakra theme consumindo os mesmos tokens do Tailwind. Migração orgânica em features futuras.
- **Não introduzir Headless UI / Radix / MUI.** Tailwind puro + Chakra theme estendido cobre 100% do escopo. Menos uma dependência.
- **Não fazer dark mode no anfitrião.** Foco é light theme premium (estilo Stripe Dashboard). Dark mode do admin é manifesto editorial. Coexistem por design.
- **Não refazer páginas públicas.** Já estão em manifesto. Continuidade visual entra via componentes compartilhados (`<RecommendationCard>` em e-mail/`/landing`/`/painel`).
- **Não criar storybook agora.** Documentação inline + 2 telas-amostra do Sprint 2/Sprint 1-admin servem como referência viva. Storybook fica como dívida quando o sistema estabilizar.

---

## 9. Próximo passo (precisa do seu OK)

Aprovando este plano, eu:
1. Atualizo `docs/roadmap-pos-sprint.md` com as 4 fases descritas.
2. Crio uma issue/branch por sprint (ex: `feat(host-shell): Sprint 1 — estabilização`).
3. Inicio Sprint 1 do anfitrião (5-7 dias) — itens 1-10 da tabela acima, com PRs pequenos focados em uma tela por PR.
4. Em paralelo, deixo `tokens.css` + 5 componentes-base prontos para o outro dev consumir.

**Decisões que preciso de você antes de começar:**
1. **Mantemos Chakra no anfitrião?** Recomendo sim — migrar seria custoso e o ganho é zero se theme consumir tokens.
2. **Mobile nav: bottom-nav ou drawer-only?** Recomendo bottom-nav 4 itens + Mais. Suporta uso single-hand em portrait.
3. **`/plans/v2` morre ou vive?** Precisa decidir. Hoje tem 525B só (provavelmente redirect ou stub).
4. **Mapbox dark style** — tem conta paga ou seguimos com style default?
5. **Priorizamos Sprint 1 admin OU Sprint 3 anfitrião** após design system? Recomendo admin Sprint 1 — destrava painel interno mais rápido, e o dev pode trabalhar enquanto você revisa Sprint 3 anfitrião.

Aprovado, começo amanhã. Se quiser ajustar prioridades, frentes ou cortar escopo, me diz e refaço.
