# Runbook - Integracoes, outcomes e calibracao

Data: 2026-05-26
Escopo: staging e ambientes controlados. Nao tocar em producao neste fluxo.

Este runbook consolida a frente que falta para levar o roadmap de
integracoes/outcomes/calibracao de "tecnicamente pronto" para "validado com
dados reais/sandbox". O objetivo pratico e subir o roadmap total para
aproximadamente 92-95%, sem inventar credenciais, sem expor segredos e sem
misturar staging com producao.

## Estado atual

| Frente | Status |
|---|---|
| Staging front/backend | Pronto tecnicamente; URLs de staging ja existem. |
| Gates publicos de CI | Prontos. |
| Gates autenticados | Bloqueados ate configurar usuarios/JWTs/secrets de staging. |
| Google Maps/Geocoding | Variavel existe no backend; falta chave real de staging e smoke. |
| Gemini | Dependencia e variavel existem; falta chave real de staging e smoke dedicado/indireto. |
| Stays sandbox | Codigo/runbooks existem; falta `STAYS_API_BASE_URL`, chave de criptografia e conta sandbox/assistida. |
| Brevo | Runbook existe; falta chave/remetente validado em staging. |
| Stripe test | Codigo/runbook/preflight existem; falta matriz completa de chaves/Price IDs test. |
| Outcomes de reserva/preco/ocupacao | Entidades, endpoints e relatorio existem; falta amostra real/sandbox em volume. |
| Calibracao da absorcao de preco | Script existe e roda em dry-run; falta dataset de outcomes para ficar `ready`. |

## Regra de seguranca

- Usar somente staging, sandbox ou fixture anonima.
- Nunca colar valores de secrets em docs, issues, chat ou evidencia.
- Manter `DB_SYNCHRONIZE=false` em staging/prod.
- Manter `STAYS_AUTO_APPLY_DRY_RUN=true` ate smoke aprovado com allowlist.
- Qualquer push real de preco exige aprovacao humana, allowlist de usuario/listing e rollback testado.
- Producao so entra depois de evidencia de staging e decisao explicita separada.

## Sequencia recomendada para 92-95%

1. **Baseline de readiness**
   - Rodar `node scripts/enterprise-access-readiness.js`.
   - Rodar `cd urban-ai-backend-main` e `npm run preflight:track3:strict` com env de staging.
   - Rodar o live gate read-only contra staging.
   - Resultado esperado: URLs e saude OK; auth/integ bloqueiam apenas por secrets ausentes.

2. **Secrets e contas de staging**
   - Criar/confirmar usuario admin staging e usuario host staging.
   - Configurar GitHub Secrets: `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`, `E2E_HOST_EMAIL`, `E2E_HOST_PASSWORD` ou JWTs equivalentes `ENTERPRISE_GATE_ADMIN_JWT` e `ENTERPRISE_GATE_HOST_JWT`.
   - Configurar Railway staging com chaves sandbox/test apenas.
   - Resultado esperado: authenticated smoke e enterprise read-only deixam de ficar skipped.

3. **Smokes por integracao**
   - Google: dry-run geocoder, depois `LIMIT=5` em staging.
   - Gemini: recompute/enrichment controlado em um evento/listing de staging.
   - Brevo: reset de senha para caixa de teste.
   - Stripe: preflight, checkout test mode, webhook replay e quota.
   - Stays: connect, sync, push manual sandbox, rollback, auto-apply apenas em dry-run.

4. **Loop de outcomes**
   - Registrar recomendacao aceita/rejeitada.
   - Registrar preco aplicado, reserva/nao-reserva, noites, receita e ocupacao.
   - Rodar snapshot de dataset.
   - Confirmar `/admin/dataset/diagnostics`, `/admin/occupancy/coverage`, `/admin/roi` e relatorio de calibracao.

5. **Calibracao**
   - Gerar relatorio com fixture ou DB staging read-only.
   - Meta minima atual do codigo: 60 linhas de treino, 20 por bucket de cenario e 20 por bucket de confidence.
   - So plugar calibracao automatica em recompute quando o relatorio estiver `ready`.

## Matriz de env vars e secrets

| Bloco | Variaveis | Onde configurar | Smoke minimo | Criterio de aceite |
|---|---|---|---|---|
| Google Maps/Geocoding | `GOOGLE_MAPS_API_KEY`; opcional legado `MAPBOX_TOKEN` | Railway backend staging | `npm run backfill:geocoder:dry`, depois `LIMIT=5 npm run backfill:geocoder` | Coordenadas preenchidas, sem `REQUEST_DENIED`, custo controlado. |
| Gemini | `GEMINI_API_KEY` | Railway backend staging e webscraping se coletor usar Gemini | Recompute/enrichment de um evento controlado; revisar logs sem segredo | Evento/listing enriquecido ou erro acionavel, sem fallback silencioso. |
| Stays sandbox | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, `STAYS_AUTO_APPLY_*` | Railway backend staging | `docs/runbooks/stays-beta-private-smoke.md` | Token criptografado, sync, push manual sandbox, rollback e auto dry-run aprovados. |
| Brevo | `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME`, `RESET_PASS_URL`, recomendado `FRONT_URL` | Railway backend staging | `docs/runbooks/brevo-transactional-smoke.md` | Reset chega na caixa de teste, link aponta para staging/app correto, DKIM/SPF ok. |
| Stripe test | `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `*_PRICE_*`, `SUCCESS_URL`, `CANCEL_URL` | Backend e frontend Railway staging; GitHub vars/secrets se usado no CI | `npm run preflight:track3:strict` e `docs/runbooks/stripe-billing-smoke.md` | Chaves todas test ou todas live conforme ambiente; em staging usar test; checkout, webhook, quota e cancelamento OK. |
| Auth gates | `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`, `E2E_HOST_EMAIL`, `E2E_HOST_PASSWORD`, `ENTERPRISE_GATE_ADMIN_JWT`, `ENTERPRISE_GATE_HOST_JWT` | GitHub Secrets e/ou sessao local segura | Release gate authenticated smoke e enterprise read-only | Checks autenticados deixam de ser skipped. |
| Events ingest | `ENTERPRISE_GATE_EVENTS_INGEST_KEY` ou `EVENTS_INGEST_API_KEY` | GitHub Secrets/Railway staging | Enterprise gate com `--allow-mutations` apenas em staging | Evento controlado ingestado, dedup/geocode/intelligence sem duplicacao. |
| Outcomes/calibracao | Sem secret novo obrigatorio; depende de DB staging e auth admin/host | DB staging e fluxo de produto | `pricing-outcome-calibration-report.ts --dry-run`, depois fixture/DB staging | `PricingDecisionSnapshot` contem outcome; relatorio atinge criterios minimos. |
| Alertas ops | `SENTRY_DSN`, `ADMIN_ALERT_EMAIL`, owners LGPD/suporte | Railway/GitHub conforme ambiente | Preflight + incidente simulado sem dado sensivel | Erros e dono operacional visiveis antes de beta pago. |

## Smokes e dry-runs existentes

| Area | Comando/procedimento | Status |
|---|---|---|
| Readiness geral | `node scripts/enterprise-access-readiness.js --output docs/evidence/enterprise-access-readiness.md` | Existe; presence-only, nao imprime secrets. |
| Live gate staging | `node scripts/enterprise-auditability-live-gate.js --env=staging --strict --skip-events-ingest --output docs/evidence/enterprise-live-gate-staging.md` | Existe; mutacoes desligadas por padrao. |
| Track 3 preflight | `cd urban-ai-backend-main` + `npm run preflight:track3:strict` | Existe; bloqueia secrets/chaves faltantes. |
| Geocoder | `npm run backfill:geocoder:dry`; real controlado com `LIMIT=5` | Existe. |
| Stripe | `docs/runbooks/stripe-billing-smoke.md` | Existe; exige Dashboard Stripe test. |
| Brevo | `docs/runbooks/brevo-transactional-smoke.md` | Existe; manual assistido. |
| Stays | `docs/runbooks/stays-beta-private-smoke.md` | Existe; sandbox/assistido. |
| Dataset/outcomes | `docs/runbooks/dataset-ground-truth-smoke.md` | Existe; exige recomendacao e preco aplicado. |
| Calibracao | `ts-node -r tsconfig-paths/register scripts/pricing-outcome-calibration-report.ts --dry-run` | Existe; dry-run sem DB por padrao. |

## Gaps reais de smoke

| Gap | Impacto | Recomendacao |
|---|---|---|
| Smoke dedicado de Gemini | Enrichment pode estar configurado mas nao exercitado isoladamente. | Adicionar health/smoke leve que chama modelo com prompt inofensivo ou usar recompute de evento fixture em staging. |
| Import automatico de reservas Stays | Outcomes ainda dependem de registro manual ou dados parciais. | Depois do sandbox, mapear endpoint de reservations/calendar da Stays e gravar `occupancy_history`. |
| Authenticated E2E admin/host | Produto pode estar pronto, mas CI ainda pula telas protegidas. | Criar usuarios staging e configurar secrets/JWTs. |
| Calibracao com volume | Script existe, mas amostra real ainda nao fecha criterios. | Rodar 7 dias de beta assistido com captura diaria de outcomes. |

## Como registrar outcomes

Usar a mesma decisao de pricing para lifecycle inteiro:

- `PricingDecisionSnapshot` nasce com cenario, probabilidade, multiplicador e risco.
- Aceite/rejeicao do host atualiza a decisao, nao cria outra decisao paralela.
- Preco aplicado preenche `appliedPriceCents` e vincula `PriceUpdate`, quando houver.
- Reserva/nao-reserva entra em `inputSignals.outcome` com status, receita, noites e fonte.
- Ocupacao diaria entra em `occupancy_history` via Stays, importacao ou `POST /admin/occupancy/manual`.
- Snapshot de dataset transforma isso em serie temporal para ROI e treino.

Campos minimos por recomendacao:

| Campo | Origem esperada |
|---|---|
| Imovel/listing | Urban AI property + Stays listing quando mapeado. |
| Evento/cidade/janela | Event intelligence snapshot. |
| Preco base/recomendado/aplicado | Pricing decision + PriceUpdate/manual. |
| Probabilidade prevista | `bookingProbability` da decisao. |
| Multiplicador/cenario | `recommendedMultiplier` e selected scenario. |
| Decisao do host | accepted/rejected/expired/superseded. |
| Resultado | booked/not_booked/blocked/cancelled/unknown. |
| Receita/noites | Stays, registro manual ou outro ground truth auditavel. |
| Fonte e timestamp | `source`, `recordedAt`, operador quando manual. |

## Evidencia esperada por etapa

Criar um arquivo em `docs/evidence/` para cada smoke relevante com:

- data/hora e ambiente;
- branch/SHA quando aplicavel;
- comando ou procedimento;
- variaveis presentes/ausentes sem valores;
- resultado observado;
- pendencias e risco residual;
- decisao: aprovado, bloqueado ou repetir.

## Definition of done para 92-95%

- Staging front/backend green.
- Release gate publico green.
- Authenticated smoke admin/host green ou com skip justificado por decisao humana temporaria.
- Enterprise gate read-only green.
- Google, Brevo, Stripe test, Gemini e Stays sandbox com evidencia em `docs/evidence/`.
- Pelo menos 1 fluxo completo de recomendacao -> aceite/rejeicao -> preco aplicado -> outcome -> snapshot.
- Relatorio de calibracao gerado em dry-run e tambem contra fixture/DB staging read-only.
- Gaps restantes documentados como volume de dados/calibracao, nao como ausencia de infraestrutura.

## Depois de 92-95%

Para buscar 100% real, falta maturidade de dados:

- 7 dias consecutivos de snapshots e ocupacao.
- Amostra minima de outcomes por cidade/tipo de evento/cenario.
- Primeiros beta testers com Stays ou registro manual confiavel.
- Recalibracao revisada por humano antes de mexer no motor automatico.
- Runbook de rollback exercitado para qualquer preco enviado ao canal.
