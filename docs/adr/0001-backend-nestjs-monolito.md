# ADR 0001 — Backend como monólito NestJS

**Status:** Aceito (retroativo, escrito em 24/04/2026)
**Autor:** Gustavo Macedo (reconstituindo o raciocínio original da Lumina Lab + primeiro mês de ownership Urban AI)

## Contexto

Em fev/2026 o Urban AI precisava de um backend que expusesse:
- Auth (JWT + Google OAuth)
- CRUD de anfitriões e imóveis
- Integração com Stripe, Mailersend, Airbnb (via RapidAPI/scraping)
- Motor de precificação que cruza imóveis × eventos × geoespacial
- Painel administrativo

A equipe era de 1–2 devs. O produto não tinha tração comercial — cada hora de dev valia em "ship rápido" mais do que em "escalabilidade teórica".

## Opções consideradas

1. **Monólito NestJS** — um só repo, um só deploy, módulos internos bem separados.
2. **Microserviços Node.js** — auth, payments, pricing e scraping em serviços separados, orquestrados via API gateway.
3. **Backend-as-a-Service (Supabase/Firebase)** — delegar auth + DB e escrever só a lógica de negócio.
4. **Python (FastAPI ou Django)** — integraria direto com o pipeline Prefect e os scrapers.

## Decisão

**Monólito NestJS 10** com módulos separados por domínio (`auth`, `payments`, `propriedades`, `evento`, etc.).

Três razões pesaram:

1. **Velocidade de entrega vs. complexidade operacional** — com 1 dev, orchestrar 5+ microserviços gastaria metade do tempo em plumbing (service discovery, circuit breaker, contratos, observabilidade distribuída). Um monólito deploya em 1 comando no Railway.
2. **NestJS já tem a estrutura modular** — se algum módulo virar gargalo, ele pode sair para um serviço separado mais tarde. Os módulos do NestJS com DI forte deixam esse corte menos traumático do que code spaghetti.
3. **Afinidade de stack com o frontend** — Next.js + TypeScript no front, NestJS + TypeScript no back — um dev consegue pular entre os dois. Menos fricção mental, menos retrabalho de schema/DTO.

BaaS (Supabase) foi descartado por dois motivos: lock-in grande (trocar depois é difícil) e porque o scraping + orquestração de eventos precisa de código próprio rodando mesmo com o BaaS. Python foi descartado porque a equipe já tinha mais traction em TS e o pipeline de dados (Prefect) roda separado do backend, então não há unificação real a ganhar.

## Consequências

**Positivas:**
- Um deploy, um log, uma tabela `migrations`. Operacionalmente simples.
- DI do NestJS facilita mockar dependências em teste (ver F5C.2 item #15).
- Swagger exposto em `/api` reflete a API inteira.

**Negativas:**
- `src/propriedades/` cresceu para 1672 linhas — é o sinal clássico de que um domínio está pedindo extração. Candidato futuro: mover `knn-engine/` para um serviço separado quando ganhar dados reais (≥200 imóveis × 12 meses).
- Testes ficam mais lentos — cada spec que usa `Test.createTestingModule` tem que resolver o grafo inteiro de DI. Em 2026-04 ainda não é um problema (1–2s por suite).
- Deploy é all-or-nothing — um bug no módulo de payments tira o site inteiro do ar. Mitigação: rollback rápido via Railway + staging (F5C.2 item #11, em provisionamento).

## Quando revisitar

- Quando `propriedades/` passar de 3000 linhas, extrair `pricing-engine` para microserviço com sua própria API (talvez Python para alinhar com o pipeline Prefect, aí sim).
- Se o webhook Stripe ou o cron de análise de preço começar a competir por CPU com requests HTTP comuns, justifica extrair.

## Referências

- `docs/avaliacao-projeto-2026-04-16.md` §3.1 — avaliação inicial do backend
- Commit inicial do NestJS: anterior a `f7b3a47` (pre-sprint)
