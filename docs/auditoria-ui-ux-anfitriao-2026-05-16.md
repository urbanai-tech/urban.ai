# Auditoria UI/UX — Fluxo do Anfitrião

**Data:** 2026-05-16
**Escopo:** 20 telas autenticadas + shell (SideBar/Header)
**Padrão de referência:** páginas públicas manifesto editorial (`/landing`, `/precos`, `/lancamento`)
**Framework:** high-ticket-page skill, MODO 1 (auditoria)

---

## Resumo Executivo

O fluxo autenticado está em outro universo visual em relação às páginas públicas redesenhadas. Enquanto `(public)/landing|precos|lancamento` carregam o manifesto editorial (preto `#080A0F`, accent `#E8500A`, Bebas Neue, grain), todas as 20 telas internas vivem em **light theme Chakra default** com primárias `blue.500`, `teal`, `green` e `emerald`.

O sistema parece duas marcas diferentes empilhadas no mesmo produto — o hóspede premium vê manifesto, o anfitrião pagante vê SaaS genérico de 2017. Telas que mais sangram conversão/UX, em ordem:

1. `/onboarding` (paywall final é o momento de checkout e está em Chakra blue)
2. `/my-plan` (KPIs em quadradinhos `blue.50/green.50/orange.50`)
3. `/plans` (Tailwind `slate-950` + `emerald-400` contradiz o accent oficial)
4. `/dashboard` (calendário com cores misturadas, badge `#3FCF19` verde berrante)

Há também 2 telas com **mock data hardcoded** (`/price` e `/onboarding/payment/price`) que vazaram para produção. **Recomendo tratar o fluxo do anfitrião como rebuild — não como ajuste cosmético.**

---

## Doenças Sistêmicas

1. **Stack inconsistente.** Chakra UI (light) domina o autenticado, mas `/plans`, `/plans/v2`, `/settings/integrations` mudaram pra Tailwind `bg-slate-950 text-slate-50` com **emerald-400/500** como accent — nem manifesto nem Chakra. Três sistemas brigando.

2. **Paleta proibida em quase toda página.** Uso disseminado de `colorScheme="blue"`, `colorScheme="teal"`, `colorScheme="green"`, `colorScheme="orange"`, `bg="blue.500"`, `bg="green.900"`, `bg-emerald-500`, badge `bg="#3FCF19"`, hex bruto `#1931CF`, `#1C1D3B`, `#ff5a5f` (vermelho Airbnb), `#E46E2E` (laranja errado — não é `#E8500A`).

3. **Background branco/cinza-claro hardcoded.** `bg="white"`, `bg="gray.50"`, `bg="#f8fafb"`, `useColorModeValue('white', 'gray.800')`. Nenhuma tela interna usa o `#080A0F`. O `useColorModeValue` está em todo lado mas dark mode não está ativado — código morto que confunde.

4. **Tipografia inexistente como sistema.** Nenhuma tela autenticada importa Bebas Neue. Tudo é Chakra default (Inter via system stack). Headings com `size="lg|2xl"` chakra (em torno de 30–40px) — zero presença editorial. Faltam eyebrows uppercase, pull quotes, hierarquia tipográfica de 3 níveis.

5. **Emojis decorativos no lugar de design.** `🏠`, `🛏️`, `🛌`, `🚿`, `👥`, `📍`, `🔗`, `✨`, `🛡️`, `⚖️`, `🚀`, `🤖`, `★` em `/onboarding`. Manifesto Apple/Linear não usa emoji como ícone — viola o "ZERO ícone decorativo".

6. **Loading e empty states amadorísticos.** Quase toda tela faz `<Center><Spinner size="xl" /></Center>` ou texto cru: `"Carregando..."`, `"Nenhum evento aceito encontrado"`, `"Sem eventos"`. `/post-login` tem o único loader trabalhado (ironicamente, com cor laranja `#E46E2E` — errada).

7. **Cards genéricos rounded-2xl com sombra.** `borderRadius="2xl"` + `boxShadow="sm"` repetidos sem variação. Em manifesto a regra é divider `rgba(255,255,255,0.08)`, não card flutuante.

8. **Toasts via `react-toastify` em config default.** Cor azul/verde/amarela do Toastify aparece em toda tela. Sem skin custom — quebra a marca toda vez que algo é salvo.

9. **Páginas com mock data em produção.** `/price` e `/onboarding/payment/price` exibem `"Apartamento charmoso perto do centro"` + `"The Town Music Festival"` + `onBack={() => alert('Voltar clicado')}`. Dead code que pode vazar para usuário real.

10. **Layout shell quebrado.** `SideBar.tsx` é o shell oficial (sidebar branca, `bg="#f8fafb"`), mas `header.tsx` parece protótipo paralelo. `HeaderLogin.tsx` usa `Image src="/image.png"` (filename genérico) + texto `"Ai Urban"` (nome errado).

---

## Tabela Consolidada — Nota por Tela

| Tela | 1ºImp | Estét | Estrut | Copy | Motion | Mobile | **TOTAL/60** |
|---|---|---|---|---|---|---|---|
| /dashboard | 4 | 3 | 5 | 6 | 3 | 5 | **26** |
| /properties | 4 | 3 | 5 | 5 | 3 | 4 | **24** |
| /onboarding | 5 | 3 | 6 | 6 | 5 | 5 | **30** |
| /onboarding/payment/price | 1 | 2 | 3 | 2 | 1 | 3 | **12** |
| /create | 4 | 4 | 5 | 5 | 4 | 5 | **27** |
| /post-login | 6 | 5 | 7 | 6 | 7 | 7 | **38** |
| /maps | 4 | 3 | 5 | 5 | 3 | 4 | **24** |
| /near-events | 3 | 3 | 4 | 4 | 3 | 4 | **21** |
| /near-events/[id] | 3 | 2 | 4 | 3 | 2 | 4 | **18** |
| /event-log | 3 | 3 | 4 | 5 | 3 | 5 | **23** |
| /my-plan | 4 | 3 | 5 | 5 | 3 | 5 | **25** |
| /plans | 5 | 4 | 5 | 6 | 4 | 5 | **29** |
| /plans/v2 | n/a (redirect) | – | – | – | – | – | – |
| /settings/integrations | 4 | 4 | 5 | 6 | 3 | 4 | **26** |
| /price | 1 | 2 | 3 | 2 | 1 | 3 | **12** |
| /painel | 4 | 3 | 5 | 5 | 3 | 4 | **24** |
| /notificacao | 5 | 4 | 5 | 5 | 4 | 5 | **28** |
| /my-roi | 6 | 5 | 7 | 7 | 4 | 6 | **35** |
| /address-verification | n/a (redirect) | – | – | – | – | – | – |
| /waitlist/aceitar | 5 | 4 | 6 | 6 | 4 | 6 | **31** |
| Shell (SideBar+Header) | 4 | 3 | 5 | 5 | 3 | 4 | **24** |

**Média geral: ~25/60.** Padrão SaaS funcional — nada premium.

---

## Auditoria por Tela

### /dashboard — 26/60
**Notas:** 1ºImp 4 · Estét 3 · Estrut 5 · Copy 6 · Motion 3 · Mobile 5

**O que está errado:**
- **[CRÍTICO]** Paleta — `useColorModeValue('blue.100', 'blue.900')` para hoje, `bg="#3FCF19"` (verde berrante hex bruto) no badge de contagem de eventos, `borderColor: 'blue.500'` no dia selecionado, focus ring `2px teal`. Quatro cores brigando.
- **[CRÍTICO]** Background — `bg={useColorModeValue('white', 'gray.800')}` no shell + `cardBg=white` + `headerBg=gray.100`. Tela toda em light theme.
- **[ALTO]** Tipografia — `Heading size={headingSize}` chakra default. Sem Bebas, sem eyebrow `CALENDÁRIO` uppercase.
- **[ALTO]** Hierarquia — calendário e painel de eventos têm peso visual igual (3:2). O dado de valor real é a recomendação de preço, não a grade.
- **[MÉDIO]** Loading — `<Spinner size="xl" />` cru. Sem skeleton.

**Como deveria ficar:** Fundo `#080A0F`, grain overlay, sidebar dark idem. Heading "CALENDÁRIO" eyebrow `#E8500A` + display Bebas Neue. Dias do mês como células sem bordas radius — apenas grid com divider `rgba(255,255,255,0.08)`. Dia com evento ganha pixel `#E8500A` em vez de badge verde. Painel de eventos à direita sem card flutuante — coluna pura com pull quotes.

---

### /properties — 24/60
**Notas:** 1ºImp 4 · Estét 3 · Estrut 5 · Copy 5 · Motion 3 · Mobile 4

**O que está errado:**
- **[CRÍTICO]** Button `colorScheme="blue"` para "Salvar" + `colorScheme="red"` no IconButton de delete + `colorScheme="green"` no toast. Três accents.
- **[ALTO]** Layout — `bg="white" borderRadius="md" shadow="sm"` envolvendo a lista. Genérico de admin panel.
- **[ALTO]** Inputs de "Diária base" e "Receita média/mês" são `Input size="sm"` com placeholder cinza. Sem prefixo R$, sem ícone.
- **[MÉDIO]** AlertDialog de delete é Chakra default — branco com fonte default.
- **[MÉDIO]** Image 60×60 com `borderRadius="md"` ao lado de tipografia sm. Foto perde valor.
- **[BAIXO]** Texto "Latitude: x, Longitude: y" exposto como subtítulo — informação técnica em destaque irrelevante.

**Como deveria ficar:** Tabela editorial. Coluna esquerda imagem 80×80 sem radius. Nome em Inter 500 18px branco, endereço em rgba 0.65. Inputs com prefixo `R$` inline. Botão "Salvar" outline accent `#E8500A`. Linha divisória `rgba(255,255,255,0.08)` separando imóveis.

---

### /onboarding — 30/60
**Notas:** 1ºImp 5 · Estét 3 · Estrut 6 · Copy 6 · Motion 5 · Mobile 5

**O que está errado:**
- **[CRÍTICO]** Step 1 CTA `bg="#ff5a5f"` (rosa Airbnb hex bruto, proibido).
- **[CRÍTICO]** Step 2 CTA `bg="#2E3748"` (cinza-azul hex bruto, não é nem manifesto nem chakra).
- **[CRÍTICO]** Step 4 Strategy Cards: paleta dinâmica `borderColor={\`${preset.color}.400\`}` onde `color` ciclará entre `green`, `blue`, `orange`, `purple`. Quatro accents brigando.
- **[CRÍTICO]** Emojis como ícones: `🛡️`, `⚖️`, `🚀`, `🤖`, `🛏️`, `🛌`, `🚿`, `👥`, `📍`, `🔗`, `✨`, `★`, `🏠`. Sistema Apple não usa emoji.
- **[ALTO]** Step 5 (paywall) — badges `colorScheme="orange"`, "Economize 20%" em `colorScheme="green"`, ListIcon `color="green.400"`. Pricing card SaaS dos anos 2010.
- **[ALTO]** Container `bg="white" borderRadius="2xl" boxShadow="0 4px 24px rgba(0,0,0,0.06)"`.
- **[ALTO]** Progress bar `bg={i < step ? "blue.500" : "gray.200"}`.
- **[MÉDIO]** Spinner final no Suspense `color="blue.500"`.

**Como deveria ficar:** Background `#080A0F` full bleed, sem card branco interno. Progress bar como linha fina `rgba(255,255,255,0.08)` com preenchimento `#E8500A`. CTAs primários `bg="#E8500A"` color="white" radius="0" hover translateY. Eyebrow "ETAPA 01 / 05" letter-spacing 4. Strategy cards sem emoji, com nome em Bebas ("CONSERVADORA" 48px) e accent border-left 2px `#E8500A` quando selecionado. Paywall: usar exatamente o layout de `/precos`.

---

### /onboarding/payment/price — 12/60
**Notas:** 1ºImp 1 · Estét 2 · Estrut 3 · Copy 2 · Motion 1 · Mobile 3

**O que está errado:**
- **[CRÍTICO]** Página inteira com **MOCK DATA** hardcoded — `mockProperty = { title: 'Apartamento charmoso perto do centro' }`, `mockEvent = "The Town Music Festival"`, `onBack={() => alert('Voltar clicado')}`. Vazou para produção.
- **[CRÍTICO]** É a tela de pagamento durante onboarding — mas o nome `/onboarding/payment/price` é uma comparação de preços de Airbnb com dados fake. Função e nome desalinhados.
- **[ALTO]** `bg="white" borderRadius="md" shadow="sm"`, badge `bg="${color}.100"` (green/red/gray).

**Como deveria ficar:** Deletar ou reescrever do zero. Se for tela de pagamento, deve ser checkout Stripe — provavelmente substituir por redirect.

---

### /create — 27/60
**Notas:** 1ºImp 4 · Estét 4 · Estrut 5 · Copy 5 · Motion 4 · Mobile 5

**O que está errado:**
- **[CRÍTICO]** CTA `bg="#1C1D3B"` (azul escuro hex), hover `#262750` — não é `#E8500A`.
- **[ALTO]** Side image `<Image src="/urbanai_only.png" objectFit="cover" />` ocupando 50% — em manifesto seria background fullbleed dark com hero text.
- **[ALTO]** Card de regras de senha `bg="gray.50"` com `CheckCircleIcon green.500`.
- **[MÉDIO]** "Já tem conta? Entrar" link `color="blue.500"`.
- **[MÉDIO]** Loading screen do prelaunch usa `bg="#f8fafb"`.

**Como deveria ficar:** Layout 60/40 — esquerdo `#080A0F` com manifesto type ("BEM-VINDO À URBAN AI" Bebas), grain. Direito form em `#0E1117` com inputs `bg="transparent"` border-bottom `rgba(255,255,255,0.2)`. CTA `#E8500A`. Checkmarks em accent `#E8500A`.

---

### /post-login — 38/60 (melhor tela)
**Notas:** 1ºImp 6 · Estét 5 · Estrut 7 · Copy 6 · Motion 7 · Mobile 7

**O que está errado:**
- **[ALTO]** Cor do orbital `bg: '#E46E2E'` — laranja errado. O accent oficial é `#E8500A`.
- **[ALTO]** Background overlay `bg="rgba(10,12,24,0.76)"` — quase manifesto mas com tom azulado. Deveria ser `rgba(8,10,15,0.9)`.
- **[MÉDIO]** Logo `/urban-logo.png` width 360 — possivelmente versão clara/colorida.

**Como deveria ficar:** Trocar `#E46E2E` por `#E8500A` (substituição literal). Overlay para `#080A0F`. Manter animação — é a única tela com sensação de produto.

---

### /maps — 24/60
**Notas:** 1ºImp 4 · Estét 3 · Estrut 5 · Copy 5 · Motion 3 · Mobile 4

**O que está errado:**
- **[CRÍTICO]** Select nativo HTML `<select style={{ border: "1px solid #ccc" }}>` para Raio (km). Browser default zero estilo.
- **[ALTO]** AntD `RangePicker` importado (`antd` lib) — outra biblioteca de UI com tema próprio. Estilo AntD light não combina com nada.
- **[ALTO]** `bg={useColorModeValue('white', 'gray.800')}`, cards com `boxShadow="sm" borderRadius="xl"`.
- **[MÉDIO]** Heading `size="2xl" fontWeight="extrabold"` mas chakra default — sem Bebas.
- **[MÉDIO]** Spinner cru durante load do `AirbnbMap`.

**Como deveria ficar:** Mapa fullbleed dark (Mapbox style dark) com filtros flutuando em chip pill `bg="rgba(8,10,15,0.8)" backdrop-blur`. Eliminar antd — date picker custom. Heading "MAPA INTERATIVO" eyebrow + Bebas.

---

### /near-events — 21/60
**Notas:** 1ºImp 3 · Estét 3 · Estrut 4 · Copy 4 · Motion 3 · Mobile 4

**O que está errado:**
- **[ALTO]** `bg="gray.50"` no container. Tudo cinza-claro.
- **[ALTO]** Usa `<CasaCard />` genérico — listing dump sem hierarquia.
- **[ALTO]** Heading `{t('my_properties.title')}` — usa key i18n de **outra tela** (`my_properties`). Erro de copy/i18n.
- **[MÉDIO]** Sem filtro, sem ordenação, paginação default Chakra.

**Como deveria ficar:** Lista em estilo "índice editorial" — uma linha por imóvel com número (01, 02, 03 Bebas), nome, contagem de eventos, distância média. Sem cards. Hover trigger sublinha `#E8500A`.

---

### /near-events/[id] — 18/60
**Notas:** 1ºImp 3 · Estét 2 · Estrut 4 · Copy 3 · Motion 2 · Mobile 4

**O que está errado:**
- **[CRÍTICO]** Bug visual — string `");"` literal renderiza dentro do `<VStack>` após `Pagination` (linha 155: `);` solta fora de JSX expression). Imprime `);` em tela.
- **[CRÍTICO]** Mostra `ev.dataInicio` e `ev.dataFim` como ISO strings raw (`"2026-07-15T18:00:00Z"`). Sem format.
- **[ALTO]** Card `bg="white" borderRadius="2xl" boxShadow="sm"`, texto "blue.500" para distância.
- **[ALTO]** `bg="gray.50"` no container.

**Como deveria ficar:** Tela de evento como página de artigo — hero com imagem full width, nome em Bebas Neue 120px, eyebrow com categoria. Lista de imóveis próximos abaixo em formato editorial. **Arrumar o bug do `);` literal urgente.**

---

### /event-log — 23/60
**Notas:** 1ºImp 3 · Estét 3 · Estrut 4 · Copy 5 · Motion 3 · Mobile 5

**O que está errado:**
- **[CRÍTICO]** O caminho `/event-log` no sidebar tem label `'Configuração'` (com FiSettings icon) — mas o componente é uma tela de configurações de perfil. Naming desalinhado da rota.
- **[CRÍTICO]** Botão "Salvar Configurações" com `colorScheme="teal"`. Teal é proibido.
- **[ALTO]** `bg={useColorModeValue('gray.50', 'gray.700')}` no muted card, `bg="white"` no surface.
- **[ALTO]** Inputs `variant="filled"` chakra default — fundo cinza.
- **[MÉDIO]** Select native chakra com `bg="white"`.

**Como deveria ficar:** Renomear rota para `/settings` ou mover para `/settings/profile`. Tela em `#080A0F`. Inputs border-bottom only. Toggle de Estratégia como grid de chips manifesto, não select dropdown. CTA primary `bg="#E8500A"`.

---

### /my-plan — 25/60
**Notas:** 1ºImp 4 · Estét 3 · Estrut 5 · Copy 5 · Motion 3 · Mobile 5

**O que está errado:**
- **[CRÍTICO]** QuotaCard com paleta dinâmica `{ blue: {bg:'blue.50'}, green:{bg:'green.50'}, orange:{bg:'orange.50'} }`. Três accents diferentes nos KPIs lado-a-lado.
- **[CRÍTICO]** Badge "Alpha assistido" `colorScheme="purple"`. Roxo proibido.
- **[ALTO]** Heading "Meu plano" tamanho `2xl` mas sem peso editorial — manifesto pediria Bebas 120px com eyebrow "ASSINATURA".
- **[ALTO]** `<Subscription />` component provavelmente cheio de chakra default.
- **[MÉDIO]** Alert `status="warning"` chakra default (amarelo banana).

**Como deveria ficar:** Hero numérico — número de imóveis ativos/contratados em Bebas. Sub-stack monocromático branco/rgba(255,255,255,0.65). Apenas o estado "quota atingida" usa accent `#E8500A`. CTA "Gerenciar billing" outline accent.

---

### /plans — 29/60
**Notas:** 1ºImp 5 · Estét 4 · Estrut 5 · Copy 6 · Motion 4 · Mobile 5

**O que está errado:**
- **[CRÍTICO]** Migrou para Tailwind `bg-slate-950 text-slate-50` — mas accent é `text-emerald-400` no h1 ("cobrado por imóvel"). Verde proibido.
- **[CRÍTICO]** Página de planos do anfitrião NÃO bate visualmente com `/precos` pública. Duas estéticas.
- **[ALTO]** `<PricingCalculatorV2 />` shared — provavelmente cheio de slate/emerald.
- **[MÉDIO]** Heading `text-4xl md:text-5xl font-extrabold` system sans — sem Bebas.

**Como deveria ficar:** Reuse total de `/precos` (mesma estética manifesto). Provavelmente embeddar `(public)/precos/page.tsx` ou compartilhar component.

---

### /settings/integrations — 26/60
**Notas:** 1ºImp 4 · Estét 4 · Estrut 5 · Copy 6 · Motion 3 · Mobile 4

**O que está errado:**
- **[CRÍTICO]** Tailwind dark `bg-slate-900/60 border-slate-800` — terceiro tom dark do app, não bate com `#080A0F`.
- **[CRÍTICO]** CTA `bg-emerald-500 hover:bg-emerald-400 text-slate-900` — verde dominante. Input `focus:border-emerald-500`, checkbox `accent-emerald-500`, badge `bg-emerald-500/20 text-emerald-300`.
- **[ALTO]** Heading `text-3xl font-bold` system sans.
- **[MÉDIO]** Botão "Sincronizar listings" `border border-emerald-500 text-emerald-300`.

**Como deveria ficar:** Substituir `slate-950` por `#080A0F`, `emerald-500` por `#E8500A`. Heading "INTEGRAÇÕES" Bebas. Cards de listings em formato lista editorial.

---

### /price — 12/60
**Notas:** 1ºImp 1 · Estét 2 · Estrut 3 · Copy 2 · Motion 1 · Mobile 3

**O que está errado:**
- **[CRÍTICO]** Idêntico a `/onboarding/payment/price` — **mock data hardcoded** (`'Apartamento charmoso perto do centro'`, `'The Town Music Festival'`, `onBack={() => alert('Voltar clicado')}`). Mesmo arquivo duplicado.
- **[CRÍTICO]** Duas rotas em produção apontando para o mesmo placeholder.

**Como deveria ficar:** Deletar uma das duas rotas e implementar de verdade — ou redirect para `/painel` / `/dashboard`.

---

### /painel — 24/60
**Notas:** 1ºImp 4 · Estét 3 · Estrut 5 · Copy 5 · Motion 3 · Mobile 4

**O que está errado:**
- **[ALTO]** `bg={useColorModeValue('gray.50', 'gray.900')}` — light theme `gray.50`.
- **[ALTO]** Heading "Painel de controle" `size="2xl"` chakra default.
- **[ALTO]** `<DashboardCards />` (StatCard) — KPIs em quadradinhos coloridos.
- **[MÉDIO]** EmptyState texto "Nenhum evento aceito encontrado" em `<Center>` sem styling.

**Como deveria ficar:** Hero numérico (receita atribuída, sugestões aceitas, taxa) em Bebas gigante. Lista de eventos abaixo em formato editorial. Tudo `#080A0F`.

---

### /notificacao — 28/60
**Notas:** 1ºImp 5 · Estét 4 · Estrut 5 · Copy 5 · Motion 4 · Mobile 5

**O que está errado:**
- **[CRÍTICO]** Card de não-lida `bg="#E8F0FF"` (azul-pastel hex) + `titleColor='blue.800'` + badge "Novo" `bg="#1931CF"` (azul royal hex). Tudo azul.
- **[ALTO]** `bg={useColorModeValue('gray.50', 'gray.100')}` no container.
- **[MÉDIO]** Heading "Central de Notificações" `size="2xl"` default.
- **[MÉDIO]** Card `borderRadius="2xl" boxShadow="xs"` rounded típico.

**Como deveria ficar:** Lista vertical sem cards rounded. Não-lida ganha bullet `#E8500A` 6×6 absoluto à esquerda + título branco. Lida mantém título rgba 0.65. Badge "NOVO" como eyebrow accent letter-spacing 4. Timestamp em mono pequeno.

---

### /my-roi — 35/60
**Notas:** 1ºImp 6 · Estét 5 · Estrut 7 · Copy 7 · Motion 4 · Mobile 6

**O que está errado:**
- **[CRÍTICO]** Hero card `bg="green.900" color="white"` — verde escuro. É a PRIMEIRA coisa que o anfitrião vê (dinheiro gerado pela IA, momento de pico). Em verde-banco-de-trás-da-padaria.
- **[ALTO]** `Button colorScheme="green"`, table com `color="green.600" fontWeight="bold"`, `colorScheme={confidenceColor}`.
- **[ALTO]** Progress bar `colorScheme="green"`.
- **[ALTO]** Heading default chakra `size="2xl"` — para hero numérico de R$ deveria ser Bebas 200px.
- **[MÉDIO]** Select default chakra `bg="white"`.

**Como deveria ficar:** Hero "MEU ROI" eyebrow + valor monetário em Bebas Neue 180px branco. Linha abaixo "DINHEIRO ATRIBUÍDO À URBAN AI" eyebrow accent `#E8500A`. Sub-stats em grid de 4 colunas monocromáticas. Verde substituído pelo accent. Confidence badge como tag uppercase letter-spacing 4.

---

### /waitlist/aceitar — 31/60
**Notas:** 1ºImp 5 · Estét 4 · Estrut 6 · Copy 6 · Motion 4 · Mobile 6

**O que está errado:**
- **[CRÍTICO]** Inteiro em light theme `bg="white" borderRadius="2xl" boxShadow="lg"`. É o primeiro contato do convidado da waitlist com o produto — depois de ver `/lancamento` (manifesto), abrir o convite vai pra esse card branco genérico.
- **[ALTO]** Button `colorScheme="blue" size="lg"`. Spinner `color="blue.500"`.
- **[ALTO]** Alert `status="error"` chakra default vermelho.
- **[MÉDIO]** Heading `size="lg"` default.

**Como deveria ficar:** Match exato com `/lancamento`. Fundo `#080A0F` + grain. Heading "BEM-VINDO" Bebas + eyebrow "POSIÇÃO #X". Inputs sem caixa, border-bottom. CTA accent `#E8500A`.

---

### Shell (SideBar + Header) — 24/60
**Notas:** 1ºImp 4 · Estét 3 · Estrut 5 · Copy 5 · Motion 3 · Mobile 4

**O que está errado:**
- **[CRÍTICO]** Sidebar `bg="white"` com `borderRight="1px solid gray.200"` e botão ativo `bg="gray.700"`. Layout shell inteiro light. O produto inteiro vive nesse frame.
- **[CRÍTICO]** Background do app `bg="#f8fafb"` (cinza-azulado claro).
- **[ALTO]** Logo da sidebar: `<Image src="/urlaranja.png" maxH="110px" />` — filename "urlaranja" sugere versão laranja não padronizada.
- **[ALTO]** Botões de nav usam ícones `react-icons/fi` (Feather) — bom, mas com `_hover={{ bg: 'gray.100' }}` light.
- **[ALTO]** Logout button `colorScheme="red"` outline.
- **[MÉDIO]** Avatar chakra default + nome em fundo `bg="gray.50"`.
- **[MÉDIO]** Existem 3 headers diferentes: `header.tsx` (Tailwind light), `HeaderLogin.tsx` (texto "Ai Urban" errado, `/image.png` placeholder), `HeaderPublic.tsx` (manifesto correto). Confuso.

**Como deveria ficar:** Sidebar `bg="#0E1117"` (1 stop acima do shell), shell `bg="#080A0F"`, border-right `rgba(255,255,255,0.08)`. Item ativo com border-left 2px `#E8500A` + texto branco. Item inativo rgba 0.65. Logo dark transparente. Avatar circle outline branco. Logout discreto text-link. **Deletar `header.tsx` e `HeaderLogin.tsx` se obsoletos.**

---

## Plano de correção priorizado (top 15)

| # | Severidade | Mudança | Effort |
|---|---|---|---|
| 1 | CRÍTICO | Shell (SideBar.tsx) — migrar para dark manifesto, é o frame de tudo | M |
| 2 | CRÍTICO | /onboarding step 5 (paywall) — reuse de `/precos` manifesto | M |
| 3 | CRÍTICO | /my-plan QuotaCards + Subscription component — remover paleta blue/green/orange, accent único `#E8500A` | M |
| 4 | CRÍTICO | /my-roi hero card verde `bg="green.900"` — refazer em manifesto dark com Bebas | M |
| 5 | CRÍTICO | /plans e /settings/integrations — substituir `slate-950` por `#080A0F` e `emerald-*` por `#E8500A` globalmente | S |
| 6 | CRÍTICO | Deletar/redirect /price e /onboarding/payment/price (mock data em produção) | S |
| 7 | CRÍTICO | /create + /waitlist/aceitar — refazer com layout manifesto | M |
| 8 | CRÍTICO | /onboarding step 1-4 — remover todos os emojis, refazer cards de strategy/operation mode em monocromático | L |
| 9 | ALTO | /dashboard calendário — repaginar com paleta manifesto e remover badge `#3FCF19` verde | M |
| 10 | ALTO | /notificacao — substituir `#E8F0FF` + `#1931CF` por dark + accent | S |
| 11 | ALTO | /event-log — renomear rota para `/settings`, trocar `colorScheme="teal"` | S |
| 12 | ALTO | /near-events/[id] — corrigir bug do `);` literal vazando, formatar datas | S |
| 13 | ALTO | /maps — remover antd RangePicker e select nativo, padronizar componentes dark | M |
| 14 | ALTO | /properties — refazer lista em formato editorial sem cards | M |
| 15 | MÉDIO | Tema global Chakra — `theme.ts` com semantic tokens (`bg.canvas`, `bg.surface`, `accent`, `border.subtle`) apontando para manifesto | M |

---

## Componentes/utilitários a criar

1. **`<ManifestoShell>`** — wrapper de página com `bg #080A0F`, grain overlay, glow opcional, container responsivo. Substitui `bg="gray.50"` / `bg="white"` espalhado.
2. **`<NavSidebar>`** (nova SideBar dark) — sidebar `#0E1117` com items ativos em border-left `#E8500A`, ícones Feather monocromáticos, avatar circle outline, logout text-link.
3. **`<HeroNumber>`** — componente para hero numérico (ROI, receita, quota): eyebrow uppercase + Bebas Neue 120-200px + sub-text rgba.
4. **`<KpiCard>`** manifesto — KPI card monocromático com label uppercase letter-spacing 4, valor em Bebas, helper text rgba 0.65, sem fundo colorido. Substitui QuotaCard, Kpi, SmallMetric, StatCard.
5. **`<EditorialList>`** + **`<EditorialRow>`** — lista vertical estilo índice (01, 02, 03 Bebas) com divider `rgba(255,255,255,0.08)`, hover sublinha `#E8500A`. Substitui CasaCard.
6. **`<EmptyState>`** manifesto — eyebrow + heading curta + texto + CTA outline. Padroniza todos os "Sem eventos", "Nenhuma notificação".
7. **`<LoadingState>`** manifesto — substitui `<Spinner size="xl">`. Reusar animação do `/post-login` (logo + orbital `#E8500A`).
8. **`<ButtonPrimary>`** e **`<ButtonOutline>`** — wrappers padronizando `bg #E8500A` / `border 1px white outline`, sem border-radius, hover translateY. Extingue `colorScheme="blue/teal/green/orange"`.
9. **`<FormFieldManifesto>`** — input/select com border-bottom único, label uppercase eyebrow, sem variant filled.
10. **`<ToastManifesto>` (skin react-toastify)** — override de css do toastify para usar dark + accent.
11. **`<Eyebrow>`, `<DisplayHeading>`, `<PullQuote>`** — primitives tipográficos (já existem como utilities CSS em globals.css, virar componentes React).
12. **`theme.ts` Chakra** — semantic tokens centralizados (`colors.bg.canvas`, `colors.accent.primary`, `fonts.display = 'Bebas Neue'`). Sem essa base, refatoração espalhada vai voltar.
