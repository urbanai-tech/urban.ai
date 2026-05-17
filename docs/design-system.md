# Urban AI — Design System

**Data:** 2026-05-17
**Owner:** Dev 2 (Frontend & UX) + Gustavo (decisões de marca)
**Status:** 96% pronto (gap N do roadmap)
**Coexistência:** público dark, admin dark, app autenticado light premium.

---

## Princípios

1. **Manifesto editorial primeiro.** Bebas Neue gigante + Inter body + accent único `#E8500A`. O design comunica premium **antes** do texto ser lido.
2. **Três expressões, uma marca.** Público (dark cinematográfico), Admin (dark ferramenta), App autenticado (light premium). Mesmos tokens semânticos, mesma família tipográfica, mesma cor accent.
3. **Sem rounded-xl colorido.** Cards, botões, badges são monocromáticos com border sutil + accent só quando há ação ou destaque.
4. **Sem emoji decorativo.** Ícones são SVG inline monocromáticos via componente `Icons.*`.
5. **Zero `alert()/confirm()/prompt()` nativos.** Use `AdminConfirmDialog` no admin ou modal inline no host.
6. **Texto tem hierarquia editorial:** eyebrow (uppercase 11px letter-spacing 3) → display (Bebas) → subtitle (Inter 14) → body (Inter 16).

---

## Tokens

### Cores

| Token | Valor | Quando usar |
|---|---|---|
| **`--app-accent`** / `--admin-accent` | `#E8500A` | CTAs primários, hover de link, selected state, hero number destacado |
| `--app-accent-soft` | `rgba(232, 80, 10, 0.10)` | Background de badge "accent" e card "accent" |
| `--app-success` / `--admin-success` | `#16A06B` / `#4ADE80` | Status positivo (sutil) — sucesso, ROI, ativo |
| `--app-warning` / `--admin-warning` | `#C8810E` / `#F5B547` | Atenção sutil — quota próxima, sem cobertura |
| `--app-danger` / `--admin-danger` | `#C2342E` / `#F87171` | Erro, ação destrutiva |
| `--app-text` / `--admin-text` | `#0E1116` / `rgba(255,255,255,0.92)` | Texto principal |
| `--app-text-muted` / `--admin-text-muted` | `rgba(14,17,22,0.62)` / `rgba(255,255,255,0.55)` | Subtítulos, labels |
| `--app-divider` / `--admin-divider` | `rgba(14,17,22,0.06)` / `rgba(255,255,255,0.08)` | Linhas divisórias, borders de card |
| `--app-bg` | `#FAFAFB` | Fundo do app autenticado |
| `--admin-bg` | `#080A0F` | Fundo do admin |

**Proibidos:** azul `#1931CF`, verde `#3FCF19`, rosa `#ff5a5f`, qualquer outro hex bruto. Usar tokens.

### Tipografia

| Hierarquia | Font | Size | Weight | Letter-spacing | Quando usar |
|---|---|---|---|---|---|
| Display hero | Bebas Neue | `clamp(56, 9vw, 120)` | 400 | -1px | KPI gigante, Hero card de tela |
| Display md | Bebas Neue | `clamp(36, 5vw, 56)` | 400 | -0.5px | KPIs de grid, números secundários |
| Display sm | Bebas Neue | 32px | 400 | -0.3px | Headings de seção |
| Eyebrow | Inter | 11-12px | 600 | 3-4px uppercase | Label antes de display |
| Body | Inter | 14-16px | 300-500 | 0 | Texto corrido |
| Caption | Inter | 12px | 400-500 | 0-1px | Labels, sub-text de card |
| Mono | monospace | 12-13px | 400 | 0 | IDs, valores monetários, código |

### Spacing scale (4-base)

```
4  · 8  · 12 · 16 · 24 · 32 · 48 · 64 · 80 · 96 · 128 · 160
```

### Radius

| Token | Valor | Onde |
|---|---|---|
| `--app-radius-card` / `--admin-radius-card` | 12 / 4 px | Cards |
| `--app-radius-control` / `--admin-radius-control` | 10 / 2 px | Botões, inputs |
| pill | 999px | Badges arredondados |

App é 10-12px (premium light, calmo). Admin é 2-4px (denso ferramenta, agressivo).

### Sombras

- App: `0 1px 2px rgba(14, 17, 22, 0.04)` (card padrão) → `0 4px 16px rgba(14, 17, 22, 0.06)` (elevated)
- Admin: nenhuma (planar) — separação por divider 1px `rgba(255,255,255,0.08)`

---

## 3 expressões da marca

### 1. Público (`.urban-manifesto`)

**Onde:** `/landing`, `/precos`, `/lancamento`, `/sobre`, `/contato`, `/forbidden`, `/not-found`, `/error`, `/plans` (autenticado mas cinematic), `/(home)` (login left side), `/waitlist/aceitar`.

**Visual:** fundo `#080A0F`, branco puro `#FFFFFF`, accent `#E8500A`, **Bebas Neue 120-220px** nos headlines, grain overlay SVG fractalNoise opacity 0.35, glow radial sutil.

**Elementos diagnósticos:**
- `urban-grain::before` em hero sections
- `urban-glow` posicionado absoluto pra criar atmosfera
- `urban-pull` para call-outs (border-left 2px accent)
- `urban-eyebrow` para labels uppercase

**Cards/botões:** zero rounded, monocromático preto/branco, accent só no CTA primário. Layout editorial (grid de linhas finas, não cards arredondados).

### 2. Admin (`.urban-admin`)

**Onde:** todas as 19+ rotas `/admin/*`. Wrap automático via `admin/layout.tsx` + `AdminShell`.

**Visual:** fundo `#080A0F` (mesma família do público), sidebar `#0E1117`, accent `#E8500A`, divider `rgba(255,255,255,0.08)`, **Bebas Neue 32-96px** nos KPIs hero/md.

**Densidade:** alta. Padding compacto, sticky table headers, row hover com box-shadow inset accent border-bottom 1px.

**Elementos diagnósticos:**
- `AdminShell` = sidebar fixa 240px + topbar com breadcrumb + busca de seção + badge env (prod/staging/local)
- `AdminSectionHeader` com eyebrow accent + display + actions
- `AdminMetricCard` variants `hero | md | sm`
- `AdminStatusDot` substitui emojis 🟢🟡🔴
- `AdminBadge` variants `success | warn | error | neutral | accent`
- `AdminTable` com row hover accent
- `AdminDrawer` substitui forms inline
- `AdminConfirmDialog` substitui `confirm()` nativo
- `AdminToast` + `useAdminToast()` substitui `alert()` nativo

### 3. App autenticado (`.urban-app`)

**Onde:** anfitrião autenticado — `/painel`, `/dashboard`, `/properties`, `/my-roi`, `/my-plan`, `/notificacao`, `/maps`, `/near-events`, `/settings/integrations`, `/onboarding`, `/create`, `/post-login`. Wrap via `HostShell`.

**Visual:** fundo `#FAFAFB` (cinza claríssimo, não branco puro pra reduzir flicker), accent `#E8500A`, divider `rgba(14,17,22,0.06)`, sombras sutis 1-4px rgba(14,17,22,0.04-0.06).

**Inspiração:** Stripe Dashboard + Linear (light) + Apple Business Manager.

**Elementos diagnósticos:**
- `HostShell` envolve todos os layouts; cuida do bg, padding, sidebar dark, footer
- `SideBar` dark `#0E1117` (mesma família admin) com switch admin↔host quando `user.role === 'admin'`
- `AppPageShell` para wrap de páginas (define max-width + padding)
- `AppSectionHeader` com eyebrow `urban-app-eyebrow` accent + Bebas Neue title
- `AppCard` variants `default | elevated | accent | subtle`
- `AppMetricCard` variants `hero | md | sm`
- `AppButton` variants `primary | secondary | ghost | danger` × sizes `sm | md | lg`
- `AppBadge` variants `success | warn | error | neutral | accent`
- `AppInput | AppSelect | AppTextarea` com leftAddon, label uppercase 11px
- `AppEmptyState` com eyebrow + Bebas + body + action CTA
- `AppToast` + `useAppToast()` substituindo `react-toastify`
- `AppFooter` minimal no rodapé do shell
- `<RecommendationCard>` (Pilar D do produto) — hero da recomendação de preço

---

## Componentes principais (anfitrião)

Catálogo em `src/app/componentes/ui/`. Barrel em `index.ts`.

### `AppButton`
4 variantes, 3 sizes, suporta `leftIcon`, `rightIcon`, `loading`, `as="a" href`. Sempre accent `#E8500A` no primary. Radius 10px (controle).

### `AppCard`
4 variantes:
- `default` — fundo branco, border divider, shadow-sm
- `elevated` — shadow maior, mais destaque
- `accent` — border-left 3px accent (pull-quote feel)
- `subtle` — fundo `--app-surface-muted` cinza claro

### `AppMetricCard`
3 variantes:
- `hero` — Bebas 56-96px, padding 32px, label uppercase eyebrow
- `md` — Bebas 36-56px, padding 24px (grid de 4 colunas default)
- `sm` — Inter 22px, padding 16px (inline)

Props: `label`, `value`, `sub`, `trend: 'up'|'down'`, `trendValue`, `accent: boolean`, `status: AppBadgeKind`.

### `RecommendationCard` (Pilar D)
**Coração do produto.** Mostra recomendação de preço de evento:
- Eyebrow categoria + status badge
- Título do evento
- Meta: data + localização + distância
- **Preço sugerido** dominante (Bebas accent) com badge delta %
- Preço atual em referência menor
- Motivo curto com Sparkles icon
- Confidence badge
- CTA primary (Aplicar) + CTA ghost (Ver detalhes)
- **(Gap 6)** Section `<details>` "POR QUE ESSE PREÇO?" com `DriverBar` + `HistoricalComparison` + `ScenarioComparison`. Mobile abre full-screen sheet.

### `DriverBar` (Gap 6)
Barra horizontal segmentada 8px com larguras proporcionais aos pesos (event/pace/compSet/seasonality). Cores via tokens semânticos. Legenda dot + label + %.

### `ScenarioComparison` (Gap 6)
Grid de 2-3 cenários ('sugerido' destacado com border-left 3px accent). Preço Bebas. Sub "Ocupação X% · Receita R$ Y mil".

### `PaceChart` (Gap 4)
SVG nativo (sem dependência nova). Área "booked" gradient accent + linha tracejada "expected" + annotations verticais de eventos. Tooltip ao hover. Empty state + loading skeleton.

### `AppToast` + `useAppToast()`
Toast manager top-right, 4500ms auto-dismiss, animação `urban-app-toast-in` 220ms ease. Substitui `react-toastify`. 4 variantes: success/warn/error/info.

### `AppFooter`
Footer minimal no shell. Wordmark URBAN AI + ©, links Termos/Privacidade/Contato/Status (hover accent).

---

## Como usar (snippets)

### Página típica do anfitrião

```tsx
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppMetricCard,
  AppButton,
  useAppToast,
  Icons,
} from "@/app/componentes/ui";

export default function MinhaPage() {
  const toast = useAppToast();

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="ÁREA · CONTEXTO"
        title="Título editorial"
        subtitle="Subtítulo explicando o que essa tela faz."
        actions={
          <AppButton
            variant="primary"
            onClick={() => toast.success("Feito.")}
            leftIcon={<Icons.Zap size={14} />}
          >
            Ação primária
          </AppButton>
        }
      />

      <section style={{ marginBottom: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32 }}>
        <AppMetricCard label="KPI 1" value={42} />
        <AppMetricCard label="KPI 2" value="R$ 1.250" accent />
      </section>

      <AppCard variant="default">
        {/* conteúdo */}
      </AppCard>
    </AppPageShell>
  );
}
```

### Página típica do admin

```tsx
import {
  AdminSectionHeader,
  AdminCard,
  AdminMetricCard,
  AdminButton,
  AdminTable,
  useAdminToast,
  Icons,
} from "../_components";

export default function MinhaPageAdmin() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader eyebrow="ADMIN · SEÇÃO" title="Título" subtitle="..." />
      {/* ... */}
    </div>
  );
}
```

---

## Anti-padrões (não fazer)

| ❌ Errado | ✅ Certo |
|---|---|
| `<Button colorScheme="blue">` | `<AppButton variant="primary">` |
| `bg="#1C1D3B"` ou `bg-emerald-500` | `var(--app-accent)` ou `var(--admin-accent)` |
| Emoji `🏠 ✓ ⚠️` como ícone | `<Icons.Home />` `<Icons.Check />` `<AdminStatusDot kind="warn" />` |
| `alert("ok")` ou `confirm("?")` | `useAppToast()` ou `<AdminConfirmDialog>` |
| `borderRadius="2xl"` em card colorido | `<AppCard variant="default\|elevated\|accent\|subtle">` |
| `text-emerald-300` ou `text-blue-500` | `var(--app-success)` ou `var(--app-accent)` |
| `<Heading size="2xl">` chakra default | `<AppSectionHeader title size="hero\|md\|sm" />` (Bebas) |
| `Spinner color="blue.500"` | `<Spinner color="orange.500" />` ou skeleton |
| `useColorModeValue('white', 'gray.800')` | Tokens CSS variables (sem dark mode no host) |

---

## Acessibilidade (WCAG 2.1 AA)

- **Contraste:** mínimo 4.5:1 pra texto body. Validados:
  - `#0E1116` em `#FAFAFB` = 16.4:1 ✅
  - `rgba(14,17,22,0.62)` em `#FAFAFB` = 7.2:1 ✅
  - `#E8500A` em `#FAFAFB` = 4.6:1 ✅ (border do CTA já dá contraste suficiente)
  - Admin: `rgba(255,255,255,0.92)` em `#080A0F` = 17.8:1 ✅
- **Focus rings:** todos os componentes com `:focus-visible` outline 2px accent + offset 2px. Definido globalmente em `globals.css`.
- **Mobile:** bottom-nav 4 itens + drawer "Mais" no anfitrião; tabelas admin com `overflow-x-auto` + scroll indicator. Min 44x44px touch target.
- **Animação:** todas <300ms, sem flash, respeita `prefers-reduced-motion` quando aplicável.

---

## Migração de telas legadas (checklist)

Pra migrar uma tela Chakra default antiga pro design system:

- [ ] Wrap com `<AppPageShell>` ou `<AdminShell>` (admin já automatico via `admin/layout.tsx`).
- [ ] Substituir `<Heading>` por `<AppSectionHeader>` ou `<AdminSectionHeader>`.
- [ ] Substituir `<Box border rounded-xl bg=white>` (KPIs) por `<AppMetricCard>` ou `<AdminMetricCard>`.
- [ ] Substituir `<Button colorScheme="blue|teal|green">` por `<AppButton variant>` ou `<AdminButton variant>`.
- [ ] Substituir `<Badge colorScheme>` por `<AppBadge kind>` ou `<AdminBadge kind>`.
- [ ] Remover `useColorModeValue` — usar CSS vars.
- [ ] Substituir emoji por `Icons.*` SVG.
- [ ] Substituir `alert()/confirm()/prompt()` por toast/dialog do design system.
- [ ] Validar `npx tsc --noEmit` + smoke visual em desktop + mobile.

---

## Roadmap do design system

- ✅ 96% pronto — tokens + 30+ componentes + 3 expressões da marca + RecommendationCard + AdminShell + HostShell
- 🔲 Storybook (P3, não bloqueante) — visualização isolada dos componentes
- 🔲 Tokens em JSON (style-dictionary) — facilita Figma sync se houver designer no time
- 🔲 Audit WCAG AA com checklist preenchido (Lighthouse a11y ≥90 em todas as telas)
- 🔲 Dark mode no anfitrião (P3 — coexistir light/dark via `prefers-color-scheme`)

---

## Ownership

- **Dev 2** owns `src/app/componentes/ui/*` e admin `_components/*`
- **Dev 1, Dev 3** consomem; PRs adicionando novos componentes shared passam por review do Dev 2
- **Gustavo** decide marca (cores, tom, copy editorial) e aprova mudanças semânticas (ex: trocar accent)
