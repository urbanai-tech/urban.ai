# Runbook — Auditoria WCAG 2.1 AA

**Contexto:** F5C.4 item #8. O axe-core automatizado cobre ~30–50% dos critérios WCAG. O restante precisa de revisão manual. Este checklist é o template para a auditoria que deve rodar **antes do go-live oficial** (S12–13) e a cada release maior depois disso.

---

## 1. Auditoria automatizada (axe-core via Playwright)

Script: `Urban-front-main/e2e/a11y.spec.ts`. Rodar:

```bash
cd Urban-front-main
E2E_BASE_URL=http://localhost:3000 npm run test:e2e -- a11y
# ou contra staging:
E2E_BASE_URL=https://staging.myurbanai.com npm run test:e2e -- a11y
```

Cobertura atual: home, landing `/lancamento`, página de planos.

**Expandir para rotas autenticadas** quando a Fase 2 do JWT cookie (docs/runbooks/jwt-cookie-migration.md) estiver pronta em staging — aí dá para autenticar programaticamente e testar /dashboard, /onboarding, /my-plan.

Aceitação: 0 violations com impact `critical` ou `serious`. Violations `moderate` e `minor` são registradas mas não bloqueiam.

---

## 2. Checklist manual — WCAG 2.1 AA (24 critérios)

Marcar **Passa / Falha / N/A** por rota. As rotas críticas hoje são:
- `/` (login)
- `/lancamento` (landing)
- `/register`
- `/onboarding` (wizard 5 passos)
- `/dashboard`
- `/properties`
- `/plans`
- `/my-plan`

### Princípio 1 — Perceptível

- [ ] **1.1.1 Conteúdo não-textual** — toda imagem tem `alt` apropriado; ícones decorativos têm `alt=""` ou `aria-hidden="true"`
- [ ] **1.3.1 Informações e relações** — headings seguem H1 > H2 > H3 (sem pular); listas usam `<ul>/<ol>`; forms têm `<label>` associado
- [ ] **1.3.2 Sequência com significado** — ordem visual = ordem de leitura = ordem do DOM
- [ ] **1.3.3 Características sensoriais** — instruções não dependem só de cor/forma ("clique no botão verde" → "clique no botão Salvar")
- [ ] **1.3.4 Orientação** — conteúdo não bloqueia portrait OU landscape
- [ ] **1.3.5 Identificação de propósito do input** — campos usam `autocomplete` correto (email, given-name, etc.)
- [ ] **1.4.1 Uso de cor** — erro não é só vermelho; tem ícone, texto ou underline
- [ ] **1.4.3 Contraste mínimo** — 4.5:1 para texto normal, 3:1 para large text (18pt+)
- [ ] **1.4.4 Redimensionar texto** — 200% de zoom não quebra layout
- [ ] **1.4.10 Reflow** — sem scroll horizontal em 320px de largura
- [ ] **1.4.11 Contraste não-texto** — ícones interativos, bordas de input com 3:1 contra o fundo
- [ ] **1.4.12 Espaçamento de texto** — ao aplicar as seguintes propriedades CSS, nada é cortado: line-height ≥ 1.5x fonte, spacing entre parágrafos ≥ 2x fonte, letter-spacing ≥ 0.12x fonte, word-spacing ≥ 0.16x fonte

### Princípio 2 — Operável

- [ ] **2.1.1 Teclado** — toda interação possível via Tab/Shift+Tab/Enter/Space/Esc; Leaflet (mapa) precisa de alternativa para usuários teclado-only
- [ ] **2.1.2 Sem armadilha de teclado** — modal abre → Esc fecha; foco volta ao trigger
- [ ] **2.4.1 Skip link** — há link "pular para o conteúdo" no topo
- [ ] **2.4.2 Título da página** — `<title>` único por rota
- [ ] **2.4.3 Ordem de foco** — Tab navega na ordem lógica
- [ ] **2.4.4 Propósito do link** — texto do link sozinho explica destino ("Clique aqui" ❌ → "Ver planos" ✅)
- [ ] **2.4.6 Headings e labels** — títulos e labels descritivos
- [ ] **2.4.7 Foco visível** — outline azul/laranja visível em todos os elementos focáveis (Chakra UI traz por padrão)
- [ ] **2.5.3 Label no nome** — botão com texto "Salvar" tem `aria-label` coerente (não pode ser "Submit")

### Princípio 3 — Compreensível

- [ ] **3.1.1 Idioma da página** — `<html lang="pt-BR">` correto
- [ ] **3.2.1 Em foco** — focar um campo não dispara submit/navegação inesperada
- [ ] **3.2.2 Em input** — digitar num campo não muda outra parte da tela sem aviso
- [ ] **3.3.1 Identificação de erro** — mensagens claras em pt-BR (F5A.1 prevê, verificar)
- [ ] **3.3.2 Labels ou instruções** — todo input tem label; campos obrigatórios sinalizados
- [ ] **3.3.3 Sugestão de erro** — se possível, sugerir correção ("E-mail inválido — faltou @")
- [ ] **3.3.4 Prevenção de erro em contextos sensíveis** — cancelamento de assinatura pede confirmação (já tem no `/my-plan`?)

### Princípio 4 — Robusto

- [ ] **4.1.1 Parsing** — HTML sem erros (`<div>` fechado, sem `id` duplicado)
- [ ] **4.1.2 Nome, papel, valor** — componentes customizados têm `role` e `aria-*` apropriados
- [ ] **4.1.3 Mensagens de status** — toast/alert tem `role="status"` ou `aria-live="polite"`

---

## 3. Ferramentas auxiliares (manual)

- **Chrome DevTools → Lighthouse → Accessibility** — dá score e sugestões
- **axe DevTools extension** — análise na página aberta, complementa o automatizado
- **WAVE** (https://wave.webaim.org) — permite auditar a URL de staging publicamente
- **NVDA** (Windows) ou **VoiceOver** (macOS) — screen reader para testar fluxo de leitura
- **Keyboard-only navigation** — desconectar mouse, navegar só com teclado a home→login→dashboard→configurar imóvel→ver recomendação→assinar→cancelar

---

## 4. Priorização de correções

Usar a matriz do `docs/avaliacao-projeto-2026-04-16.md`:

- **CRIT**: violation critical que impede uso por pessoa com deficiência (ex.: botão sem label, form sem label)
- **P1**: serious (ex.: contraste abaixo de 4.5:1, sem skip link)
- **P2**: moderate (ex.: heading hierarchy quebrada)
- **P3**: minor (ex.: texto decorativo sem `aria-hidden`)

Meta pré-go-live: **zero CRIT e P1** nas 3 rotas públicas + onboarding.

---

## 5. Relatório

Ao concluir, salvar em `docs/audits/wcag-<YYYY-MM-DD>.md` com:
- Rotas auditadas
- Violations encontradas (por severidade)
- Ações tomadas imediatamente
- Backlog de ações planejadas
- Screenshot dos cenários mais problemáticos

---

*Última atualização: 24/04/2026 · F5C.4 item #8 · Execução bloqueada em staging + conta de teste autenticada.*
