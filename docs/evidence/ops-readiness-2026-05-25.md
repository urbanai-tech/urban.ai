# Ops Readiness - 2026-05-25

Data: 2026-05-25
Branch de trabalho: `codex/ops-hygiene-readiness-20260525`
Base: `83ec7df` (`feat: unify property pricing self-service`)

## Executado nesta rodada

- Branch de trabalho criada para organizar higiene/readiness fora da `main`.
- Branch `codex/portfolio-cockpit` removida localmente e dos remotes `origin` e `urbanai-tech` por ja estar mergeada em `main`.
- `.gitignore` atualizado para ignorar caches TypeScript (`*.tsbuildinfo`) e estados vivos de squads (`/squads/*/state.json`).
- `Urban-front-main/tsconfig.tsbuildinfo` removido do indice do Git; o arquivo local passa a ser tratado como cache.
- Evidencia de readiness atual gerada em `docs/evidence/enterprise-access-readiness-2026-05-25.md`.
- Evidencia de enterprise gate dry-run gerada em `docs/evidence/enterprise-live-gate-dry-run-2026-05-25.md`.
- Railway MCP mapeado em modo leitura.

## Validacoes locais executadas

| Area | Comando/forma | Resultado |
|---|---|---|
| Backend TypeScript | `tsc --noEmit` via `typescript@5.9.3` local | passou |
| Backend Nest build | `nest build` via CLI local | passou |
| Frontend TypeScript | `Urban-front-main/node_modules/.bin/tsc.cmd --noEmit` | passou |
| Dashboard TypeScript | `dashboard/node_modules/.bin/tsc.cmd --noEmit` | passou |
| Backend testes focados | `jest` direto nos specs de auth, jwt, admin e propriedades | 4 suites / 37 testes passaram |
| Pipeline pytest | `.venv/Scripts/python.exe -m pytest` | 49 testes passaram |
| Webscraping pytest | `.venv/Scripts/python.exe -m pytest` com permissao escalonada | 95 testes passaram |

Observacao: a primeira tentativa de pytest do webscraping falhou por `PermissionError` ao importar `requests` dentro do `.venv`; ao repetir fora da restricao do sandbox, a suite passou integralmente.

Observacao: o build local do Next.js foi tentado apos limpar caches/build outputs ignorados (`.next`, `dashboard/dist`, `urban-ai-backend-main/dist`), mas falhou por `ENOSPC: no space left on device`. No momento da checagem, o disco `C:` tinha cerca de 1.2 GB livres. O typecheck frontend passou, mas o build completo ainda precisa ser repetido em ambiente com mais espaco ou no CI com logs disponiveis.

## Readiness atual

`enterprise-access-readiness` segue bloqueado em `0/4` grupos prontos:

| Grupo | Status | Bloqueios |
|---|---|---|
| Enterprise live gate read-only | blocked | `ENTERPRISE_GATE_BACKEND_URL`, `ENTERPRISE_GATE_FRONTEND_URL`, JWTs admin/host |
| Events ingest controlled smoke | blocked | `ENTERPRISE_GATE_BACKEND_URL`, `ENTERPRISE_GATE_EVENTS_INGEST_KEY` |
| Restore drill verifier | blocked | `RESTORE_DATABASE_URL` |
| Stays sandbox/assisted account smoke | blocked | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, allowlists/dry-run |

O gate enterprise dry-run funciona e lista os checks planejados sem imprimir segredos.

## Railway observado via MCP

Workspace: `urbanai-tech`.

| Projeto | ID | Ambiente observado | Servico | Status |
|---|---|---|---|---|
| `backend` | `3b2167ce-0a97-4e11-8157-b4e4c25653d8` | production | `urban.ai` | SUCCESS |
| `Front` | `17fbf94b-8436-4443-82c7-7b04bebaada8` | production | `Frontend` | SUCCESS |
| `mysql` | `79c6c23d-4aba-4c8e-962e-2fa34211d7cb` | production | `MySQL` | SUCCESS |
| `urban-pipeline` | `15641068-8b78-4e31-a705-c359702f5744` | production | `urban.ai` | SUCCESS |
| `webscrapping` | `ed2bfe94-dd02-406d-8757-49475b384f25` | production | `urban.ai` | SUCCESS |
| `KnnEngine` | `d8c8630c-6048-450a-a5bd-dd2ff0d348e0` | production | `urban.ai` | SUCCESS |

Nao foi criado staging nesta rodada porque criar/forkar ambientes Railway pode duplicar servicos ou recursos com custo. Decisao recomendada: criar staging isolado com DB separado e variaveis proprias, sem herdar segredo de producao por acidente.

## Branch antiga `codex-assuncao-operacional-railway`

Estado:

- Branch local sem upstream remoto.
- `git cherry` contra `main` mostra 3 commits ainda nao equivalentes e 1 ja equivalente:
  - `32a9187 chore: harden operations for production takeover`
  - `89428d3 fix: stabilize property pricing recommendations`
  - `f06e68a fix: make plan pricing migration defensive`
  - `ece022c fix: resolve waitlist mailer auth module cycle` ja esta equivalente em `main`.
- Diff total: 116 arquivos, 3700 insercoes e 1891 remocoes.

Recomendacao: nao mergear a branch inteira. Extrair cirurgicamente apenas itens ainda validos:

1. Revisar a migration defensiva de planos (`f06e68a`) contra a migration atual de pricing/planos.
2. Comparar estabilizacao de pricing (`89428d3`) com o pricing self-service ja em `main`.
3. Transformar o hardening operacional (`32a9187`) em checklist/issue ou cherry-pick por arquivo, evitando ressuscitar codigo legado.

## Decisoes pendentes

1. Criar staging Railway agora ou aguardar definicao de custo/isolamento.
2. Definir se staging sera projeto separado ou environments dentro dos projetos atuais.
3. Preencher secrets do gate enterprise (`ENTERPRISE_GATE_*`) e JWTs controlados.
4. Criar/confirmar `EVENTS_INGEST_API_KEY` para staging.
5. Corrigir Google Geocoding no Google Cloud e setar `GOOGLE_MAPS_API_KEY`.
6. Obter credenciais Stays sandbox/assistida.
7. Definir `RESTORE_DATABASE_URL` para restore drill.
8. Decidir destino da branch `codex-assuncao-operacional-railway`: extrair itens ou apagar apos revisao.
