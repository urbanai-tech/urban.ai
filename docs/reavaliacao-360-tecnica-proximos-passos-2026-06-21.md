# Reavaliação 360° — Urban AI (foco técnico) + Próximos Passos

> **Adendo 2026-07-01:** para onboarding de novo dev e estado operacional atualizado, leia primeiro [`docs/handoff/README.md`](./handoff/README.md). A fotografia de 2026-06-21 continua valida como auditoria tecnica, mas a revisao de 2026-07-01 atualiza staging, secrets, testes, disco local, backlog e resumo dos chats.

**Data:** 2026-06-21
**Autor:** Gustavo (via auditoria assistida)
**Escopo:** backend NestJS, frontend Next.js, engine KNN, pipeline/webscraping, prontidão go-live e estado da marca/rebrand.
**Método:** leitura do código-fonte (`src/`, não `dist/`), verificação manual dos achados críticos, consolidação dos roadmaps de maio/2026 e do estudo de naming de hoje.

> **Como ler este documento:** as seções 1–5 são o diagnóstico técnico (o que está bom, o que ainda dói). A seção 6 é o estado da marca. A seção 7 é o plano de ação priorizado — é a parte acionável. Tudo que afirmo aqui foi conferido contra arquivo:linha quando crítico.

---

## 0. Veredito em uma frase

O produto está **tecnicamente maduro (~94–97% de código pronto)** e a maioria dos riscos críticos de abril/2026 **foi corrigida**. O que separa o Urban AI do go-live não é mais código de tela ou arquitetura — é **operação**: deploy da branch atual, credenciais externas (Google, Stays, e-mail), **dados reais com prova de valor (MAPE + cases)** e a camada legal/LGPD. Em paralelo, há uma decisão de marca em aberto (rebrand) que precisa ser fechada antes de gastar em domínio, identidade e material público.

---

## 1. Status dos riscos críticos de abril/2026

A auditoria de 16/04/2026 apontou 6 riscos graves. Reverificados hoje no código:

| # | Risco (abril) | Status hoje | Evidência |
|---|---------------|-------------|-----------|
| 1 | Hash de senha SHA-256 sem salt | ✅ **Corrigido** | `src/auth/auth.service.ts` usa **bcrypt(12)**, com re-hash transparente de hashes legados SHA-256 no login |
| 2 | `synchronize: true` em produção | ✅ **Controlado** | `src/app.module.ts:129,144` → `synchronize: process.env.DB_SYNCHRONIZE === 'true'` (default **false**); ~44 migrations versionadas |
| 3 | Senha em texto nos logs | ✅ **Corrigido** | Sem ocorrência de log de senha/secret no código atual |
| 4 | IP/URL hardcoded no frontend | ✅ **Corrigido** | Frontend aponta por `NEXT_PUBLIC_API_URL` (`src/app/service/api.ts`); sem IP fixo |
| 5 | API key hardcoded no código | 🟡 **Persiste (baixa severidade)** | `src/propriedades/propriedade.service.ts:848` — `apiKey = 'd306z...t20'`. **É a chave pública conhecida do cliente web do Airbnb**, não um secret privado. Anti-padrão, não vazamento |
| 6 | Zero testes automatizados | ✅ **Resolvido** | 52 arquivos `.spec.ts` no backend (~141 testes Jest) + ~95 testes Python no pipeline/webscraping |

**Correção importante a um boato recorrente:** o arquivo `.env` do backend **não está versionado no git** (`git ls-files --error-unmatch .env` não encontra). Os secrets não estão commitados. O `.env` existe apenas no disco local. *Ainda assim*, vale confirmar que ele está no `.gitignore` efetivo e que os secrets de produção no Railway são strings fortes (não defaults de dev).

**Conclusão da seção:** o risco residual de segurança caiu de **crítico** para **baixo**. Sobram itens de higiene, não de sobrevivência.

---

## 2. Backend (NestJS) — saudável, com arestas

**Pontos fortes**

- **Autenticação sólida:** JWT extraído de cookie httpOnly (com fallback Bearer legado), validado contra o banco a cada request; `ignoreExpiration: false`; `RolesGuard` re-consulta o role no DB (não confia no claim do token). `JWT_SECRET` via `getOrThrow()`.
- **Migrations maduras:** ~44 migrations versionadas cobrindo users, eventos, payments, auditoria admin, push, event-intelligence. `npm run migration:run/revert/show` disponíveis.
- **Hardening web:** Helmet + CSP restritivo, CORS por whitelist (fail-closed sem config), ThrottlerModule global (10/1s, 100/60s).
- **Validação:** `ValidationPipe` global com `whitelist: true` + DTOs com class-validator em ~30 controllers.
- **Queries seguras:** TypeORM QueryBuilder com parâmetros nomeados (sem concatenação de SQL).

**Arestas a corrigir (em ordem de retorno)**

1. **API key do Airbnb hardcoded** (`propriedades/propriedade.service.ts:848`) → mover para env var por consistência (mesmo sendo chave pública).
2. **`forbidNonWhitelisted: false`** no `ValidationPipe` (`main.ts`) → ativar `true` em produção para rejeitar payloads com campos extras.
3. **Rate limit em `/admin/*`** → endpoints admin não têm throttle adicional; aplicar `@Throttle` em rotas de scraping/admin.
4. **Lacuna de testes em `propriedades/`** — o serviço que faz o scraping e alimenta o pricing **não tem spec visível**. É o caminho mais crítico do produto e o menos coberto.
5. **`ConfigModule` sem validação de env obrigatórias no boot** → falha só em runtime; preferir `getOrThrow()` no bootstrap.

---

## 3. Frontend (Next.js 15) — pronto

- Stack: **Next 15.4.10** (App Router, output standalone), Chakra UI 2 + Tailwind 4 (convivendo — Chakra legado, Tailwind no novo), NextAuth 4, Stripe Elements, Sentry, Leaflet, i18next, TS strict.
- **API por env var** (`NEXT_PUBLIC_API_URL`), interceptor injeta Bearer e trata 401/403 com redirect contextual. Sem IP hardcoded.
- Secrets do client corretos: só `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, GA4/Pixel vazios desativam scripts; `sk_*` e `SENTRY_AUTH_TOKEN` ficam server-side.
- Roteamento por subdomínio (`myurbanai.com` público / `app.myurbanai.com` autenticado) com 301 implementados.
- E2E com Playwright + axe-core (smoke, authenticated-smoke, a11y).

**Dívidas menores:** rotas órfãs (`/maps-bkp`, `/painel` duplicando `/dashboard`) para remover; débito de ESLint warnings em backlog; faltam testes reais de instalação PWA em Android/iOS.

---

## 4. Engine KNN — atenção a fonte da verdade

- O microserviço **`urban-ai-knn-main/` está DEPRECADO (24/04/2026)**. A lógica foi migrada para `urban-ai-backend-main/src/knn-engine/` (TypeScript, dentro do monolito), que tem specs (`pricing-engine.spec.ts`, `knn-classifier.spec.ts`).
- Risco: manter os dois no repo gera confusão sobre qual é a fonte da verdade. **Arquivar com tag git e remover** o legado.
- A cobertura de testes da engine ativa é fina para um componente que define preço — vale expandir cenários (features faltando, k-vizinhos, fronteiras de categoria).

---

## 5. Pipeline + Webscraping (Python 3.12) — operacionais e bem testados

- **Pipeline (Prefect 3.4 + Pandas + SQLAlchemy + boto3):** ETL S3 → MySQL e trigger de spiders via Scrapyd; credenciais escapadas e `__repr__` não expõe senha; 12+ testes E2E (moto p/ S3, testcontainers p/ MySQL); lint ruff + mypy strict.
- **Webscraping (Scrapy 2.11 + Playwright):** 7 spiders (eventim, ticketmaster, sympla, ingresse, even3, blue_ticket, ticket_360); `ROBOTSTXT_OBEY=True`, AutoThrottle, retry exponencial; cliente de ingest com buffer fail-soft e refresh de JWT; 11 arquivos de teste.
- **Dívida:** type hints parciais no webscraping (alinhar ao mypy strict do pipeline).

---

## 6. Prontidão para go-live (consolidado dos roadmaps de maio)

**Prontidão por camada** (fonte: `roadmap-consolidado-gaps-manuais-2026-05-17.md`, `status-roadmap-analytics-eventos-pricing-2026-05-23.md`):

| Camada | % | Estado |
|--------|---|--------|
| Código / gates locais | ~98% | builds e typechecks OK, testes verdes |
| Produção deployada | ~94% | Railway em `SUCCESS`; health 200; smokes pós-deploy OK |
| Alpha assistido (admin/host) | ~91% | UI/API 100% em código; pende deploy do footer/CORS fix |
| PWA/Mobile | ~96% | manifest+SW+offline OK; falta install real Android/iOS |
| Beta pago (Stripe) | ~80% | 8/8 Price IDs OK; checkout/webhook/portal/cancel/quota não testados ponta-a-ponta |
| Go-live público | ~63% | falta dado real, cases auditados, legal/LGPD, branch protection, backup |

**Bloqueadores P0 (impedem go-live):**

1. **Merge/deploy da branch atual** — produção ainda roda commit antigo; footer fix, preflight e auditor admin não estão em prod.
2. **Stripe ponta-a-ponta** — rodar checkout/webhook/portal/cancel/quota em test mode (`runbooks/stripe-billing-smoke.md`).
3. **Google Geocoding 403 (REQUEST_DENIED)** — ativar billing no GCP; sem isso, trava backfill de coordenadas e qualidade de recomendação.
4. **Stays API/sandbox** — bloqueado externamente; operar beta privado com allowlist enquanto não há acesso oficial Preferred+.
5. **GitHub Secrets + branch protection** — CI não roda smoke autenticado sem segredos; `main` aceita push direto (sem gate de PR/CI).

**P1 (partes do produto não funcionam sem isso):** MailerSend (DKIM/SPF), billing Google Cloud, Sentry DSN real, GA4/Meta reais, secrets fortes de prod.

**P2 (legal/escala):** CNPJ + Stripe Brasil live (decisão societária), LGPD final (termos/DPO/consent), backup off-site + restore drill, domínio/DNS/SSL, WhatsApp Business.

---

## 7. Próximos passos priorizados

### Sprint A — "Colocar em produção o que já existe" (esta semana)
*Sem dependência externa. Maior retorno imediato.*

1. Merge da branch atual → `main`; aguardar Railway `SUCCESS`; smoke público + autenticado em prod.
2. Habilitar **branch protection** em `main` (PR review + CI obrigatório) e gravar **GitHub Secrets** do E2E.
3. Corrigir as 3 arestas baratas do backend: API key → env var, `forbidNonWhitelisted: true`, throttle em `/admin/*`.
4. Arquivar e remover `urban-ai-knn-main/` (tag `archive/knn-microservice-v1`).
5. Confirmar `.env` no `.gitignore` efetivo e rotacionar/forçar secrets fortes no Railway.

### Sprint B — "Destravar dados e dinheiro" (próxima semana)
*Depende de contas externas — começar os pedidos hoje.*

6. Ativar **billing Google Cloud** → resolver Geocoding 403 → rodar **backfill** de imóveis.
7. Rodar **Stripe smoke** completo em test mode e anexar evidência.
8. Verificar **MailerSend** (DKIM/SPF) e configurar **Sentry DSN** + GA4/Pixel reais.
9. Cobrir com testes o caminho crítico: `propriedades/` (scraping → pricing) e expandir a engine KNN ativa.

### Sprint C — "Prova de valor + legal" (2–3 semanas)
*O que realmente abre o go-live público.*

10. Coletar **7 dias de dados reais**, calcular **MAPE inicial** e produzir **3 cases auditados** de precificação.
11. Fechar **LGPD** (termos/privacidade revisados, DPO, banner de consent) e **backup off-site + restore drill**.
12. Confirmar owners operacionais (suporte/LGPD), domínio/DNS/SSL e WhatsApp Business.

### Faixa paralela — Marca (ver seção 8)
13. Decidir o nome (estudo de naming já está pronto) **antes** de gastar em domínio definitivo, identidade e material público. Isso destrava o item de domínio do Sprint C.

---

## 8. Estado da marca / rebrand (o que o último chat produziu)

Hoje foi gerado `estudo-naming-rebrand.html` (Projects/UrbanAi) — tabela interativa com **~23 nomes candidatos** (internos, da Markettane e da rodada nova), verificados contra fontes reais: RDAP (.com/.com.br/.ai), busca INPI anônima, Google/Firecrawl e checagem HTTP de handles.

**Achado que filtra tudo:** de ~85 candidatos testados, **100% têm o `.com` puro tomado** — até coinages de 6 letras. O `.com.br` está bem mais aberto e o `.ai` tem disponibilidade razoável. Implicação prática: a marca rodará em **`.com.br` como principal** (ou `.ai` de marca), não `.com`.

**Decisão pendente:** escolher o finalista. Enquanto isso não fecha, o item "domínio + DNS + SSL" do go-live fica em suspenso e qualquer gasto com identidade visual e material público é prematuro. O design system dark editorial (bg `#080A0F`, Bebas Neue + Inter, laranja `#E8500A`) já está aprovado e serve de base independente do nome final.

---

## 9. Riscos e dependências externas (caminho crítico)

| Dependência | Tipo | Tempo estimado | Bloqueia |
|-------------|------|----------------|----------|
| Billing Google Cloud | Conta externa | ~1 dia | backfill, qualidade da recomendação |
| Acesso oficial Stays (Preferred+) | Parceiro externo | 2–3 dias (incerto) | modo automático de sync |
| 7 dias de dados reais | Temporal | 7 dias corridos | MAPE + cases (prova de valor) |
| Revisão jurídica LGPD | Externo | 3–5 dias | go-live público |
| Decisão de naming | Interno | depende de você | domínio definitivo + identidade |

---

## 10. Resumo executivo

- **Técnico:** maduro. Riscos de abril majoritariamente sanados; sobra higiene (3 arestas de backend, cobertura de testes no caminho de pricing, limpeza do KNN legado).
- **Go-live:** o gargalo migrou de engenharia para **operação + dados + legal**. O ganho mais rápido é fazer o **deploy da branch atual** e ativar **branch protection** já.
- **Dados:** a peça que falta para vender é **prova de valor real (MAPE + 3 cases)** — depende de destravar o Geocoding e rodar 7 dias de coleta.
- **Marca:** estudo de naming pronto; **decidir o nome** destrava domínio e identidade. `.com` está fora da mesa — planeje em `.com.br`/`.ai`.

---

### Fontes
Código verificado: `urban-ai-backend-main/src/` (auth, app.module, propriedades, main), `Urban-front-main/src/app/service/api.ts`, `urban-ai-knn-main/DEPRECATED.md`, `urban-pipeline-main/`, `urban-webscraping-main/`.
Docs consolidados: `docs/roadmap-consolidado-gaps-manuais-2026-05-17.md`, `docs/roadmap-4-tracks-2026-05-17.md`, `docs/go-live-manual-checklist.md`, `docs/roadmap-execucao-restante-2026-05-17.md`, `docs/status-roadmap-analytics-eventos-pricing-2026-05-23.md`, `CHANGELOG.md` (v2.16).
Marca: `Projects/UrbanAi/estudo-naming-rebrand.html` (21/06/2026).
