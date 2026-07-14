# Opensquad Local Readiness - 2026-05-27

Data: 2026-05-27
Escopo: higiene local do Opensquad, estrutura de equipes e gates sem segredos.

## Resultado

Status: **aprovado localmente**.

O Opensquad esta configurado para operar as equipes existentes em modo local/assistido. Os bloqueios remanescentes estao ligados a ambiente real, staging, contas externas e segredos.

## Ajustes feitos

| Area | Resultado |
|---|---|
| Skills locais | Criadas `read_files`, `run_command` e `mcp_railway` como wrappers nativos/operacionais. |
| Marketing agency | Corrigido typo `blottato` para `blotato`. |
| `squad-party.csv` | Padronizados `event-demand-pricing-radar`, `qa-security-auditors` e `roadmap-manager` para `id,name,role,path`. |
| Check permanente | Adicionado `scripts/opensquad-readiness-check.js`. |
| Script NPM | Adicionado `opensquad:check` ao `package.json`. |
| Gate env-file | Ajustado parser dos gates para aceitar `--env-file .env.staging`, como o help ja prometia. |
| Template staging | Criado `.env.staging.example` sem valores sensiveis. |

## Validacoes executadas

| Check | Resultado |
|---|---|
| `node scripts/opensquad-readiness-check.js` | Passou. |
| Backend `tsc --noEmit` | Passou. |
| Frontend `tsc --noEmit` | Passou. |
| Dashboard `tsc --noEmit` | Passou. |
| Enterprise live gate dry-run | Gerou `docs/evidence/enterprise-live-gate-dry-run-2026-05-27.md`. |
| Enterprise access readiness | Gerou `docs/evidence/enterprise-access-readiness-2026-05-27.md`; exit 1 esperado por secrets/URLs ausentes. |

## Bloqueios que sobraram

| Grupo | Bloqueio |
|---|---|
| Enterprise live gate read-only | Faltam `ENTERPRISE_GATE_BACKEND_URL`, `ENTERPRISE_GATE_FRONTEND_URL`, `ENTERPRISE_GATE_HEALTH_TOKEN` e JWTs controlados. |
| Events ingest controlled smoke | Falta `ENTERPRISE_GATE_EVENTS_INGEST_KEY` e URL de backend staging. |
| Restore drill verifier | Falta `RESTORE_DATABASE_URL`. |
| Stays sandbox/assisted account smoke | Faltam `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY` e flags/allowlists de dry-run. |

## Decisao operacional

O proximo passo nao e construir novas telas. E configurar staging seguro, preencher secrets de teste/sandbox e rodar os gates reais contra ambiente nao-producao.
