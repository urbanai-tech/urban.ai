# Design System — Urban AI

**Versão:** 1.0 (consolidada do código em 2026-06-21)
**Fonte de verdade no código:** `Urban-front-main/src/app/componentes/ui/design-tokens.css`
**Estilo aprovado:** dark editorial (ref. Vinci Society) no público; light premium (ref. Stripe/Linear) no app; dark tool no admin.

> Este documento descreve o sistema **como está** e propõe a **camada de tokens neutros para rebrand** (seção 3). O que é proposta está marcado como tal.

---

## 1. Três superfícies (cada rota usa uma)

O produto tem três contextos visuais, aplicados por classe raiz:

| Classe | Onde | Tema | Inspiração |
|--------|------|------|-----------|
| `.urban-manifesto` | Público (`myurbanai.com`) | Dark editorial | Vinci Society, manifesto |
| `.urban-app` | Host autenticado (`app.*`) | Light premium | Stripe Dashboard, Linear |
| `.urban-admin` | Admin (`/admin/*`) | Dark tool | Linear dark, ferramentas internas |

Cada superfície tem seu conjunto de tokens (`--theme-public-*`, `--theme-app-*`, `--theme-admin-*`) e respeita `data-theme="light|dark"` no `:root`.

---

## 2. Tokens atuais (estado real)

### 2.1 Cor de marca (accent)
| Token | Light | Dark |
|-------|-------|------|
| `--theme-public-accent` | `#B83D07` | `#E8500A` |
| `--theme-app-accent` | `#B83D07` | `#E8500A` |
| `--theme-admin-accent` | `#B83D07` | `#E8500A` |
| accent-hover | `#9A3105` | `#FF6A1A` |
| accent-soft | rgba(184,61,7,.12) | rgba(232,80,10,.16) |

**Laranja `#E8500A`** (dark) / **`#B83D07`** (light, mais escuro p/ contraste em fundo claro) é a cor única de marca.

### 2.2 Superfícies / fundo
| Contexto | Light | Dark |
|----------|-------|------|
| Page bg | `#FAFAFB` | `#080A0F` |
| App surface | `#FFFFFF` | `#11151C` |
| App surface elevated | `#FFFFFF` | `#171C24` |
| Admin bg | `#F7F7F8` | `#080A0F` |
| Text primário | `#0E1116` | rgba(255,255,255,.92) |

### 2.3 Cores semânticas
| Papel | Light | Dark |
|-------|-------|------|
| Success | `#16A06B` / `#137A55` | `#4ADE80` |
| Warning | `#C8810E` / `#9A6508` | `#F5B547` |
| Danger | `#C2342E` / `#B42318` | `#F87171` |

### 2.4 Tipografia
| Papel | Fonte | Uso |
|-------|-------|-----|
| Display/Headline | **Bebas Neue** (fallback Inter) | `.urban-*-display-hero/md/sm`, números grandes |
| Corpo/UI | **Inter** (system fallback) | texto, controles |
| Eyebrow | Inter 600, 11–12px, letter-spacing 3–4px, uppercase, cor accent | rótulos de seção |
| ⚠️ Legado | **Poppins** forçado em `* { ... !important }` (linhas 1–7) | **conflito** — ver dívida 4.1 |

Hero: `clamp(56px, 9vw, 120px)`, line-height .92, letter-spacing -1px. Mobile reduz para `clamp(42px,13vw,64px)`.

### 2.5 Forma & profundidade
- Radius: card 12px, control 10px, pill 999px (`--app-radius-*`).
- Sombras: card discreta, elevated, overlay (escalas em light/dark).
- Texturas de marca: `.urban-grain` (ruído fractal SVG, opacity .35, mix-blend overlay), `.urban-glow` (radial laranja blur 40px), `.urban-pull` (border-left laranja 2px).

### 2.6 Componentes padronizados
- **Cards:** `.urban-app-card`, `-elevated`, `-accent` (border-left accent).
- **Skeletons:** shimmer (`urban-app-skeleton`, `urban-admin-skeleton`).
- **Admin:** sidebar com item ativo border-left accent, switch custom, drawer slide-in (cubic-bezier 0.16,1,0.3,1), scrollbar dark, row hover com inset accent.
- **Foco (a11y):** `outline: 2px solid accent; outline-offset: 2px` em todos os interativos.
- Família de componentes React: `App*` (host) e `Admin*` (admin) — AppButton, AppCard, AppInput, AppMetricCard, AppSectionHeader; AdminButton, AdminCard, AdminTable, AdminMetricCard, etc.

---

## 3. Camada de tokens para rebrand (PROPOSTA — implementar)

**Problema:** a cor de marca `#E8500A`/`#B83D07` está repetida em ~30 arquivos `.tsx/.css` (hardcoded fora dos tokens) e nos próprios temas. Trocar a marca hoje exige caçar hex em dezenas de lugares.

**Solução:** introduzir uma camada de **primitivos de marca** que os tokens de tema consomem. Trocar a marca passa a mexer em **3 valores**.

```css
/* === BRAND PRIMITIVES (única fonte da cor de marca) === */
:root {
  /* Trocar SÓ estas 3 linhas no rebrand */
  --brand-accent:        #E8500A;  /* cor de marca (dark) */
  --brand-accent-strong: #B83D07;  /* variante para fundo claro */
  --brand-accent-bright: #FF6A1A;  /* hover/realce */

  /* derivados (não tocar no rebrand) */
  --brand-accent-soft:   color-mix(in srgb, var(--brand-accent) 16%, transparent);
}
```

Depois, os tokens de tema deixam de ter hex e passam a referenciar o primitivo:

```css
:root[data-theme="dark"] {
  --theme-app-accent:       var(--brand-accent);
  --theme-app-accent-hover: var(--brand-accent-bright);
  --theme-public-accent:    var(--brand-accent);
  --theme-admin-accent:     var(--brand-accent);
}
:root[data-theme="light"] {
  --theme-app-accent:       var(--brand-accent-strong);
  /* ... */
}
```

**Regras a partir daqui (lint/convention):**
1. **Nenhum componente usa hex de marca direto.** Só `var(--theme-*-accent...)` ou `var(--brand-accent...)`.
2. `.urban-glow`, `.urban-pull` e os ~30 arquivos com `#E8500A` devem migrar para `var(--brand-accent)`.
3. Remover o `* { font-family: Poppins !important }` global e definir fontes só via `--font-display` / `--font-body` (ver 4.1).
4. Nome da marca nunca aparece "cru" em componente — vem de `siteConfig.name` (um lugar). Ver `REBRAND-MAP.md`.

> Benefício: rebrand de cor = 3 linhas. Rebrand de fonte = 2 variáveis. Rebrand de nome = 1 constante + assets.

### 3.1 Tokens de tipografia neutros (proposta)
```css
:root {
  --font-display: 'Bebas Neue', 'Inter', sans-serif;  /* trocar no rebrand */
  --font-body:    'Inter', system-ui, sans-serif;     /* trocar no rebrand */
}
```

---

## 4. Dívidas do design system

1. **Conflito de fonte:** `* { font-family: 'Poppins' !important }` (linhas 1–7) briga com `.urban-app *`/`.urban-manifesto *` que forçam Inter. Resolver removendo o global Poppins e usando `--font-body`. Hoje funciona por especificidade/ordem, mas é frágil.
2. **Hex de marca espalhado** em ~30 arquivos — migrar para tokens (seção 3).
3. **Dois frameworks de estilo** (Chakra legado + Tailwind novo) — definir trajetória de convergência para Tailwind + tokens.
4. **`!important` pesado** nas regras de fonte — reduzir conforme migra para tokens.

---

## 5. Acessibilidade (estado + metas)
- Focus rings consistentes (2px accent) — ✅.
- Auditoria WCAG 2.1 AA parcial existe (`docs/wcag-audit-track2-2026-05-17.md`); E2E com axe-core no frontend — ✅.
- **Verificar no rebrand:** contraste do novo accent em fundo claro (por isso existe `--brand-accent-strong`); o laranja atual já usa variante mais escura no light justamente para passar contraste. Qualquer cor nova precisa repetir esse cuidado (texto sobre accent e accent sobre bg).

---

## 6. Como usar (resumo para quem cria tela)
1. Escolha a superfície certa pela rota (público→manifesto, host→app, admin→admin).
2. Use componentes `App*`/`Admin*` existentes antes de criar novos.
3. Cores: só tokens (`var(--theme-app-accent)` etc.), nunca hex de marca.
4. Tipografia: classes `urban-*-display-*` para headline; Inter por padrão no corpo.
5. Estados: use success/warning/danger tokens; foco já vem dos rings globais.
6. Marca textual: importe de `siteConfig`, não escreva "Urban AI" no JSX.
