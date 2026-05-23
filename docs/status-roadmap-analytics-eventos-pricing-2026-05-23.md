# Status do roadmap analytics, eventos e pricing

Data: 2026-05-23
Rodada: consolidacao de release e integracoes

## Leitura executiva

O roadmap tecnico esta em 97%. A parte de produto e codigo local esta bem
avancada: frontend compila, builda e responde nas rotas criticas; backend
compila; deduplicacao, communications e webscraping tem testes focados e suite
oficial verdes.

A diferenca para 100% nao e mais falta de tela ou contrato solto. O que resta
e principalmente operacional: staging autenticado/read-only, chaves de
fornecedores, migrations/backfill em banco real, Stays em beta assistido e
outcomes reais para calibrar absorcao de preco.

## Percentuais atuais

| Frente | Percentual | Status |
|---|---:|---|
| Roadmap tecnico consolidado | 97% | Builds, typechecks e suites locais passaram; falta staging real |
| Frontend analytics/radar/eventos | 91% | `tsc` e `next build` verdes, 74 rotas geradas |
| Backend dedup/admin | 88% | `tsc`, Nest build e Jest completo verdes; falta DB/migration staging |
| Communications/digests/preferences | 88% | PII mascarada em admin logs e opt-out rechecado antes do flush; falta retencao/purge formal |
| Webscraping ingest providers | 78% codigo / 74% ops | Client Python alinhado com `x-urban-events-ingest-key`; suite oficial verde |
| Providers/pricing intelligence | 78% | Gargalo em Google, Stays, RapidAPI/quota e outcomes reais |
| Ops/release gate no repo | 80% | Runbooks/travas atualizados; enterprise gate dry-run verde |
| QA release remoto | 72% atual / 85-88% com staging | Nao acionar gate final enquanto vars/secrets nao apontarem para staging |
| Workspace/empacotamento | 85% | Branch limpa criada a partir de `main`; artefatos locais deixados fora |

## Evidencias desta rodada

- Frontend `tsc --noEmit`: passou.
- Frontend `next build`: passou, gerou 74/74 rotas e incluiu `/admin/events/dedup`.
- Backend `tsc --noEmit`: passou.
- Backend Nest build: passou.
- Backend Jest completo: 50 suites, 336 testes verdes.
- Webscraping suite oficial `tests/`: 95 testes verdes.
- Enterprise live gate dry-run: passou, com checks planejados/skips seguros e sem imprimir segredos.
- `git diff --check`: sem erros; apenas avisos de CRLF no Windows.

## Mudancas consolidadas

- Webscraping: `UrbanBackendClient` passa a preferir `URBAN_EVENTS_INGEST_API_KEY` e enviar `x-urban-events-ingest-key`, mantendo fallback legado por JWT.
- Webscraping: `.env.example` documenta `URBAN_EVENTS_INGEST_API_KEY`, `URBAN_COLLECTOR_NAME`, `URBAN_COLLECTOR_VERSION` e `URBAN_INGEST_RUN_ID`.
- Backend communications: retornos admin mascaram email, device/provider id, metadata sensivel e tokens em erro.
- Backend communications: specs cobrem redaction de PII em respostas admin.
- Backend pricing digest: opt-out de email/push e revalidado imediatamente antes do flush do digest.
- Backend dataset collector: fixture atualizado para exigir fonte confiavel de preco base, alinhado ao guard de `pricingInputSource`.
- Backend event intelligence e paineis: consultas ignoram eventos duplicados e redirecionam detalhe para canonico quando possivel.
- Backend KNN: arquivos JS legados removidos em favor das implementacoes TypeScript rastreadas.
- Ops: `.env.staging` e `.env.staging.local` ignorados no Git.
- Ops: `release-gate.md` exige enterprise live gate read-only em staging.
- Ops: `staging-release-drill.md` registra comandos obrigatorios do gate enterprise.

## O que ainda impede 100%

1. Staging isolado no Railway com frontend, backend, pipeline e DB staging.
2. Vars/secrets de staging para `release-gate.yml`, sem fallback para producao.
3. Google Geocoding/Routes corrigido: API habilitada, billing e restricoes server-side.
4. Webscraping em producao/staging usando `URBAN_EVENTS_INGEST_API_KEY`.
5. Migrations dedup/communications aplicadas em DB staging e backfill em dry-run.
6. Stays em beta assistido com sandbox, allowlist, dry-run, push manual e rollback.
7. Outcomes reais de preco/reserva/ocupacao para calibrar probabilidade de absorcao.
8. Evidencia final do enterprise gate contra staging real, com URLs/JWT/ingest key de staging.

## Empacotamento recomendado

| Pacote | Prontidao | Observacao |
|---|---:|---|
| Dedup/admin | 88% backend / 91% frontend relacionado | Pronto para PR com migrations e runbook ja no `main` |
| Communications | 80% | PR separado por sensibilidade de dados e retencao |
| Providers/webscraping ingest | 82% | PR pequeno e de alto ROI para alinhar coletores ao backend |
| Ops/staging docs | 80% | Pode entrar como hardening de release sem segredo |

## Proxima ordem de execucao

1. Subir branch limpa para `origin` e `urbanai-tech`.
2. Abrir PR/draft com evidencia de typecheck, build, Jest e pytest.
3. Configurar staging read-only/auth no Railway e GitHub Actions.
4. Rodar `release-gate.yml` manual contra staging e salvar artifact.
5. Corrigir Google Geocoding/Routes e rodar backfill limitado.
6. Rodar migrations/backfill dedup em staging.
7. Ativar ingestao webscraping via service account.
8. Rodar beta assistido Stays e comecar coleta de outcomes.
