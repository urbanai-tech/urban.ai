#!/usr/bin/env bash
# Roda localmente as mesmas verificacoes do CI (.github/workflows/ci.yml),
# em sequencia, e imprime `nome=codigo` por etapa com um resumo no final.
# Sai com codigo diferente de zero se qualquer etapa falhar.
#
# Uso:
#   scripts/validate-local.sh [--root] [--backend] [--front] [--webscraping] [--pipeline] [--all]
#
# Sem flags equivale a --all. As flags se combinam (ex.: --backend --front).
# Roda em Git Bash (Windows) e Linux. Requer node 20+ e npm; para os servicos
# Python, `uv` (ou `python -m uv`).
#
# Nao cobre o que depende de infraestrutura externa: servico MySQL do job
# backend-migrations (use `docker compose up`, que ja roda as migrations),
# E2E Playwright, product-audit/smoke contra staging e o scan do Gitleaks.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RUN_ROOT=0 RUN_BACKEND=0 RUN_FRONT=0 RUN_WEBSCRAPING=0 RUN_PIPELINE=0
if [ "$#" -eq 0 ]; then set -- --all; fi
for arg in "$@"; do
  case "$arg" in
    --root) RUN_ROOT=1 ;;
    --backend) RUN_BACKEND=1 ;;
    --front) RUN_FRONT=1 ;;
    --webscraping) RUN_WEBSCRAPING=1 ;;
    --pipeline) RUN_PIPELINE=1 ;;
    --all) RUN_ROOT=1 RUN_BACKEND=1 RUN_FRONT=1 RUN_WEBSCRAPING=1 RUN_PIPELINE=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Flag desconhecida: $arg (use --root, --backend, --front, --webscraping, --pipeline, --all)" >&2; exit 2 ;;
  esac
done

NAMES=()
CODES=()

# step <nome> <diretorio relativo a raiz> <comando...>
step() {
  local name="$1" dir="$2"
  shift 2
  echo
  echo "==> $name  ($dir)"
  ( cd "$REPO_ROOT/$dir" && "$@" )
  local code=$?
  echo "$name=$code"
  NAMES+=("$name")
  CODES+=("$code")
}

# Escolhe como invocar o uv.
UV=()
if command -v uv >/dev/null 2>&1; then
  UV=(uv)
elif command -v python >/dev/null 2>&1 && python -m uv --version >/dev/null 2>&1; then
  UV=(python -m uv)
elif command -v python3 >/dev/null 2>&1 && python3 -m uv --version >/dev/null 2>&1; then
  UV=(python3 -m uv)
fi

skip_python() {
  local name="$1"
  echo
  echo "==> $name  (uv nao encontrado; instale com 'pip install uv')"
  echo "$name=127"
  NAMES+=("$name")
  CODES+=(127)
}

# ---------------------------------------------------------------- raiz
if [ "$RUN_ROOT" -eq 1 ]; then
  step root:security-head-self-test . node scripts/security-head-scan.js --self-test
  step root:security-head . node scripts/security-head-scan.js
  step root:docs-links . node scripts/audit-document-links.js
  step root:public-scope-self-test . npm run gate:public-scope:self-test
  step root:public-scope . npm run gate:public-scope
  step root:slo-probe-self-test . node scripts/slo-probe.js --self-test
  step root:resilience-dr-self-test . npm run audit:resilience-dr:self-test
  step root:resilience-dr . npm run audit:resilience-dr
  step root:knn-legacy-self-test . npm run audit:knn-legacy:self-test
  step root:knn-legacy . npm run audit:knn-legacy
  step root:npm-ci . npm ci
  step root:npm-audit . npm audit --omit=dev --audit-level=high
  step root:release-evidence-dry . node scripts/release-evidence.js --dry-run
  step root:enterprise-gate-dry . node scripts/enterprise-auditability-live-gate.js --dry-run
fi

# ------------------------------------------------------------- backend
if [ "$RUN_BACKEND" -eq 1 ]; then
  B=urban-ai-backend-main
  step backend:npm-ci $B npm ci
  step backend:npm-audit $B npm audit --omit=dev --audit-level=moderate
  step backend:lint $B npm run lint
  step backend:tsc $B npx tsc --noEmit
  step backend:body-dtos $B npm run audit:body-dtos
  step backend:jest $B npx jest --passWithNoTests --ci --silent
  step backend:contract-openapi $B npm run contract:openapi -- --silent
  step backend:coverage-certified $B npm run test:coverage:certified
  step backend:lgpd-self-test $B npm run audit:lgpd:self-test
  step backend:lgpd $B npm run audit:lgpd
  step backend:observability-self-test $B npm run audit:observability:self-test
  step backend:observability $B npm run audit:observability
  step backend:authorization-self-test $B npm run audit:authorization:self-test
  step backend:authorization $B npm run audit:authorization
  step backend:cron-self-test $B npm run audit:cron:self-test
  step backend:cron-strict $B npm run audit:cron:strict
  step backend:migrations-strict $B npm run audit:migrations:strict
  step backend:backup-dry $B npm run backup:mysql:dry
  step backend:backup-self-test $B npm run backup:mysql:self-test
  step backend:restore-verify-self-test $B npm run restore:verify:self-test
  step backend:nest-build $B npx nest build
  step backend:dist-main $B test -f dist/main.js
fi

# ------------------------------------------------------------ frontend
if [ "$RUN_FRONT" -eq 1 ]; then
  F=Urban-front-main
  step front:npm-ci $F npm ci --legacy-peer-deps
  step front:npm-audit $F npm audit --omit=dev --audit-level=moderate
  step front:lint $F npm run lint
  step front:test-unit $F npm run test:unit
  step front:design-debt-self-test $F npm run design:debt:self-test
  step front:design-audit $F npm run design:audit
  step front:tsc $F npx tsc --noEmit
  step front:build $F env \
    NEXT_PUBLIC_API_URL=http://localhost:10000 \
    NEXT_PUBLIC_APP_URL=http://localhost:3000 \
    NEXT_PUBLIC_MARKETING_URL=http://localhost:3000 \
    NEXTAUTH_URL=http://localhost:3000 \
    NEXTAUTH_SECRET=ci_dummy_secret_not_for_prod \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci_dummy \
    npm run build
fi

# --------------------------------------------------------- webscraping
if [ "$RUN_WEBSCRAPING" -eq 1 ]; then
  W=urban-webscraping-main
  if [ "${#UV[@]}" -eq 0 ]; then
    skip_python webscraping:uv-sync
  else
    step webscraping:uv-sync $W "${UV[@]}" sync --all-groups --frozen
    step webscraping:ruff-check $W "${UV[@]}" run ruff check urban_webscrapping tests auth_proxy.py
    step webscraping:ruff-format $W "${UV[@]}" run ruff format --check urban_webscrapping tests auth_proxy.py
    step webscraping:mypy $W "${UV[@]}" run mypy urban_webscrapping auth_proxy.py
    step webscraping:pytest $W "${UV[@]}" run pytest -q
  fi
fi

# ------------------------------------------------------------ pipeline
if [ "$RUN_PIPELINE" -eq 1 ]; then
  P=urban-pipeline-main
  if [ "${#UV[@]}" -eq 0 ]; then
    skip_python pipeline:uv-sync
  else
    step pipeline:uv-sync $P "${UV[@]}" sync --all-groups --frozen
    step pipeline:lint $P "${UV[@]}" run poe lint
    step pipeline:pytest $P "${UV[@]}" run pytest tests -q
  fi
fi

# -------------------------------------------------------------- resumo
echo
echo "==================== RESUMO ===================="
FAILED=0
for i in "${!NAMES[@]}"; do
  echo "${NAMES[$i]}=${CODES[$i]}"
  if [ "${CODES[$i]}" -ne 0 ]; then FAILED=$((FAILED + 1)); fi
done
echo "------------------------------------------------"
echo "total=${#NAMES[@]} falhas=$FAILED"
if [ "$FAILED" -ne 0 ]; then
  echo "RESULTADO: FALHOU"
  exit 1
fi
echo "RESULTADO: OK"
