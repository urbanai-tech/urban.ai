# Runbook — Redução Gradual da Dívida de ESLint (Frontend)

**Contexto:** a auditoria de 16/04/2026 pediu reativar ESLint no build do frontend (F5C.2 item 13). Um flip direto de `ignoreDuringBuilds: false` quebraria o build por 97 violações. Em vez disso, aplicamos estratégia em camadas: manter regras **críticas como error**, rebaixar **não-críticas para warning**, reativar o build. Este doc lista o que foi deixado como dívida e o plano para zerar.

---

## Estado após 24/04/2026

- ✅ `ignoreDuringBuilds: false` em `next.config.ts` — build agora depende do ESLint
- ✅ 2 violações `rules-of-hooks` (bloqueantes) corrigidas:
  - `ChainlitCopilot.tsx` — useEffect era chamado após early return condicional
  - `notificacao/page.tsx` — `useColorModeValue` chamado condicionalmente no `NotificationCard`
- 🟡 Config rebaixado em `eslint.config.mjs`:
  - `@typescript-eslint/no-unused-vars` → warn (com allowlist `^_`)
  - `react-hooks/exhaustive-deps` → warn
  - `@next/next/no-img-element` → warn
  - `react/no-unescaped-entities` → warn
  - `prefer-const` → warn
  - `@typescript-eslint/no-explicit-any` → off (preexistente, a remover junto com saneamento de `any`)

**Contagem atual (após o fix dos críticos):** ~95 warnings, 0 errors.

---

## Plano de redução — 4 passes

### Pass 1 — Imports/vars não usados (meta: -50 warnings, 1–2h)

Regex: `@typescript-eslint/no-unused-vars`.

Muitos são imports que sobraram de refactors. Usar o fix automático parcial:

```bash
cd Urban-front-main
npx next lint --fix
git diff    # revisar antes de commitar — --fix pode remover imports necessários
```

Casos comuns:
- Componentes Chakra importados e não usados (ex.: `Alert`, `AlertIcon`, `HStack`)
- Icons importados e não usados (lucide, react-icons, fortawesome)
- Variáveis `router`, `t`, `error` declaradas e nunca consumidas

Onde **não** remover: variáveis prefixadas com `_` (já ignoradas pela config), destructs que documentam forma do objeto mesmo sem uso.

### Pass 2 — `react-hooks/exhaustive-deps` (meta: -6, 2–4h)

Cada caso é decisão de arquitetura, não mecânico:
- Se a dep ausente é estável (useRef, setState callback): adicionar ao array.
- Se causa loop infinito: usar `useCallback`/`useMemo` para estabilizar.
- Se intencional (efeito once-on-mount): comentar com `// eslint-disable-next-line react-hooks/exhaustive-deps` + razão.

Arquivos conhecidos:
- `src/app/painel/components/CustomSelect.tsx:32` — dep faltante `prevPropsInfo`
- `src/app/painel/page.tsx:100` — dep faltante `fetchEvents`
- `src/app/near-events/[id]/page.tsx:89` — dep faltante `fetchEventos`

### Pass 3 — `<img>` → `<Image />` do next/image (meta: -4, 1h)

4 ocorrências. Ganho real de LCP/bandwidth. Converter para `<Image>` com `width`/`height` explícitos. Imagens remotas precisam adicionar domínio em `next.config.ts → images.remotePatterns`.

### Pass 4 — `react/no-unescaped-entities` + `prefer-const` (meta: -3, 15 min)

Trivial. Apenas escapar apóstrofes (`&apos;`) ou usar template strings; trocar `let` por `const` onde o linter apontar.

### Pass 5 (opcional) — Remover `@typescript-eslint/no-explicit-any: off`

Audit de `any` (33 usos segundo auditoria). Substituir por:
- Tipos específicos quando possível
- `unknown` + type guard quando vindo de fonte externa
- Interface dedicada para payloads do backend

Este pass é o mais pesado (4–8h) e pode ficar para depois do go-live.

---

## Cronograma recomendado

| Pass | Quando | Esforço | Prioridade |
|---|---|---|---|
| 1 — unused vars | Semana 6 (antes de beta fechado) | 1–2h | Alta (limpeza visível) |
| 2 — exhaustive-deps | Semana 6–7 | 2–4h | Média (bugs latentes) |
| 3 — img→Image | Semana 7–8 | 1h | Baixa (ganho de performance) |
| 4 — entities+const | A qualquer momento | 15 min | Baixa |
| 5 — no-any | Pós go-live (Semana 10+) | 4–8h | Baixa (qualidade) |

---

## Como medir progresso

```bash
cd Urban-front-main
npx next lint 2>&1 | grep -cE "Warning|Error"
```

Meta: chegar a **≤ 10 warnings** até semana 8 e **0 warnings** até o fim da F6 (semana 11).

---

*Última atualização: 24/04/2026 — criado junto com F5C.2 item 13 (reativação do ESLint no build).*
