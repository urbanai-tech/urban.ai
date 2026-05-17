# Roadmap 4 Tracks - 2026-05-17

Status consolidado da squad multiagente para execucao do roadmap Urban AI.

Atualizado em 2026-05-17 apos leitura dos artefatos, commits recentes e smoke
de producao: `f56b46a..8600d48`. Este arquivo consolida o "chat" de divisao dos devs sem
alterar o roadmap operacional grande durante a execucao paralela.

## Placar

| Track | Dev | Foco | Pronto | Leitura |
|---|---|---|---:|---|
| Track 1 | Dev 1 | Release, CI, deploy, Railway, coordenacao e evidencias | 98% | Release/health/local gates foram endurecidos, auditoria de migrations e script de evidencias entraram, `8600d48` esta nos dois remotos, health prod esta 200/DB ok e smoke publico prod passou. Producao Railway ainda esta em `f56b46a`, entao falta merge/deploy dos commits novos. |
| Track 2 | Dev 2 | Core de valor: eventos, geocoder, recomendacao, dataset e ROI | 91% | AskUrban drawer + Cmd+J, market intelligence, pricing rules, WCAG Track 2 e correcoes de pricing/geocoder avancaram bem. Prova real ainda depende de credencial autenticada valida, Geocoding API, backfill, reprocess com Gustavo, coletores e ground truth. |
| Track 3 | Dev 3 | Monetizacao e integracoes: Stripe, MailerSend, Stays, LGPD e suporte | 94% | Termos e privacidade revisados foram publicados no front; suporte/LGPD, Stays readiness, preflight e billing seguem bem estruturados. Smokes reais Stripe/MailerSend/Stays e credencial valida ainda seguram 100%. |
| Track 4 | Dev 4 | UX, admin, QA, Playwright, design system e smokes | 92% | WCAG 2.1 AA auditou 22 arquivos do Track 2, `tsc --noEmit` passou, subset E2E local expandiu para `22 passed, 1 skipped`, login post-login foi promovido ao CI, smoke publico prod passou `5 passed/2 skipped` e release-gate publico passou `14 passed`. Faltam mutacoes reais, auditoria visual obrigatoria e smoke autenticado valido. |

**Prontidao geral:** 94%.

## Entregas conferidas desde o ultimo placar

| Commit / fonte | Track | Entrega | Estado |
|---|---|---|---|
| smoke prod 2026-05-17 | 1 / 4 | Health API/app e release-gate publico contra producao | `/health` 200 DB ok, public smoke `5 passed/2 skipped`, release-gate publico `14 passed`; autenticado bloqueado por `401` nas credenciais fornecidas. |
| `8600d48` | 4 / 1 | Login post-login estabilizado e promovido ao gate CI mockado | Feito em codigo e pushado nos dois remotos. |
| `74e6bf7` | 4 / 1 | Subset E2E local ampliado: dashboard, email, waitlist, login, logout, billing, pricing, Stays | `22 passed`, `1 skipped` no registro de evidencia. |
| `1d041a8` | 3 | Termos de uso e politica de privacidade revisados publicados no front | Feito em codigo; validar revisao juridica final/DPAs. |
| `0aed7f4` | 1 / 2 | Gaps automaticos de release fechados: migrations audit, logs Mailer, erros Google Maps, geocoder e pricing shadow/adaptive | Feito em codigo; producao ainda nao esta nesse commit. |
| `2efbc7b` | 1 | Health endpoints, release gate, evidencia automatizada, backup MySQL e auditoria de migrations | Feito em codigo; branch protection/staging continuam pendentes. |
| `2cd76e4` | 2 / 4 | WCAG Track 2: portfolio, pricing-rules, market e componentes AskUrban/design system | Feito; 22 arquivos auditados, 14 alterados, 1 novo `SkipLink`. |
| `62bf855` | 2 | AskUrban drawer, provider, upgrade modal, atalho Cmd+J e API de suporte | Feito em codigo; precisa smoke autenticado e criterio de monetizacao/limite. |

## Track 1 - Dev 1

### Bloqueios

- CI/local gate avancou ate `8600d48`, com login post-login promovido e subset E2E mockado expandido.
- Railway producao segue ativo em `f56b46a`; os commits `2efbc7b..8600d48` ainda precisam chegar em `main`/producao.
- Smoke autenticado executa o job; tentativa real em producao com credencial fornecida retornou `401` em `/auth/login`.
- Branch protection ainda precisa tornar CI/Release Gate obrigatorios em `main`.
- Restou sujeira local gerada: `Urban-front-main/tsconfig.tsbuildinfo`.

### Entregas

- Health endpoints e `/health/live` adicionados no backend.
- `release-gate.yml`, `scripts/release-evidence.js`, auditoria de migrations e runbook de backup entraram.
- CI passou a rodar subset E2E mockado maior, incluindo login/post-login reparado.
- Evidencia Railway/prod de 17/05 mostra prod saudavel em `f56b46a`: `/health` e `/health/live` 200, DB ok, 0 respostas 5xx na amostra.
- Smoke publico prod passou: `5 passed`, `2 skipped`; release-gate publico prod passou: `14 passed`.

### Proximas acoes

1. Abrir/atualizar PR de `feat/dev2-track2-semana-7-8-askurban`.
2. Conferir deploy/health no Railway apos merge/deploy dos commits novos.
3. Resetar/confirmar credencial valida e configurar `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` no GitHub para smoke autenticado real.
4. Tornar branch protection/release gate obrigatorios.
5. Preparar evidencia do CI verde e do Release Gate para o handoff.

## Track 2 - Dev 2

### Bloqueios

- Geocoding API precisa ser ativada no Google Cloud antes do backfill real.
- Recomendacao nova e AskUrban precisam smoke autenticado com Gustavo; credencial testada em prod retornou `401`.
- Dataset/ROI ainda depende de preco aplicado, ocupacao/reserva real e snapshots por 7 dias.
- Coletores precisam comprovar `lastSeen < 48h` e eventos futuros SP/30d.
- Railway evidencia ainda aponta Google Geocoding `HTTP 403 REQUEST_DENIED`.

### Entregas

- AskUrban drawer + provider + upgrade modal + atalho Cmd+J entregues.
- Telas Track 2 semanas 5-8 ganharam market intelligence, pricing rules e polimento WCAG.
- Auditoria WCAG Track 2 fechou sem erro de tipo em `tsc --noEmit`.
- Geocoder ficou mais diagnostico para erros Google Maps e pricing shadow/adaptive teve ajustes/testes.

### Proximas acoes

1. Rodar backfill geocoder em dry-run e depois real.
2. Validar AskUrban em sessao autenticada real e decidir limites por plano.
3. Validar coletores e health operacional.
4. Reprocessar um imovel real do Gustavo.
5. Registrar preco aplicado, ocupacao/resultado e evidencia do gate M2.

## Track 3 - Dev 3

### Bloqueios

- Smoke Stripe ponta a ponta ainda nao foi executado em ambiente real de teste.
- KYC/separacao test-live precisa confirmacao.
- MailerSend precisa entrega real validada.
- Stays depende de URL/API oficial ou sandbox.
- LGPD/suporte tem triagem, painel, contrato de donos operacionais, termos/privacidade publicados e preflight; falta validar canais reais, DPAs e donos no ambiente.

### Entregas

- Termos de uso e politica de privacidade revisados foram publicados nas rotas publicas.
- Conteudo legal saiu de DOCX para `legalContent.ts`, reduzindo divergencia entre docs e site.
- Track 3 segue com preflight versionado e dashboard de readiness para Stripe, MailerSend, Stays e suporte.

### Proximas acoes

1. Rodar runbook Stripe em staging/test mode.
2. Fazer readiness MailerSend com dominio, DKIM e envios reais.
3. Executar smoke Stays beta privado.
4. Rodar `npm run preflight:track3:strict` com as envs do ambiente alvo.
5. Validar canais suporte/privacidade reais, DPAs prioritarios e preencher `SUPPORT_OWNER_EMAIL`/`PRIVACY_OWNER_EMAIL`.

## Track 4 - Dev 4

### Bloqueios

- Release gate visual/auditoria ainda nao e obrigatorio.
- Fluxos mutantes reais nao foram fechados.
- `/admin/properties` precisa smoke autenticado real; credencial testada em prod retornou `401`.
- Auditor E2E ainda nao cobre todo o novo drill-down.
- Subset E2E CI e majoritariamente mock/read-only; ainda nao substitui staging real.

### Entregas

- WCAG 2.1 AA Track 2: 22 arquivos auditados, 14 modificados, 1 `SkipLink.tsx` novo, zero erro de tipo.
- Subset E2E local expandido para 22 testes verdes e 1 skip esperado.
- Login post-login reparado e promovido ao CI.
- Evidencia de estabilidade E2E documentada em `docs/evidence/e2e-stability-2026-05-17.md`.
- Smokes publicos de producao foram estabilizados contra banner de cookies e passaram.

### Proximas acoes

1. Adicionar `/admin/properties` e detalhe ao auditor.
2. Rodar smoke mutante em staging.
3. Rodar Stripe test mode completo com evidencias.
4. Automatizar auditoria visual desktop/mobile.
5. Estabilizar seletores e `data-testid` nos fluxos criticos.

## Regra de Atualizacao

A cada rodada, atualizar:

- percentual por track;
- bloqueio principal;
- proxima acao;
- impacto no placar geral.
