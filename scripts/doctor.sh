#!/usr/bin/env bash
# Confere os pre-requisitos para desenvolver neste monorepo ANTES de subir o
# ambiente ou rodar a validacao. Nao altera nada (somente leitura).
#
# Uso:
#   scripts/doctor.sh          # ou: npm run doctor
#
# Imprime OK / AVISO / FALHA por item e sai com codigo 1 se houver FALHA.
# AVISO nao bloqueia. Roda em Git Bash (Windows), Linux e macOS.
# Ver CONTRIBUTING.md, secoes 1 e 2.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILS=0
WARNS=0

ok()   { echo "OK     $1"; }
warn() { echo "AVISO  $1"; WARNS=$((WARNS + 1)); }
fail() { echo "FALHA  $1"; FAILS=$((FAILS + 1)); }
has()  { command -v "$1" >/dev/null 2>&1; }

echo "Urban AI doctor ($REPO_ROOT)"
echo

# ---------------------------------------------------------------- Node / npm
# A versao esperada esta em .nvmrc (a mesma major do CI e dos containers).
# Outras versoes costumam funcionar para lint/jest, mas o `npm ci` e o
# `nest build` do CI sao validados so nessa major.
WANT_MAJOR=20
if [ -f "$REPO_ROOT/.nvmrc" ]; then
  nvmrc_v="$(tr -d '[:space:]vV' < "$REPO_ROOT/.nvmrc")"
  nvmrc_v="${nvmrc_v%%.*}"
  case "$nvmrc_v" in ''|*[!0-9]*) ;; *) WANT_MAJOR="$nvmrc_v" ;; esac
fi
if has node; then
  NODE_V="$(node -v)"
  NODE_MAJOR="${NODE_V#v}"; NODE_MAJOR="${NODE_MAJOR%%.*}"
  if [ "$NODE_MAJOR" -eq "$WANT_MAJOR" ]; then
    ok "node $NODE_V (mesma major do .nvmrc, do CI e dos containers)"
  elif [ "$NODE_MAJOR" -gt "$WANT_MAJOR" ]; then
    warn "node $NODE_V: o .nvmrc (e o CI) fixam o Node $WANT_MAJOR; para um validate-local equivalente ao CI use 'nvm use' / 'fnm use'"
  else
    fail "node $NODE_V: e preciso Node $WANT_MAJOR ou superior (.nvmrc; o CI usa $WANT_MAJOR) - 'nvm use' / 'fnm use'"
  fi
else
  fail "node nao encontrado (necessario para scripts/*.js e para validate-local.sh)"
fi
if has npm; then ok "npm $(npm -v)"; else fail "npm nao encontrado"; fi

# ---------------------------------------------------------------------- git
if has git; then ok "$(git --version)"; else fail "git nao encontrado"; fi
if has git && [ "$(git -C "$REPO_ROOT" config --get core.hooksPath 2>/dev/null)" = ".githooks" ]; then
  ok "hook de pre-push instalado (core.hooksPath=.githooks)"
else
  warn "hook de pre-push nao instalado; rode 'npm run hooks:install' antes de publicar"
fi

# ------------------------------------------------------------------- docker
DOCKER_OK=0
if has docker; then
  if docker info >/dev/null 2>&1; then
    DOCKER_OK=1
    ok "docker em execucao"
  else
    fail "docker instalado, mas o daemon nao responde (abra o Docker Desktop)"
  fi
  if docker compose version >/dev/null 2>&1; then
    ok "$(docker compose version | head -n 1)"
  else
    fail "docker compose v2 nao encontrado (o comando e 'docker compose', sem hifen)"
  fi
else
  fail "docker nao encontrado (necessario para 'docker compose up'; ver CONTRIBUTING.md secao 1)"
fi

# ------------------------------------------------------------------- portas
# As portas padrao do docker-compose.yml; mude-as em .env se estiverem ocupadas.
port_busy() {
  node -e '
    const s = require("net").createServer();
    s.once("error", () => process.exit(1));
    s.once("listening", () => s.close(() => process.exit(0)));
    s.listen(Number(process.argv[1]));
  ' "$1" >/dev/null 2>&1
  [ $? -ne 0 ]
}

if has node; then
  for spec in "MYSQL_HOST_PORT:3306:mysql" "REDIS_HOST_PORT:6379:redis" \
              "BACKEND_HOST_PORT:10000:backend" "FRONT_HOST_PORT:3000:frontend"; do
    var="${spec%%:*}"; rest="${spec#*:}"; port="${rest%%:*}"; name="${rest#*:}"
    # Respeita a sobrescrita em .env da raiz, se existir.
    if [ -f "$REPO_ROOT/.env" ]; then
      override="$(grep -E "^${var}=" "$REPO_ROOT/.env" | tail -n 1 | cut -d= -f2 | tr -d '\r ')"
      [ -n "$override" ] && port="$override"
    fi
    if port_busy "$port"; then
      owner=""
      if [ "$DOCKER_OK" -eq 1 ]; then
        owner="$(docker ps --filter "publish=$port" --format '{{.Names}}' 2>/dev/null | head -n 1)"
      fi
      case "$owner" in
        urban-ai-*) ok "porta $port ($name) em uso pelo proprio ambiente local ($owner)" ;;
        "") warn "porta $port ($name) ocupada por outro processo; libere-a ou mude $var em .env" ;;
        *) warn "porta $port ($name) ocupada pelo container $owner; libere-a ou mude $var em .env" ;;
      esac
    else
      ok "porta $port ($name) livre"
    fi
  done
fi

# ------------------------------------------------------ arquivos de ambiente
if [ -f "$REPO_ROOT/.env" ]; then
  ok ".env da raiz presente (sobrescreve os padroes do docker-compose.yml)"
else
  ok ".env da raiz ausente (normal: o docker-compose.yml tem padroes ficticios)"
fi
if [ -f "$REPO_ROOT/urban-ai-backend-main/.env" ] || [ -f "$REPO_ROOT/Urban-front-main/.env.local" ]; then
  warn "existe .env/.env.local dentro de um servico: so vale para 'npm run start:dev' no host; o Compose ignora esses arquivos"
fi

# --------------------------------------------------------- conflitos de build
# 'nest build' no host grava urban-ai-backend-main/dist, que o backend do
# Compose tambem usa (bind mount). Evite os dois ao mesmo tempo.
if [ "$DOCKER_OK" -eq 1 ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^urban-ai-backend-'; then
  warn "o backend do Compose esta no ar: nao rode 'nest build' nem 'validate-local.sh --backend' no host ate fazer 'docker compose down'"
fi

# ------------------------------------------------------- ferramentas opcionais
if has uv || (has python && python -m uv --version >/dev/null 2>&1) || (has python3 && python3 -m uv --version >/dev/null 2>&1); then
  ok "uv disponivel (validacao de webscraping e pipeline)"
else
  warn "uv nao encontrado: validate-local.sh --webscraping/--pipeline vao falhar (pip install uv)"
fi
if has gitleaks; then
  ok "gitleaks disponivel"
else
  warn "gitleaks nao encontrado: necessario antes de publicar (CONTRIBUTING.md secao 6)"
fi

echo
echo "resumo: falhas=$FAILS avisos=$WARNS"
if [ "$FAILS" -ne 0 ]; then
  echo "RESULTADO: FALHOU"
  exit 1
fi
echo "RESULTADO: OK"
