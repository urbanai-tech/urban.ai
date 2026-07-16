# Relatório consolidado — Scorecard Urban AI 10/10

**Agente:** Vera Veredito — Tech Lead e revisora final  
**Data:** 2026-07-15  
**Branch:** `codex/scorecard-10-10-20260715`  
**Escopo:** segurança, QA lógico, dados, UI/UX, arquitetura, CI e operação

## Short alerting

> **Veredito: release candidate local verde; certificação 10/10 em produção ainda é NO-GO.** A rodada eliminou falhas críticas de cadastro, refresh, tenant isolation, SSRF, enumeração/código de e-mail e validação runtime; elevou a cobertura dos núcleos críticos acima de 90%; fechou 896 testes backend e 97/97 E2E; e endureceu CI, acessibilidade, design e headers web. O bloqueio restante não deve ser disfarçado: histórico sensível, Railway/readiness, DNS, sandboxes, restore real, beta, jurídico e janela de SLO exigem execução externa ou decisão do owner.

## Evidência reproduzível

| Gate | Resultado | Comando/arquivo |
|---|---|---|
| Backend integral | 92 suítes, 896 testes, lint/build verdes | `urban-ai-backend-main`: Jest completo, ESLint e `npm run build` |
| Auth crítico | 96,92% statements; 91,91% branches | `npm run test:coverage:auth` |
| Stays crítico | 97,65% statements; 90,94% branches | `npm run test:coverage:stays` |
| Health/cron/jobs | 97,78% statements; 92,78% branches | `npm run test:coverage:health-cron` |
| Backtesting/Stripe resolver | 100% nas quatro métricas | `npm run test:coverage:certified` |
| Frontend | 97/97 E2E Chromium; zero skips | `E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test --project=chromium` contra Next standalone |
| Frontend build | 76 rotas; shared 103,0 KiB gzip | `npm run lint`, `npm run typecheck`, `npm run build` |
| Mapa HTML | 0 serious/critical, 0 overflow/erro JS em 1440/390 dark/light | `docs/urban-ai-system-map-2026-07-15.html` |
| Dados | pipeline 55; scraping 109; Ruff/format/mypy verdes | pytest e `uv run poe lint` |
| Dependências | npm produção zerado; 1 incompatibilidade Python externa rastreada | npm audit; Scrapyd 1.6 × setuptools |

## Issue tracking — correções concluídas

### [CRÍTICO][RESOLVIDO] Mass assignment no cadastro público

`urban-ai-backend-main/src/auth/register.dto.ts` passou a ser a allowlist runtime. O controller não recebe mais tipo estrutural apagado em runtime; `role` e `active` são definidos no servidor. Testes tentam elevar privilégio e enviar campos desconhecidos.

### [ALTO][RESOLVIDO] Rotação concorrente de refresh token

`urban-ai-backend-main/src/auth/auth.service.ts` usa transação e atualização condicional do token ainda não revogado. Reuso ou perda da corrida revoga a família. O spec inclui concorrência e replay.

### [ALTO][RESOLVIDO] Mutação cross-tenant de propriedade

O controller repassa `req.user.userId`; `urban-ai-backend-main/src/propriedade/propriedade.service.ts` resolve o listing Airbnb pelo owner antes de quota ou chamada ao provider. O teste comprova rejeição do segundo tenant e persistência somente para o owner.

### [ALTO][RESOLVIDO] SSRF no resolvedor Airbnb

`urban-ai-backend-main/src/connect/safe-airbnb-url-resolver.ts` exige HTTPS e host allowlisted, valida DNS/IP e cada redirect, bloqueia redes privadas e limita saltos, duração e corpo. O recorte possui 25/25 testes.

### [ALTO][RESOLVIDO] SSRF no Web Push

O cadastro e cada envio revalidam HTTPS, DNS e todos os IPs; redes privadas/metadata, DNS misto, IPv4/IPv6 especiais e 3xx são bloqueados. O gate preserva FCM, Mozilla e Apple e possui 29 testes. Pinning integral exigiria trocar o transporte nativo e permanece risco residual documentado.

### [ALTO][RESOLVIDO LOCALMENTE] Enumeração e código de e-mail

Endpoints públicos respondem de forma indistinguível; status é JWT/owner-scoped; o código usa `crypto.randomInt` e somente HMAC versionado é persistido. Expiração, tentativas e lockout por conta/finalidade têm migration reversível e compatibilidade one-time com legado.

### [ALTO][RESOLVIDO] Secrets parciais em logs

`src/airbnb/airbnb.service.ts` e `src/connect/connect.service.ts` registram apenas presença de configuração; nenhum prefixo/sufixo da chave é emitido.

### [ATENÇÃO][RESOLVIDO LOCALMENTE] Frontend, a11y e layout

Contraste do accent, live regions e loading contextual, foco inicial/trap/retorno, touch 44 px, footer/bottom-nav, cookie banner, fallback de imagens, tema e responsividade foram corrigidos. A suíte final fecha 97/97 cenários, incluindo público, host, admin, desktop/mobile, teclado, Axe e headers defensivos.

### [ATENÇÃO][RESOLVIDO] Validação runtime dos comandos

O gate AST canônico comprova 61/61 `@Body` em 36 controllers com classe DTO runtime. Inline, `any`, interface e array raw são rejeitados; multipart só passa quando o body usa classe validada. O audit faz parte do package e da CI.

### [OTIMIZAÇÃO][CONTROLADA] Adoção do design system

Um baseline por arquivo impede aumento ou deslocamento de 441 cores cruas, 3.109 estilos inline e 43 breakpoints não canônicos; arquivo novo nasce com budget zero e redução exige justificativa. Self-test 6/6 e catálogo estático de 12 componentes passam no CI.

### [ATENÇÃO][RESOLVIDO NO CI] Gates incompletos

`.github/workflows/ci.yml` agora inclui audit/lint/cobertura certificada no backend; audit/lint/unit no frontend; Ruff/format/mypy Python; cron estrito; e toda a suíte Chromium local determinística. O workflow foi parseado localmente; a prova remota deve ocorrer no mesmo SHA após publicação.

## Issue tracking — tickets que continuam abertos

| Prioridade | Ticket | Ação sem ambiguidade | Aceite | Esforço/owner |
|---|---|---|---|---|
| P0 externo | SEC-01/02 | Inventariar as 11 referências históricas com acesso restrito, rotacionar credenciais/sessões, coordenar rewrite de refs/forks/caches e registrar decisão LGPD/ANPD | `git rev-list --objects --all` sem blobs; scan remoto, rotação e ata anexados | G · Founder/Sec/Jurídico |
| P0 externo | OPS-01/03/04/05 | Autenticar Railway/Cloudflare, configurar readiness secret, DNS `api/status/staging/staging-api`, CORS e monitor | `/health` autenticado 200 em produção/staging; DNS e status públicos; smoke ponta a ponta | M · Owner/DevOps |
| P1 externo | DR/PROVIDERS | Executar restore real, MySQL/Redis multi-réplica, Stripe Test Clock e sandbox Stays/Airbnb/Maps | RPO/RTO medidos; webhooks/retries/rollback/idempotência com artefatos | G · DevOps/Backend |
| P1 externo | DATA/BETA | Versionar dataset real, backtest por coorte, shadow/drift e estudo com 5–10 hosts | outcomes ≥80%, sucesso ≥95%, SUS ≥80 e dois ciclos sem P0/P1 | G · Produto/Data |
| P2 externo | CSP | Coletar violações do `Content-Security-Policy-Report-Only` e gerar política por nonce/hash | enforcement sem quebrar Stripe, mapas ou Sentry | M · Frontend/Sec |
| P2 externo | MATRIX | Executar Firefox/WebKit, dispositivos reais, zoom 200%, leitor de tela, install/push e visual baselines | matriz aprovada e anexada ao release | M · QA/Design |
| P2 externo | SEC-DEPS-PY | Acompanhar release/substituição do Scrapyd 1.6 incompatível com setuptools corrigido | `pip-audit` zerado sem quebrar runtime | M · Data/Sec |

## Decisão de release

- **Código local para continuação técnica:** GO.
- **Publicação da branch para CI/PR:** GO após revisão do diff e commit intencional.
- **Certificação 10/10/produção plena:** NO-GO.
- **Motivo do NO-GO:** os critérios externos acima não possuem evidência executada; nota não sobe por inferência.

## Saída estruturada

```yaml
report: "Release candidate local verde, com 896 testes backend, cobertura crítica >=90% e 97/97 E2E; certificação 10/10 permanece NO-GO por bloqueios externos e tickets locais explicitados."
issues:
  - item: "SEC-01/02: histórico sensível, rotação e decisão LGPD/ANPD"
  - item: "OPS: readiness, Railway, DNS, status e staging"
  - item: "DR/PROVIDERS, DATA/BETA, CSP e matriz real de browsers/dispositivos"
```
