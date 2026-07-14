# Mapa de Rebrand — Urban AI → [NOVO NOME]

**Versão:** 1.0 (2026-06-21)
**Objetivo:** transformar a troca de nome, domínio, cores e assets em uma operação **mecânica e auditável**, não uma caça ao tesouro.
**Pré-requisito:** decidir o nome (ver `Projects/UrbanAi/estudo-naming-rebrand.html`). Lembrete do estudo: **`.com` está 100% tomado** — a marca rodará em **`.com.br`** principal (ou `.ai` de marca).

> Estratégia central: **externalizar para uma fonte única** cada coisa que hoje está espalhada. Onde já há fonte única (env var, token, `siteConfig`), o rebrand é trivial. Onde está hardcoded, primeiro centraliza, depois troca. As seções abaixo marcam cada item como ✅ já-centralizado ou ⚠️ precisa-centralizar.

---

## 1. Nome da marca

**Estado:** o nome "Urban AI" aparece em **88+ arquivos** do frontend, mas a maioria deveria puxar de uma constante única.

| Item | Local | Status | Ação |
|------|-------|--------|------|
| Nome canônico | `src/app/lib/seo.tsx` → `siteConfig.name` | ✅ fonte única | Trocar 1 valor |
| Metadata raiz | `layout.tsx` (applicationName, apple title) | ⚠️ literal | Apontar para `siteConfig.name` |
| Manifest PWA | `public/manifest.webmanifest` (name, short_name) | ⚠️ literal | Trocar 2 campos |
| Texto em telas | ~88 arquivos `.tsx` com "Urban AI" literal | ⚠️ espalhado | Migrar para `siteConfig.name`; depois trocar 1 vez |
| Feature "Ask Urban" | componentes `AskUrban*`, entidade `AskUrbanMessage` | ⚠️ literal | Decidir se renomeia (afeta entidade/tabela no backend) |
| Classes CSS `urban-*` | `design-tokens.css` + componentes | 🟡 opcional | Funcional, não visível ao usuário; renomear só se quiser higiene total |

**Recomendação:** antes de trocar o nome, faça um PR que substitui todos os literais "Urban AI" no JSX por `{siteConfig.name}`. Depois, o rebrand do nome é **1 linha** em `seo.tsx` + manifest + metadata.

---

## 2. Domínios e e-mails

| Item | Valor atual | Local | Status | Ação |
|------|-------------|-------|--------|------|
| Site público | `myurbanai.com` | `seo.tsx` (DEFAULT_SITE_URL), `layout.tsx`, `payments.service.ts:517` | ⚠️ fallback hardcoded | Externalizar p/ `NEXT_PUBLIC_SITE_URL` e remover fallback literal |
| App | `app.myurbanai.com` | `seo.tsx` (DEFAULT_APP_URL) | ⚠️ | `NEXT_PUBLIC_APP_URL` |
| Aliases/redirects | `www.*`, `*.com.br` | `src/middleware.ts` (PUBLIC/APP lists) | ⚠️ | Atualizar listas de host no middleware |
| E-mail contato | `contato@myurbanai.com` | `seo.tsx:17` | ⚠️ | `CONTACT_EMAIL` env |
| E-mail privacidade | `privacidade@myurbanai.com` | `seo.tsx:18`, páginas legais | ⚠️ | `PRIVACY_EMAIL` env |
| DNS/SSL | infra (Railway) | — | — | Apontar novo domínio `.com.br`; SSL automático |

**Atenção middleware:** o roteamento por subdomínio depende de strings de host (`myurbanai.com`, `app.myurbanai.com`, `.com.br`). Centralizar essas constantes no topo do `middleware.ts` antes de trocar.

---

## 3. Cores

**Estado:** a cor de marca `#E8500A` (dark) / `#B83D07` (light) está nos tokens **e** hardcoded em ~30 arquivos.

| Item | Valor | Local | Ação |
|------|-------|-------|------|
| Accent dark | `#E8500A` | `design-tokens.css` (várias linhas) | Mover para `--brand-accent` (1 lugar) |
| Accent light | `#B83D07` | idem | `--brand-accent-strong` |
| Accent hover | `#FF6A1A` | idem | `--brand-accent-bright` |
| Hex hardcoded | `#E8500A` | **~30 arquivos `.tsx/.css`** (PortfolioToolbar, ItemEvento, AppButton, plans/page, admin/layout, CookieConsent, error/not-found, e2e...) | Migrar para `var(--brand-accent)` |
| `.urban-glow`/`.urban-pull` | `#E8500A` literal | `design-tokens.css:170,175` | `var(--brand-accent)` |
| theme-color (browser) | `#E8500A` / `#080A0F` | `layout.tsx`, `manifest.webmanifest` | Atualizar se a cor mudar |

**Passo único recomendado:** implementar a camada de primitivos descrita em `DESIGN-SYSTEM.md §3`. Depois, o rebrand de cor = **trocar 3 linhas** + replace dos ~30 hardcoded (que viram `var(--brand-accent)` de uma vez).

> Fundo dark `#080A0F` e off-white `#FAFAFB` são "neutros de marca" — provavelmente ficam, mas confira contra a nova identidade. Se mudarem, são tokens (`--theme-page-bg`).

---

## 4. Logos e assets

Substituir os arquivos em `Urban-front-main/public/` (manter os mesmos nomes evita mexer em referências):

| Asset | Arquivo | Onde é referenciado |
|-------|---------|---------------------|
| Favicon | `/favicon.ico` | layout metadata, manifest |
| PWA 192 | `/pwa-icon-192.png` | layout, manifest |
| PWA 512 | `/pwa-icon-512.png` | layout, manifest, OG/Twitter |
| Apple touch | `/apple-touch-icon.png` | layout |
| Maskable | `/maskable-icon-512.png` | manifest |
| OG dinâmico | `/opengraph-image` (gerado) | `seo.tsx`, `lib/seo-og-image.tsx` |
| Twitter dinâmico | `/twitter-image` (gerado) | `seo.tsx` |
| Logo (conteúdo) | `Projects/UrbanAi/urban-logo.png` + capas/perfis | material de marketing |

⚠️ As imagens **OG/Twitter são geradas dinamicamente** (`lib/seo-og-image.tsx`) e desenham a cor e o nome — precisam ser atualizadas no código, não só trocando um PNG.

---

## 5. SEO, conteúdo e legal

| Item | Local | Ação |
|------|-------|------|
| Title/description | `layout.tsx`, `seo.tsx` (`buildSeoMetadata`) | Reescrever com novo nome |
| 7 páginas SEO | `src/app/(public)/*` + `seoPagesData.ts` | Trocar nome no copy; URLs (slugs) podem permanecer |
| Slug "urban-ai-vs-planilha-de-precificacao" | rota pública | Decidir se renomeia (afeta SEO/links) |
| Páginas legais | `(public)/termos`, `(public)/privacidade`, `legalContent.ts` | Trocar nome; **CNPJs e razão social permanecem** (MP IA Tecnologia 62.497.936/0001-27 controladora; Guilds 44.361.255/0001-55 operadora) |
| JSON-LD / structured data | `lib/seo.tsx` (JsonLd) | Atualizar `name`, `url`, `logo` |
| sitemap/robots | `Projects/UrbanAi/sitemap.xml`, `robots.txt` | Atualizar domínio |

> A entidade jurídica **não** muda com o rebrand de produto — só o nome comercial/identidade. Manter os CNPJs nas páginas legais.

---

## 6. Backend (toques pontuais)

| Item | Local | Ação |
|------|-------|------|
| URL de front (links em e-mail) | `payments.service.ts` `getFrontBaseUrl()` fallback | Externalizar p/ env |
| Templates de e-mail | `email/`/`mailer/` | Nome/logo nos HTMLs |
| Strings/comentários "Urban" | diversos | Opcional (não visível ao usuário) |
| Entidade `AskUrbanMessage` / tabela `ask_urban_messages` | `entities/` | Só se renomear a feature — exige migration |
| Env vars de marca | Stripe `*_PRICE_*`, `STAYS_*` | Não dependem do nome; não tocar |

---

## 7. Checklist de execução do rebrand (ordem recomendada)

**Fase 0 — Centralizar (antes de decidir o nome, dá pra fazer já):**
1. [ ] Implementar primitivos de cor (`--brand-accent*`) e migrar os ~30 hardcoded.
2. [ ] Trocar literais "Urban AI" no JSX por `siteConfig.name`.
3. [ ] Externalizar domínios/e-mails para env vars; centralizar hosts no middleware.
4. [ ] Tokens de fonte (`--font-display`/`--font-body`) e remover Poppins global.

**Fase 1 — Aplicar a nova marca (após decidir nome):**
5. [ ] `siteConfig` (nome) + manifest + metadata.
6. [ ] 3 linhas de cor de marca (se a paleta mudar).
7. [ ] Substituir assets em `/public` + regerar OG/Twitter dinâmicos.
8. [ ] Novo domínio `.com.br` no DNS/Railway + middleware + env.
9. [ ] Reescrever copy das páginas legais e SEO com o novo nome.
10. [ ] Registrar marca no INPI (o estudo já checou disponibilidade).

**Fase 2 — Verificação:**
11. [ ] `grep -ri "urban"` no front: só devem sobrar classes CSS `urban-*` (se optar por mantê-las) e nada de usuário-visível.
12. [ ] Build + E2E (axe-core) + smoke; conferir OG/Twitter no preview de link.
13. [ ] Lighthouse PWA (manifest novo) + install em Android/iOS.

---

## 8. Estimativa de esforço

| Fase | Esforço | Observação |
|------|---------|-----------|
| Fase 0 (centralizar) | ~1–2 dias dev | Independe do nome; reduz risco e já melhora o código |
| Fase 1 (aplicar) | ~1–2 dias dev + design dos assets | Mecânico se a Fase 0 estiver feita |
| Fase 2 (verificar) | ~0,5 dia | Build/smoke/Lighthouse |

> Sem a Fase 0, o rebrand vira caça ao hex/string em 90+ arquivos. **Faça a Fase 0 agora**, mesmo antes de bater o martelo no nome — é refactor saudável que paga sozinho.
