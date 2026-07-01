# Backlog Para 100% Operacional

Data base: 2026-07-01.

Este backlog separa codigo, operacao, integracoes, dados, legal e repositorio.

## P0 - Antes de Passar Para Outro Dev Trabalhar Com Confianca

| Item | Status | Como fechar |
|---|---|---|
| Liberar espaco em disco local | Bloqueado | Deixar 5 a 10 GB livres antes de build/teste. |
| Frontend build | Bloqueado por `ENOSPC` | Rerodar `npm --prefix Urban-front-main run build` apos liberar espaco. |
| Backend tests | Falhando | Corrigir specs listadas em `VALIDATION-CHECKLIST.md`. |
| Backend dependency audit | Aberto | Tratar 1 critical e 13 high sem `--force` cego. |
| Gate admin/host autenticado | Pendente | Criar/renovar JWTs ou usuarios E2E e setar secrets. |
| Restore drill | Pendente | Definir `RESTORE_DATABASE_URL` nao-producao e rodar verifier. |
| Staging DNS | Pendente | Aplicar registros Cloudflare de staging. |
| Stays sandbox | Pendente | Obter `STAYS_API_BASE_URL`, conta sandbox/assistida, dry-run e allowlists. |
| Working tree | Aberto | Separar commit docs/handoff de fixes tecnicos. |

## P1 - Go-live Assistido

| Item | Status | Como fechar |
|---|---|---|
| Stripe smoke completo | Pendente | Checkout, webhook, portal, cancelamento e quota em test mode. |
| Google Geocoding | Pendente historico | Ativar Geocoding API/billing/restricoes server-side; rodar backfill dry-run. |
| Brevo e e-mail transacional | Pendente validacao real | DKIM/SPF e reset de senha entregue em caixa de teste. |
| CORS production/staging | Pendente em preflight local | Configurar `CORS_ALLOWED_ORIGINS` por ambiente. |
| Sentry | Pendente local | Configurar DSNs separados por ambiente. |
| Owners suporte/LGPD | Pendente | Definir `SUPPORT_OWNER_EMAIL` e `PRIVACY_OWNER_EMAIL`. |
| Branch protection | Pendente historico | Exigir PR + CI em `main`. |
| GitHub secrets/vars E2E | Pendente | Configurar `E2E_BASE_URL`, `E2E_API_URL`, credenciais e flags. |

## P2 - Go-live Publico

| Item | Status | Como fechar |
|---|---|---|
| 7 dias de dados reais | Pendente | Coletar dados e calcular MAPE inicial. |
| 3 cases auditados | Pendente | Fonte, periodo, amostra, consentimento e revisao. |
| LGPD final | Pendente | Termos, privacidade, DPO, consentimento, DPAs. |
| Backup off-site + restore real | Pendente | Backup em S3/B2 e restore drill documentado. |
| Naming/rebrand | Pendente decisao | Escolher nome antes de dominio definitivo e materiais. |
| KNN legado | Aberto | Arquivar/remover `urban-ai-knn-main/` quando time concordar. |

## Fixes Tecnicos Candidatos

- Remover API key publica do Airbnb hardcoded para env por consistencia.
- Ativar `forbidNonWhitelisted: true` em producao, com rollout cuidadoso.
- Throttle adicional em rotas admin/scraping.
- Expandir testes de `propriedades/` e pricing.
- Fechar mocks/fallbacks contratuais do Event Radar quando backend real tiver cobertura suficiente.
