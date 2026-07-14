# Estado do Repositorio - 2026-07-01

## Remotes

```text
origin       https://github.com/Gustavogm9/urban.ai.git
urbanai-tech https://github.com/urbanai-tech/urban.ai
```

## Branches

| Branch | Estado |
|---|---|
| `main` | `1cca3411 fix: repair copy audit regressions` nos dois remotes. |
| `codex/staging-railway-gates-20260526` | Branch local atual em `46dbde5c`, publicada nos dois remotes. |

## Worktree Temporaria

Existe worktree em:

```text
C:/tmp/urban-ai-main-merge-20260531 [main]
```

Ela foi usada para cherry-pick/merge seguro em maio. Remover apenas se nao houver trabalho pendente nela.

## Alteracoes Locais Observadas

Rastreadas:

- `package.json`: adiciona script `opensquad:check`.
- `scripts/enterprise-access-readiness.js`: aceita `--env-file caminho`.
- `scripts/enterprise-auditability-live-gate.js`: aceita `--env caminho` e `--env-file caminho`.
- CSVs de squads padronizados para `id,name,role,path`.
- ajustes de skill typo `blottato` -> `blotato`.
- memoria do squad de Event Radar com rodada de backfill.

Nao rastreadas:

- `.env.staging.example`
- docs/evidence de 2026-05-27
- `docs/product/`
- `docs/reavaliacao-360-tecnica-proximos-passos-2026-06-21.md`
- `docs/runbooks/staging-handoff-2026-05-27.md`
- `docs/spinoff-plataforma-demanda/`
- `scripts/opensquad-readiness-check.js`
- skills locais: `mcp_railway`, `read_files`, `run_command`
- outputs de squads

## Recomendacao de Commit

1. Commit A: documentacao e handoff.
2. Commit B: ferramentas de readiness/Opensquad.
3. Commit C: evidencias/outputs, se o time quiser versionar.
4. Commit D: fixes tecnicos e testes.

Nao misturar secrets ou `.env.staging`.
