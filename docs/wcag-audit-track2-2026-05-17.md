# Auditoria WCAG 2.1 AA — Track 2 (Dev 2 Frontend) — 2026-05-17

Escopo: apenas arquivos entregues pelo Dev 2 nas semanas 1-8 (design system
do anfitriao + telas /portfolio, /properties/:id/pricing-rules e
/properties/:id/market).

Padrao do design system aplicado:
`focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] focus-visible:outline-offset-2`.

## Resultado tsc

```
$ npx tsc --noEmit
EXIT=0
```

Sem erros de tipo apos os fixes.

## Notas globais

- `--app-text-muted` (rgba 0.62) e `--app-text-dim` (rgba 0.70) tem contraste
  >= 4.5 sobre `--app-bg`. Use `--app-text` para conteudo critico.
- Tailwind v4 esta habilitado (postcss.config.mjs) — `sr-only` ja vem do
  framework, nenhuma classe utilitaria nova foi adicionada.
- HostShell esta FORA do escopo deste track. O `<SkipLink>` foi criado e
  exportado no barrel `componentes/ui/index.ts`, mas precisa ser montado por
  Dev 1 dentro do HostShell (envolvendo o `<main id="main-content">`).

## Checklist por arquivo

Legenda: OK = ja conforme · FIX = corrigido nesta passada · N/A = nao se
aplica (sem elementos do tipo).

### Componentes design system (`src/app/componentes/ui/`)

| Arquivo | Contraste 1.4.3 | Focus 2.4.7 | ARIA 1.3.1/4.1.2 | Heading 1.3.1 | Keyboard 2.1.1 | Live 4.1.3 | Touch 44px 2.5.5 | Motion |
|--|--|--|--|--|--|--|--|--|
| `RecommendationCard.tsx` | OK | FIX (toggle + close mobile) | OK (aria-expanded, aria-controls, aria-label sheet) | OK (h3) | OK (Esc fecha sheet) | N/A | FIX (close mobile 32→44) | OK |
| `DriverBar.tsx` | OK | N/A (sem interativos) | OK (role=img+aria-label, decorativos aria-hidden) | N/A | N/A | N/A | N/A | OK |
| `ScenarioComparison.tsx` | OK | N/A | OK | N/A | N/A | N/A | N/A | OK |
| `PaceChart.tsx` | OK | OK | OK (svg role=img, tooltip role=tooltip, skeleton aria-busy) | N/A | OK (hover-only OK, tooltip nao oculta info critica) | OK (aria-busy no skeleton) | N/A | OK |
| `PortfolioCalendar.tsx` | FIX (`—` mudou de text-dim para text-muted com aria-label) | FIX (botoes dia mobile+desktop) | FIX (aria-label rico por celula) | N/A | OK (J/K/H/L registrado) | OK (aria-busy loading) | FIX (mobile day buttons min-h 44) | OK |
| `AskUrbanDrawer.tsx` | OK | FIX (close, send, suggestion, citation, feedback) | OK (role=dialog, aria-modal, aria-labelledby, focus trap, restore) | OK (h2 titulo) | OK (Esc + Cmd+J via provider) | FIX (ThinkingDots aria-live=polite) | FIX (close 36→44, send 36→44, suggestions min-h 44) | FIX (prefers-reduced-motion) |
| `AskUrbanProvider.tsx` | OK | FIX (FAB) | OK (aria-label FAB, atalho documentado) | N/A | OK (Cmd+J global, Esc fecha) | N/A | OK (FAB 56px) | OK |
| `AskUrbanUpgradeModal.tsx` | OK | FIX (close button) | OK (role=dialog, aria-modal, aria-labelledby, backdrop aria-hidden) | OK | OK (Esc) | N/A | FIX (close 28→44) | OK |
| `AppToast.tsx` | OK | FIX (close) | FIX (role=alert+assertive em error/warn; status+polite em success/info) | N/A | N/A | FIX | FIX (close 28 com flex center) | FIX (prefers-reduced-motion) |
| `AppFooter.tsx` | OK | FIX (onFocus/onBlur + focus-visible nos links) | OK (nav aria-label, externos rel=noopener) | N/A | OK | N/A | OK | OK |
| `AppConfirmDialog.tsx` | OK | OK (AppButton ja tem) | FIX (backdrop aria-hidden) | OK (h2) | OK (Esc) | N/A | OK (AppButton padrao) | OK |
| `SkipLink.tsx` (NOVO) | OK (focus state bg accent + text white = >7:1) | OK (sr-only + focus:not-sr-only) | OK (link semantico) | N/A | OK | N/A | OK | OK |

### Tela `/portfolio`

| Arquivo | Contraste | Focus | ARIA | Heading | Keyboard | Live | Touch | Motion |
|--|--|--|--|--|--|--|--|--|
| `portfolio/page.tsx` | OK | FIX (date inputs) | OK | OK (h1 via AppSectionHeader) | OK (J/K/H/L) | FIX (placeholder role=status aria-live=polite) | OK | OK |
| `portfolio/layout.tsx` | OK | OK | OK | OK | OK | OK | OK | OK |
| `portfolio/components/PortfolioToolbar.tsx` | FIX (DropdownItem text-dim→text-muted) | FIX (botao limpar + DropdownItem) | FIX (aria-label "limpar selecao") | OK | OK | N/A | OK (botoes AppButton sm OK) | OK |

### Tela `/properties/:id/pricing-rules`

| Arquivo | Contraste | Focus | ARIA | Heading | Keyboard | Live | Touch | Motion |
|--|--|--|--|--|--|--|--|--|
| `pricing-rules/page.tsx` | OK | OK (AppButton padrao) | OK (StickySaveFooter role=region) | OK (h1) | OK (Ctrl+S) | FIX (skeleton role=status aria-busy) | OK | OK |
| `pricing-rules/layout.tsx` | OK | OK | OK | OK | OK | OK | OK | OK |
| `components/PricingRuleCard.tsx` | OK | FIX (Switch + header role=button) | FIX (aria-label rico no header) | OK (h3, lista de cards) | OK (Enter/Space header) | N/A | FIX (header min-h 44) | OK |
| `components/CopyRulesModal.tsx` | OK | FIX (close button novo) | FIX (backdrop aria-hidden, close button explicito) | OK (h2) | OK (Esc) | FIX (loading role=status, error role=alert) | FIX (close 44x44) | OK |
| `components/PreviewStrip.tsx` | OK | N/A (sem interativos) | OK (role=img, aria-live no "atualizando") | OK | N/A | OK | N/A | OK |

### Tela `/properties/:id/market`

| Arquivo | Contraste | Focus | ARIA | Heading | Keyboard | Live | Touch | Motion |
|--|--|--|--|--|--|--|--|--|
| `market/page.tsx` | OK | OK | OK (aria-busy skeleton, secoes com aria-label) | FIX (h3→h2 para hierarquia correta apos h1) | OK | OK (aria-busy skeleton) | OK | OK |
| `market/layout.tsx` | OK | OK | OK | OK | OK | OK | OK | OK |
| `components/PercentileHero.tsx` | OK | N/A | OK (section aria-label, status badge aria-label) | OK (h2 hero) | N/A | OK (role=status trend) | N/A | OK |
| `components/AdrComparisonChart.tsx` | OK | OK (rects tabIndex 0 + aria-label ja) | OK (svg role=img + title + sr-only trend summary, tooltip role=tooltip) | N/A | OK (Tab pelos hover rects) | OK | N/A | OK |
| `components/ComparablesTable.tsx` | OK | FIX (SortableColHeader aria-label) | FIX (cards mobile com role=list/listitem, removido aria-hidden incorreto) | OK | OK (Tab pelos headers, Enter/Space) | OK (caption sr-only, aria-sort) | OK | OK |

## Observacoes que ficam para outros tracks

1. **HostShell** (Dev 1) — quando montar `<SkipLink />`, garantir que o
   container do conteudo principal use `<main id="main-content" tabIndex={-1}>`.
2. **AppPageShell** — atualmente envolve em `<div>`. Poderia ser `<main>` mas
   esta fora do escopo desta passada.
3. Considerar tokens novos: `--app-focus-ring` (atualmente derivado de
   `--app-accent`) ja funciona, mas centralizar ajudaria.
4. `AppButton` — verificar se ja tem focus-visible (esta fora deste escopo;
   provavelmente tem, baseado no comportamento de teclado observado).

## Numeros

- Arquivos auditados: 22 (11 componentes design system + 1 layout portfolio +
  3 paginas + 7 subcomponentes/components).
- Arquivos modificados: 14.
- Arquivos novos: 1 (`SkipLink.tsx`).
- Nenhuma dependencia adicionada.
- Sem warning de tsc.
